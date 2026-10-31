# Padel Boldmaskine

En intelligent padel-boldmaskine til **Arduino Uno Q**. Mikrocontrolleren (STM32U585) står for al realtids-motorstyring. Linux-delen (QRB2210) står for web-UI, træningsprogrammer og kommunikation.

- Krav: [docs/specifikation.md](docs/specifikation.md)
- Arkitektur: [docs/arkitektur.md](docs/arkitektur.md)
- Protokol Linux ↔ MCU: [docs/protokol.md](docs/protokol.md)
- Til AI-værktøjer (Codex m.fl.): [AGENTS.md](AGENTS.md)

## Struktur

Strukturen følger Arduino App Lab-formatet: `app.yaml` + `python/` + `sketch/`.

```
padel-boldmaskine/
├── app.yaml                 App Lab-manifest
├── sketch/                  MCU-firmware (C++)
│   ├── sketch.ino           Opretter moduler, loop() kalder Machine::update()
│   ├── sketch.yaml          Board-profil og biblioteker
│   └── src/                 MotorControl, StepperControl, CommandParser, Scheduler,
│                            Communication, Safety, Machine, HAL
├── python/                  Linux-del
│   ├── main.py              Startpunkt (Bridge / serial / simulator)
│   ├── padel/               protocol, links, client, drills, presets, webserver
│   └── web/                 Web-app (HTML/CSS/JS, intet build-trin)
├── tests/
│   ├── firmware/            PC-unit-tests af MCU-logikken (make)
│   └── python/              Tests af Linux-delen mod simulator (unittest)
└── docs/
```

## Kom i gang uden hardware

Kræver Python 3.10+ og g++.

```bash
cd padel-boldmaskine
python3 python/main.py --sim          # Web-UI på http://localhost:8080 mod simuleret MCU
make -C tests/firmware test           # Firmware-tests
python3 -m unittest discover -s tests/python -v
```

## På Arduino Uno Q

1. Åbn mappen `padel-boldmaskine/` som app i **Arduino App Lab**, og kør den. Sketchen flashes til MCU'en, og `python/main.py` starter på Linux med Bridge som transport.
2. Åbn `http://<uno-q-ip>:8080` fra mobil, tablet eller computer.
3. Tryk **Kalibrér (home)** før første skud.

Hvis du vil styre MCU'en direkte over USB (f.eks. under fejlfinding), skal du udkommentere `#define PADEL_USE_BRIDGE` i `sketch.ino` og køre `python3 python/main.py --serial /dev/ttyACM0` (kræver `pip install pyserial`).

> **Før første kørsel med motorer:** Gennemgå alle værdier markeret `TBD` i `sketch/src/Config.h` (pins, trin pr. grad, vinkelgrænser og fremføring). Test først uden bolde og med hjulene afskærmet.

## Hardware (forventet)

| Funktion | Komponent | Pin (Config.h) |
| --- | --- | --- |
| Venstre hjul | DC-motor + PWM-driver | D5 |
| Højre hjul | DC-motor + PWM-driver | D6 |
| Vinkel | Stepper + STEP/DIR-driver (f.eks. TMC2209/DM542) | D2 STEP, D3 DIR, D4 EN |
| Endestop vinkel | Mikrokontakt mod GND (NO) | D7 |
| Nødstop | Svampeknap, NC mod GND | D8 |
| Boldfremføring | Solenoide/relæ (TBD) | D9 |

Nødstoppet bør **også** afbryde motorstrømmen fysisk (kontaktor). Softwarenødstoppet er et ekstra lag og erstatter det ikke.

## Status

| Område | Status |
| --- | --- |
| MCU-moduler (motor, stepper, parser, scheduler, safety) | Implementeret og unit-testet på PC |
| Linux: protokol, klient, heartbeat, drill engine, presets, web-UI | Implementeret og testet mod simulator |
| Bridge-transport og App Lab-manifest | Skrevet, **ikke verificeret på hardware** |
| Hardware-watchdog, Bluetooth, sideakse og sensorer | Ikke påbegyndt (se AGENTS.md) |
