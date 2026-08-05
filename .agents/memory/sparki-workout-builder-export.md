---
name: Workoutbouwer + .zwo/.fit-export
description: Gestructureerde stappen op coachtrainingen en export naar Zwift/Garmin-bestanden — eerlijkheids- en autorisatieregels.
---

- Vermogensdoelen zijn ALTIJD %FTP-bereiken; nooit watts verzinnen. FIT-conventie: workout-powerwaarden 0–1000 = %FTP, ≥1001 = watts+1000 — wij schrijven bewust alleen %FTP. Stappen zonder vermogensdoel → .zwo FreeRide / .fit open-doel.
- **Elke lees-/exportroute op coachtrainingen heeft dezelfde eigenaarspoort nodig als PUT/repeat** (source="coach" + coachClerkId==coach, legacy null = elke gekoppelde coach). Alleen gateAthlete is niet genoeg: een tweede gekoppelde coach lekt anders andermans trainingsinhoud (gevonden door review, gefixt + test).
- UI-bewerkbaarheid nooit afleiden uit `source` alleen: de workout-DTO levert een server-afgeleid `canEdit`; de weekkalender gebruikt dat voor slepen/kopiëren.
- Eigen FIT-encoder (lib/workout-builder.ts, dependency-vrij zoals fit-parse): header 14B + file_id/workout/workout_step + CRC-16. Let op basistypes: uint32z = 0x8c (niet 0x86). Test verifieert header- én bestands-CRC.
- Export is een download via `<a href>`; in DEV Preview gaat de x-dev-clerk-id-header dan niet mee — testen via fetch met header.
- **Why:** eerlijkheid (geen verzonnen watts) + cross-coach isolatie zijn hier de twee vaste breekpunten.
