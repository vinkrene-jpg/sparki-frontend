# AIE2 — F1 Adviesdossier: migratie- en overgangsplan (AIE2-31) + antwoord O-11

**Status:** opgeleverd 01-08-2026. Gebouwd: tabel `advice_dossiers` (20 velden), schrijf-laag `lib/advice-dossier.ts` (onvolledig = harde fout), inzage-route `/api/advice-dossiers`, DB-test 3/3 groen.

## 1. Wat het dossier is (en niet is)

- Eén registratielaag voor **nieuwe** adviezen, per advies één rij met twintig velden — inclusief de twee structureel vergeten velden: **waarom is het alternatief niet gekozen** (verplicht bij aanmaak) en **latere uitkomst** (`recordAdviceOutcome`, later ingevuld, nooit verzonnen).
- Het dossier **verwijst** naar bestaande onderbouwing (source-quality-keys, regel-ids, KENNIS_01 evidence-id+versie, engines-keten) en dupliceert die niet (F0 §7.3).
- Interne confidence-factoren blijven server-side; naar de client gaat alleen één van vier taalniveaus (zeker · redelijk zeker · voorzichtig · slag om de arm). De inzage-route stript de interne factoren (AIE2-82).

## 2. Legacy-markering (AIE2-29)

Geen backfill, geen verzonnen waarden. Een advies **zonder** dossier-rij is per definitie `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` — afgeleid bij lezen (`dossierStatusFor(null)`), met een eerlijke UI-tekst. Bestaande adviezen blijven gewoon zichtbaar; de regel "zonder dossier niet tonen" gaat pas gelden voor **nieuwe** adviezen ná de bewezen overgang per adviesvorm (AIE2-30).

## 3. Overgang per adviesvorm — antwoord O-11 (voorstel)

| Adviesvorm | Kan alsnog/voortaan een dossier krijgen? | Hoe |
|---|---|---|
| Dagadvies (day-advice) | **ja, bij uitlevering** | on-the-fly berekend met volledige deterministische onderbouwing → dossier schrijven op het moment van tonen (adviceKey `dag:<datum>`), vanaf F2 |
| Coach-signalen | **ja** | sources/whyHuman/confidence bestaan al → mapping is vrijwel 1-op-1; bestaande besluiten blijven legacy |
| Wijzigingsvoorstellen | **ja** | dossier bij aanmaak van het voorstel; oude rijen legacy |
| Observaties | **ja** | signals + alternativeExplanations dekken basedOn/alternatieven al; nieuwe observaties krijgen dossier, oude blijven legacy |
| Race-advies | **ja, bij uitlevering** | found/derived/missing → sourcesUsed/-Excluded |
| Plan-aanpassing | **ja** | AdjustDecision-motivatie → dossier bij besluit |
| Doelbewaking (F9, nieuw) | **ja, verplicht vanaf dag één** | nieuw gebouwd ⇒ geen legacy |
| Fueling-richtwaarden | **definitief legacy als vorm** | het zijn doorlopende richtwaarden (SSOT), geen los advies-moment; uitleg loopt via de bestaande uitleglaag; alleen een expliciete voedingsaanbeveling (bijv. bij een wedstrijd) krijgt een dossier |
| State-kaart / readiness | **definitief legacy als vorm** | toestandsweergave, geen advies; de basis-indicatoren blijven de uitleg |
| Nudges/meldingen | **volgt het bronadvies** | de melding zelf krijgt geen eigen dossier; ze linkt naar het bronobject dat er wel één heeft |

## 4. Overgangsvolgorde

1. **F2** koppelt de "waarop is dit gebaseerd"-weergave aan het dossier (nieuwe adviezen) en aan de legacy-tekst (oude), via de bestaande uitleg-infra.
2. Per adviesvorm wordt de producer omgezet (volgorde: dagadvies → observaties → coach-signalen → voorstellen → race → plan-aanpassing); pas als een vorm aantoonbaar bij elke uitlevering een dossier schrijft, gaat voor díe vorm de regel "nieuw advies zonder dossier niet tonen" aan.
3. Doelbewaking (F9) start dossier-verplicht.
4. Mirror-toets per vorm: nieuw advies zonder dossier = afkeur (AIE2-80); oud advies ongemarkeerd = afkeur (AIE2-81).
