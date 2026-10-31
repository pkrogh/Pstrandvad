// =============================================================================
// Scheduler.h – Non-blocking koordinering af timing, affyring og intervaller.
//
// Ansvar: affyringssekvensen (vent på klar -> aktivér fremføring -> pause) og
// små timer-hjælpere. Ingen delay(): alt drives af update(nowMs) fra loop().
//
// Affyringssekvens:
//   Idle --requestFire()--> WaitingForReady --klar--> Feeding --puls slut-->
//   Cooldown --min. interval--> Idle
// Bliver maskinen ikke klar inden kSpinUpTimeoutMs, afbrydes skuddet.
// =============================================================================
#pragma once

#include "Hal.h"

namespace padel {

/// Simpel periodisk timer. Eksempel: if (statusTimer.due(now)) sendStatus();
class IntervalTimer {
 public:
  explicit IntervalTimer(uint32_t periodMs) : periodMs_(periodMs) {}
  bool due(uint32_t nowMs) {
    if (nowMs - lastMs_ < periodMs_) return false;
    lastMs_ = nowMs;
    return true;
  }
  void setPeriod(uint32_t periodMs) { periodMs_ = periodMs; }

 private:
  uint32_t periodMs_;
  uint32_t lastMs_ = 0;
};

class Scheduler {
 public:
  enum class FireState : uint8_t { Idle, WaitingForReady, Feeding, Cooldown };
  enum class Event : uint8_t { None, Fired, FireTimeout };

  explicit Scheduler(IDigitalOut& feeder);

  /// Beder om ét skud. Returnerer false hvis et skud allerede er i gang (BUSY).
  bool requestFire(uint32_t nowMs);

  /// Afbryder igangværende skud og slukker fremføringen øjeblikkeligt.
  void cancel();

  /// readyToFire: hjul ved hastighed, vinkel nået og ingen fejl.
  /// Returnerer en hændelse, som Machine videresender til Linux.
  Event update(uint32_t nowMs, bool readyToFire);

  FireState state() const { return state_; }
  bool isBusy() const { return state_ != FireState::Idle; }

 private:
  IDigitalOut& feeder_;
  FireState state_ = FireState::Idle;
  uint32_t stateSinceMs_ = 0;
};

}  // namespace padel
