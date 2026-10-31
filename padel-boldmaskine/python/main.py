"""Startpunkt for Linux-delen.

På Uno Q (App Lab) bruges Arduino Bridge automatisk. Under udvikling:

    python3 python/main.py --sim                  # simulator, ingen hardware
    python3 python/main.py --serial /dev/ttyACM0  # MCU via USB-serial

Web-UI: http://<maskine>:8080
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from padel.client import MachineClient  # noqa: E402
from padel.drills import DrillEngine  # noqa: E402
from padel.links import BridgeLink, LineLink, SerialLink, SimulatedLink  # noqa: E402
from padel.presets import PresetManager  # noqa: E402
from padel.webserver import PadelApp, serve  # noqa: E402

HERE = Path(__file__).resolve().parent


def build_link(args: argparse.Namespace) -> LineLink:
    if args.sim:
        return SimulatedLink()
    if args.serial:
        return SerialLink(args.serial, args.baud)
    return BridgeLink()  # Standard på Uno Q


def main() -> None:
    parser = argparse.ArgumentParser(description="Padel Boldmaskine – Linux-del")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--sim", action="store_true", help="kør mod simuleret MCU")
    mode.add_argument("--serial", metavar="PORT", help="seriel port til MCU'en")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default=os.environ.get("PADEL_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PADEL_PORT", "8080")))
    parser.add_argument("--data", default=os.environ.get("PADEL_DATA", str(HERE / "data")),
                        help="mappe til gemte træningsprogrammer")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    client = MachineClient(build_link(args))
    client.start()
    app = PadelApp(client, PresetManager(Path(args.data) / "presets.json"), DrillEngine(client))
    server = serve(app, HERE / "web", args.host, args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            client.stop()  # Efterlad aldrig maskinen kørende
        except Exception:
            pass
        client.close()
        server.server_close()


if __name__ == "__main__":
    main()
