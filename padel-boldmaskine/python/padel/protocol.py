"""Tekstprotokollen mellem Linux og MCU.

Ét sted definerer kommandoer, grænser og parsing af svar, så resten af
Linux-koden aldrig bygger protokolstrenge i hånden. Se docs/protokol.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Grænser – skal matche sketch/src/Config.h
PWM_MIN, PWM_MAX = 0, 255
ANGLE_MIN, ANGLE_MAX = 0.0, 60.0


class ProtocolError(Exception):
    """MCU'en svarede ERROR, eller svaret kunne ikke forstås."""


class BusyError(ProtocolError):
    """MCU'en svarede BUSY – prøv igen senere."""


def _check_pwm(value: int) -> int:
    value = int(value)
    if not PWM_MIN <= value <= PWM_MAX:
        raise ValueError(f"PWM skal være {PWM_MIN}..{PWM_MAX}, fik {value}")
    return value


def _check_angle(value: float) -> float:
    value = float(value)
    if not ANGLE_MIN <= value <= ANGLE_MAX:
        raise ValueError(f"Vinkel skal være {ANGLE_MIN}..{ANGLE_MAX}, fik {value}")
    return value


# --- Kommando-byggere --------------------------------------------------------
def ping() -> str: return "PING"
def status() -> str: return "STATUS"
def home() -> str: return "HOME"
def start() -> str: return "START"
def stop() -> str: return "STOP"
def fire() -> str: return "FIRE"
def estop() -> str: return "ESTOP"
def reset() -> str: return "RESET"
def get_angle() -> str: return "GET_ANGLE"
def set_speed(pwm: int) -> str: return f"SET_SPEED={_check_pwm(pwm)}"
def set_left_pwm(pwm: int) -> str: return f"SET_LEFT_PWM={_check_pwm(pwm)}"
def set_right_pwm(pwm: int) -> str: return f"SET_RIGHT_PWM={_check_pwm(pwm)}"
def set_angle(deg: float) -> str: return f"SET_ANGLE={_check_angle(deg):.1f}"


# --- Svar --------------------------------------------------------------------
def is_event(line: str) -> bool:
    """Asynkrone linjer, som ikke er svar på en kommando."""
    return line.startswith("EVT ") or line == "READY"


def check_reply(line: str) -> str:
    """Returnerer svaret hvis det er en succes, ellers rejses en fejl."""
    if line == "BUSY":
        raise BusyError("BUSY")
    if line.startswith("ERROR"):
        raise ProtocolError(line[6:].strip() or "ERROR")
    return line


@dataclass
class MachineStatus:
    """Parset STATUS-linje. Ukendte felter gemmes i extra (fremadkompatibelt)."""

    state: str = "UNKNOWN"
    homed: bool = False
    angle: float = 0.0
    target: float = 0.0
    left: int = 0
    left_target: int = 0
    right: int = 0
    right_target: int = 0
    running: bool = False
    firing: bool = False
    comm: bool = False
    fault: str = "NONE"
    extra: dict[str, str] = field(default_factory=dict)

    @classmethod
    def parse(cls, line: str) -> "MachineStatus":
        if not line.startswith("STATUS"):
            raise ProtocolError(f"Ikke en STATUS-linje: {line!r}")
        fields: dict[str, str] = {}
        for token in line.split()[1:]:
            key, sep, value = token.partition("=")
            if sep:
                fields[key] = value
        st = cls()
        converters = {
            "state": str, "fault": str,
            "angle": float, "target": float,
            "left": int, "left_target": int, "right": int, "right_target": int,
            "homed": lambda v: v == "1", "running": lambda v: v == "1",
            "firing": lambda v: v == "1", "comm": lambda v: v == "1",
        }
        for key, value in fields.items():
            if key in converters:
                setattr(st, key, converters[key](value))
            else:
                st.extra[key] = value
        return st

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}
