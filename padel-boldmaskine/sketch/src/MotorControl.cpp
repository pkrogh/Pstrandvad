#include "MotorControl.h"

#include "Config.h"

namespace padel {

// Bemærk: konstruktøren rører ikke hardware, da globale objekter konstrueres
// før Arduino-kernen er initialiseret. Sikker starttilstand sættes i setup().
MotorControl::MotorControl(IPwmOut& left, IPwmOut& right) : left_(left), right_(right) {}

void MotorControl::setLeftSpeed(uint8_t pwm) { leftTarget_ = pwm; }
void MotorControl::setRightSpeed(uint8_t pwm) { rightTarget_ = pwm; }

void MotorControl::setSpeed(uint8_t pwm) {
  leftTarget_ = pwm;
  rightTarget_ = pwm;
}

void MotorControl::start() { running_ = true; }
void MotorControl::stop() { running_ = false; }

void MotorControl::emergencyStop() {
  running_ = false;
  leftActual_ = 0.0f;
  rightActual_ = 0.0f;
  writeOutputs();
}

float MotorControl::approach(float actual, float target, float maxDelta) {
  if (actual < target) return (target - actual <= maxDelta) ? target : actual + maxDelta;
  if (actual > target) return (actual - target <= maxDelta) ? target : actual - maxDelta;
  return actual;
}

void MotorControl::update(uint32_t nowMs) {
  if (!hasLastUpdate_) {
    hasLastUpdate_ = true;
    lastUpdateMs_ = nowMs;
    return;
  }
  const uint32_t dtMs = nowMs - lastUpdateMs_;  // Wrap-sikker usigneret subtraktion
  if (dtMs == 0) return;
  lastUpdateMs_ = nowMs;

  const float maxDelta = static_cast<float>(config::kPwmRampPerSecond) * dtMs / 1000.0f;
  const float leftGoal = running_ ? leftTarget_ : 0.0f;
  const float rightGoal = running_ ? rightTarget_ : 0.0f;

  leftActual_ = approach(leftActual_, leftGoal, maxDelta);
  rightActual_ = approach(rightActual_, rightGoal, maxDelta);
  writeOutputs();
}

bool MotorControl::isAtSpeed() const {
  if (!running_) return false;
  const auto near = [](float actual, uint8_t target) {
    const float diff = actual > target ? actual - target : target - actual;
    return diff <= config::kPwmAtSpeedTolerance;
  };
  return near(leftActual_, leftTarget_) && near(rightActual_, rightTarget_);
}

void MotorControl::writeOutputs() {
  left_.write(static_cast<uint8_t>(leftActual_ + 0.5f));
  right_.write(static_cast<uint8_t>(rightActual_ + 0.5f));
}

}  // namespace padel
