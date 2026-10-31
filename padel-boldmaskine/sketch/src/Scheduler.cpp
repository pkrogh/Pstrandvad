#include "Scheduler.h"

#include "Config.h"

namespace padel {

Scheduler::Scheduler(IDigitalOut& feeder) : feeder_(feeder) {}  // Ingen hardwareadgang her

bool Scheduler::requestFire(uint32_t nowMs) {
  if (state_ != FireState::Idle) return false;
  state_ = FireState::WaitingForReady;
  stateSinceMs_ = nowMs;
  return true;
}

void Scheduler::cancel() {
  feeder_.write(false);
  state_ = FireState::Idle;
}

Scheduler::Event Scheduler::update(uint32_t nowMs, bool readyToFire) {
  const uint32_t elapsed = nowMs - stateSinceMs_;

  switch (state_) {
    case FireState::Idle:
      break;

    case FireState::WaitingForReady:
      if (readyToFire) {
        feeder_.write(true);
        state_ = FireState::Feeding;
        stateSinceMs_ = nowMs;
      } else if (elapsed > config::kSpinUpTimeoutMs) {
        state_ = FireState::Idle;
        return Event::FireTimeout;
      }
      break;

    case FireState::Feeding:
      if (elapsed >= config::kFeederPulseMs) {
        feeder_.write(false);
        state_ = FireState::Cooldown;
        stateSinceMs_ = nowMs;
        return Event::Fired;
      }
      break;

    case FireState::Cooldown:
      // Cooldown regnes fra skudets start, så skudintervallet bliver præcist.
      if (elapsed + config::kFeederPulseMs >= config::kMinShotIntervalMs) {
        state_ = FireState::Idle;
      }
      break;
  }
  return Event::None;
}

}  // namespace padel
