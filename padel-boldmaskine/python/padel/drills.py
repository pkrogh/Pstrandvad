"""Drill Engine – afvikler træningsprogrammer.

Et træningsprogram (Drill) er en liste af skud. Hvert skud angiver vinkel,
hjulhastigheder og pausen før næste skud. Motorstyringen sker stadig på MCU'en;
Drill Engine sender blot kommandoer og venter på EVT FIRED.

NB: Maskinen har i dag kun én akse (elevation). "Højre/venstre" kræver en
fremtidig sideakse – feltet `side` er reserveret til den og ignoreres indtil da.
"""

from __future__ import annotations

import logging
import random
import threading
from dataclasses import asdict, dataclass, field

from .client import MachineClient
from .protocol import BusyError, ProtocolError

log = logging.getLogger(__name__)


@dataclass
class Shot:
    angle: float          # Grader
    left: int             # PWM venstre hjul
    right: int            # PWM højre hjul (forskel fra left = spin)
    pause: float = 3.0    # Sekunder efter skuddet før næste
    name: str = ""
    side: str = "center"  # Reserveret til fremtidig sideakse

    @classmethod
    def from_dict(cls, d: dict) -> "Shot":
        return cls(**{k: d[k] for k in cls.__dataclass_fields__ if k in d})


@dataclass
class Drill:
    name: str
    shots: list[Shot]
    repeat: int = 1
    shuffle: bool = False   # "Tilfældige bolde"
    description: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Drill":
        shots = [Shot.from_dict(s) for s in d.get("shots", [])]
        if not shots:
            raise ValueError("Et træningsprogram skal have mindst ét skud")
        return cls(name=str(d["name"]), shots=shots, repeat=max(1, int(d.get("repeat", 1))),
                   shuffle=bool(d.get("shuffle", False)),
                   description=str(d.get("description", "")))


# Skudtyper der kan genbruges i programmer.
SHOT_LIBRARY: dict[str, Shot] = {
    "flad": Shot(angle=8, left=170, right=170, name="flad"),
    "dyb": Shot(angle=14, left=200, right=200, name="dyb"),
    "lob": Shot(angle=40, left=150, right=150, name="lob"),
    "smash": Shot(angle=52, left=165, right=165, name="smash"),  # Høj bold at smashe
    "topspin": Shot(angle=10, left=200, right=160, name="topspin"),
}


@dataclass
class DrillProgress:
    running: bool = False
    drill: str | None = None
    shot_index: int = 0
    shots_total: int = 0
    shots_fired: int = 0
    error: str | None = None
    history: list[str] = field(default_factory=list)


class DrillEngine:
    FIRE_TIMEOUT = 8.0
    HOME_TIMEOUT = 20.0

    def __init__(self, client: MachineClient) -> None:
        self._client = client
        self._thread: threading.Thread | None = None
        self._cancel = threading.Event()
        self.progress = DrillProgress()

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self, drill: Drill) -> None:
        if self.running:
            raise RuntimeError("Et træningsprogram kører allerede")
        self._cancel.clear()
        self.progress = DrillProgress(running=True, drill=drill.name)
        self._thread = threading.Thread(target=self._run, args=(drill,), name="drill",
                                        daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._cancel.set()
        try:
            self._client.stop()
        except (TimeoutError, ProtocolError) as exc:
            log.warning("STOP fejlede: %s", exc)
        if self._thread:
            self._thread.join(timeout=2.0)

    def _run(self, drill: Drill) -> None:
        c = self._client
        try:
            sequence: list[Shot] = []
            for _ in range(drill.repeat):
                shots = list(drill.shots)
                if drill.shuffle:
                    random.shuffle(shots)
                sequence.extend(shots)
            self.progress.shots_total = len(sequence)

            if not c.refresh_status().homed:
                evt = c.wait_for_event("EVT HOMED", self.HOME_TIMEOUT, trigger=c.home)
                if evt is None or evt.startswith("EVT FAULT"):
                    raise RuntimeError(f"Homing mislykkedes: {evt}")

            c.start_wheels()
            for i, shot in enumerate(sequence):
                if self._cancel.is_set():
                    break
                self.progress.shot_index = i
                c.move_to_angle(shot.angle)
                c.set_left_speed(shot.left)
                c.set_right_speed(shot.right)
                evt = self._fire_with_retry()
                if evt is None or not evt.startswith("EVT FIRED"):
                    raise RuntimeError(f"Skud {i + 1} blev ikke affyret: {evt}")
                self.progress.shots_fired += 1
                self.progress.history.append(shot.name or f"skud {i + 1}")
                if self._cancel.wait(shot.pause):
                    break
            c.stop()
        except Exception as exc:  # Rapportér til UI og stop maskinen sikkert
            log.error("Træningsprogram afbrudt: %s", exc)
            self.progress.error = str(exc)
            try:
                c.stop()
            except Exception:
                pass
        finally:
            self.progress.running = False

    def _fire_with_retry(self) -> str | None:
        """FIRE kan svare BUSY under cooldown; prøv igen kortvarigt."""
        for _ in range(20):
            try:
                return self._client.wait_for_event("EVT FIRE", self.FIRE_TIMEOUT,
                                                   trigger=self._client.fire)
            except BusyError:
                if self._cancel.wait(0.1):
                    return None
        return None
