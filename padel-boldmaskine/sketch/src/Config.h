// =============================================================================
// Config.h – Central konfiguration for MCU-firmwaren.
//
// Alle pins, grænseværdier og timingkonstanter samles her, så hardwareændringer
// aldrig kræver ændringer i modulernes logik. Værdier markeret "TBD" skal
// verificeres mod den faktiske hardware.
// =============================================================================
#pragma once

#include <stdint.h>

namespace padel {
namespace config {

// ---------------------------------------------------------------------------
// Pins (Arduino-nummerering på Uno Q-headeren). TBD: verificér mod print/driver.
// ---------------------------------------------------------------------------
constexpr uint8_t kPinLeftPwm      = 5;   // PWM til venstre DC-motordriver
constexpr uint8_t kPinRightPwm     = 6;   // PWM til højre DC-motordriver
constexpr uint8_t kPinStepperStep  = 2;   // STEP til stepperdriver
constexpr uint8_t kPinStepperDir   = 3;   // DIR til stepperdriver
constexpr uint8_t kPinStepperEn    = 4;   // ENABLE til stepperdriver (aktiv lav)
constexpr uint8_t kPinHomeSwitch   = 7;   // Endestop for vinkel (aktiv lav, pull-up)
constexpr uint8_t kPinEstop        = 8;   // Nødstop (NC-kontakt, aktiv lav = OK)
constexpr uint8_t kPinFeeder       = 9;   // Boldfremføring (solenoide/relæ). TBD

// ---------------------------------------------------------------------------
// DC-motorer
// ---------------------------------------------------------------------------
constexpr uint8_t  kPwmMax              = 255;
constexpr uint16_t kPwmRampPerSecond    = 400;  // Maks. PWM-ændring pr. sekund (blød start)
constexpr uint8_t  kPwmAtSpeedTolerance = 2;    // "Ved hastighed" når |faktisk - mål| <= dette

// ---------------------------------------------------------------------------
// Stepper / vinkel
// ---------------------------------------------------------------------------
constexpr float    kStepsPerDegree      = 200.0f * 16.0f * 5.0f / 360.0f; // 200 trin, 1/16 mikro, 5:1 gear. TBD
constexpr float    kMinAngleDeg         = 0.0f;
constexpr float    kMaxAngleDeg         = 60.0f;
constexpr float    kHomeAngleDeg        = 0.0f;   // Vinkel ved endestop
constexpr float    kMaxSpeedStepsPerSec = 4000.0f;
constexpr float    kAccelStepsPerSec2   = 8000.0f;
constexpr float    kHomingStepsPerSec   = 800.0f;
constexpr int32_t  kHomingBackoffSteps  = 100;    // Træk væk fra endestop efter homing
constexpr uint32_t kHomingTimeoutMs     = 15000;
constexpr uint32_t kStepPulseWidthUs    = 3;      // Min. STEP-pulsbredde (driverdatablad)

// ---------------------------------------------------------------------------
// Affyring
// ---------------------------------------------------------------------------
constexpr uint32_t kFeederPulseMs       = 120;   // Hvor længe fremføringen aktiveres. TBD
constexpr uint32_t kMinShotIntervalMs   = 800;   // Mindste tid mellem to skud
constexpr uint32_t kSpinUpTimeoutMs     = 5000;  // Maks. ventetid på at hjulene når hastighed

// ---------------------------------------------------------------------------
// Kommunikation og sikkerhed
// ---------------------------------------------------------------------------
constexpr uint32_t kSerialBaud          = 115200;
constexpr uint32_t kCommTimeoutMs       = 1000;  // Ingen kommando i så lang tid => motorstop
constexpr uint32_t kEstopDebounceMs     = 10;
constexpr uint32_t kHardwareWatchdogMs  = 250;
constexpr uint8_t  kMaxLineLength       = 64;    // Inkl. nul-terminering

}  // namespace config
}  // namespace padel
