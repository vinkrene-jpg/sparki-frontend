# F9 — Trainer-cockpit (`pages/coach-cockpit.tsx`) — voor/na

Schermbewijs op **402×874** (telefoon), vastgelegd met het e2e-harnas
`e2e/tests/f9-trainer.mjs` (patroon overgenomen van `e2e/tests/f9-clubbeheer.mjs`).
De harness wordt via de DEV-identiteitskiezer een **gekoppelde trainer**
(`governor-fixture-trainer-zelfstandig`), haalt een gekoppelde sporter op via
`/api/coach/athletes` en opent diens cockpit
(`/coach/athletes/:athleteId/cockpit`). Login/data slaagden — echte fixture-data.

- **VOOR** = HEAD (`cf18daf9`), productiebuild vóór de herindeling.
- **NA** = deze herindeling, opnieuw gebouwd.

## Meetresultaat

| Meting | VOOR | NA |
| --- | --- | --- |
| Paginahoogte (fold = 874px) | 1861px | 934px |
| Schermen scroll voor "alles" | 2,1 | 1,1 |
| Echte tabs | 0 (alles gestapeld) | 4 (Sporter/Plannen/Berichten/Meer) |
| Primaire acties in beeld | meerdere | 1 per tab |
| Zware formulieren inline | ja (WorkoutForm add + edit) | nee — stappenvenster (BeheerSheet) |

## Screenshots

**VOOR** (`voor/`): `…-01-cockpit-fold`, `…-02/03-scroll`, `…-04-stappenvenster*`
(de tabkliks vielen uit → geen tab-opnames; één lange scroll van 2,1 schermen).

**NA** (`na/`):
- `…-01-cockpit-fold` — kop, rol/omgeving-badge, één primaire actie
  ("Markeer als beoordeeld"), de 4 tabs en de eerste kaart, alles boven de vouw.
- `…-04-tab-sporter` — signalen + Sparki-voorstellen.
- `…-05-tab-plannen` — planning; primaire actie "Training toevoegen".
- `…-06-tab-berichten` / `…-08-berichten-met-f7-ingang` — cockpitberichten
  **plus de F7-ingang** "Berichten met bijlagen naar <naam>" (bereikbaar gebleven).
- `…-07-tab-meer` — afspraken & context, doelen, privénotities, adviesschema.
- `…-09-stappenvenster-training-toevoegen` — WorkoutForm als stappenvenster.

## Per F9-regel

- **Max 1 primaire actie:** per tab één primaire knop
  (Sporter → "Markeer als beoordeeld"; Plannen → "Training toevoegen";
  Berichten → F7-bijlage-ingang). Overige acties zijn secundair (kaarten/sheets).
- **Max 4 kaarten boven de vouw:** fold toont kop + badge + primaire actie +
  tabbalk + eerste kaart. Paginahoogte 934px (1,1 scherm) i.p.v. 1861px.
- **2–4 échte tabs:** vier `role="tab"`-knoppen via `HoofdstukTabs`
  (Sporter/Plannen/Berichten/Meer). Geen lege tabs.
- **Meerstaps = stappenvenster met uitweg:** WorkoutForm (toevoegen én wijzigen)
  opent nu in `BeheerSheet` over het scherm, met annuleren/sluiten als uitweg —
  niet meer inline in de lange scroll.
- **Details apart:** signalen, voorstellen, context, doelen, privénotities en het
  adviesschema staan verdeeld over tabs; het adviesschema blijft een aparte route.
- **Rol + omgeving via ScreenShell-ContextRegel:** de bestaande ScreenShell rendert
  bovenaan "COACH · TESTOMGEVING · ROL COACH" — ongewijzigd overgenomen.
- **F7-berichtingang bereikbaar:** `CoachLinkMessagesLink` staat als primaire
  actie op de Berichten-tab (`na/…-08`), verwijst naar
  `/coach-messages/:coachClerkId/:athleteId`. Niets weggelaten.

## Behoud

Alle onderdelen uit de oude één-scroll-indeling zijn behouden en bereikbaar:
signalen + besluiten, Sparki-voorstellen, planning (toevoegen/wijzigen/herhalen/
annuleren), cockpitberichten, F7-bijlageberichten, afspraken & context, doelen
voorstellen + inzage, privénotities en het adviesschema. Geen nieuwe functionaliteit.

## Eerlijke beperkingen

- De DEV-identiteitskiezer levert de echte cockpit met echte fixture-data; login
  en dataophaling slaagden (zie harness-log: rol `coach`, sporter
  `governor-fixture-athlete-compleet`).
- Tabkliks/stappenvenster-opnames zijn best-effort in dezelfde harness, zodat
  VOOR (geen tabs) en NA (wel tabs) met identieke code worden vastgelegd.
