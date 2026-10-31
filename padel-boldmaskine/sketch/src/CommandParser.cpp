#include "CommandParser.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

namespace padel {

namespace {

struct KeywordEntry {
  const char* keyword;
  CommandType type;
};

// Opslagstabel. Nye kommandoer tilføjes her og i CommandType.
constexpr KeywordEntry kKeywords[] = {
    {"PING", CommandType::Ping},
    {"STATUS", CommandType::Status},
    {"HOME", CommandType::Home},
    {"SET_SPEED", CommandType::SetSpeed},
    {"SET_LEFT_PWM", CommandType::SetLeftPwm},
    {"SET_RIGHT_PWM", CommandType::SetRightPwm},
    {"SET_ANGLE", CommandType::SetAngle},
    {"MOVE_ANGLE", CommandType::SetAngle},
    {"ANGLE", CommandType::SetAngle},
    {"GET_ANGLE", CommandType::GetAngle},
    {"START", CommandType::Start},
    {"STOP", CommandType::Stop},
    {"FIRE", CommandType::Fire},
    {"ESTOP", CommandType::Estop},
    {"RESET", CommandType::Reset},
};

constexpr uint8_t kMaxKeywordLength = 16;

bool isSeparator(char c) { return c == '=' || c == ' ' || c == '\t'; }

}  // namespace

bool CommandParser::requiresValue(CommandType type) {
  switch (type) {
    case CommandType::SetSpeed:
    case CommandType::SetLeftPwm:
    case CommandType::SetRightPwm:
    case CommandType::SetAngle:
      return true;
    default:
      return false;
  }
}

Command CommandParser::parse(const char* line) {
  Command cmd;
  if (line == nullptr) return cmd;

  // Spring indledende whitespace over.
  while (*line == ' ' || *line == '\t') ++line;

  // Læs nøgleordet i store bogstaver.
  char keyword[kMaxKeywordLength + 1];
  uint8_t len = 0;
  while (*line != '\0' && !isSeparator(*line)) {
    if (len >= kMaxKeywordLength) return cmd;  // For langt => Unknown
    keyword[len++] = static_cast<char>(toupper(static_cast<unsigned char>(*line)));
    ++line;
  }
  keyword[len] = '\0';
  if (len == 0) return cmd;

  for (const auto& entry : kKeywords) {
    if (strcmp(entry.keyword, keyword) == 0) {
      cmd.type = entry.type;
      break;
    }
  }
  if (cmd.type == CommandType::Unknown) return cmd;

  // Valgfri værdi efter separator.
  while (isSeparator(*line)) ++line;
  if (*line == '\0') return cmd;

  cmd.hasValue = true;
  char* end = nullptr;
  cmd.value = strtof(line, &end);
  // Tillad efterfølgende whitespace, men intet andet.
  while (end != nullptr && (*end == ' ' || *end == '\t' || *end == '\r')) ++end;
  cmd.valueValid = (end != line) && (end != nullptr) && (*end == '\0');
  return cmd;
}

}  // namespace padel
