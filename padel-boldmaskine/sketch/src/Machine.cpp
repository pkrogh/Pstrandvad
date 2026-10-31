#include "Machine.h"

#include <stdio.h>

#include "Config.h"

namespace padel {

namespace {
// Maks. antal kommandolinjer pr. loop, så en strøm af kommandoer aldrig kan
// sulte stepperen for opdateringer.
constexpr uint8_t kMaxLinesPerLoop = 4;

bool isPwmValue(float v) { return v >= 0.0f && v <= config::kPwmMax; }
}  // namespace

Machine::Machine(IClock& clock, MotorControl& motors, StepperControl& stepper,
                 Scheduler& scheduler, Safety& safety, Communication& comm)
    : clock_(clock),
      motors_(motors),
      stepper_(stepper),
      scheduler_(scheduler),
      safety_(safety),
      comm_(comm) {}

void Machine::begin() {
  safety_.begin();
  stepper_.begin();
  comm_.send("READY");
}

void Machine::update() {
  const uint32_t nowMs = clock_.millis();

  // 1. Kommandoer fra Linux.
  char line[config::kMaxLineLength];
  for (uint8_t i = 0; i < kMaxLinesPerLoop && comm_.poll(line, sizeof(line)); ++i) {
    handleLine(line, nowMs);
    stepper_.update(clock_.micros(), clock_.millis());  // Hold trinstrømmen i gang
  }

  // 2. Sikkerhed – vurderes før der bevæges noget.
  if (safety_.update(nowMs)) {
    enterSafeState();
    char evt[config::kMaxLineLength];
    snprintf(evt, sizeof(evt), "EVT FAULT=%s", faultName(safety_.fault()));
    comm_.send(evt);
  }

  // 3. Realtidsmoduler.
  stepper_.update(clock_.micros(), nowMs);

  const bool homing = stepper_.state() == StepperControl::State::Homing;
  if (wasHoming_ && !homing) {
    if (stepper_.homingFailed()) {
      safety_.reportHomingFailed();
      enterSafeState();
      comm_.send("EVT FAULT=HOMING_FAILED");
    } else if (stepper_.isHomed()) {
      comm_.send("EVT HOMED");
    }
  }
  wasHoming_ = homing;

  motors_.update(nowMs);

  // 4. Affyringssekvens.
  switch (scheduler_.update(nowMs, readyToFire())) {
    case Scheduler::Event::Fired: comm_.send("EVT FIRED"); break;
    case Scheduler::Event::FireTimeout: comm_.send("EVT FIRE_TIMEOUT"); break;
    case Scheduler::Event::None: break;
  }
}

bool Machine::readyToFire() const {
  return safety_.isMotionAllowed() && motors_.isAtSpeed() && stepper_.isHomed() &&
         !stepper_.isMoving();
}

void Machine::enterSafeState() {
  scheduler_.cancel();
  motors_.emergencyStop();
  stepper_.emergencyStop();
}

void Machine::handleLine(const char* line, uint32_t nowMs) {
  const Command cmd = CommandParser::parse(line);
  if (cmd.type == CommandType::Unknown) {
    sendError("UNKNOWN_COMMAND");
    return;
  }
  safety_.feedComm(nowMs);  // Enhver genkendt kommando beviser at Linux lever

  if (CommandParser::requiresValue(cmd.type) && !cmd.hasValue) {
    sendError("MISSING_VALUE");
    return;
  }
  if (cmd.hasValue && !cmd.valueValid) {
    sendError("BAD_VALUE");
    return;
  }
  handleCommand(cmd, nowMs);
}

void Machine::handleCommand(const Command& cmd, uint32_t nowMs) {
  const bool latched = safety_.isLatched();

  switch (cmd.type) {
    case CommandType::Ping:
      comm_.send("OK");
      return;

    case CommandType::Status:
      sendStatus();
      return;

    case CommandType::GetAngle:
      comm_.sendFixed1("ANGLE=", stepper_.getCurrentAngle());
      return;

    case CommandType::SetSpeed:
    case CommandType::SetLeftPwm:
    case CommandType::SetRightPwm: {
      if (!isPwmValue(cmd.value)) return sendError("RANGE");
      const uint8_t pwm = static_cast<uint8_t>(cmd.value + 0.5f);
      if (cmd.type != CommandType::SetRightPwm) motors_.setLeftSpeed(pwm);
      if (cmd.type != CommandType::SetLeftPwm) motors_.setRightSpeed(pwm);
      comm_.send("OK");
      return;
    }

    case CommandType::SetAngle:
      if (latched) return sendError("FAULT");
      if (stepper_.state() == StepperControl::State::Homing) {
        comm_.send("BUSY");
        return;
      }
      if (!stepper_.isHomed()) return sendError("NOT_HOMED");
      if (!stepper_.moveToAngle(cmd.value)) return sendError("RANGE");
      comm_.send("OK");
      return;

    case CommandType::Home:
      if (latched) return sendError("FAULT");
      if (scheduler_.isBusy()) {
        comm_.send("BUSY");
        return;
      }
      stepper_.home(nowMs);
      wasHoming_ = true;  // Sikrer EVT HOMED, selv hvis homing afsluttes i samme loop
      comm_.send("OK");
      return;

    case CommandType::Start:
      if (latched) return sendError("FAULT");
      motors_.start();
      comm_.send("OK");
      return;

    case CommandType::Stop:
      scheduler_.cancel();
      motors_.stop();
      stepper_.emergencyStop();
      comm_.send("OK");
      return;

    case CommandType::Fire:
      if (latched) return sendError("FAULT");
      if (!stepper_.isHomed()) return sendError("NOT_HOMED");
      if (!motors_.isRunning()) return sendError("NOT_RUNNING");
      if (!scheduler_.requestFire(nowMs)) {
        comm_.send("BUSY");
        return;
      }
      comm_.send("OK");
      return;

    case CommandType::Estop:
      safety_.triggerEstop();
      enterSafeState();
      comm_.send("OK");
      return;

    case CommandType::Reset:
      if (!safety_.reset()) return sendError("ESTOP_ACTIVE");
      stepper_.clearFault();
      comm_.send("OK");
      return;

    case CommandType::Unknown:
      break;
  }
  sendError("UNKNOWN_COMMAND");
}

const char* Machine::stateName() const {
  if (safety_.isLatched()) return "FAULT";
  if (stepper_.state() == StepperControl::State::Homing) return "HOMING";
  if (!stepper_.isHomed()) return "NOT_HOMED";
  if (stepper_.isMoving()) return "MOVING";
  if (motors_.isRunning()) return "RUNNING";
  return "READY";
}

void Machine::sendStatus() {
  char angle[12];
  char target[12];
  Communication::formatFixed1(angle, sizeof(angle), stepper_.getCurrentAngle());
  Communication::formatFixed1(target, sizeof(target), stepper_.getTargetAngle());

  char line[160];
  snprintf(line, sizeof(line),
           "STATUS state=%s homed=%d angle=%s target=%s left=%u left_target=%u right=%u "
           "right_target=%u running=%d firing=%d comm=%d fault=%s",
           stateName(), stepper_.isHomed() ? 1 : 0, angle, target, motors_.leftActual(),
           motors_.leftTarget(), motors_.rightActual(), motors_.rightTarget(),
           motors_.isRunning() ? 1 : 0, scheduler_.isBusy() ? 1 : 0,
           safety_.isCommAlive() ? 1 : 0, faultName(safety_.fault()));
  comm_.send(line);
}

void Machine::sendError(const char* code) {
  char line[config::kMaxLineLength];
  snprintf(line, sizeof(line), "ERROR %s", code);
  comm_.send(line);
}

}  // namespace padel
