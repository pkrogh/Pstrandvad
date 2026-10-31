// =============================================================================
// Safety.h – Nødstop, kommunikations-timeout, fejltilstande og watchdog.
//
// Ansvar: at AFGØRE om bevægelse er tilladt. Safety stopper ikke selv motorerne;
// det gør Machine, som spørger Safety i hvert loop. Det holder modulerne
// afkoblede og gør reglerne testbare.
//
// Fejltyper:
//   - Låsende fejl (EstopInput, EstopCommand, HomingFailed): kræver RESET.
//   - Ikke-låsende (CommTimeout): motorer stoppes, men forbindelsen kan
//     genoptages. Hjulene starter IKKE af sig selv igen – der kræves ny START.
// =============================================================================
#pragma once

#include "Hal.h"

namespace padel {

enum class Fault : uint8_t {
  None,
  EstopInput,    // Fysisk nødstop aktiveret
  EstopCommand,  // ESTOP modtaget fra Linux
  CommTimeout,   // Ingen kommandoer fra Linux inden for timeout
  HomingFailed,  // Endestop ikke fundet inden for timeout
};

const char* faultName(Fault fault);

class Safety {
 public:
  Safety(IDigitalIn& estopInput, IHardwareWatchdog& watchdog);

  void begin();

  /// Kaldes ved hver gyldig kommando fra Linux.
  void feedComm(uint32_t nowMs);

  /// Kaldes hvert loop. Returnerer true hvis en NY fejl opstod i dette kald.
  bool update(uint32_t nowMs);

  void triggerEstop();
  void reportHomingFailed();

  /// Forsøger at rydde låsende fejl. Fejler hvis fysisk nødstop stadig er aktivt.
  bool reset();

  /// Låsende fejl aktiv => ingen bevægelse tilladt.
  bool isLatched() const;
  bool isMotionAllowed() const { return !isLatched(); }
  bool isCommAlive() const { return commAlive_; }
  Fault fault() const { return fault_; }

 private:
  void raise(Fault f);

  IDigitalIn& estopInput_;
  IHardwareWatchdog& watchdog_;
  Fault fault_ = Fault::None;
  bool commEverSeen_ = false;
  bool commAlive_ = false;
  uint32_t lastCommMs_ = 0;
  bool estopRaw_ = false;       // Seneste rå aflæsning (true = aktiveret)
  bool estopStable_ = false;    // Debounced værdi
  uint32_t estopChangedMs_ = 0;
};

}  // namespace padel
