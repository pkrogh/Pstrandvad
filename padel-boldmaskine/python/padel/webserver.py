"""Web Interface – HTTP-server med JSON-API og statisk web-app.

Kun Python's standardbibliotek, så der ikke skal installeres noget på Uno Q.
Serveren kører i egne tråde og kan aldrig blokere motorstyringen, som ligger
på MCU'en.

API (alle svar er JSON):
  GET    /api/status               maskinstatus + træningsprogram-fremskridt
  POST   /api/command              {"cmd": "start|stop|fire|home|estop|reset|
                                             speed|left|right|angle", "value": n}
  GET    /api/presets              alle træningsprogrammer
  PUT    /api/presets/<navn>       gem/overskriv program (Drill-JSON)
  DELETE /api/presets/<navn>       slet brugerprogram
  POST   /api/drill/start          {"name": "<program>"}
  POST   /api/drill/stop

Sikkerhed: Der er ingen login. Serveren er beregnet til et lukket lokalnet
(maskinens eget WiFi). Se docs/arkitektur.md før den eksponeres bredere.
"""

from __future__ import annotations

import json
import logging
import mimetypes
from dataclasses import asdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlparse

from .client import MachineClient
from .drills import Drill, DrillEngine
from .presets import PresetManager
from .protocol import BusyError, ProtocolError

log = logging.getLogger(__name__)

MAX_BODY = 64 * 1024


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status


class PadelApp:
    """Forretningslogikken bag API'et – uafhængig af HTTP, så den kan genbruges
    af f.eks. en fremtidig Bluetooth-grænseflade."""

    def __init__(self, client: MachineClient, presets: PresetManager, drills: DrillEngine):
        self.client = client
        self.presets = presets
        self.drills = drills

    def status(self) -> dict:
        return {
            "connected": self.client.connected,
            "machine": self.client.status.to_dict(),
            "drill": asdict(self.drills.progress),
        }

    def command(self, body: dict) -> dict:
        cmd = str(body.get("cmd", "")).lower()
        value = body.get("value")
        c = self.client
        actions: dict[str, Callable[[], None]] = {
            "start": c.start_wheels,
            "stop": self._stop_all,
            "fire": c.fire,
            "home": c.home,
            "estop": self._estop,
            "reset": c.reset,
            "speed": lambda: c.set_speed(self._num(value)),
            "left": lambda: c.set_left_speed(self._num(value)),
            "right": lambda: c.set_right_speed(self._num(value)),
            "angle": lambda: c.move_to_angle(self._num(value)),
        }
        if cmd not in actions:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Ukendt kommando: {cmd}")
        actions[cmd]()
        return {"ok": True}

    def _stop_all(self) -> None:
        if self.drills.running:
            self.drills.stop()
        else:
            self.client.stop()

    def _estop(self) -> None:
        self.client.estop()  # Først – nødstop må aldrig vente på andet
        if self.drills.running:
            self.drills.stop()

    @staticmethod
    def _num(value: Any) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ApiError(HTTPStatus.BAD_REQUEST, "value skal være et tal")
        return value

    def start_drill(self, body: dict) -> dict:
        try:
            drill = self.presets.get(str(body.get("name", "")))
        except KeyError:
            raise ApiError(HTTPStatus.NOT_FOUND, "Ukendt træningsprogram") from None
        try:
            self.drills.start(drill)
        except RuntimeError as exc:
            raise ApiError(HTTPStatus.CONFLICT, str(exc)) from None
        return {"ok": True}

    def save_preset(self, name: str, body: dict) -> dict:
        try:
            drill = Drill.from_dict({**body, "name": name})
        except (KeyError, TypeError, ValueError) as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Ugyldigt program: {exc}") from None
        self.presets.save(drill)
        return {"ok": True}

    def delete_preset(self, name: str) -> dict:
        try:
            self.presets.delete(name)
        except KeyError:
            raise ApiError(HTTPStatus.NOT_FOUND, "Kun egne programmer kan slettes") from None
        return {"ok": True}


def make_handler(app: PadelApp, static_dir: Path) -> type[BaseHTTPRequestHandler]:
    static_root = static_dir.resolve()

    class Handler(BaseHTTPRequestHandler):
        server_version = "PadelBoldmaskine/0.1"

        def log_message(self, fmt: str, *args: Any) -> None:
            log.debug("%s - %s", self.address_string(), fmt % args)

        # --- Hjælpere -------------------------------------------------------
        def _json(self, status: HTTPStatus, payload: Any) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _body(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "For stor forespørgsel")
            if length == 0:
                return {}
            try:
                body = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Ugyldig JSON") from None
            if not isinstance(body, dict):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Forventede et JSON-objekt")
            return body

        def _dispatch(self, method: str) -> None:
            path = urlparse(self.path).path
            try:
                if path.startswith("/api/"):
                    self._json(HTTPStatus.OK, self._api(method, path))
                elif method == "GET":
                    self._static(path)
                else:
                    raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "Metode ikke tilladt")
            except ApiError as exc:
                self._json(exc.status, {"error": str(exc)})
            except BusyError:
                self._json(HTTPStatus.CONFLICT, {"error": "Maskinen er optaget (BUSY)"})
            except ValueError as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            except ProtocolError as exc:
                self._json(HTTPStatus.CONFLICT, {"error": f"Maskinen afviste: {exc}"})
            except TimeoutError as exc:
                self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": str(exc)})
            except Exception:
                log.exception("Uventet fejl")
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Intern fejl"})

        def _api(self, method: str, path: str) -> Any:
            route = (method, path)
            if route == ("GET", "/api/status"):
                return app.status()
            if route == ("POST", "/api/command"):
                return app.command(self._body())
            if route == ("GET", "/api/presets"):
                return app.presets.list()
            if route == ("POST", "/api/drill/start"):
                return app.start_drill(self._body())
            if route == ("POST", "/api/drill/stop"):
                app.drills.stop()
                return {"ok": True}
            if path.startswith("/api/presets/"):
                name = unquote(path[len("/api/presets/"):])
                if method == "PUT":
                    return app.save_preset(name, self._body())
                if method == "DELETE":
                    return app.delete_preset(name)
            raise ApiError(HTTPStatus.NOT_FOUND, "Ukendt endpoint")

        def _static(self, path: str) -> None:
            rel = "index.html" if path in ("", "/") else path.lstrip("/")
            target = (static_root / rel).resolve()
            # Forhindr path traversal (../../etc/passwd).
            if static_root not in target.parents and target != static_root:
                raise ApiError(HTTPStatus.NOT_FOUND, "Ikke fundet")
            if not target.is_file():
                raise ApiError(HTTPStatus.NOT_FOUND, "Ikke fundet")
            data = target.read_bytes()
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None: self._dispatch("GET")
        def do_POST(self) -> None: self._dispatch("POST")
        def do_PUT(self) -> None: self._dispatch("PUT")
        def do_DELETE(self) -> None: self._dispatch("DELETE")

    return Handler


def serve(app: PadelApp, static_dir: Path, host: str, port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), make_handler(app, static_dir))
    server.daemon_threads = True
    log.info("Web-UI på http://%s:%d", host, port)
    return server
