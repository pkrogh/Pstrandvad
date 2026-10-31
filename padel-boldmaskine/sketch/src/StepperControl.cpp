#include "StepperControl.h"

#include <math.h>

#include "Config.h"

namespace padel {

namespace {
// Laveste hastighed i profilen: hastigheden efter ét trin fra stilstand.
const float kMinSpeed = sqrtf(2.0f * config::kAccelStepsPerSec2);
}  // namespace

StepperControl::StepperControl(IDigitalOut& stepPin, IDigitalOut& dirPin,
                               IDigitalOut& enablePin, IDigitalIn& homeSwitch)
    : stepPin_(stepPin), dirPin_(dirPin), enablePin_(enablePin), homeSwitch_(homeSwitch) {}

void StepperControl::begin() {
  stepPin_.write(false);
  dirPin_.write(true);
  dir_ = 1;
  enablePin_.write(false);  // Aktiv lav => driver aktiv
}

int32_t StepperControl::angleToSteps(float degrees) {
  return static_cast<int32_t>(lroundf(degrees * config::kStepsPerDegree));
}

float StepperControl::stepsToAngle(int32_t steps) {
  return static_cast<float>(steps) / config::kStepsPerDegree;
}

uint32_t StepperControl::intervalFor(float stepsPerSec) {
  return static_cast<uint32_t>(1000000.0f / stepsPerSec);
}

void StepperControl::home(uint32_t nowMs) {
  homed_ = false;
  speed_ = 0.0f;
  homingStartMs_ = nowMs;
  intervalUs_ = intervalFor(config::kHomingStepsPerSec);
  state_ = State::Homing;
}

bool StepperControl::moveToAngle(float degrees) {
  if (!homed_ || state_ == State::Homing || state_ == State::Fault) return false;
  if (degrees < config::kMinAngleDeg || degrees > config::kMaxAngleDeg) return false;
  target_ = angleToSteps(degrees);
  state_ = State::Moving;
  return true;
}

float StepperControl::getCurrentAngle() const { return stepsToAngle(position_); }
float StepperControl::getTargetAngle() const { return stepsToAngle(target_); }

void StepperControl::emergencyStop() {
  speed_ = 0.0f;
  target_ = position_;
  if (state_ == State::Homing) homed_ = false;  // Afbrudt homing => ikke homed
  if (state_ != State::Fault) state_ = State::Idle;
  stepPin_.write(false);
  stepHigh_ = false;
}

void StepperControl::clearFault() {
  if (state_ != State::Fault) return;
  state_ = State::Idle;
  homed_ = false;
  speed_ = 0.0f;
}

void StepperControl::setDirection(int8_t dir) {
  dir_ = dir;
  dirPin_.write(dir > 0);
}

void StepperControl::pulse(uint32_t nowUs) {
  stepPin_.write(true);
  stepHigh_ = true;
  pulseStartUs_ = nowUs;
  lastStepUs_ = nowUs;
  position_ += dir_;
}

void StepperControl::update(uint32_t nowUs, uint32_t nowMs) {
  // Afslut STEP-puls når minimumsbredden er opfyldt. Ingen ny puls før denne er lav.
  if (stepHigh_) {
    if (nowUs - pulseStartUs_ < config::kStepPulseWidthUs) return;
    stepPin_.write(false);
    stepHigh_ = false;
  }

  switch (state_) {
    case State::Moving: updateMove(nowUs); break;
    case State::Homing: updateHoming(nowUs, nowMs); break;
    default: break;
  }
}

void StepperControl::updateHoming(uint32_t nowUs, uint32_t nowMs) {
  if (nowMs - homingStartMs_ > config::kHomingTimeoutMs) {
    state_ = State::Fault;  // Endestop aldrig nået: mekanisk/elektrisk fejl
    return;
  }

  const bool switchPressed = !homeSwitch_.read();  // Aktiv lav
  if (switchPressed) {
    position_ = angleToSteps(config::kHomeAngleDeg);
    homed_ = true;
    // Træk lidt væk fra endestoppet med normal bevægelsesprofil.
    target_ = position_ + config::kHomingBackoffSteps;
    speed_ = 0.0f;
    state_ = State::Moving;
    return;
  }

  if (dir_ != -1) {
    setDirection(-1);  // DIR sættes et kald før første trin (setup-tid)
    return;
  }
  if (nowUs - lastStepUs_ >= intervalUs_) pulse(nowUs);
}

void StepperControl::updateMove(uint32_t nowUs) {
  // Stilstand: færdig, eller start (evt. i ny retning).
  if (speed_ == 0.0f) {
    if (position_ == target_) {
      state_ = State::Idle;
      return;
    }
    const int8_t wanted = (target_ > position_) ? 1 : -1;
    if (wanted != dir_) {
      setDirection(wanted);
      return;  // Giv DIR-signalet setup-tid før første trin
    }
  } else if (nowUs - lastStepUs_ < intervalUs_) {
    return;  // Næste trin ikke forfaldent endnu
  }

  pulse(nowUs);

  // Planlæg hastigheden for næste trin.
  const int32_t remaining = (target_ - position_) * dir_;  // >0: mål ligger forude
  const float stepsToStop = (speed_ * speed_) / (2.0f * config::kAccelStepsPerSec2);

  if (remaining <= 0 || static_cast<float>(remaining) <= stepsToStop) {
    // Decelerér. remaining <= 0 betyder at målet er nået, eller at det er
    // flyttet bag os under bevægelse: så bremses der blødt op (lille overshoot),
    // og updateMove() vender retningen ved stilstand.
    const float v2 = speed_ * speed_ - 2.0f * config::kAccelStepsPerSec2;
    if (v2 > kMinSpeed * kMinSpeed) {
      speed_ = sqrtf(v2);
    } else if (remaining <= 0) {
      speed_ = 0.0f;  // Stoppet: genvurdér mål og retning ved næste kald
      return;
    } else {
      speed_ = kMinSpeed;
    }
  } else {
    const float v = sqrtf(speed_ * speed_ + 2.0f * config::kAccelStepsPerSec2);
    speed_ = (v < config::kMaxSpeedStepsPerSec) ? v : config::kMaxSpeedStepsPerSec;
  }
  intervalUs_ = intervalFor(speed_);
}

}  // namespace padel
