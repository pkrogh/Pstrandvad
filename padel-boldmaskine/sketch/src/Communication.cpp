#include "Communication.h"

#include <stdio.h>
#include <string.h>

namespace padel {

bool LineAssembler::push(char c) {
  if (c == '\r') return false;  // Ignorér CR (CRLF-linjeskift)

  if (c == '\n') {
    const bool complete = !overflow_ && length_ > 0;
    buffer_[length_] = '\0';
    length_ = 0;
    overflow_ = false;
    return complete;
  }

  if (length_ >= sizeof(buffer_) - 1) {
    overflow_ = true;  // Kassér resten af denne linje
    return false;
  }
  buffer_[length_++] = c;
  return false;
}

int Communication::formatFixed1(char* buf, int capacity, float value) {
  const bool negative = value < 0.0f;
  const float absValue = negative ? -value : value;
  const long tenths = static_cast<long>(absValue * 10.0f + 0.5f);
  return snprintf(buf, capacity, "%s%ld.%ld", negative && tenths != 0 ? "-" : "", tenths / 10,
                  tenths % 10);
}

void Communication::sendFixed1(const char* prefix, float value) {
  char line[config::kMaxLineLength];
  const int prefixLen = snprintf(line, sizeof(line), "%s", prefix);
  if (prefixLen < 0 || prefixLen >= static_cast<int>(sizeof(line))) return;
  formatFixed1(line + prefixLen, sizeof(line) - prefixLen, value);
  send(line);
}

}  // namespace padel
