"""Padel Boldmaskine – Linux-delen (Arduino Uno Q, QRB2210).

Moduler:
  protocol   tekstprotokollen til MCU'en (kommandoer, svar, STATUS)
  links      transport: Bridge (Uno Q), serial, simulator
  client     MachineClient: request/response, hændelser, heartbeat
  drills     Drill Engine: afvikler træningsprogrammer
  presets    Preset Manager: gemmer programmer som JSON
  webserver  HTTP-API og web-app
"""

__version__ = "0.1.0"
