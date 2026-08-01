# MEDIA_UITLEG_01 — DATAMODEL

**Deel 3 van 20**

---

## 0. Uitgangspunt

Dit document beschrijft het **contract** waaraan de weergavelaag moet kunnen voldoen. Het schrijft geen nieuw schema voor waar een bestaand model volstaat.

**F0 stelt vast** welke bestaande modellen worden hergebruikt en welke velden aantoonbaar ontbreken. Tot F0 is opgeleverd, is de kolom "bestaand of nieuw" hieronder onbekend — en dat wordt niet ingevuld met een aanname.

**Bewaartermijnen worden hier niet vastgesteld.** Iedere verwijzing gaat naar het bestaande bewaarbeleid. De zes openstaande termijnen liggen bij jurist of accountant.

---

## 1. Contentcontract voor mediapresentatie

Eigenaar van de inhoud: `KENNIS_01`. Onderstaande velden zijn wat de weergavelaag **nodig heeft om iets te mogen tonen**.

| Veld | Betekenis | Blokkeert vertoning als het ontbreekt |
|---|---|---|
| `content_id` | unieke verwijzing | ja |
| `content_version` | versie van de inhoud | ja |
| `content_type` | les · uitleg · oefening · coachtoelichting | ja |
| `category` | indeling binnen Academy | nee |
| `target_role` | voor welke rol(len) bedoeld | nee — leeg betekent alle rollen |
| `target_age_class` | leeftijdsklasse | **ja bij minderjarigen** |
| `language` | taal van de inhoud | ja |
| `entitlement` | gratis of Compleet | ja |
| `screen_or_feature` | waar het bij hoort | ja voor uitleg, nee voor Academy-inhoud |
| `media_type` | video · animatie · alleen tekst | ja |
| `media_source_reference` | verwijzing naar het bestand | ja bij media_type ≠ tekst |
| `poster_reference` | posterbeeld | **ja bij media** |
| `low_resolution_reference` | lage-resolutievariant | nee — zonder deze variant geen aanbod op lage bandbreedte |
| `subtitles_reference` | ondertiteling | **ja bij media** |
| `text_alternative` | volwaardige tekstvariant | **ja, altijd** |
| `duration_seconds` | duur | ja bij media |
| `rights_status` | zie mediarechten | **ja** |
| `license_reference` | licentie | **ja** |
| `publication_status` | zie mediarechten | **ja** |
| `last_content_review_at` | datum inhoudelijke controle | **ja** |
| `safety_classification` | veiligheidsclassificatie | **ja bij oefeninhoud** |

**Regel:** een ontbrekend blokkerend veld leidt tot **niet tonen**, niet tot een lege speler en niet tot een gegenereerde vervanging. De gebruiker ziet de eerlijke niet-beschikbaarstatus (PAT-35).

---

## 2. Gebruikersstatus

Eigenaar: de weergavelaag. Server-side bewaard.

| Veld | Betekenis |
|---|---|
| `user_id` | de gebruiker |
| `content_id` | welke inhoud |
| `content_version` | welke versie hij zag |
| `state` | aangeboden · gestart · bekeken · voltooid · overgeslagen · uitgesteld · opnieuw geopend |
| `first_offered_at` | wanneer voor het eerst aangeboden |
| `started_at` | wanneer gestart |
| `completed_at` | wanneer voltooid |
| `skipped_at` | wanneer overgeslagen |
| `dismissed_until` | tot wanneer uitgesteld |
| `do_not_show_again` | alleen waar toegestaan |
| `last_position` | laatste positie in de media |
| `playback_speed` | 1× of 0,5× |
| `updated_at` | laatste wijziging |

---

## 3. Harde regels

**D-1** `do_not_show_again` is **nooit** toegestaan voor acute meldingen.

**D-2** `do_not_show_again` is **nooit** toegestaan voor minderjarigen — ook niet voor een niet-acute melding.

**D-3** Een gewijzigde `content_version` mag gecontroleerd opnieuw worden aangeboden: alleen bij een inhoudelijke wijziging, en hoogstens één keer per versie.

**D-4** Historie blijft herleidbaar. Overslaan of "niet meer tonen" wist niet dat er is aangeboden.

**D-5** Geen fictieve voortgang. Wat niet gemeten is, wordt niet getoond.

**D-6** Status wordt server-side bewaard; niets wordt lokaal als bevestigd getoond zonder serverantwoord.

**D-7** Cross-accountafscherming. Voortgang van de één is nooit zichtbaar voor de ander — ook niet bij gedeelde toestellen of gekoppelde ouder-kindrelaties.

**D-8** Verwijderen en bewaren volgen het bestaande beleid. **Geen termijnen verzinnen.**

**D-9** Bij verlies van een pakket blijft bestaande voortgang bestaan; alleen de toegang vervalt.

**D-10** Een ingetrokken contentversie blokkeert nieuwe vertoning; de bestaande statusregels blijven als historie staan.

---

## 4. API-contracten

Vijf calls. Namen zijn indicatief; F0 stelt vast of bestaande endpoints hergebruikt kunnen worden.

### 4.1 Inhoud opvragen voor een scherm
**In:** scherm of functie · rol · pakket · taal · leeftijdsklasse.
**Uit:** nul of meer contentrecords volgens hoofdstuk 1, uitsluitend gepubliceerd en rechten-gecontroleerd.
**Fout:** geen resultaten is geen fout — het is een lege toestand.
**Rechten:** server-side gefilterd. Nooit alles ophalen en client-side verbergen.

### 4.2 Status ophalen
**In:** gebruiker · één of meer content-ID's.
**Uit:** de statusrecords van hoofdstuk 2.
**Rechten:** uitsluitend de eigen gebruiker.

### 4.3 Status bijwerken
**In:** gebruiker · content-ID · contentversie · nieuwe toestand · optioneel positie en snelheid.
**Uit:** bevestiging met de opgeslagen toestand.
**Regels:** `do_not_show_again` wordt server-side geweigerd bij een acute melding of een minderjarige — niet client-side verborgen. De weigering wordt gelogd (E-1).

### 4.4 Media-URL opvragen
**In:** content-ID · contentversie · gewenste variant (poster, laag, volledig).
**Uit:** een beveiligde of openbare URL, afhankelijk van de content.
**Regels:** entitlement en leeftijd worden **hier** gecontroleerd, niet pas bij het afspelen. Geen URL vóór de controle.

### 4.5 Gebeurtenis melden
**In:** gebeurtenistype uit E-1 · content-ID · contentversie.
**Uit:** bevestiging.
**Regels:** nooit inhoud meesturen, alleen het type.

---

## 5. Wat dit model niet doet

- Geen contentbeheer. Aanmaken, wijzigen en publiceren van inhoud gebeurt in `KENNIS_01`.
- Geen rechtenbeslissingen. De entitlementlaag beslist; dit model vraagt en respecteert.
- Geen mediaopslag. Bestanden staan in de bestaande objectopslag of CDN.
- Geen eigen leeftijdsbepaling. De leeftijdsklasse komt uit het bestaande profiel- en jeugdmodel.

---

*Deel 3 van 20.*
