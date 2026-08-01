# Sparki centrale documentenbibliotheek

**Status:** ontwerpbron voor Replit  
**Doel:** één centrale plek voor levende werkobjecten, sjablonen, rapportuitvoer en archief.

## Hoofdregel

Een document in Sparki is in beginsel een **levend werkobject**. Een PDF is alleen een onveranderlijke momentopname van één versie.

## Voorgestelde repositorylocatie

`docs/document-library/`

In de applicatie komt later één centrale omgeving:

**Meer → Documenten**

met filters op:

- organisatie;
- team;
- sporter;
- evenement;
- documenttype;
- status;
- eigenaar;
- periode;
- privacyklasse.

## Mappen

- `governance/` — eigenaarschap, status, versie, rechten en publicatie.
- `schemas/` — centrale metadata en sectiecontracten.
- `templates/club/` — vaste clubdocumenten.
- `templates/team/` — team- en seizoensdocumenten.
- `templates/event/` — wedstrijd- en dagschema-objecten.
- `templates/trainer/` — professionele begeleiding.
- `templates/parent_minor/` — ouder, jeugd en toestemming.
- `templates/finance/` — eenvoudige verkoopfacturatie.
- `templates/shared/` — incident, evaluatie, overdracht en algemene formulieren.

## Gebruik door Replit

1. Inventariseer bestaande documenten, tabellen, API's en rapportgeneratoren.
2. Hergebruik wat al bestaat.
3. Implementeer één centrale werkobjectlaag.
4. Registreer ieder sjabloon in `TEMPLATE_CATALOGUE.md`.
5. Laat gebruikers nieuwe sjablonen toevoegen zonder codewijziging.
6. Bewaar iedere gepubliceerde versie onveranderlijk.
7. Laat dupliceren altijd een nieuw object met een nieuwe ID maken.
8. Exporteer PDF, Excel of CSV alleen vanuit een vastgelegde objectversie.
