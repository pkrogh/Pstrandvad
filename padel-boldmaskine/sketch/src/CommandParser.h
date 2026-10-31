// =============================================================================
// CommandParser.h – Oversætter tekstlinjer fra Linux til strukturerede kommandoer.
//
// Ansvar: kun parsing. Parseren kender intet til motorer eller tilstand, og
// den allokerer ingen hukommelse (ingen String, ingen heap).
//
// Accepterede formater (store/små bogstaver er ligegyldige):
//   KOMMANDO
//   KOMMANDO=VÆRDI
//   KOMMANDO VÆRDI
// Se docs/protokol.md for den komplette liste.
// =============================================================================
#pragma once

#include <stdint.h>

namespace padel {

enum class CommandType : uint8_t {
  Unknown,
  Ping,         // PING
  Status,       // STATUS
  Home,         // HOME
  SetSpeed,     // SET_SPEED=<0..255>       (begge hjul)
  SetLeftPwm,   // SET_LEFT_PWM=<0..255>
  SetRightPwm,  // SET_RIGHT_PWM=<0..255>
  SetAngle,     // SET_ANGLE=<grader>  (aliaser: MOVE_ANGLE, ANGLE)
  GetAngle,     // GET_ANGLE
  Start,        // START   (hjul spinner op)
  Stop,         // STOP    (blød stop af alt)
  Fire,         // FIRE    (affyr én bold)
  Estop,        // ESTOP   (software-nødstop, låser)
  Reset,        // RESET   (nulstil fejltilstand)
};

struct Command {
  CommandType type = CommandType::Unknown;
  bool hasValue = false;
  float value = 0.0f;
  bool valueValid = true;  // false hvis der var en værdi, men den ikke var et tal
};

class CommandParser {
 public:
  /// Parser én linje. Linjen ændres ikke.
  static Command parse(const char* line);

  /// true hvis kommandotypen kræver en numerisk værdi.
  static bool requiresValue(CommandType type);
};

}  // namespace padel
