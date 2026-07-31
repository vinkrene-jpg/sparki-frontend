---
name: Persoonlijke routekandidaten uit ritgeschiedenis
description: Ontwerpregels voor de incrementele scan die geïmporteerde ritten clustert tot routekandidaten — naamclash, eerlijkheid, migratie-eis.
---

# Routekandidaten uit gekoppelde ritgeschiedenis (deel 1)

- **Naamclash-trap**: er bestaat al een "route candidates"-concept in api-server:
  de short-lived store voor provider-gegenereerde routes (re-exported via de
  route-engine). De ritgeschiedenis-engine heet daarom "ridden route
  candidates". Bij nieuwe bestanden rond routes eerst greppen op de naam —
  een generieke naam overschreef bijna de bestaande store.
- **Sporenbron**: trainingssessies zelf dragen geen geometrie; bestandsimports
  bewaren het spoor bij de import, Strava-samenvattingen alleen een encoded
  polyline (grover — eerlijk verrekenen in een GPS-volledigheidsfactor, niet
  verzwijgen).
- **Incrementeel, nooit bij paginalaad**: cursor per gebruiker; scan alleen
  aanstoten ná sync/import (fire-and-forget); lees-endpoints lezen alleen.
- **Clusteren**: richtinggevoelige cel-fingerprint exact, anders zelfde sport +
  startgebied + afstandstolerantie + celoverlap. Disciplines nooit samen.
  Uitgesloten kandidaten blijven meedoen in matching zodat re-imports geen
  duplicaten laten herleven.
- **Eerlijkheid**: vervoer vóór/na trimmen én melden; slechte GPS afkeuren met
  reden; kwaliteitsscore is transparant per factor en NOOIT een
  veiligheidsoordeel — bewaren/starten gaat altijd door de actuele fail-closed
  blokkadepoort.
- **Migratie-eis**: nieuwe tabellen alleen via drizzle-push is dev-only en wordt
  door de completion-review afgekeurd; altijd óók een genummerde idempotente
  SQL-migratie in `lib/db/migrations/` toevoegen en dubbel toepasbaar bewijzen.
- **Why:** opdracht 31-07-2026 — geen tweede routesysteem; canonieke eisen in
  `docs/route-candidates.md`.
- **How to apply:** deel 2 (zoeken-eerst-bestaand, gemengde/hybride voorstellen)
  bouwt op deze kandidaten, niet op een nieuwe pipeline; privacyzones toepassen
  op kandidaat-geometrie vóór enige deel-/toonstap.
