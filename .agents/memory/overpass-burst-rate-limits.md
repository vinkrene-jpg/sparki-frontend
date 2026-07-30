---
name: Overpass burst rate-limits bij recursieve bbox-splitsing
description: Waarom kwadrant-recursie tegen Overpass pauzes + retry nodig heeft en hoe het eerlijk-gat-contract intact blijft.
---

Regel: wie een afgekapte Overpass-bbox recursief in kwadranten hersplitst, vuurt 5+ zware queries kort na elkaar af. Mirrors (maps.mail.ru timeout/abort, overpass-api.de 406, kumi 429) rate-limiten zo'n burst; zonder mitigatie faalt willekeurig één sub-query → null → 502, ook al is de recursie correct.

**Why:** dichte stadskernen (Hengelo/Borne) raken het 10.000-ways-plafond óók op kwadrant-niveau; alleen dieper splitsen is niet genoeg — de burst zelf maakt het antwoord flaky.

**How to apply:** (1) korte pauze (~750 ms) tussen opeenvolgende kwadrant-queries; (2) één beleefde retry na ~2 s bij een gefaalde sub-query; (3) max split-diepte (3) en bij blijvende truncatie/failure altijd null teruggeven — nooit een gedeeltelijke set mergen, want ontbrekende ways renderen onterecht als "onbekend wegdek".
