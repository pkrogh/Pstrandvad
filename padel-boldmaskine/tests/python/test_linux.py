"""Tests af Linux-delen mod den simulerede MCU.

    python3 -m unittest discover -s tests/python -v
"""

from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python"))

from padel import protocol  # noqa: E402
from padel.client import MachineClient  # noqa: E402
from padel.drills import Drill, DrillEngine, Shot  # noqa: E402
from padel.links import SimulatedLink  # noqa: E402
from padel.presets import BUILTIN_PRESETS, PresetManager  # noqa: E402
from padel.protocol import BusyError, MachineStatus, ProtocolError  # noqa: E402
from padel.webserver import PadelApp, serve  # noqa: E402


def make_client() -> tuple[MachineClient, SimulatedLink]:
    link = SimulatedLink()
    client = MachineClient(link, heartbeat_interval=0.05)
    client.start()
    return client, link


class ProtocolTests(unittest.TestCase):
    def test_builders_validate(self) -> None:
        self.assertEqual(protocol.set_angle(35), "SET_ANGLE=35.0")
        self.assertEqual(protocol.set_left_pwm(180), "SET_LEFT_PWM=180")
        with self.assertRaises(ValueError):
            protocol.set_speed(256)
        with self.assertRaises(ValueError):
            protocol.set_angle(-1)

    def test_status_parse(self) -> None:
        st = MachineStatus.parse(
            "STATUS state=RUNNING homed=1 angle=25.0 target=30.5 left=180 left_target=180 "
            "right=175 right_target=175 running=1 firing=0 comm=1 fault=NONE new_field=x")
        self.assertEqual(st.state, "RUNNING")
        self.assertTrue(st.homed and st.running and st.comm)
        self.assertEqual(st.target, 30.5)
        self.assertEqual(st.right, 175)
        self.assertEqual(st.extra, {"new_field": "x"})

    def test_replies(self) -> None:
        self.assertTrue(protocol.is_event("EVT FIRED"))
        self.assertTrue(protocol.is_event("READY"))
        self.assertFalse(protocol.is_event("OK"))
        with self.assertRaises(BusyError):
            protocol.check_reply("BUSY")
        with self.assertRaisesRegex(ProtocolError, "NOT_HOMED"):
            protocol.check_reply("ERROR NOT_HOMED")


class ClientTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client, self.link = make_client()

    def tearDown(self) -> None:
        self.client.close()

    def test_heartbeat_keeps_status_fresh(self) -> None:
        time.sleep(0.2)
        self.assertTrue(self.client.connected)
        self.assertEqual(self.client.status.state, "NOT_HOMED")
        self.assertIn("STATUS", self.link.received)

    def test_errors_are_raised(self) -> None:
        with self.assertRaisesRegex(ProtocolError, "NOT_HOMED"):
            self.client.move_to_angle(10)

    def test_home_event(self) -> None:
        evt = self.client.wait_for_event("EVT HOMED", 2.0, trigger=self.client.home)
        self.assertEqual(evt, "EVT HOMED")
        self.assertTrue(self.client.refresh_status().homed)


class DrillTests(unittest.TestCase):
    def test_drill_runs_all_shots(self) -> None:
        client, link = make_client()
        try:
            engine = DrillEngine(client)
            drill = Drill(name="t", shots=[Shot(angle=10, left=150, right=140, pause=0.01),
                                           Shot(angle=40, left=120, right=120, pause=0.01)],
                          repeat=2)
            engine.start(drill)
            engine._thread.join(timeout=10)
            self.assertIsNone(engine.progress.error)
            self.assertEqual(engine.progress.shots_fired, 4)
            self.assertFalse(link.running)  # Stoppet til sidst
            self.assertIn("HOME", link.received)
            self.assertIn("SET_ANGLE=40.0", link.received)
        finally:
            client.close()

    def test_stop_interrupts(self) -> None:
        client, link = make_client()
        try:
            engine = DrillEngine(client)
            engine.start(Drill(name="lang", shots=[Shot(angle=10, left=100, right=100, pause=5)],
                               repeat=50))
            time.sleep(0.8)
            engine.stop()
            self.assertFalse(engine.running)
            self.assertLess(engine.progress.shots_fired, 50)
            self.assertFalse(link.running)
        finally:
            client.close()


class PresetTests(unittest.TestCase):
    def test_save_load_delete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "presets.json"
            pm = PresetManager(path)
            names = [p["name"] for p in pm.list()]
            self.assertEqual(names[:3], list(BUILTIN_PRESETS))
            pm.save(Drill(name="Custom", shots=[Shot(angle=5, left=1, right=2)]))
            self.assertEqual(PresetManager(path).get("Custom").shots[0].right, 2)
            with self.assertRaises(KeyError):
                pm.delete("Elite")  # Indbyggede kan ikke slettes
            pm.delete("Custom")
            self.assertNotIn("Custom", [p["name"] for p in PresetManager(path).list()])

    def test_invalid_drill(self) -> None:
        with self.assertRaises(ValueError):
            Drill.from_dict({"name": "tom", "shots": []})


class WebTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        cls.client, cls.link = make_client()
        app = PadelApp(cls.client, PresetManager(Path(cls.tmp.name) / "p.json"),
                       DrillEngine(cls.client))
        cls.server = serve(app, ROOT / "python" / "web", "127.0.0.1", 0)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.client.close()
        cls.tmp.cleanup()

    def call(self, method: str, path: str, body: dict | None = None) -> tuple[int, object]:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                return res.status, json.loads(res.read())
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read())

    def test_index_served(self) -> None:
        with urllib.request.urlopen(self.base + "/", timeout=5) as res:
            self.assertIn(b"Padel Boldmaskine", res.read())

    def test_path_traversal_blocked(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(self.base + "/../padel/client.py", timeout=5)
        self.assertEqual(ctx.exception.code, 404)

    def test_commands(self) -> None:
        self.assertEqual(self.call("POST", "/api/command", {"cmd": "speed", "value": 120})[0], 200)
        self.assertEqual(self.link.left, 120)
        self.assertEqual(self.call("POST", "/api/command", {"cmd": "speed", "value": 999})[0], 400)
        self.assertEqual(self.call("POST", "/api/command", {"cmd": "angle", "value": "x"})[0], 400)
        self.assertEqual(self.call("POST", "/api/command", {"cmd": "rm -rf"})[0], 400)
        status, body = self.call("POST", "/api/command", {"cmd": "fire"})
        self.assertEqual(status, 409)
        self.assertIn("NOT_HOMED", body["error"])
        status, body = self.call("GET", "/api/status")
        self.assertEqual(status, 200)
        self.assertIn("machine", body)

    def test_presets_api(self) -> None:
        drill = {"repeat": 3, "shots": [{"angle": 10, "left": 100, "right": 100}]}
        self.assertEqual(self.call("PUT", "/api/presets/Min%20drill", drill)[0], 200)
        _, presets = self.call("GET", "/api/presets")
        self.assertIn("Min drill", [p["name"] for p in presets])
        self.assertEqual(self.call("PUT", "/api/presets/x", {"shots": []})[0], 400)
        self.assertEqual(self.call("DELETE", "/api/presets/Min%20drill")[0], 200)
        self.assertEqual(self.call("POST", "/api/drill/start", {"name": "findes ikke"})[0], 404)


if __name__ == "__main__":
    unittest.main()
