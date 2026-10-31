# Arkitektur

## Overblik

```
┌──────────────────────── Arduino Uno Q ─────────────────────────┐
│                                                                │
│  Linux (QRB2210, Python)                MCU (STM32U585, C++)   │
│  ┌──────────────┐                       ┌──────────────────┐   │
│  │ Web-app (JS) │◄─HTTP─┐               │ Machine          │   │
│  └──────────────┘       │               │  (orkestrering)  │   │
│  ┌──────────────┐  ┌────┴─────┐  tekst  │  ├ CommandParser │   │
│  │ DrillEngine  ├─►│ Machine- │◄──────► │  ├ Communication │   │
│  │ PresetManager│  │ Client   │ linjer  │  ├ Safety        │   │
│  └──────────────┘  └──────────┘ (Bridge)│  ├ Scheduler ────┼─► fremføring
│                     heartbeat           │  ├ MotorControl ─┼─► 2× DC (PWM)
│                                         │  └ StepperControl┼─► STEP/DIR
│                                         └──────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**Hovedregel:** Linux beslutter *hvad* der skal ske. MCU'en beslutter *hvordan* og *om* det er sikkert.
Linux sender kun tekstkommandoer. Den rører aldrig PWM- eller step-pins.

## MCU-firmware (`sketch/`)

| Fil | Ansvar |
| --- | --- |
| `sketch.ino` | Opretter HAL-objekter og moduler, og kalder `machine.update()` fra `loop()`. Indeholder ingen logik |
| `src/Config.h` | Alle pins, grænser og timing på ét sted |
| `src/Hal.h` | Interfaces for ur, PWM, digitale pins, transport og watchdog |
| `src/ArduinoHal.h` | HAL bygget på Arduino-API'et, plus `StreamLineTransport` |
| `src/BridgeLineTransport.h` | Transport over Arduino Bridge (Uno Q) |
| `src/MotorControl.*` | To DC-motorer med rampe, start/stop og individuel hastighed (spin) |
| `src/StepperControl.*` | Trapezprofil, homing mod endestop og vinkelstyring |
| `src/CommandParser.*` | Tekst → `Command`. Ingen heap |
| `src/Communication.*` | Samler linjer (`LineAssembler`) og formaterer svar |
| `src/Scheduler.*` | Affyringssekvens og `IntervalTimer` |
| `src/Safety.*` | Nødstop-input, kommunikationstimeout, fejltilstande og hardware-watchdog |
| `src/Machine.*` | Binder modulerne sammen, sender kommandoer videre og håndhæver Safety |

### Designvalg

- **Dependency injection og HAL:** Ingen moduler inkluderer `Arduino.h`. Alt kan derfor testes på en PC (`tests/firmware`), og et skift af board kræver kun en ny HAL.
- **Ingen globale variable i modulerne:** Kun `sketch.ino` ejer instanserne, i et anonymt namespace.
- **Ingen heap og ingen `String`** i realtidskoden. Bufferne har fast størrelse.
- **Non-blocking:** Alle moduler har en `update(now)`, som returnerer med det samme. `Machine` behandler højst 4 kommandolinjer pr. loop og kalder `stepper.update()` mellem dem.
- **Fejlsikker opstart:** Konstruktører rører ikke hardware. `setup()` sætter alle udgange sikkert, før noget andet sker.
- **Nødstop-input:** Det er en NC-kontakt, så en knækket ledning også udløser nødstop.

### Realtid og opgraderingssti

Stepperen genererer trin ved at polle `micros()` i `loop()`. Det giver op til flere kHz trinfrekvens, så længe `loop()` er kort. Hvis der kommer behov for højere hastighed eller lavere jitter, kan `StepperControl::update()`'s trinlogik flyttes til en hardware-timer-ISR uden at ændre API'et.

## Linux-del (`python/`)

| Modul | Ansvar |
| --- | --- |
| `padel/protocol.py` | Bygger kommandoer, validerer grænser og parser svar og `STATUS` |
| `padel/links.py` | `BridgeLink` (Uno Q), `SerialLink` (USB) og `SimulatedLink` (udvikling) |
| `padel/client.py` | `MachineClient`: request/response, hændelser og heartbeat |
| `padel/drills.py` | `DrillEngine`, `Drill`, `Shot` og skudbiblioteket |
| `padel/presets.py` | `PresetManager`: indbyggede og egne programmer gemt i JSON (atomisk skrivning) |
| `padel/webserver.py` | `PadelApp` (logik) og HTTP-handler (kun stdlib) |
| `web/` | Mobilvenlig web-app uden build-trin |
| `main.py` | Startpunkt. Vælger link ud fra argumenter |

`PadelApp` er bevidst uafhængig af HTTP. En kommende Bluetooth-grænseflade (BLE GATT) kan derfor genbruge den direkte.

## Sikkerhedslag

| Lag | Hvor | Hvad sker der |
| --- | --- | --- |
| Fysisk nødstop | MCU, `Safety` | PWM sættes straks til 0, og stepper og fremføring stoppes. Låser |
| Software-nødstop (`ESTOP`) | MCU | Samme som det fysiske nødstop. Web-UI'et sender det først, før alt andet |
| Kommunikationstimeout | MCU | Alt stopper efter 1 s uden kommandoer. Kræver ny `START` |
| Homing-timeout | MCU | Låser, hvis endestoppet ikke findes |
| Spin-up-timeout | MCU, `Scheduler` | Skuddet annulleres, og der sendes `EVT FIRE_TIMEOUT` |
| Hardware-watchdog | MCU | Fodres i hvert loop. **TODO:** implementér IWDG (se `NullWatchdog`) |
| Inputvalidering | Linux og MCU | Begge sider tjekker grænser. MCU'en er den endelige autoritet |
| Web | Linux | Kommandoer på hvidliste, JSON-validering, beskyttelse mod path traversal og ingen shell |

> Web-UI'et har ingen login. Det er beregnet til et lukket net, f.eks. maskinens eget WiFi-hotspot. Før det eksponeres bredere, skal der tilføjes adgangskontrol.

## Udvidelsespunkter

| Ønske | Hvor |
| --- | --- |
| Encoder-feedback på hjulene | Nyt `IEncoder` i `Hal.h`. `MotorControl` får en PI-regulator i `update()` |
| Sideakse (højre/venstre) | Ny `StepperControl`-instans + kommando `SET_SIDE`. `Shot.side` er allerede reserveret |
| Sensorer (boldtæller, tom-magasin) | Nyt modul på MCU + nyt `EVT` |
| Bluetooth | Nyt Linux-modul, der kalder `PadelApp` |
| Statistik/cloud | Lyt på `EVT FIRED` via `MachineClient.add_listener` |
| AI-træningsprogrammer | Generér `Drill`-objekter. Motorlaget skal ikke ændres |
