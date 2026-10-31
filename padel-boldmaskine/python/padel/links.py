"""Transportlag: hvordan tekstlinjer kommer frem og tilbage til MCU'en.

Alle links har samme interface (LineLink), så resten af systemet er
uafhængigt af om vi kører på Uno Q (Bridge), via USB-serial eller mod en
simulator under udvikling.
"""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from typing import Callable

log = logging.getLogger(__name__)

LineHandler = Callable[[str], None]


class LineLink(ABC):
    """Sender linjer til MCU'en og leverer modtagne linjer til en handler."""

    def __init__(self) -> None:
        self._handler: LineHandler | None = None

    def set_line_handler(self, handler: LineHandler) -> None:
        self._handler = handler

    def _deliver(self, line: str) -> None:
        line = line.strip()
        if line and self._handler:
            self._handler(line)

    @abstractmethod
    def open(self) -> None: ...

    @abstractmethod
    def send_line(self, line: str) -> None: ...

    def close(self) -> None:  # pragma: no cover - valgfri
        pass


class SerialLink(LineLink):
    """USB-/UART-serial. Kræver pyserial."""

    def __init__(self, port: str, baud: int = 115200) -> None:
        super().__init__()
        self._port_name = port
        self._baud = baud
        self._serial = None
        self._running = False

    def open(self) -> None:
        import serial  # Importeres først her, så pyserial kun kræves ved brug

        self._serial = serial.Serial(self._port_name, self._baud, timeout=0.1)
        self._running = True
        threading.Thread(target=self._reader, name="serial-reader", daemon=True).start()

    def _reader(self) -> None:
        buf = b""
        while self._running:
            chunk = self._serial.read(256)
            if not chunk:
                continue
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                self._deliver(raw.decode("ascii", errors="replace"))

    def send_line(self, line: str) -> None:
        self._serial.write((line + "\n").encode("ascii"))

    def close(self) -> None:
        self._running = False
        if self._serial:
            self._serial.close()


class BridgeLink(LineLink):
    """Arduino Bridge på Uno Q (kun tilgængelig i App Lab-miljøet).

    VERIFICÉR mod Arduino's dokumentation: navnene padel_cmd/padel_line skal
    matche sketch/src/BridgeLineTransport.h.
    """

    def open(self) -> None:
        from arduino.app_utils import Bridge  # type: ignore[import-not-found]

        self._bridge = Bridge
        Bridge.provide("padel_line", self._deliver)

    def send_line(self, line: str) -> None:
        self._bridge.notify("padel_cmd", line)


class SimulatedLink(LineLink):
    """Simpel software-model af MCU'en til udvikling og tests uden hardware.

    Modellen er bevidst forenklet (øjeblikkelige bevægelser, korte forsinkelser)
    men følger protokollens svar og hændelser.
    """

    HOMING_TIME = 0.3
    FIRE_TIME = 0.2

    def __init__(self) -> None:
        super().__init__()
        self._lock = threading.Lock()
        self.homed = False
        self.homing = False
        self.angle = 0.0
        self.left = self.right = 0
        self.running = False
        self.firing = False
        self.fault = "NONE"
        self.received: list[str] = []

    def open(self) -> None:
        self._later(0.0, "READY")

    def _later(self, delay: float, line: str, action: Callable[[], None] | None = None) -> None:
        def run() -> None:
            time.sleep(delay)
            if action:
                with self._lock:
                    action()
            self._deliver(line)

        threading.Thread(target=run, daemon=True).start()

    def send_line(self, line: str) -> None:
        self.received.append(line)
        with self._lock:
            reply = self._handle(line)
        self._deliver(reply)

    def _handle(self, line: str) -> str:  # noqa: C901 - en simpel dispatcher
        key, _, value = line.replace(" ", "=", 1).partition("=")
        key = key.upper()
        latched = self.fault != "NONE"
        if key == "PING":
            return "OK"
        if key == "STATUS":
            state = ("FAULT" if latched else "HOMING" if self.homing else
                     "NOT_HOMED" if not self.homed else "RUNNING" if self.running else "READY")
            return (f"STATUS state={state} homed={int(self.homed)} angle={self.angle:.1f} "
                    f"target={self.angle:.1f} left={self.left if self.running else 0} "
                    f"left_target={self.left} right={self.right if self.running else 0} "
                    f"right_target={self.right} running={int(self.running)} "
                    f"firing={int(self.firing)} comm=1 fault={self.fault}")
        if key == "GET_ANGLE":
            return f"ANGLE={self.angle:.1f}"
        if key in ("SET_SPEED", "SET_LEFT_PWM", "SET_RIGHT_PWM"):
            try:
                pwm = round(float(value))
            except ValueError:
                return "ERROR BAD_VALUE"
            if not 0 <= pwm <= 255:
                return "ERROR RANGE"
            if key != "SET_RIGHT_PWM":
                self.left = pwm
            if key != "SET_LEFT_PWM":
                self.right = pwm
            return "OK"
        if key in ("SET_ANGLE", "MOVE_ANGLE", "ANGLE"):
            if latched:
                return "ERROR FAULT"
            if self.homing:
                return "BUSY"
            if not self.homed:
                return "ERROR NOT_HOMED"
            try:
                deg = float(value)
            except ValueError:
                return "ERROR BAD_VALUE"
            if not 0.0 <= deg <= 60.0:
                return "ERROR RANGE"
            self.angle = deg
            return "OK"
        if key == "HOME":
            if latched:
                return "ERROR FAULT"
            self.homing = True

            def done() -> None:
                self.homing, self.homed, self.angle = False, True, 2.3

            self._later(self.HOMING_TIME, "EVT HOMED", done)
            return "OK"
        if key == "START":
            if latched:
                return "ERROR FAULT"
            self.running = True
            return "OK"
        if key == "STOP":
            self.running = self.firing = False
            return "OK"
        if key == "FIRE":
            if latched:
                return "ERROR FAULT"
            if not self.homed:
                return "ERROR NOT_HOMED"
            if not self.running:
                return "ERROR NOT_RUNNING"
            if self.firing:
                return "BUSY"
            self.firing = True

            def fired() -> None:
                self.firing = False

            self._later(self.FIRE_TIME, "EVT FIRED", fired)
            return "OK"
        if key == "ESTOP":
            self.fault, self.running, self.firing = "ESTOP_COMMAND", False, False
            return "OK"
        if key == "RESET":
            self.fault = "NONE"
            return "OK"
        return "ERROR UNKNOWN_COMMAND"
