// =============================================================================
// PC-unit-tests af MCU-logikken. Kører uden Arduino-hardware takket være HAL'en.
//
//   make -C tests/firmware test
// =============================================================================
#include <math.h>
#include <stdio.h>
#include <string.h>

#include <string>
#include <vector>

#include "CommandParser.h"
#include "Communication.h"
#include "Config.h"
#include "Machine.h"
#include "MotorControl.h"
#include "Safety.h"
#include "Scheduler.h"
#include "StepperControl.h"

using namespace padel;

// --- Minimal testramme --------------------------------------------------------
static int g_failures = 0;
static int g_checks = 0;
#define CHECK(cond)                                                      \
  do {                                                                   \
    ++g_checks;                                                          \
    if (!(cond)) {                                                       \
      ++g_failures;                                                      \
      printf("  FEJL %s:%d: %s\n", __FILE__, __LINE__, #cond);           \
    }                                                                    \
  } while (0)
#define RUN(test)                \
  do {                           \
    printf("- %s\n", #test);     \
    test();                      \
  } while (0)

// --- Fakes --------------------------------------------------------------------
struct FakeClock : IClock {
  uint32_t us = 0;
  uint32_t millis() const override { return us / 1000; }
  uint32_t micros() const override { return us; }
};
struct FakePwm : IPwmOut {
  uint8_t value = 0;
  void write(uint8_t d) override { value = d; }
};
struct FakeOut : IDigitalOut {
  bool value = false;
  int rising = 0;
  void write(bool h) override {
    if (h && !value) ++rising;
    value = h;
  }
};
struct FakeIn : IDigitalIn {
  bool value = true;  // Pull-up: høj = ikke aktiveret for aktiv-lav input
  bool read() const override { return value; }
};
struct FakeWatchdog : IHardwareWatchdog {
  int feeds = 0;
  void begin(uint32_t) override {}
  void feed() override { ++feeds; }
};
struct FakeTransport : ILineTransport {
  std::vector<std::string> inbox;
  std::vector<std::string> outbox;
  bool readLine(char* buf, uint8_t cap) override {
    if (inbox.empty()) return false;
    strncpy(buf, inbox.front().c_str(), cap - 1);
    buf[cap - 1] = '\0';
    inbox.erase(inbox.begin());
    return true;
  }
  void writeLine(const char* line) override { outbox.emplace_back(line); }
  bool sent(const std::string& prefix) const {
    for (const auto& l : outbox)
      if (l.rfind(prefix, 0) == 0) return true;
    return false;
  }
};

// --- CommandParser --------------------------------------------------------------
static void testParser() {
  Command c = CommandParser::parse("SET_ANGLE=35");
  CHECK(c.type == CommandType::SetAngle && c.hasValue && c.valueValid && c.value == 35.0f);

  c = CommandParser::parse("set_speed 120");
  CHECK(c.type == CommandType::SetSpeed && c.value == 120.0f);

  c = CommandParser::parse("MOVE_ANGLE=30.5");
  CHECK(c.type == CommandType::SetAngle && fabsf(c.value - 30.5f) < 1e-4f);

  c = CommandParser::parse("ANGLE=42");
  CHECK(c.type == CommandType::SetAngle);

  c = CommandParser::parse("  FIRE  ");
  CHECK(c.type == CommandType::Fire && !c.hasValue);

  c = CommandParser::parse("SET_LEFT_PWM=abc");
  CHECK(c.type == CommandType::SetLeftPwm && c.hasValue && !c.valueValid);

  c = CommandParser::parse("SET_LEFT_PWM=12x");
  CHECK(!c.valueValid);

  CHECK(CommandParser::parse("FOO").type == CommandType::Unknown);
  CHECK(CommandParser::parse("").type == CommandType::Unknown);
  CHECK(CommandParser::parse("AVERYLONGKEYWORDTHATOVERFLOWS").type == CommandType::Unknown);
  CHECK(CommandParser::requiresValue(CommandType::SetAngle));
  CHECK(!CommandParser::requiresValue(CommandType::Stop));
}

// --- LineAssembler / formatering ------------------------------------------------
static void testLineAssembler() {
  LineAssembler a;
  const char* in = "PING\r\n";
  bool done = false;
  for (const char* p = in; *p; ++p) done = a.push(*p);
  CHECK(done && strcmp(a.line(), "PING") == 0);

  // For lang linje kasseres helt, næste linje virker.
  for (int i = 0; i < 200; ++i) CHECK(!a.push('X'));
  CHECK(!a.push('\n'));
  for (const char* p = "STOP\n"; *p; ++p) done = a.push(*p);
  CHECK(done && strcmp(a.line(), "STOP") == 0);

  char buf[16];
  Communication::formatFixed1(buf, sizeof(buf), 31.46f);
  CHECK(strcmp(buf, "31.5") == 0);
  Communication::formatFixed1(buf, sizeof(buf), -2.04f);
  CHECK(strcmp(buf, "-2.0") == 0);
  Communication::formatFixed1(buf, sizeof(buf), -0.01f);
  CHECK(strcmp(buf, "0.0") == 0);
}

// --- MotorControl ---------------------------------------------------------------
static void testMotorRamp() {
  FakePwm l, r;
  MotorControl m(l, r);
  m.setSpeed(200);
  m.update(0);
  m.update(100);
  CHECK(l.value == 0);  // Ikke startet endnu
  m.start();
  m.update(200);  // 100 ms * 400/s = 40
  CHECK(l.value == 40 && r.value == 40);
  CHECK(!m.isAtSpeed());
  m.update(1000);
  CHECK(l.value == 200 && m.isAtSpeed());

  m.setRightSpeed(150);  // Spin: forskellige hastigheder
  m.update(1500);
  CHECK(r.value == 150 && l.value == 200);

  m.stop();
  m.update(1600);
  CHECK(l.value == 160);  // Blød stop rampes ned
  m.emergencyStop();
  CHECK(l.value == 0 && r.value == 0 && !m.isRunning());
}

// --- StepperControl -------------------------------------------------------------
struct StepperRig {
  FakeOut step, dir, en;
  FakeIn home;
  StepperControl s{step, dir, en, home};
  uint32_t us = 0;
  // Kører update() i 10 µs-skridt. switchAtSteps: endestop aktiveres ved pos <= værdi.
  void run(uint32_t durationUs, bool useSwitch = false, int32_t switchAt = 0) {
    for (uint32_t t = 0; t < durationUs; t += 10) {
      us += 10;
      if (useSwitch) home.value = !(s.positionSteps() <= switchAt);
      s.update(us, us / 1000);
    }
  }
};

static void testStepperHomingAndMove() {
  StepperRig rig;
  rig.s.begin();
  CHECK(!rig.s.moveToAngle(10.0f));  // Ikke homed

  // Start et stykke væk fra endestoppet; endestop ved pos <= -500.
  rig.s.home(0);
  rig.run(2000000, true, -500);
  CHECK(rig.s.isHomed());
  CHECK(rig.s.state() == StepperControl::State::Idle);
  CHECK(rig.s.positionSteps() == config::kHomingBackoffSteps);

  CHECK(rig.s.moveToAngle(30.0f));
  rig.run(3000000);
  CHECK(rig.s.state() == StepperControl::State::Idle);
  CHECK(rig.s.positionSteps() == StepperControl::angleToSteps(30.0f));
  CHECK(fabsf(rig.s.getCurrentAngle() - 30.0f) < 0.05f);

  CHECK(!rig.s.moveToAngle(config::kMaxAngleDeg + 1.0f));  // Uden for område

  // Retningsskift midt i bevægelse: skal ende præcist på nyt mål.
  CHECK(rig.s.moveToAngle(55.0f));
  rig.run(150000);
  CHECK(rig.s.isMoving());
  CHECK(rig.s.moveToAngle(5.0f));
  rig.run(4000000);
  CHECK(rig.s.state() == StepperControl::State::Idle);
  CHECK(rig.s.positionSteps() == StepperControl::angleToSteps(5.0f));
}

static void testStepperRespectsMaxSpeed() {
  StepperRig rig;
  rig.s.begin();
  rig.s.home(0);
  rig.run(100000, true, 0);  // Endestop med det samme
  CHECK(rig.s.isHomed());
  rig.run(500000);
  CHECK(rig.s.moveToAngle(60.0f));
  // Mål trinfrekvensen i 50 ms-vinduer gennem hele bevægelsen.
  int maxSteps = 0;
  int total = 0;
  while (rig.s.isMoving()) {
    const int before = rig.step.rising;
    rig.run(50000);
    const int steps = rig.step.rising - before;
    total += steps;
    if (steps > maxSteps) maxSteps = steps;
  }
  CHECK(total > 0);
  CHECK(maxSteps <= static_cast<int>(config::kMaxSpeedStepsPerSec * 0.05f) + 2);
  CHECK(maxSteps >= static_cast<int>(config::kMaxSpeedStepsPerSec * 0.05f) - 10);  // Når topfart
}

static void testStepperHomingTimeout() {
  StepperRig rig;
  rig.s.begin();
  rig.s.home(0);
  rig.run((config::kHomingTimeoutMs + 100) * 1000);  // Endestop aldrig aktiveret
  CHECK(rig.s.homingFailed());
  CHECK(!rig.s.isHomed());
  rig.s.clearFault();
  CHECK(rig.s.state() == StepperControl::State::Idle);
}

// --- Scheduler --------------------------------------------------------------------
static void testScheduler() {
  FakeOut feeder;
  Scheduler s(feeder);
  CHECK(s.requestFire(0));
  CHECK(!s.requestFire(1));  // Optaget
  CHECK(s.update(10, false) == Scheduler::Event::None);
  CHECK(!feeder.value);
  CHECK(s.update(20, true) == Scheduler::Event::None);
  CHECK(feeder.value);
  CHECK(s.update(20 + config::kFeederPulseMs, true) == Scheduler::Event::Fired);
  CHECK(!feeder.value);
  CHECK(s.isBusy());  // Cooldown
  s.update(20 + config::kMinShotIntervalMs, true);
  CHECK(!s.isBusy());

  CHECK(s.requestFire(5000));
  CHECK(s.update(5000 + config::kSpinUpTimeoutMs + 1, false) == Scheduler::Event::FireTimeout);
  CHECK(!s.isBusy());
}

// --- Safety -----------------------------------------------------------------------
static void testSafety() {
  FakeIn estop;
  estop.value = false;  // NC lukket = OK
  FakeWatchdog wd;
  Safety s(estop, wd);
  s.begin();

  CHECK(!s.update(0));
  CHECK(!s.update(5000));  // Ingen timeout før første kommando

  s.feedComm(5000);
  CHECK(!s.update(5000 + config::kCommTimeoutMs));
  CHECK(s.update(5001 + config::kCommTimeoutMs));
  CHECK(s.fault() == Fault::CommTimeout && !s.isLatched());
  s.feedComm(7000);
  CHECK(s.fault() == Fault::None);

  estop.value = true;  // Nødstop trykket
  s.update(7001);
  CHECK(s.fault() == Fault::None);  // Debounce
  CHECK(s.update(7001 + config::kEstopDebounceMs));
  CHECK(s.isLatched());
  CHECK(!s.reset());  // Stadig trykket
  estop.value = false;
  s.update(7100);
  s.update(7200);
  CHECK(s.reset());
  CHECK(!s.isLatched());
  CHECK(wd.feeds > 0);
}

// --- Machine (integration) --------------------------------------------------------
struct MachineRig {
  FakeClock clock;
  FakePwm l, r;
  FakeOut step, dir, en, feeder;
  FakeIn home, estop;
  FakeWatchdog wd;
  FakeTransport transport;
  Communication comm{transport};
  MotorControl motors{l, r};
  StepperControl stepper{step, dir, en, home};
  Scheduler scheduler{feeder};
  Safety safety{estop, wd};
  Machine machine{clock, motors, stepper, scheduler, safety, comm};

  MachineRig() { estop.value = false; }
  void cmd(const char* line) { transport.inbox.emplace_back(line); }
  // Kører maskinen i durationMs, sender PING hver 200 ms (som Linux-heartbeat).
  void run(uint32_t durationMs, bool heartbeat = true) {
    const uint32_t end = clock.us + durationMs * 1000;
    uint32_t nextPing = clock.us;
    while (clock.us < end) {
      if (heartbeat && clock.us >= nextPing) {
        cmd("PING");
        nextPing += 200000;
      }
      home.value = !(stepper.positionSteps() <= 0);
      machine.update();
      clock.us += 20;
    }
  }
  void clearOut() { transport.outbox.clear(); }
};

static void testMachineFlow() {
  MachineRig m;
  m.machine.begin();
  CHECK(m.transport.sent("READY"));

  m.cmd("FIRE");
  m.run(1);
  CHECK(m.transport.sent("ERROR NOT_HOMED"));

  m.cmd("SET_ANGLE=20");
  m.run(1);
  CHECK(m.transport.sent("ERROR NOT_HOMED"));

  m.cmd("HOME");
  m.run(3000);
  CHECK(m.transport.sent("EVT HOMED"));
  CHECK(strcmp(m.machine.stateName(), "READY") == 0);

  m.clearOut();
  m.cmd("SET_ANGLE=999");
  m.cmd("SET_SPEED=300");
  m.cmd("SET_SPEED");
  m.cmd("BOGUS");
  m.run(1);
  CHECK(m.transport.sent("ERROR RANGE"));
  CHECK(m.transport.sent("ERROR MISSING_VALUE"));
  CHECK(m.transport.sent("ERROR UNKNOWN_COMMAND"));

  m.cmd("SET_ANGLE=25");
  m.cmd("SET_LEFT_PWM=180");
  m.cmd("SET_RIGHT_PWM=175");
  m.cmd("START");
  m.cmd("FIRE");
  m.run(4000);
  CHECK(m.transport.sent("EVT FIRED"));
  CHECK(m.l.value == 180 && m.r.value == 175);
  CHECK(m.feeder.rising == 1);

  m.clearOut();
  m.cmd("GET_ANGLE");
  m.cmd("STATUS");
  m.run(1);
  CHECK(m.transport.sent("ANGLE=25.0"));
  CHECK(m.transport.sent("STATUS state=RUNNING homed=1 angle=25.0"));

  m.cmd("STOP");
  m.run(2000);
  CHECK(m.l.value == 0 && !m.motors.isRunning());
}

static void testMachineCommTimeoutStopsMotors() {
  MachineRig m;
  m.machine.begin();
  m.cmd("SET_SPEED=150");
  m.cmd("START");
  m.run(1000);
  CHECK(m.l.value == 150);

  m.clearOut();
  m.run(config::kCommTimeoutMs + 100, /*heartbeat=*/false);  // Linux "dør"
  CHECK(m.transport.sent("EVT FAULT=COMM_TIMEOUT"));
  CHECK(m.l.value == 0 && m.r.value == 0 && !m.motors.isRunning());

  // Forbindelsen genoptages: hjulene starter IKKE af sig selv.
  m.run(500);
  CHECK(m.l.value == 0);
  CHECK(m.safety.fault() == Fault::None);
}

static void testMachineEstop() {
  MachineRig m;
  m.machine.begin();
  m.cmd("SET_SPEED=150");
  m.cmd("START");
  m.run(1000);
  m.estop.value = true;
  m.run(50);
  CHECK(m.transport.sent("EVT FAULT=ESTOP_INPUT"));
  CHECK(m.l.value == 0);
  CHECK(strcmp(m.machine.stateName(), "FAULT") == 0);

  m.clearOut();
  m.cmd("START");
  m.cmd("RESET");
  m.run(1);
  CHECK(m.transport.sent("ERROR FAULT"));
  CHECK(m.transport.sent("ERROR ESTOP_ACTIVE"));

  m.estop.value = false;
  m.run(50);
  m.clearOut();
  m.cmd("RESET");
  m.run(1);
  CHECK(m.transport.sent("OK"));
  CHECK(!m.safety.isLatched());

  m.cmd("ESTOP");
  m.run(1);
  CHECK(m.safety.fault() == Fault::EstopCommand);
}

int main() {
  RUN(testParser);
  RUN(testLineAssembler);
  RUN(testMotorRamp);
  RUN(testStepperHomingAndMove);
  RUN(testStepperRespectsMaxSpeed);
  RUN(testStepperHomingTimeout);
  RUN(testScheduler);
  RUN(testSafety);
  RUN(testMachineFlow);
  RUN(testMachineCommTimeoutStopsMotors);
  RUN(testMachineEstop);
  printf("%d checks, %d fejl\n", g_checks, g_failures);
  return g_failures == 0 ? 0 : 1;
}
