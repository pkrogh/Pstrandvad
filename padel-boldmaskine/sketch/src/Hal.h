// =============================================================================
// Hal.h – Hardware Abstraction Layer.
//
// Modulerne taler aldrig direkte med Arduino-API'et. De får i stedet disse små
// interfaces injiceret. Det giver to fordele:
//   1. Al logik kan unit-testes på en PC (se tests/firmware) med falske pins/ur.
//   2. Skift af board (R4 WiFi -> Uno Q -> noget tredje) kræver kun en ny
//      implementering af HAL'en, ikke ændringer i modulerne.
// =============================================================================
#pragma once

#include <stdint.h>

namespace padel {

/// Monoton tidskilde. Wrap-around håndteres af kalderen via usigneret subtraktion.
class IClock {
 public:
  virtual ~IClock() = default;
  virtual uint32_t millis() const = 0;
  virtual uint32_t micros() const = 0;
};

/// PWM-udgang, 0..255.
class IPwmOut {
 public:
  virtual ~IPwmOut() = default;
  virtual void write(uint8_t duty) = 0;
};

/// Digital udgang.
class IDigitalOut {
 public:
  virtual ~IDigitalOut() = default;
  virtual void write(bool high) = 0;
};

/// Digital indgang.
class IDigitalIn {
 public:
  virtual ~IDigitalIn() = default;
  virtual bool read() const = 0;
};

/// Linjebaseret transport mellem Linux og MCU (seriel port, Bridge, ...).
/// Begge metoder skal være non-blocking.
class ILineTransport {
 public:
  virtual ~ILineTransport() = default;
  /// Kopierer en komplet modtaget linje (uden linjeskift) til buf og returnerer
  /// true. Returnerer false straks hvis ingen komplet linje er klar.
  virtual bool readLine(char* buf, uint8_t capacity) = 0;
  /// Sender én linje. Transporten tilføjer selv linjeskift.
  virtual void writeLine(const char* line) = 0;
};

/// Hardware-watchdog. Skal fodres jævnligt fra loop(), ellers resettes MCU'en.
class IHardwareWatchdog {
 public:
  virtual ~IHardwareWatchdog() = default;
  virtual void begin(uint32_t timeoutMs) = 0;
  virtual void feed() = 0;
};

}  // namespace padel
