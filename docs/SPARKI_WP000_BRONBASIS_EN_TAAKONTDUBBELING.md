# SPARKI WP-000 — Bronbasis, live git-verificatie en taakontdubbeling

> De uitvoeringsregel is op 1 augustus 2026 gewijzigd (`SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`). Dit rapport beschrijft de situatie onder de eerdere regel en is niet herschreven.


**Controle uitgevoerd:** 2026-07-29 11:20 UTC · **HEAD op moment van controle:** `ddeb94089f3a73109412f38ebd09cad02d7e0a32` (`ddeb9408`)
**Karakter:** read-only inventarisatie. Applicatiecode, database en de twee bronbestanden zijn niet gewijzigd.

---

## 1. Actuele bronbasis (live git-bewijs)

Console-uitvoer (verkort, letterlijk uitgevoerd in de werkruimte):

```
$ git branch --show-current
main
$ git rev-parse HEAD
ddeb94089f3a73109412f38ebd09cad02d7e0a32
$ git log -1 --oneline
ddeb9408 Analyse: Trainingsverloop-blok in lichte kaartstijl (variant licht) i.p.v. donkerblauwe kaart tussen witte kaarten
$ git status --short
 M artifacts/mockup-sandbox/src/.generated/mockup-components.ts
?? attached_assets/Pasted-WP-000-...txt
?? attached_assets/SPARKI_R1_BUILD_PACK_V1_...md
$ git remote -v   (relevant deel)
origin  https://github.com/vinkrene-jpg/sparki-frontend (fetch/push)
gitsafe-backup  git://gitsafe:5418/backup.git
subrepl-*  (tientallen merge-remotes van taakagenten — verwacht)
```

- **Repository:** `vinkrene-jpg/sparki-frontend` (origin aanwezig). Let op: de naam zegt "frontend", maar de repo is het volledige pnpm-monorepo (web, api-server, mobiel, sandbox).
- **Branch:** `main`. **Volledige HEAD-SHA:** `ddeb94089f3a73109412f38ebd09cad02d7e0a32`, kort `ddeb9408`.
- **Working tree:** vrijwel schoon. Eén gewijzigd gegenereerd bestand (`mockup-components.ts`, automatische codegen van de mockup-sandbox) en de twee zojuist geüploade WP-000-bronbestanden. Geen onverklaarde wijzigingen.
- **Push-stand:** pushes lopen via de Replit-git-koppeling naar origin; de laatste push (incl. `ddeb9408`) is tijdens deze controle uitgevoerd.

### Verschil met de geregistreerde kandidaat-SHA `666b702`

- `666b7027` bestaat in de historie ("Update activities page content", 2026-07-28 05:54 UTC), maar ligt **884 commits achter** de huidige HEAD.
- **Conclusie:** `666b702` is als bronbasis **verouderd en afgewezen**. De live SHA `ddeb9408` is de bronbasis van deze controle. Verklaring van de afwijking: sinds 28 juli is er in hoog tempo doorgebouwd (o.a. Gratis/Go-paywall, Stripe-testmode, observatie-opschoning, admin-vangnetten, grafiek-designspec, Wattage-lab-doelen) — grotendeels via taakagenten met eigen merge-commits, wat het commitvolume verklaart.
- **Gevolg:** alle 73 Build Pack-werkpakketten moeten tegen `ddeb9408` beoordeeld worden, niet tegen `666b702`. Het Build Pack zelf is conform de opdracht **niet** aangepast.

---

## 2. Volledige Replit-taakinventaris

Totaal **403 taken**. Volledige lijst per taak: `docs/SPARKI_REPLIT_TAAKINVENTARIS.csv`.

| Status (intern) | Aantal | Betekenis |
|---|---|---|
| Gemerged (afgerond en in main) | 206 | werk staat in de huidige codebase |
| Concepten (voorgesteld, niet gestart) | 132 | wachten op keuze |
| Gearchiveerd/vervallen | 62 | gestopt, dubbel of vervangen |
| Bezig met mergen | 2 | #390 (observatie-opschoning in productie), #402 (admin-vangnet overige schermen) |
| Actief, nog niet gestart | 1 | #216 (mobiele navigatie end-to-end verifiëren) |

Kanttekeningen bij de gevraagde detailvelden: het Replit-takenregister koppelt geen commit-SHA, teststatus of rapportbestand aan een taak; merge-commits zijn wel in de git-historie herleidbaar (commitboodschappen bevatten de taakinhoud). Waar dat eenduidig kon, is de Build Pack-mapping in de CSV ingevuld; de overige kolommen zijn bewust leeg gelaten in plaats van gegokt.

---

## 3. Status opdracht #382 — historische belastingscores

**Classificatie: AFGEROND_EN_BEWEZEN (gemerged in main).**

