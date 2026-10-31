# Kommunikationsprotokol Linux ↔ MCU (v1)

Tekstbaseret og linjeorienteret. Hver linje afsluttes med `\n` (`\r` ignoreres). Maks. 63 tegn pr. kommandolinje.
Protokollen er den samme uanset transport (Arduino Bridge på Uno Q, USB-serial eller simulator).

## Regler

1. Linux sender **én kommando ad gangen** og venter på svaret (timeout 0,5 s) før næste.
2. Alle linjer, der begynder med `EVT `, og linjen `READY` er **asynkrone hændelser**. De er ikke svar.
3. Enhver genkendt kommando fodrer MCU'ens kommunikations-watchdog. Linux sender `STATUS` ca. hver 300 ms som heartbeat.
4. Hvis MCU'en ikke modtager en kommando i **1000 ms**, stopper den hjul, stepper og fremføring og sender `EVT FAULT=COMM_TIMEOUT`. Hjulene starter ikke igen af sig selv. Det kræver en ny `START`.

## Kommandoer

Formatet er `KOMMANDO`, `KOMMANDO=VÆRDI` eller `KOMMANDO VÆRDI`. Store og små bogstaver behandles ens.

| Kommando | Værdi | Svar | Beskrivelse |
| --- | --- | --- | --- |
| `PING` | – | `OK` | Lever du? |
| `STATUS` | – | `STATUS …` | Se format nedenfor |
| `HOME` | – | `OK` / `BUSY` / `ERROR FAULT` | Starter homing. Sender `EVT HOMED` eller `EVT FAULT=HOMING_FAILED` når den er færdig |
| `SET_SPEED` | 0–255 | `OK` / `ERROR RANGE` | Målhastighed for begge hjul |
| `SET_LEFT_PWM` | 0–255 | `OK` / `ERROR RANGE` | Målhastighed for venstre hjul |
| `SET_RIGHT_PWM` | 0–255 | `OK` / `ERROR RANGE` | Målhastighed for højre hjul |
| `SET_ANGLE` (aliaser `MOVE_ANGLE`, `ANGLE`) | 0,0–60,0 grader | `OK` / `BUSY` / `ERROR NOT_HOMED` / `ERROR RANGE` / `ERROR FAULT` | Kører til vinklen. Kan ændres undervejs |
| `GET_ANGLE` | – | `ANGLE=31.5` | Nuværende vinkel |
| `START` | – | `OK` / `ERROR FAULT` | Hjulene rampes op til deres målhastigheder |
| `STOP` | – | `OK` | Hjulene rampes ned, stepperen stopper, og et skud i gang annulleres |
| `FIRE` | – | `OK` / `BUSY` / `ERROR NOT_HOMED` / `ERROR NOT_RUNNING` / `ERROR FAULT` | Affyrer én bold, når hjulene er oppe i fart og vinklen er nået. Sender `EVT FIRED` eller `EVT FIRE_TIMEOUT` |
| `ESTOP` | – | `OK` | Software-nødstop. Låser, indtil `RESET` sendes |
| `RESET` | – | `OK` / `ERROR ESTOP_ACTIVE` | Rydder låste fejl. Efter en homingfejl skal der køres `HOME` igen |

Generelle fejlsvar: `ERROR UNKNOWN_COMMAND`, `ERROR MISSING_VALUE`, `ERROR BAD_VALUE`.

## STATUS-format

```
STATUS state=RUNNING homed=1 angle=25.0 target=25.0 left=180 left_target=180 right=175 right_target=175 running=1 firing=0 comm=1 fault=NONE
```

Felterne er `nøgle=værdi`, adskilt af mellemrum. Nye felter må tilføjes. Klienter skal ignorere felter, de ikke kender.

`state` er én af `READY`, `RUNNING`, `MOVING`, `HOMING`, `NOT_HOMED` og `FAULT`.
`fault` er én af `NONE`, `ESTOP_INPUT`, `ESTOP_COMMAND`, `COMM_TIMEOUT` og `HOMING_FAILED`.

## Hændelser (MCU → Linux)

| Linje | Betydning |
| --- | --- |
| `READY` | MCU'en er startet (efter reset/opstart) |
| `EVT HOMED` | Homing er gennemført |
| `EVT FIRED` | En bold er affyret |
| `EVT FIRE_TIMEOUT` | Hjulene nåede ikke hastighed, eller vinklen blev ikke nået, inden for 5 s. Skuddet er annulleret |
| `EVT FAULT=<kode>` | Der er opstået en ny fejl. Alt er stoppet |

## Transport på Uno Q (Arduino Bridge)

| Retning | Bridge-kald | Indhold |
| --- | --- | --- |
| Linux → MCU | `Bridge.notify("padel_cmd", linje)` | Én kommandolinje |
| MCU → Linux | `Bridge.notify("padel_line", linje)` | Ét svar eller én hændelse |

## Udvidelse af protokollen

1. Tilføj kommandoen i `CommandType` og `kKeywords` (`sketch/src/CommandParser.*`).
2. Håndtér den i `Machine::handleCommand`.
3. Tilføj en builder i `python/padel/protocol.py`, og opdatér `SimulatedLink`.
4. Opdatér tabellen ovenfor, og skriv tests i begge testsuiter.

Hvis der kommer brug for flere samtidige forespørgsler, kan v2 indføre et sekvensnummer (`#12 SET_ANGLE=30` → `#12 OK`).
