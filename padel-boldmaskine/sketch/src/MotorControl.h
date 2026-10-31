// =============================================================================
// MotorControl.h – Styring af de to DC-motorer på affyringshjulene.
//
// Ansvar: PWM, start, stop og hastighed. Intet andet.
//
// Hastighedsændringer rampes (config::kPwmRampPerSecond) for at skåne motorer,
// drivere og strømforsyning. Rampen beregnes i update(), som kaldes fra loop().
// Hjulene har uafhængige hastigheder, så spin kan tilføjes senere ved blot at
// give dem forskellige mål.
// =============================================================================
#pragma once

#include "Hal.h"

namespace padel {

class MotorControl {
 public:
  MotorControl(IPwmOut& left, IPwmOut& right);

  /// Sætter målhastighed (0..255) for venstre hjul. Træder i kraft når kørende.
  void setLeftSpeed(uint8_t pwm);
  /// Sætter målhastighed (0..255) for højre hjul. Træder i kraft når kørende.
  void setRightSpeed(uint8_t pwm);
  /// Sætter begge hjul – synkroniseret, samme rampe.
  void setSpeed(uint8_t pwm);

  /// Starter hjulene (rampe op til målhastighederne).
  void start();
  /// Blød stop: rampe ned til 0.
  void stop();
  /// Hård stop: PWM = 0 med det samme. Bruges af Safety.
  void emergencyStop();

  /// Skal kaldes ofte fra loop(). Opdaterer rampen.
  void update(uint32_t nowMs);

  bool isRunning() const { return running_; }
  /// true når begge hjul kører og har nået deres målhastighed.
  bool isAtSpeed() const;

  uint8_t leftTarget() const { return leftTarget_; }
  uint8_t rightTarget() const { return rightTarget_; }
  uint8_t leftActual() const { return static_cast<uint8_t>(leftActual_); }
  uint8_t rightActual() const { return static_cast<uint8_t>(rightActual_); }

 private:
  /// Flytter actual mod target med højst maxDelta. Returnerer ny værdi.
  static float approach(float actual, float target, float maxDelta);
  void writeOutputs();

  IPwmOut& left_;
  IPwmOut& right_;
  uint8_t leftTarget_ = 0;
  uint8_t rightTarget_ = 0;
  float leftActual_ = 0.0f;
  float rightActual_ = 0.0f;
  bool running_ = false;
  bool hasLastUpdate_ = false;
  uint32_t lastUpdateMs_ = 0;
};

}  // namespace padel
