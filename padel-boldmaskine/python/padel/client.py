"""MachineClient – Linux-sidens eneste indgang til MCU'en.

Ansvar:
  * request/response: én kommando ad gangen, venter på svaret med timeout
  * hændelser (EVT ...) fordeles til abonnenter
  * heartbeat: sender STATUS jævnligt, så MCU'ens kommunikations-watchdog
    holdes fodret, og så status-cachen er frisk til web-UI'et

Linux styrer ALDRIG motorer direkte – kun via disse tekstkommandoer.
"""

from __future__ import annotations

import logging
import queue
import threading
from typing import Callable

from . import protocol
from .links import LineLink
from .protocol import MachineStatus, ProtocolError

log = logging.getLogger(__name__)

EventHandler = Callable[[str], None]


class MachineClient:
    def __init__(self, link: LineLink, *, reply_timeout: float = 0.5,
                 heartbeat_interval: float = 0.3) -> None:
        self._link = link
        self._reply_timeout = reply_timeout
        self._heartbeat_interval = heartbeat_interval
        self._replies: queue.Queue[str] = queue.Queue()
        self._request_lock = threading.Lock()
        self._listeners: list[EventHandler] = []
        self._listeners_lock = threading.Lock()
        self._stop = threading.Event()
        self.status = MachineStatus()
        self.connected = False
        link.set_line_handler(self._on_line)

    # --- Livscyklus ---------------------------------------------------------
    def start(self) -> None:
        self._link.open()
        threading.Thread(target=self._heartbeat, name="heartbeat", daemon=True).start()

    def close(self) -> None:
        self._stop.set()
        self._link.close()

    # --- Hændelser ----------------------------------------------------------
    def add_listener(self, handler: EventHandler) -> None:
        with self._listeners_lock:
            self._listeners.append(handler)

    def remove_listener(self, handler: EventHandler) -> None:
        with self._listeners_lock:
            if handler in self._listeners:
                self._listeners.remove(handler)

    def _on_line(self, line: str) -> None:
        if protocol.is_event(line):
            log.info("MCU: %s", line)
            with self._listeners_lock:
                listeners = list(self._listeners)
            for handler in listeners:
                try:
                    handler(line)
                except Exception:  # En fejlende lytter må ikke vælte forbindelsen
                    log.exception("Fejl i hændelseslytter")
        else:
            self._replies.put(line)

    # --- Kommandoer ---------------------------------------------------------
    def request(self, line: str) -> str:
        """Sender én kommando og returnerer svaret. Rejser ProtocolError/BusyError
        ved fejlsvar og TimeoutError hvis MCU'en ikke svarer."""
        with self._request_lock:
            # Smid evt. forsinkede svar fra en tidligere timeout væk.
            while not self._replies.empty():
                self._replies.get_nowait()
            self._link.send_line(line)
            try:
                reply = self._replies.get(timeout=self._reply_timeout)
            except queue.Empty:
                self.connected = False
                raise TimeoutError(f"Intet svar på {line!r}") from None
        self.connected = True
        return protocol.check_reply(reply)

    def refresh_status(self) -> MachineStatus:
        self.status = MachineStatus.parse(self.request(protocol.status()))
        return self.status

    # Bekvemmelighedsmetoder – samme navne som i projektbeskrivelsen.
    def home(self) -> None: self.request(protocol.home())
    def start_wheels(self) -> None: self.request(protocol.start())
    def stop(self) -> None: self.request(protocol.stop())
    def fire(self) -> None: self.request(protocol.fire())
    def estop(self) -> None: self.request(protocol.estop())
    def reset(self) -> None: self.request(protocol.reset())
    def set_speed(self, pwm: int) -> None: self.request(protocol.set_speed(pwm))
    def set_left_speed(self, pwm: int) -> None: self.request(protocol.set_left_pwm(pwm))
    def set_right_speed(self, pwm: int) -> None: self.request(protocol.set_right_pwm(pwm))
    def move_to_angle(self, deg: float) -> None: self.request(protocol.set_angle(deg))

    def wait_for_event(self, prefix: str, timeout: float,
                       trigger: Callable[[], None] | None = None) -> str | None:
        """Venter på en hændelse der starter med prefix. trigger() kaldes efter
        lytteren er registreret, så hændelsen ikke kan nå at blive misset."""
        got: queue.Queue[str] = queue.Queue()

        def handler(line: str) -> None:
            if line.startswith(prefix) or line.startswith("EVT FAULT"):
                got.put(line)

        self.add_listener(handler)
        try:
            if trigger:
                trigger()
            return got.get(timeout=timeout)
        except queue.Empty:
            return None
        finally:
            self.remove_listener(handler)

    # --- Heartbeat ----------------------------------------------------------
    def _heartbeat(self) -> None:
        while not self._stop.wait(self._heartbeat_interval):
            try:
                self.refresh_status()
            except (TimeoutError, ProtocolError) as exc:
                log.warning("Heartbeat fejlede: %s", exc)
