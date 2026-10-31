// =============================================================================
// Communication.h – Tekstbaseret linjekommunikation mellem Linux og MCU.
//
// Ansvar: at samle indkommende bytes til linjer og at sende svar/hændelser.
// Selve transporten (seriel port, Arduino Bridge, ...) er skjult bag
// ILineTransport, så protokollen er den samme uanset forbindelsestype.
//
// LineAssembler er en genbrugelig, allokeringsfri linjebuffer. Linjer der er
// længere end bufferen kasseres helt (i stedet for at blive afkortet og evt.
// fortolket som en anden kommando).
// =============================================================================
#pragma once

#include <stdint.h>

#include "Config.h"
#include "Hal.h"

namespace padel {

class LineAssembler {
 public:
  /// Tilføjer ét tegn. Returnerer true når en komplet linje er klar i line().
  bool push(char c);
  const char* line() const { return buffer_; }

 private:
  char buffer_[config::kMaxLineLength] = {};
  uint8_t length_ = 0;
  bool overflow_ = false;
};

class Communication {
 public:
  explicit Communication(ILineTransport& transport) : transport_(transport) {}

  /// Henter næste komplette linje hvis tilgængelig (non-blocking).
  bool poll(char* line, uint8_t capacity) { return transport_.readLine(line, capacity); }

  /// Sender en linje uændret.
  void send(const char* line) { transport_.writeLine(line); }

  /// Sender "<prefix><værdi med 1 decimal>", f.eks. "ANGLE=31.5".
  /// Undgår printf("%f"), som ofte mangler i indlejrede C-biblioteker.
  void sendFixed1(const char* prefix, float value);

  /// Formaterer value med én decimal i buf. Returnerer antal skrevne tegn.
  static int formatFixed1(char* buf, int capacity, float value);

 private:
  ILineTransport& transport_;
};

}  // namespace padel