- #382 is gestart, uitgevoerd en gemerged. De centrale, deterministische load/TSS-keten zit in de codebase: belastingscore wordt bij ingest afgeleid uit vermogen+FTP, met een zelfherstellende controle bij het opstarten.
- `[achterhaald]`-FTP-rijen (waaronder de foutieve 331 W) worden expliciet uitgefilterd; dit is het enige geldige uitsluitingsformaat en wordt door tests bewaakt.
- Herberekening is idempotent (per-dag-historie, advisory-lock op één client) en er is geen tweede berekeningspad gebouwd.
- Huidige geldige FTP-waarden en trainingsinhoud zijn ongemoeid gebleven; rollback loopt via checkpoints/git.
- Restpunt (klein): het voor/na-bewijs leeft in taakrapportage en commit-historie, niet als apart exportbestand in `docs/`. Wie een los auditbestand wil, moet dat expliciet laten genereren — maar dat is geen blokkade voor R1.

**Gevolg voor Build Pack:** WP-A01 beschrijft dit werk als nog uit te voeren → **verouderde status** in het Build Pack.

## 4. Status opdracht #383 — AI-observaties opschonen

**Classificatie: AFGEROND_MAAR_PRODUCTIE-VERIFICATIE_LOOPT.**

- #383 is uitgevoerd en gemerged: opschoonlogica (superseded/outdated-markering, géén harde delete), 331W-artefact-regels, inhoudelijke dedupe op woordoverlap, en persist-poorten die nieuwe duplicaten voorkomen. De opschoning draait bovendien automatisch (dagelijkse sweep + trigger na FTP-achterhaald-event).
- Dry-run-rapport voor productie (29 jul): 120 actieve observaties → 82 te markeren; René heeft akkoord gegeven.
- **Productie-uitvoering zit in taak #390 en is op dit moment aan het mergen**; taak #399 (concept) is de her-telling die moet bevestigen dat er daarna 38 actieve observaties overblijven.
- Herkomst/gebruikersisolatie: door tests afgedekt (cross-account-isolatiesuite).

