// =============================================================================
// BridgeLineTransport.h – Linjetransport over Arduino Bridge (Uno Q).
//
// På Uno Q forbindes Linux (QRB2210) og MCU (STM32U585) internt af
// arduino-router, som eksponeres via biblioteket Arduino_RouterBridge.
// Vi bruger IKKE Bridge's RPC-typer til selve protokollen – vi sender de samme
// tekstlinjer som over en seriel port:
//
//   Linux -> MCU : notify "padel_cmd" med én kommandolinje (string)
//   MCU -> Linux : notify "padel_line" med én svar-/hændelseslinje (string)
//
// Dermed er protokollen identisk uanset transport, og Linux-siden kan testes
// mod en seriel port eller simulator.
//
// VERIFICÉR: Bridge-API'et (provide_safe / notify og typekonvertering af
// String) er skrevet efter Arduino's dokumentation for Uno Q og skal testes på
// rigtig hardware. Hvis provide_safe ikke findes i den installerede version,
// bruges provide, men så kører handleren i Bridge-tråden, og køen nedenfor
// skal gøres trådsikker (k_msgq i Zephyr).
// =============================================================================
#pragma once

#ifdef PADEL_USE_BRIDGE

#include <Arduino.h>
#include <Arduino_RouterBridge.h>
#include <string.h>

#include "Config.h"
#include "Hal.h"

namespace padel {

class BridgeLineTransport : public ILineTransport {
 public:
  /// Skal kaldes fra setup() efter Bridge.begin().
  void begin() {
    instance_ = this;
    Bridge.provide_safe("padel_cmd", &BridgeLineTransport::onCommand);
  }

  bool readLine(char* buf, uint8_t capacity) override {
    if (count_ == 0) return false;
    strncpy(buf, queue_[head_], capacity - 1);
    buf[capacity - 1] = '\0';
    head_ = (head_ + 1) % kQueueSize;
    --count_;
    return true;
  }

  void writeLine(const char* line) override { Bridge.notify("padel_line", String(line)); }

 private:
  static constexpr uint8_t kQueueSize = 8;

  static void onCommand(String line) {
    if (instance_ == nullptr) return;
    instance_->enqueue(line.c_str());
  }

  void enqueue(const char* line) {
    if (count_ >= kQueueSize) return;  // Fuld kø: kommandoen tabes, Linux får timeout
    const uint8_t tail = (head_ + count_) % kQueueSize;
    strncpy(queue_[tail], line, config::kMaxLineLength - 1);
    queue_[tail][config::kMaxLineLength - 1] = '\0';
    ++count_;
  }

  static BridgeLineTransport* instance_;
  char queue_[kQueueSize][config::kMaxLineLength] = {};
  uint8_t head_ = 0;
  uint8_t count_ = 0;
};

inline BridgeLineTransport* BridgeLineTransport::instance_ = nullptr;

}  // namespace padel

#endif  // PADEL_USE_BRIDGE
