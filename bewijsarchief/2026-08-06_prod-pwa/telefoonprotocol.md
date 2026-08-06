# Telefoonprotocol — PWA-installatie op productie (Task #627)

Doel: op een echte telefoon bewijzen dat Sparki vanaf https://sparki-frontend.replit.app
installeert als beginscherm-app, standalone opent en het Rijden-scherm toont.

Doorloop de stappen in volgorde; elk stap heeft een objectief controlepunt.

## A. Installatie
1. Open **Chrome (Android)** of **Safari (iPhone)** en ga naar `https://sparki-frontend.replit.app`.
2. Log in en wacht tot het startscherm volledig geladen is.
3. Android: menu (⋮) → **App installeren** / **Toevoegen aan startscherm**.
   iPhone: deelknop → **Zet op beginscherm**.
   - ☐ Controlepunt A1: het installatievoorstel toont de naam **Sparki** en het Sparki-icoon (geen generiek wereldbol-icoon).
4. Bevestig.
   - ☐ Controlepunt A2: op het beginscherm staat een Sparki-icoon.

## B. Standalone opening
5. Sluit de browser volledig. Tik op het Sparki-icoon op het beginscherm.
   - ☐ Controlepunt B1: de app opent **zonder adresbalk** (volledig scherm, geen browser-chrome).
6. Ga onderin naar **Rijden** (of open het routescherm).
   - ☐ Controlepunt B2: de kaart rendert (plaatsnamen zichtbaar, geen grijs/zwart vlak).
   - ☐ Controlepunt B3: routes tonen in kleur/patroon en een route-item opent het routekaartje.

## C. Verversing (na de eerstvolgende Publish — CACHE_VERSIE staat al op v2)
7. Open de geïnstalleerde app opnieuw, ná de Publish; sluit hem daarna volledig en open nogmaals.
   - ☐ Controlepunt C1: de app toont de nieuwe versie (geen oude schil). Ik bewijs de
     cachewissel (v1 weg, v2 aanwezig) parallel met een browsercontrole op productie.

Uitkomst (welke controlepunten wel/niet gehaald, toestel + browser) graag terugmelden;
die leg ik vast in dit bewijsarchief.
