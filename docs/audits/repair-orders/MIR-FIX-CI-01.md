# MIR-FIX-CI-01 — Herstel ontbrekende GitHub Actions voor vereiste PR-checks

Status: GEREED VOOR OVERDRACHT AAN REPLIT
Gekoppeld register-finding: MIR-2026-003
Opgesteld door: Mirror (documentatie-only; geen productcode gewijzigd)
Datum: 2026-08-01

## Bronbevinding

GitHub branch protection op main vereist drie statuschecks: validators, typecheck, admin-smoke.
Op main bestaat geen .github/workflows-directory (live geverifieerd: tree/main/.github bevat alleen instructions/ en copilot-instructions.md).
Geen workflow kan deze checknamen ooit rapporteren. PR #3 toont letterlijk "There are no checks for this commit".

Gevolg: PR #2, #3 en #4 blijven permanent op Checks pending; branch protection werkt formeel maar is praktisch onuitvoerbaar; documentatiecorrecties kunnen niet via de normale route worden gemerged.

## Doel

Herstel de normale CI-keten zodat de bestaande required checks daadwerkelijk worden uitgevoerd en gerapporteerd.

## Bouw

Maak onder .github/workflows/ een of meer GitHub Actions-workflows die exact deze checknamen opleveren: validators, typecheck, admin-smoke.

## Vereisten per check

validators: promise-calibration uitvoeren; sanity-reports uitvoeren; fail bij echte validatorfout; duidelijke logs; geen silent pass.

typecheck: libs typecheck; api-server typecheck; relevante frontendtypecheck wanneer dat onderdeel is van de bestaande standaard; fail bij fout; cache mag maar geen oude resultaten hergebruiken als bewijs.

admin-smoke: echte applicatie starten tegen een verse tijdelijke Postgres-database; migraties uitvoeren; admin-smoke-tests draaien; database na afloop opruimen; geen productiegeheimen of productiedatabase gebruiken; fail-closed wanneer benodigde testconfig ontbreekt.

## Triggers

Minimaal: pull_request naar main; push naar main waar passend; handmatige workflow_dispatch voor herstel/verificatie.

## Repositoryregels

Gebruik bestaande package manager en scripts; verzin geen parallelle testcommando's wanneer bestaande scripts beschikbaar zijn; required-check namen moeten exact overeenkomen met branch protection; branch protection niet versoepelen tenzij technisch aantoonbaar noodzakelijk; geen checks verwijderen om groen te krijgen.

## Testen (minimaal bewijs)

Punt a: nieuwe test-PR activeert alle drie checks. Punt b: validators rapporteert zichtbaar. Punt c: typecheck rapporteert zichtbaar. Punt d: admin-smoke rapporteert zichtbaar. Punt e: een opzettelijk falende test maakt de juiste check rood. Punt f: na herstel wordt de check groen. Punt g: PR #2, #3 en #4 krijgen de vereiste checks. Punt h: branch protection laat merge toe wanneer alle drie groen zijn.

## Oplevering (door Replit)

Rapporteer: start-SHA; eind-SHA; workflowbestanden; gebruikte scripts; checknamen; bewijs van groene run; bewijs van rode proefrun en herstel; status PR #2/#3/#4; merge-SHA's zodra CI groen is. Commit en push. Gebruik normale branch protection. Niet omzeilen.

## Rolgrens

Dit document is uitsluitend de herstelopdracht-specificatie. Mirror bouwt geen .github/workflows-bestanden en start geen CI-infrastructuur zelf; dat is Replit-werk. Mirror hertoetst pas na een geleverde herstel-SHA (zie Testen-sectie hierboven).
