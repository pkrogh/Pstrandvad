# Padel Boldmaskine – Projektbeskrivelse (kravspecifikation)

> Dette er projektets kildedokument for krav. Ændringer i krav skrives her først.
> Hvordan kravene er opfyldt, står i [arkitektur.md](arkitektur.md) og [protokol.md](protokol.md).

## Projektets formål

Projektet skal udvikle en intelligent padel-boldmaskine, der leverer præcise træningsøvelser, som kan gentages ens. Maskinen skal kunne styre boldens hastighed, retning og affyringsvinkel elektronisk. Senere skal den kunne udvides med avancerede træningsprogrammer.

Softwarearkitekturen er modulær, så nye funktioner kan tilføjes uden at omskrive eksisterende kode.

Den oprindelige platform var Arduino Uno R4 WiFi. Projektet migreres til **Arduino Uno Q**. Linux-processoren bruges til brugerinterface og overordnet styring, og den indbyggede mikrocontroller håndterer realtidskritiske opgaver.

## Overordnede mål

Systemet skal kunne:

- affyre padelbolde med justerbar hastighed
- justere affyringsvinklen elektronisk
- køre kontinuerligt uden tab af præcision
- styres fra mobil, tablet eller computer
- udvides let med nye funktioner
- holde til lange træningssessioner

## Hardware

### Arduino Uno Q – systemets centrale controller

Projektet udnytter boardets todelte arkitektur:

| Linux-delen (QRB2210) | Mikrocontroller-delen (STM32U585) |
| --- | --- |
| Webserver | PWM |
| Bluetooth | Stepper-timing |
| Kommandohåndtering | Realtidsmotorstyring |
| Fremtidige AI-funktioner | Sensoraflæsning |
| Træningsprogrammer | Safety-funktioner |
| Kommunikationsprotokol | |

**Linux må aldrig styre motorerne direkte.**

### Motorer

- **DC-motor 1 og 2** driver hvert sit affyringshjul. Begge motorer skal have variabel PWM, hurtig acceleration og stabil hastighed. De skal kunne køre synkront, og hver motor skal kunne få sin egen hastighed, så der senere kan gives spin.
- **Steppermotor** styrer affyringsvinklen via en STEP/DIR-driver. Den skal kunne køre til en bestemt vinkel med acceleration og deceleration, holde positionen og køre homing ved opstart.

**Linux må aldrig generere step-pulser.**

## Softwaremoduler (MCU)

| Modul | Ansvar | Offentlige funktioner |
| --- | --- | --- |
| MotorControl | PWM, start, stop og hastighed | `setLeftSpeed()`, `setRightSpeed()`, `stop()` |
| StepperControl | Position, homing og vinkelstyring | `home()`, `moveToAngle()`, `getCurrentAngle()` |
| CommandParser | Modtager kommandoer fra Linux | – |
| Scheduler | Koordinerer timing, affyring og intervaller. Ingen delay(): alt er non-blocking | – |
| Communication | Tekstbaseret seriel kommunikation mellem Linux og MCU | – |
| Safety | Nødstop, timeout, fejltilstande og watchdog. Motorerne stoppes automatisk, hvis forbindelsen mistes | – |

## Fremtidige softwaremoduler (Linux)

- **Drill Engine:** afvikler hele træningsprogrammer, f.eks. højre, venstre, lob, smash og tilfældige bolde.
- **Preset Manager:** gemmer træningsprogrammer, f.eks. Begynder, Øvet, Elite og Custom.
- **Bluetooth Interface:** styring direkte fra telefon eller tablet.
- **Web Interface:** brugeren kan starte og stoppe, ændre hastighed og vinkel, gemme presets og vælge træningsprogram.

## Kommunikationsarkitektur

Linux sender kommandoer (`SET_LEFT_PWM=180`, `MOVE_ANGLE=30`, `START`, `STOP`, …).
Arduino svarer (`OK`, `ERROR`, `BUSY`, `ANGLE=31`, `READY`). Se [protokol.md](protokol.md).

## Realtidskrav

- Stepperpulser genereres af mikrocontrolleren.
- PWM skal være stabil.
- Motorstyringen må aldrig blokeres af webserver, Bluetooth, filsystem eller netværk.

## Kodestandard

- Moderne C++ på MCU'en. Hvert modul står for sig, og hver klasse har ét ansvar.
- Ingen globale variable, medmindre det er absolut nødvendigt.
- Ingen `delay()`. Brug `millis()`/`micros()` eller hardwaretimere.
- Grundige kommentarer, så koden er nem at vedligeholde.

## Udvidelsesmuligheder

Automatisk kalibrering, sensorer, encoder-feedback, spin-kontrol, AI-baserede træningsprogrammer, cloud-synkronisering, statistik, firmwareopdateringer, kamera til boldsporing og app til iOS og Android.

## Designprincipper

Modulær arkitektur · høj læsbarhed · lav kobling · høj genbrugelighed · realtidskritiske funktioner holdes adskilt fra brugerinterfacet · Linux bruges til logik og brugeroplevelse · mikrocontrolleren bruges til præcis hardwarestyring.

## Langsigtet vision

En professionel padel-boldmaskine med en softwarearkitektur, der kan vokse fra hobbyprojekt til avanceret træningssystem. Koden skal være let at vedligeholde, udvide og videreudvikle med AI-værktøjer som Codex og ChatGPT, uden større omskrivninger.
