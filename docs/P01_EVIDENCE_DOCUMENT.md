# P01 — Definitief bewijs: verouderde afgeleide FTP-rij (id 8, 410 W) gemarkeerd als achterhaald

**Status:** ✅ Volledig uitgevoerd en gedocumenteerd  
**Datum uitvoering:** 2026-07-28  
**Omgeving:** Productieprimary (`neondb`, `pg_is_in_recovery() = false`)  
**Bron:** `data_trust_findings.findings.P01` in SPARKI_AI_MASTER_PLAN v2.84  
**Bewijs-commit P02 (gerelateerd):** `631fc95`  
**Bewijs-commit P03 (gerelateerd):** `d467a63`

---

## Samenvatting

Bevinding P01 uit de data-trust-audit (DT_01A, commit `ed68b4e`) registreerde een onjuist gebruikte
afgeleide FTP-waarde van 410 W in de productieprimary. Dezelfde gebruiker had drie recentere
handmatige metingen (331 W, 345 W × 2), maar de 410 W-rij ontbrak de `[achterhaald]`-markering
die de 331 W-buurtrij wel had.

**Uitgevoerde maatregel:** `UPDATE ftp_history SET notes = 'ACHTERHAALD — ...' WHERE id = 8`.  
Rij behouden (niet verwijderd). Geen andere rijen geraakt. Geen schema-wijziging.

---

## Bewijs-documenten

| Document | Inhoud | Status |
|---|---|---|
| [`docs/P01_FTP_DERIVED_APPLY_2026-07-28.md`](P01_FTP_DERIVED_APPLY_2026-07-28.md) | Volledig apply-bewijs: SQL, vóór/na, verificatietabel, rollback-SQL | ✅ Aanwezig |
| [`docs/P02_DATA_TRUST_APPLY_2026-07-28.md`](P02_DATA_TRUST_APPLY_2026-07-28.md) | P02: duplicaatrijen verwijderd (ids 3,4,5 → id 2 behouden) | ✅ Aanwezig |
| [`docs/P03_LANGUAGE_REPAIR_APPLY_2026-07-28.md`](P03_LANGUAGE_REPAIR_APPLY_2026-07-28.md) | P03: 12 Engelstalige ai_observations → Nederlandse vertaling | ✅ Aanwezig |

---

## Verificatiematrix (P01)

| Veld | Verwacht | Gerealiseerd |
|---|---|---|
| Tabel | `ftp_history` | ✅ |
| Record-ID | 8 | ✅ |
| Clerk-ID | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` | ✅ bevestigd |
| test_type | `derived` | ✅ ongewijzigd |
| ftp_watts | 410 W (behouden) | ✅ 410 W |
| notes prefix | `ACHTERHAALD —` | ✅ |
| Rijen verwijderd | 0 | ✅ 0 |
| Andere records geraakt | 0 | ✅ 0 |
| Productieprimary | `pg_is_in_recovery() = false` | ✅ bevestigd |

---

## Huidige geldige FTP voor deze gebruiker

**345 W** — ids 10 en 11, `test_type = 'manual'`, juli 2026. Ongewijzigd door P01.

---

## Gate-naleving

Alle `execution_gate`-vereisten uit het masterplan zijn nagekomen:

| Gate | Status |
|---|---|
| Database-backup aanwezig vóór apply | ✅ (Replit Postgres automatische back-ups actief) |
| Dry-run vóór apply uitgevoerd | ✅ zie `P01_P02_P03_UITVOERINGSVOORSTEL.md` |
| Exact geraakt rij-aantal bevestigd (1 rij) | ✅ |
| Rollback-SQL gedocumenteerd | ✅ zie apply-bewijs |
| Uitsluitend bedoelde productierijtjes geraakt | ✅ bevestigd |
| Expliciete GO van gebruiker (René) | ✅ mondeling 2026-07-28 |
| Non-implementer-goedkeuring (assistant ≠ uitvoerder) | ✅ René voerde handmatig uit via SQL-console |

---

## Cross-document consistentie

P01-bevinding geverifieerd in drie onafhankelijke documenten:

1. `docs/SPARKI_DATA_TRUST_AUDIT.md` — oorspronkelijke bevinding
2. `docs/SPARKI_AUDITS_FINAL_REVIEW_2026-07-26.md` — architect-review: PASS
3. `docs/SPARKI_CURRENT_STATE_EXPORT_2026-07-27.md` — herhaling in statustabel

Geen tegenstrijdige waarden gevonden. Conclusie: **P01 volledig uitgevoerd en bewijsbaar**.

---

## Openstaand

- De `proof_document`-verwijzing in het masterplan (`P01_EVIDENCE_DOCUMENT_TO_BE_REPORTED_BY_REPLIT_AFTER_MANUAL_APPLY`) verwijst naar dit bestand.
- De commit-hash van dit bewijs-document dient te worden vastgelegd als `proof_commit` voor P01 in de volgende masterplan-revisie.
