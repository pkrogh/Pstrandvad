#include "Safety.h"

#include "Config.h"

namespace padel {

const char* faultName(Fault fault) {
  switch (fault) {
    case Fault::None: return "NONE";
    case Fault::EstopInput: return "ESTOP_INPUT";
    case Fault::EstopCommand: return "ESTOP_COMMAND";
    case Fault::CommTimeout: return "COMM_TIMEOUT";
    case Fault::HomingFailed: return "HOMING_FAILED";
  }
  return "UNKNOWN";
}

Safety::Safety(IDigitalIn& estopInput, IHardwareWatchdog& watchdog)
    : estopInput_(estopInput), watchdog_(watchdog) {}

void Safety::begin() { watchdog_.begin(config::kHardwareWatchdogMs); }

void Safety::feedComm(uint32_t nowMs) {
  commEverSeen_ = true;
  commAlive_ = true;
  lastCommMs_ = nowMs;
  if (fault_ == Fault::CommTimeout) fault_ = Fault::None;  // Ikke-låsende
}

void Safety::raise(Fault f) {
  // En låsende fejl overskrives ikke af en mindre alvorlig.
  if (isLatched()) return;
  fault_ = f;
}

bool Safety::isLatched() const {
  return fault_ == Fault::EstopInput || fault_ == Fault::EstopCommand ||
         fault_ == Fault::HomingFailed;
}

bool Safety::update(uint32_t nowMs) {
  watchdog_.feed();
  const Fault before = fault_;

  // Nødstop: NC-kontakt, lav = OK, høj = aktiveret (også ved knækket ledning).
  const bool raw = estopInput_.read();
  if (raw != estopRaw_) {
    estopRaw_ = raw;
    estopChangedMs_ = nowMs;
  }
  if (nowMs - estopChangedMs_ >= config::kEstopDebounceMs) estopStable_ = estopRaw_;
  if (estopStable_) raise(Fault::EstopInput);

  // Kommunikations-watchdog.
  if (commEverSeen_ && commAlive_ && nowMs - lastCommMs_ > config::kCommTimeoutMs) {
    commAlive_ = false;
    raise(Fault::CommTimeout);
  }

  return fault_ != before && fault_ != Fault::None;
}

void Safety::triggerEstop() { raise(Fault::EstopCommand); }
void Safety::reportHomingFailed() { raise(Fault::HomingFailed); }

bool Safety::reset() {
  if (estopStable_) return false;
  fault_ = Fault::None;
  return true;
}

}  // namespace padel
