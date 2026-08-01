---
name: Overpass burst rate-limits bij recursieve bbox-splitsing
description: Waarom kwadrant-recursie tegen Overpass pauzes + retry nodig heeft en hoe het eerlijk-gat-contract intact blijft.
---

Regel: wie een afgekapte Overpass-bbox recursief in kwadranten hersplitst, vuurt 5+ zware queries kort na elkaar af. Mirrors (maps.mail.ru timeout/abort, overpass-api.de 406, kumi 429) rate-limiten zo'n burst; zonder mitigatie faalt willekeurig één sub-query → null → 502, ook al is de recursie correct.

**Why:** dichte stadskernen (Hengelo/Borne) raken het 10.000-ways-plafond óók op kwadrant-niveau; alleen dieper splitsen is niet genoeg — de burst zelf maakt het antwoord flaky.

**How to apply:** (1) korte pauze (~750 ms) tussen opeenvolgende kwadrant-queries; (2) één beleefde retry na ~2 s bij een gefaalde sub-query; (3) max split-diepte (3) en bij blijvende truncatie/failure altijd null teruggeven — nooit een gedeeltelijke set mergen, want ontbrekende ways renderen onterecht als "onbekend wegdek".

**Update 01-08-2026 (ROUTE_OVERPASS_STABILITEIT_01):** al het Overpass-verkeer in de routeketen loopt nu via één gedeelde client (`lib/overpass/client.ts`): proces-breed serieel met minimumpauze, herkansing met oplopende pauze op DEZELFDE mirror vóór doorschuiven, mirror-cooldown (maps.mail.ru eerst), persistente cache in `overpass_query_cache` (sleutel = sha256 van query; bbox vooraf naar buiten snappen met `normalizeBbox`), en een aanvraagbudget per generatie via `withOverpassBudget` (op = eerlijk gat → bestaande fail-closed melding). Nieuwe Overpass-consumers NIET zelf fetchen — altijd deze client.
