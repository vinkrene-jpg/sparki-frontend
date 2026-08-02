# MOBIEL_ROLLEN_01 F0 — Gekozen samenvoegroute (besluitregister)

**Status:** vastgesteld 02-08-2026 · technische keuze conform MR-09 (door Replit, met één zin terug te draaien)
**Opdracht:** `attached_assets/MOBIEL_ROLLEN_01_1785657774007.md`

## Besluit MR-F0-01 — Route B: hybride, native rijkern + rolschermen uit de webcodebasis

De app en de browser worden één codebasis voor alle **rolschermen** door de bestaande
webapplicatie (`artifacts/sparki`) ín de native app te tonen via een ingebedde
webweergave met een beveiligde sessiebrug. De **rijkern blijft volledig native**.

### Waarom deze route

Gemeten uitgangspositie (02-08-2026):

1. **De API-laag is al één codebasis.** Web én app gebruiken `@workspace/api-client-react`,
   gegenereerd uit één OpenAPI-spec (`lib/api-spec`). Types worden nergens dubbel
   gedeclareerd. Rechten zitten uitsluitend server-side (`entitlements.ts`,
   `club-permissions.ts`, `parent-permissions.ts`) — MR-16 is vandaag al de architectuur.
2. **De UI-laag is onverenigbaar.** Web: ~50 pagina's in React/wouter/Tailwind/shadcn met
   het complete designsysteem en de CommercialShell. App: 13 schermen in React
   Native/Expo Router. Er is geen gedeelde UI-component.
3. De verworpen alternatieven:
   - **Route A — alles naar Expo universal (react-native-web):** vergt herbouw van ~50
     webschermen in React Native, gooit het designsysteem en de CommercialShell weg,
     maanden doorlooptijd, maximaal regressierisico op web (dat vandaag productie is).
     Bouwt elk bestaand webscherm alsnog een tweede keer — precies wat MR-05 verbiedt.
   - **Route C — logica delen, UI per platform:** elk rolscherm bestaat dan blijvend twee
     keer; directe herstelgrond MR-24.
4. **Route B bouwt een rolscherm aantoonbaar één keer** (MR-10): het scherm bestaat
   alleen in `artifacts/sparki` en draait uit diezelfde code in de browser én in de app.
   De schil (vaste vijf posities, contextregel, rolwisselaar — MR-11 t/m MR-13) is de
   bestaande CommercialShell en is daarmee automatisch identiek op beide platformen
   (MR-14).

### De vier verplicht-native onderdelen (MR-08)

**Navigeren tijdens de rit · rit opnemen · wedstrijddagmodus · achtergrondlocatie**
blijven ongewijzigd native (incl. BLE-sensoren, val-alarm, audio-cues, kaart). De
webweergave krijgt deze functies nooit; knoppen die een rit starten springen via een
brug (deep link) naar het native scherm.

### Sessiebrug (kern van F1)

- De app is ingelogd via Clerk (`@clerk/expo`, Bearer-tokens); de web-app gebruikt
  Clerk-cookies. De brug logt de webweergave in met dezelfde Clerk-sessie
  (token → webessie), zonder tweede login en zonder tokens in URL's of opslag van de
  webweergave te lekken.
- Mislukking van de brug is een eerlijke foutkaart met opnieuw-proberen — nooit een
  leeg scherm of stille terugval naar de sporterweergave.
- De contextregel (rol · organisatie · test/productie, MR-27) komt uit de webschil
  zelf en is daardoor per definitie op elk rolscherm zichtbaar.

### Migratiepad per bestaand app-scherm (13, MR-20)

| Scherm | Pad |
|---|---|
| record (rit opnemen) | **native, blijft** (MR-08) |
| navigate | **native, blijft** (MR-08) |
| wedstrijddag | **native, blijft** (MR-08); F7 verbreedt naar mechanieker/soigneur |
| route-plannen / route-aanvraag | native, blijft (kaart-eerst, gekoppeld aan native navigatie) |
| gpx-import | native, blijft (bestandssysteem + koppeling aan native bibliotheek) |
| rides / ride-detail | native, blijft (gekoppeld aan opname/upload-wachtrij) |
| index (Vandaag sporter) | native, blijft vooralsnog; rolvarianten van Vandaag komen via de webschil |
| instellingen / support / diagnostiek | native, blijft (apparaat-instellingen, permissies, diagnose) |
| sign-in / sign-up | native, blijft (Clerk expo is de tokenbron van de brug) |

Geen enkel bestaand scherm wordt verwijderd of herbouwd in dit pakket — regressie op de
rijfuncties weegt zwaarder dan een ontbrekend rolscherm (MR-29, keuze 6 van Claude).
**Nieuwe rolschermen (F2–F6) worden uitsluitend in `artifacts/sparki` gebouwd** en in de
app via de brug getoond; nooit een tweede native variant (MR-23/MR-24).

### Gevolgen (MR-07)

- **Bouwtijd:** rolschermen kosten eenmalig webwerk; de app-kant is één generiek
  brugscherm. Geen dubbele bouw of dubbel herstel.
- **Publicatie:** webschermen verbeteren zonder app-store-release; alleen wijzigingen
  aan de rijkern of de brug vergen een nieuwe app-build. De dagelijkse publish blijft
  zoals hij is.
- **Risico's, benoemd:** webweergave voelt minder "native" voor bureauwerk-rollen
  (aanvaard: dit zijn precies de rollen met browserwerkstromen); de brug is één nieuw
  kritisch pad (daarom eerlijke foutafhandeling + regressiebewijs in F8); store-review
  accepteert hybride apps zolang de kern native waarde biedt — de rijkern ís native.

### Klaar-criterium F0 (MR-10)

Route gekozen en onderbouwd ✓ · migratiepad per bestaand scherm ✓ · aantoonbaar dat een
rolscherm hierna één keer wordt gebouwd: het bestaat alleen in `artifacts/sparki` en de
app rendert diezelfde build via de brug ✓.
