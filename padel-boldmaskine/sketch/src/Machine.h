// =============================================================================
// Machine.h – Applikationslaget på MCU'en.
//
// Ansvar: orkestrering. Machine binder modulerne sammen, oversætter kommandoer
// til modulkald, håndhæver Safety's beslutninger og sender hændelser til Linux.
// Machine indeholder ingen hardware-detaljer og ingen parsing.
//
// Tilstande (afledt, rapporteres i STATUS):
//   FAULT      låsende fejl aktiv, alt stoppet
//   HOMING     vinkelaksen søger endestop
//   NOT_HOMED  vinkel ukendt, kun HOME / hjulkommandoer tilladt
//   MOVING     vinkelaksen bevæger sig
//   RUNNING    hjulene kører
//   READY      klar, intet i gang
// =============================================================================
#pragma once

#include "CommandParser.h"
#include "Communication.h"
#include "Hal.h"
#include "MotorControl.h"
#include "Safety.h"
#include "Scheduler.h"
#include "StepperControl.h"

namespace padel {

class Machine {
 public:
  Machine(IClock& clock, MotorControl& motors, StepperControl& stepper, Scheduler& scheduler,
          Safety& safety, Communication& comm);

  /// Kaldes én gang fra setup().
  void begin();

  /// Kaldes fra loop(). Må aldrig blokere.
  void update();

  /// Behandler én kommandolinje og sender svaret. Offentlig af hensyn til test.
  void handleLine(const char* line, uint32_t nowMs);

  /// Navn på den aktuelle tilstand (se ovenfor).
  const char* stateName() const;

 private:
  void handleCommand(const Command& cmd, uint32_t nowMs);
  void enterSafeState();
  void sendStatus();
  void sendError(const char* code);
  bool readyToFire() const;

  IClock& clock_;
  MotorControl& motors_;
  StepperControl& stepper_;
  Scheduler& scheduler_;
  Safety& safety_;
  Communication& comm_;
  bool wasHoming_ = false;
};

}  // namespace padel
