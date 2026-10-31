"""Preset Manager – gemmer og henter træningsprogrammer som JSON.

Indbyggede programmer (Begynder, Øvet, Elite) kan ikke slettes, men kan
overskrives af brugerens egne. Brugerprogrammer gemmes i én JSON-fil.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

from .drills import SHOT_LIBRARY, Drill, Shot


def _shot(kind: str, **overrides) -> Shot:
    base = SHOT_LIBRARY[kind]
    return Shot(**{**base.__dict__, **overrides})


BUILTIN_PRESETS: dict[str, Drill] = {
    "Begynder": Drill(
        name="Begynder",
        description="Rolige, flade bolde med god tid imellem.",
        shots=[_shot("flad", left=140, right=140, pause=5.0)],
        repeat=10,
    ),
    "Øvet": Drill(
        name="Øvet",
        description="Blanding af flade, dybe bolde og lob.",
        shots=[_shot("flad", pause=3.5), _shot("dyb", pause=3.5), _shot("lob", pause=4.0)],
        repeat=5,
    ),
    "Elite": Drill(
        name="Elite",
        description="Højt tempo, tilfældig rækkefølge, inkl. smash og topspin.",
        shots=[_shot("dyb", pause=2.2), _shot("topspin", pause=2.2),
               _shot("lob", pause=2.5), _shot("smash", pause=2.5)],
        repeat=6,
        shuffle=True,
    ),
}


class PresetManager:
    def __init__(self, path: str | os.PathLike) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        self._custom: dict[str, Drill] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        data = json.loads(self._path.read_text(encoding="utf-8"))
        self._custom = {d["name"]: Drill.from_dict(d) for d in data.get("presets", [])}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        payload = {"version": 1, "presets": [d.to_dict() for d in self._custom.values()]}
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._path)  # Atomisk: ingen halvskrevet fil ved strømsvigt

    def list(self) -> list[dict]:
        with self._lock:
            merged = {**BUILTIN_PRESETS, **self._custom}
            return [{**d.to_dict(), "builtin": name in BUILTIN_PRESETS and name not in self._custom}
                    for name, d in merged.items()]

    def get(self, name: str) -> Drill:
        with self._lock:
            if name in self._custom:
                return self._custom[name]
            if name in BUILTIN_PRESETS:
                return BUILTIN_PRESETS[name]
        raise KeyError(name)

    def save(self, drill: Drill) -> None:
        with self._lock:
            self._custom[drill.name] = drill
            self._save()

    def delete(self, name: str) -> None:
        with self._lock:
            if name not in self._custom:
                raise KeyError(name)
            del self._custom[name]
            self._save()
