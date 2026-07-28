# Voorstel — veilige uitvoering P01 / P02 / P03 (data-trust)

**Bron:** `docs/SPARKI_DATA_TRUST_AUDIT.md` (audit DT_01A, commit `ed68b4e`, 26-07-2026), kruisgecontroleerd met `docs/SPARKI_AUDITS_FINAL_REVIEW_2026-07-26.md` (architect-review PASS) en `docs/SPARKI_CURRENT_STATE_EXPORT_2026-07-27.md` (commit `3942f0f`).
**Status:** géén enkele wijziging uitgevoerd. Dit is uitsluitend een voorstel ter goedkeuring.

---

## Vooraf — vaste voorwaarde voor alle drie

Voor elke `apply=true`-actie, zonder uitzondering:
1. Databaseback-up direct vóór de actie (pg_dump of gelijkwaardig, zoals eerder al gedaan bij de constraint-migratie van 10 juli).
2. Verse droogdraai (dry-run) in dezelfde sessie als de apply — geen hergebruik van oude dry-run-output.
3. Exact aantal getroffen rijen genoemd, en dat aantal moet overeenkomen met de droogdraai-uitvoer.
4. Rollbackplan vooraf vastgelegd (welk commando herstelt de back-up).
5. Expliciete bevestiging dat uitsluitend de bedoelde rij(en)/tabel(len) wijzigen — geen bijeffecten op andere gebruikers of tabellen.
6. Jouw expliciete akkoord per bevinding (niet één blanco akkoord voor alle drie).

Zonder dit alles: geen `apply=true`. Dit geldt ook als Replit zelf meldt dat het "veilig" is — zelf-goedkeuring door de uitvoerder is niet voldoende (zie collaboration_contract in het master plan).

---

## P01 — verouderde afgeleide FTP-rij (410 W, 25-05-2026)

- **Tabel:** `ftp_history`
- **Omgeving:** productie
- **Waarde:** 410 W, `test_type='derived'`, datum 2026-05-25
- **Probleem:** mist de `[achterhaald]`-markering die de zusterrij (331 W, zelfde datum) wél heeft
- **Risico:** middel — kan TSS/IF-afleidingen rond eind mei 2026 vertekenen
- **Voorgestelde actie:** de rij markeren met het bestaande `[achterhaald]`-label via het bestaande zelfherstelmechanisme. **Nooit verwijderen** — geschiedenis blijft intact, alleen het label wordt toegevoegd.
- **Wat NIET verandert:** het actuele profiel-FTP (345 W, niet-geschat) — dat staat los van deze rij.

**Voorstel voor uitvoering:**
1. Droogdraai: bevestig dat exact 1 rij wordt geraakt (deze specifieke rij, deze user).
2. Toon de exacte SQL/mechanisme-aanroep die het label toevoegt, vóór uitvoering.
3. Na akkoord: uitvoeren, daarna verifiëren dat de rij nu `[achterhaald]` toont en dat de overige 9 rijen in `ftp_history` ongewijzigd zijn.

---

## P02 — 4 dubbele Strava-importrijen (272 W, 26-06-2026)

- **Tabel:** `ftp_history`
- **Omgeving:** productie
- **Waarde:** 4 rijen, elk 272 W, `test_type='strava'`, datum 2026-06-26
- **Risico:** laag — het zijn echte eigen metingen, alleen gedupliceerd (import dedupliceert inmiddels per dag, maar deze rijen dateren van vóór die fix)
- **Voorgestelde actie:** bestaand endpoint `POST /api/admin/data-trust/cleanup`, strikt beperkt tot rijen met `test_type='strava'` op deze datum; oudste rij blijft staan, overige 3 worden verwijderd.

**Voorstel voor uitvoering:**
1. Droogdraai: bevestig exact 4 rijen gevonden, exact 3 gemarkeerd voor verwijdering (oudste blijft).
2. Databaseback-up van de tabel (of relevante rijen) vóór apply.
3. Na akkoord: `apply=true` uitsluitend voor deze scope, daarna verifiëren: 1 rij over voor deze datum, waarde ongewijzigd (272 W), overige `ftp_history`-rijen ongewijzigd.

---

## P03 — mogelijk Engelstalige observaties (status onbekend)

- **Tabel:** `ai_observations`
- **Omgeving:** productie
- **Totaal in tabel:** 161 observaties
- **Probleem:** onbekend aantal rijen mogelijk nog in het Engels, van vóór een eerdere taalcorrectie
- **Status:** `UNKNOWN_REQUIRES_REVIEW` — dit is nog geen bevestigde bevinding, alleen een vermoeden

**Voorstel voor uitvoering — twee aparte stappen, geen apply in stap 1:**
1. **Alleen droogdraai, geen apply.** Laat het bestaande cleanup-mechanism exact tonen: hoeveel rijen, welke user(s), welke content (of een voorbeeld daarvan), welke datums.
2. **Pas na die uitkomst** een besluit nemen: verwijderen, vertalen, of laten staan — dat besluit hoort bij jou, niet bij Replit of bij mij.
3. Geen enkele wijziging aan deze tabel totdat stap 1 een concreet, door jou geziene aantal en voorbeeld heeft opgeleverd.

---

## Samenvatting volgorde-advies

| # | Bevinding | Risico | Actie nu mogelijk? |
|---|---|---|---|
| P02 | 4 dubbele Strava-rijen | Laag | Ja, na droogdraai + back-up + jouw akkoord |
| P01 | Verouderde FTP-rij zonder label | Middel | Ja, na droogdraai + jouw akkoord (labelen, niet verwijderen) |
| P03 | Mogelijk Engelstalige observaties | Onbekend | Nee — eerst alleen droogdraai ter inzage, geen apply |

Ik raad aan met P02 te beginnen (laagste risico, duidelijkste scope), dan P01, en P03 pas te agenderen zodra de droogdraai-uitkomst er ligt.
