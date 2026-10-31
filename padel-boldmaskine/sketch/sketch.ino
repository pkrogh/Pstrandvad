// =============================================================================
// Padel Boldmaskine – MCU-firmware (Arduino Uno Q, STM32U585-delen)
//
// Denne fil er bevidst tynd: den opretter HAL-objekter og moduler og kalder
// Machine::update() fra loop(). Al logik ligger i src/.
//
// Transport vælges ved kompilering:
//   PADEL_USE_BRIDGE defineret -> Arduino Bridge til Linux-delen (Uno Q, standard)
//   ellers                     -> Serial (USB / andre boards, f.eks. Uno R4 WiFi)
//
// Regel: ingen delay() nogen steder. loop() skal returnere hurtigt (< 100 µs
// typisk), så stepperen får jævne trin.
// =============================================================================

#define PADEL_USE_BRIDGE  // Kommentér ud for at styre via USB-serial i stedet

#include "src/ArduinoHal.h"
#include "src/BridgeLineTransport.h"
#include "src/Communication.h"
#include "src/Config.h"
#include "src/Machine.h"
#include "src/MotorControl.h"
#include "src/Safety.h"
#include "src/Scheduler.h"
#include "src/StepperControl.h"

using namespace padel;

namespace {

// --- HAL -------------------------------------------------------------------
ArduinoClock clockSource;
ArduinoPwmOut leftPwm(config::kPinLeftPwm);
ArduinoPwmOut rightPwm(config::kPinRightPwm);
ArduinoDigitalOut stepPin(config::kPinStepperStep);
ArduinoDigitalOut dirPin(config::kPinStepperDir);
ArduinoDigitalOut enablePin(config::kPinStepperEn);
ArduinoDigitalOut feederPin(config::kPinFeeder);
ArduinoDigitalIn homeSwitch(config::kPinHomeSwitch);
ArduinoDigitalIn estopInput(config::kPinEstop);
NullWatchdog watchdog;

#ifdef PADEL_USE_BRIDGE
BridgeLineTransport transport;
#else
StreamLineTransport transport(Serial);
#endif

// --- Moduler ---------------------------------------------------------------
Communication comm(transport);
MotorControl motors(leftPwm, rightPwm);
StepperControl stepper(stepPin, dirPin, enablePin, homeSwitch);
Scheduler scheduler(feederPin);
Safety safety(estopInput, watchdog);
Machine machine(clockSource, motors, stepper, scheduler, safety, comm);

}  // namespace

void setup() {
  // Sikre udgange FØR noget andet: motorer slukket, fremføring inaktiv.
  leftPwm.begin();
  rightPwm.begin();
  feederPin.begin(false);
  stepPin.begin(false);
  dirPin.begin(true);
  enablePin.begin(true);  // Aktiv lav: driver deaktiveret indtil stepper.begin()
  homeSwitch.begin();
  estopInput.begin();

#ifdef PADEL_USE_BRIDGE
  Bridge.begin();
  transport.begin();
#else
  Serial.begin(config::kSerialBaud);
#endif

  machine.begin();
}

void loop() { machine.update(); }
