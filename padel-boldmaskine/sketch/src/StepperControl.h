// =============================================================================
// StepperControl.h – Vinkelstyring via STEP/DIR-stepperdriver.
//
// Ansvar: position, homing og vinkelstyring.
//
// Trin genereres udelukkende her på MCU'en (aldrig fra Linux). update() kaldes
// så ofte som muligt fra loop() og afgør ud fra micros() om næste trin er
// forfaldent. Bevægelser kører med trapezprofil: konstant acceleration op til
// maks.-hastighed og deceleration så motoren stopper præcist på målet.
//
// Hastigheden opdateres pr. trin efter v_ny² = v² ± 2a (a i trin/s²).
//
// Opgraderingssti: Kræves der højere trinfrekvens eller lavere jitter, kan
// update()'s trinlogik flyttes til en hardware-timer-ISR uden at API'et ændres.
// =============================================================================
#pragma once

#include "Hal.h"

namespace padel {

class StepperControl {
 public:
  enum class State : uint8_t { Idle, Moving, Homing, Fault };

  StepperControl(IDigitalOut& stepPin, IDigitalOut& dirPin, IDigitalOut& enablePin,
                 IDigitalIn& homeSwitch);

  /// Aktiverer driveren (holder position).
  void begin();

  /// Starter homing: kør mod endestop, nulstil position, træk lidt tilbage.
  void home(uint32_t nowMs);

  /// Bevæg til vinkel (grader). Returnerer false hvis ikke homed, i fejl eller
  /// vinklen er uden for [kMinAngleDeg, kMaxAngleDeg]. Må kaldes under bevægelse:
  /// målet opdateres, og motoren decelererer/vender om nødvendigt.
  bool moveToAngle(float degrees);

  /// Nuværende vinkel i grader (beregnet fra trinposition).
  float getCurrentAngle() const;
  float getTargetAngle() const;

  /// Stopper øjeblikkeligt al trin-generering. Driveren forbliver aktiv (holder).
  void emergencyStop();

  /// Rydder en homing-fejl. Positionen er derefter ukendt => ny HOME kræves.
  void clearFault();

  /// Skal kaldes så ofte som muligt fra loop().
  void update(uint32_t nowUs, uint32_t nowMs);

  State state() const { return state_; }
  bool isHomed() const { return homed_; }
  bool isMoving() const { return state_ == State::Moving || state_ == State::Homing; }
  bool homingFailed() const { return state_ == State::Fault; }
  int32_t positionSteps() const { return position_; }

  static int32_t angleToSteps(float degrees);
  static float stepsToAngle(int32_t steps);

 private:
  void updateMove(uint32_t nowUs);
  void updateHoming(uint32_t nowUs, uint32_t nowMs);
  void pulse(uint32_t nowUs);
  void setDirection(int8_t dir);
  static uint32_t intervalFor(float stepsPerSec);

  IDigitalOut& stepPin_;
  IDigitalOut& dirPin_;
  IDigitalOut& enablePin_;
  IDigitalIn& homeSwitch_;

  State state_ = State::Idle;
  bool homed_ = false;
  int32_t position_ = 0;  // Trin, absolut (0 = 0 grader)
  int32_t target_ = 0;
  int8_t dir_ = 1;        // +1 / -1, aktuel retning på DIR-pin
  float speed_ = 0.0f;    // Trin/s, altid >= 0
  uint32_t intervalUs_ = 0;
  uint32_t lastStepUs_ = 0;
  bool stepHigh_ = false;
  uint32_t pulseStartUs_ = 0;
  uint32_t homingStartMs_ = 0;
};

}  // namespace padel