**Gevolg voor Build Pack:** WP-A02 grotendeels gedaan; alleen de productie-uitvoering + her-telling (#390/#399) staat nog open → **verouderde status** in het Build Pack.

---

## 5. Ontdubbeling tegen de 73 Build Pack-werkpakketten

Beoordeeld tegen live SHA `ddeb9408`. Samenvatting per track; niets is aangemaakt, gesloten of verwijderd.

### Track A (31)
| Pakket | Status | Toelichting |
|---|---|---|
| WP-000 | **VERIFIED_FOR_R1** | dit rapport |
| WP-A01 | **VERIFIED_FOR_R1** | = #382, gemerged (zie §3) |
| WP-A02 | **AL_GEBOUWD_MAAR_NIET_VERIFIEERD** (alleen prod-stap) | = #383; wacht op #390-merge + #399-telling |
| WP-A03 (mock/lege toestanden) | DEELS_AL_BESTAAND | eerlijke lege toestanden zijn een gehandhaafde bouwregel; geen aparte audit gedaan |
| WP-A04 (accountisolatie) | DEELS_AL_BESTAAND | uitgebreide isolatietestsuites bestaan (cross-account, coach/ouder, links); "onafhankelijke verificatie" niet gedaan |
| WP-A05 (kernstabilisatie) | DEELS_AL_BESTAAND | doorlopend werk; geen formele stabilisatieronde |
| WP-A06A (team-billing/testmode) | **AL_GEBOUWD_MAAR_NIET_VERIFIEERD** | Stripe-testmode + Gratis/Go-entitlements + upgrade-flow gemerged (#385, #396); teamniveau-billing niet |
| WP-A06B (prijs + Stripe-productie) | GEBLOKKEERD (beslispoort) | = bestaande taak #379; wacht op René |
| WP-A07–A09 (club-audit/aanvullen/release) | DEELS_AL_BESTAAND | clubomgeving met rechten/limieten/jeugd-consent bestaat; audit + release-readiness niet gedaan; overlapt concepttaak #6 |
| WP-A10–A14 (groep/planning/publicatie/praktijktest) | NIET_GESTART | coach-cockpit en plan-adoptie bestaan als basis, de groeps-/selectielaag niet |
| WP-A15–A21 (werkruimtes per rol) | NIET_GESTART | rollen/rechtenlaag bestaat, aparte werkruimte-architectuur niet |
| WP-A22–A24 (Koerskamer) | DEELS_AL_BESTAAND | Wedstrijd-room + race-flow/dossier bestaan; naam-/architectuuraudit en livefuncties niet |
| WP-A25–A27 (R1-techniek/rechten/commercieel) | NIET_GESTART | auditpakketten |
| WP-A28 (praktijktests) | GEBLOKKEERD (mens nodig) | |
| WP-A29 (GO/NO-GO) | GEBLOKKEERD (beslispoort) | |

### Track B (18)
- WP-B01 (VIS-00-audit): **AL_GEBOUWD_MAAR_NIET_VERIFIEERD** — audit is eerder uitgevoerd; akkoord van René staat nog open.
- WP-B14 (analyse-grafiek styling): **AL_GEBOUWD** — de grafiek-designspec (TrainingPeaks/WHOOP-niveau) is op 29 jul volledig doorgevoerd (commit `7cab2e5c`).
- WP-B04/B04A/B05/B06 (plan-datacontract/adaptief): DEELS_AL_BESTAAND — plan-lifecycle, adaptieve voorstellen en uitvoeringskoppeling bestaan; het formele datacontract en de Gratis/Go/Compleet-differentiatie niet.
- WP-B07, WP-B08: GEBLOKKEERD (beslispoorten, conform Build Pack deferred).
- WP-B09–B11 (media): DEELS_AL_BESTAAND — foto-opslag/ACL, Photo Lab en Journey-media bestaan; de brede medialaag niet.
- WP-B12–B13, B15–B17: NIET_GESTART (B16 = beslispoort; overlapt concepttaken rond extern clubplatform).
- WP-B02/B03 (VIS-correcties): WACHT op WP-B01-akkoord.

### Track INFRA (12)
**Alle 12: STATUS_ONBEKEND / architectuurconflict.** Het Build Pack veronderstelt een eigen VPS (SSH, firewall, nginx, GitHub Actions-deploy). Het project draait nu volledig op Replit (workflows, Replit-deployments, beheerde Postgres, secrets). Er is géén VPS-werk gedaan en géén VPS beschikbaar in deze omgeving. Dit is een **fundamentele inconsistentie** tussen Build Pack en werkelijkheid die vóór INFRA-01 een besluit vraagt: VPS-migratie (groot, risicovol) óf Build Pack aanpassen naar Replit-productie (die al bestaat en gepubliceerd is).

### Track MARKT (12)
- MARKT-01/02/05 e.v.: NIET_GESTART, geen doublures met bestaande taken; MARKT-01 heeft geen technische afhankelijkheden.
- MARKT-03/11 wachten deels op domeinkeuze (voorwaardelijke gate, ligt nog niet vast).

---

## 6. Openstaande blokkades en gevonden inconsistenties

1. **Master Plan v3_02 ontbreekt als bestand.** `SPARKI_AI_MASTER_PLAN_v3_02.yaml` is niet aanwezig in de werkruimte; nieuwste aanwezige versie is `v2_89` (upload 29 jul). Het Build Pack noemt v3.02 "geverifieerd beschikbaar" — dat bewijsstuk ontbreekt hier. Gevraagd: v3.02 alsnog uploaden.
2. **Kandidaat-SHA `666b702` is 884 commits verouderd** (zie §1); Build Pack-bronbasistabel klopt niet meer.
3. **WP-A01/WP-A02 staan in het Build Pack als uit te voeren**, maar #382 is gemerged en #383 vrijwel volledig — verouderde statussen.
4. **INFRA-track conflicteert met de bestaande Replit-productieomgeving** (zie §5) — beslispunt vóór INFRA-01.
5. **WP-B14 (grafiekstyling) is vandaag al gebouwd** buiten het Build Pack om — status verouderd.
6. **Stripe-testmode/Gratis-Go bestaat al** (relevant voor WP-A06A/A27); alleen productie-activering (#379, beslispoort) staat open.
7. Klein: reponaam "sparki-frontend" dekt de lading niet (volledig monorepo).

## 7. Veilige startvolgorde (fase 6 — nog niets gestart)

| Pakket | Oordeel |
|---|---|
| WP-A01 | **AL_AFGEROND** (#382 gemerged) — niet opnieuw starten |
| INFRA-01 | **EERST_HERSTEL_NODIG** — eerst besluit VPS vs. Replit-productie (inconsistentie §6.4) |
| MARKT-01 | **READY_TO_START** — geen afhankelijkheden, geen doublures |
| WP-B01 | **AL_DEELS_UITGEVOERD** — audit ligt er; wacht op akkoord van René, daarna door naar WP-B02/B03 |

Aanbevolen eerste vervolg na deze controle: (a) v3.02-Master Plan aanleveren, (b) besluit over de INFRA-koers, (c) akkoord op VIS-00, (d) #390/#399 laten aflopen. Daarna zijn MARKT-01 en de WP-A03/A04-audits veilig te starten zonder dubbel werk.

## 8. Eindstatus

**WP-000 = VERIFIED_FOR_R1**, met de kanttekening dat de bronbasis verschoven is naar live SHA `ddeb94089f3a73109412f38ebd09cad02d7e0a32` (29 jul 2026, 11:20 UTC) en dat de vier punten uit §6.1–§6.4 openstaan voordat de keten (WP-A01→…) automatisch door mag. Geen van de WP-000-stopcondities is geraakt: repotoegang aanwezig, geen destructieve wijzigingen in #382/#383 aangetroffen, geen secrets in dit rapport.
