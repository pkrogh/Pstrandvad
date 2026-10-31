// =============================================================================
// ArduinoHal.h – HAL-implementeringer oven på Arduino-API'et.
//
// Det eneste sted (sammen med sketch.ino) hvor Arduino.h må inkluderes.
// Kompileres ikke i PC-testene.
// =============================================================================
#pragma once

#include <Arduino.h>

#include "Communication.h"
#include "Hal.h"

namespace padel {

class ArduinoClock : public IClock {
 public:
  uint32_t millis() const override { return ::millis(); }
  uint32_t micros() const override { return ::micros(); }
};

class ArduinoPwmOut : public IPwmOut {
 public:
  explicit ArduinoPwmOut(uint8_t pin) : pin_(pin) {}
  void begin() { pinMode(pin_, OUTPUT); analogWrite(pin_, 0); }
  void write(uint8_t duty) override {
    if (duty == last_) return;  // Undgå unødige registerskrivninger
    last_ = duty;
    analogWrite(pin_, duty);
  }

 private:
  uint8_t pin_;
  int16_t last_ = -1;
};

class ArduinoDigitalOut : public IDigitalOut {
 public:
  explicit ArduinoDigitalOut(uint8_t pin) : pin_(pin) {}
  void begin(bool initial) { pinMode(pin_, OUTPUT); write(initial); }
  void write(bool high) override { digitalWrite(pin_, high ? HIGH : LOW); }

 private:
  uint8_t pin_;
};

class ArduinoDigitalIn : public IDigitalIn {
 public:
  explicit ArduinoDigitalIn(uint8_t pin) : pin_(pin) {}
  void begin() { pinMode(pin_, INPUT_PULLUP); }
  bool read() const override { return digitalRead(pin_) == HIGH; }

 private:
  uint8_t pin_;
};

/// Linjetransport over en Arduino Stream (Serial, Serial1, ...).
/// Bruges til udvikling via USB og på boards uden Bridge (f.eks. Uno R4 WiFi).
class StreamLineTransport : public ILineTransport {
 public:
  explicit StreamLineTransport(Stream& stream) : stream_(stream) {}

  bool readLine(char* buf, uint8_t capacity) override {
    // Læs højst det der allerede er modtaget – blokerer aldrig.
    while (stream_.available() > 0) {
      if (assembler_.push(static_cast<char>(stream_.read()))) {
        strncpy(buf, assembler_.line(), capacity - 1);
        buf[capacity - 1] = '\0';
        return true;
      }
    }
    return false;
  }

  void writeLine(const char* line) override {
    // Bemærk: Hvis TX-bufferen er fuld, kan print() vente. Svarene er korte, og
    // Linux læser løbende, så det er acceptabelt her.
    stream_.print(line);
    stream_.print('\n');
  }

 private:
  Stream& stream_;
  LineAssembler assembler_;
};

/// Watchdog-stub. TODO(uno-q): Implementér med STM32U585 IWDG via Zephyr's
/// watchdog-API (wdt_install_timeout / wdt_setup / wdt_feed), når den
/// eksponeres af Arduino-kernen til Uno Q.
class NullWatchdog : public IHardwareWatchdog {
 public:
  void begin(uint32_t) override {}
  void feed() override {}
};

}  // namespace padel
