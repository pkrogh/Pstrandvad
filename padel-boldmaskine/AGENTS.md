# Instruktioner til AI-agenter (Codex, Claude, ChatGPT)

Læs denne fil før du ændrer noget i `padel-boldmaskine/`.

## Kontekst

- Kravspecifikation: `docs/specifikation.md`
- Arkitektur: `docs/arkitektur.md`
- Protokol: `docs/protokol.md`

## Ufravigelige regler

1. **Linux styrer aldrig motorer direkte.** Al PWM, alle trin og al fremføring sker på MCU'en (`sketch/`). Linux sender kun tekstkommandoer via `MachineClient`.
2. **Ingen `delay()`** og ingen blokerende løkker i firmwaren. Brug `update(now)` og tidsstempler.
3. **Moduler må ikke inkludere `Arduino.h`.** Det må kun `sketch.ino` og `src/ArduinoHal.h` / `src/BridgeLineTransport.h`. Hardwareadgang går gennem `Hal.h`.
4. **Ingen heap, `String` eller `printf("%f")`** i `sketch/src/`. Brug faste buffere og `Communication::formatFixed1`.
5. **Én klasse, ét ansvar.** Nye funktioner bliver til nye moduler, som `Machine` binder sammen.
6. **Sikkerhed først.** En ny bevægelse skal respektere `Safety::isMotionAllowed()` og stoppes i `Machine::enterSafeState()`.
7. Grænser (PWM og vinkel) findes i `sketch/src/Config.h` **og** `python/padel/protocol.py`. Hold dem ens.
8. Kommentarer skrives på dansk, og identifikatorer på engelsk.

## Arbejdsgang

```bash
make -C tests/firmware test                         # MCU-logik på PC (g++, ASan/UBSan)
python3 -m unittest discover -s tests/python -v     # Linux-delen mod simulator
python3 python/main.py --sim                        # Kør web-UI uden hardware: http://localhost:8080
```

Begge testsuiter skal være grønne før commit. Ny funktionalitet skal have tests.

## Typiske opgaver

- **Ny kommando:** følg "Udvidelse af protokollen" i `docs/protokol.md`.
- **Nyt træningsprogram:** tilføj det i `BUILTIN_PRESETS` (`python/padel/presets.py`), eller gem det via API'et.
- **Ny hardware:** tilføj pins i `Config.h`, et interface i `Hal.h`, en Arduino-implementering i `ArduinoHal.h`, en fake i testen og derefter selve modulet.

## Kendte åbne punkter (TODO)

- Verificér Bridge-API'et (`provide_safe`/`notify`) og FQBN (`arduino:zephyr:unoq`) på rigtig Uno Q-hardware.
- Implementér hardware-watchdog (STM32U585 IWDG via Zephyr) i stedet for `NullWatchdog`.
- Pins, `kStepsPerDegree`, fremføringsmekanisme og vinkelgrænser er pladsholdere (markeret `TBD` i `Config.h`).
- Bluetooth-grænseflade (BLE) er ikke påbegyndt.
