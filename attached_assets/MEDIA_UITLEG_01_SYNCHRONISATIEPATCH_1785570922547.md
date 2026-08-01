# MEDIA_UITLEG_01 — SYNCHRONISATIEPATCH

**Deel 14 van 20**

---

## 0. Regel

**Het Master Plan wordt niet bijgewerkt.** Het blijft een bouwplan. Synchroniseren gebeurt via besluitregister, afbouwmatrix, dagkaart, releasestatus en roadmap.

---

## 1. Besluitregister

Vier besluiten horen geregistreerd. **Nummers nog niet toekennen** zolang de reeks niet is opgeschoond; tijdelijke aanduiding:

| Tijdelijk | Besluit |
|---|---|
| MED-B1 | `MEDIA_UITLEG_01` is eigenaar van de weergavelaag; `KENNIS_01` van inhoud, bron, maker, licentie, leeftijdsclassificatie, doelgroep, veiligheidsinhoud, publicatiestatus, inhoudsversie en controledatum; `BRAND_IDENTITY_01` van logo, kleur, typografie en iconografie; de centrale entitlementlaag van pakkettoegang. Geen dubbele architectuur. |
| MED-B2 | Uitleg en Academy wordt geen zesde hoofditem. Plaatsing onder Hulp & ondersteuning, met "Sparki gebruiken" gratis en "Beter fietsen en trainen" in Sparki Compleet. Presentatiegrens is een verwijzing; geen entitlements in dit pakket. |
| MED-B3 | Mobiele data: standaard geen videodownload · gebruiker kan het bewust **per apparaat** toestaan · later weer uit te schakelen · poster en volledige tekstvariant blijven beschikbaar · geen stille download of prefetch. |
| MED-B4 | Acute veiligheids- en medische meldingen blijven in hun **bestaande veiligheidslaag**. CMP-44 is uitsluitend de niet-acute melding; dit pakket bouwt geen acute-meldingenregime. |

---

## 2. Afbouwmatrix

Nieuw domein: **mediaweergave en uitleglaag**.

| Onderdeel | Beginstatus |
|---|---|
| Motion- en toegankelijkheidsbasis | niet gestart |
| Dieptecomponent | niet gestart |
| Mediaspeler | niet gestart |
| Gebruikersstatus en contentbinding | niet gestart |
| Uitlegflow | niet gestart |
| Oefenkaartweergave | niet gestart — geblokkeerd door contentmodel |
| Coachmelding (uitsluitend niet-acuut) | niet gestart — geblokkeerd door echte adviesgrond |
| Uitleg en Academy | niet gestart — wacht op de technische route uit F0 en op pilotinhoud |
| Verminder beweging | niet gestart |

Bestaande animatie-, media-, help- en toegankelijkheidsstatus staan op **onbekend** tot F0 is opgeleverd. Geen schattingen.

---

## 3. Releasestatus

`MEDIA_UITLEG_01` is **niet release-blokkerend**: zonder deze laag werkt Sparki volledig. Twee uitzonderingen:

- de instelling Verminder beweging telt mee in `34_TOEGANKELIJKHEID_01`;
- **media met onduidelijke rechten is wél release-blokkerend** zodra er ook maar één bestand gepubliceerd is.

---

## 4. Roadmap

Eén blok met twaalf fasen, met de aantekening dat F6, F7 en F8 elk aan een voorwaarde hangen die buiten dit pakket ligt.

---

## 5. Dagkaart

Regel op de dag van vrijgave: welke fase, op welke SHA, en wat de eerstvolgende poort is.

---

## 6. Documenten die naar deze laag verwijzen

| Document | Toevoeging |
|---|---|
| `SPARKI_MOBILE_COMPONENT_LIBRARY.md` | bij CMP-40 t/m 44: "gebouwd door `MEDIA_UITLEG_01`" |
| `SPARKI_MOBILE_PATTERNS.md` | bij PAT-28 t/m 39: idem |
| `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` | hoofdstuk 10 geldt; `MEDIA_UITLEG_01` is het eerste pakket dat eronder valt |
| `KENNIS_01` | grensparagraaf: `KENNIS_01` levert, `MEDIA_UITLEG_01` toont |
| `34_TOEGANKELIJKHEID_01` | verwijzing naar Verminder beweging in plaats van een eigen norm |
| `BRAND_IDENTITY_01` | de vormtaal van de diepte hoort bij het merkhandboek |
| `REPORT_DESIGN_STANDARD_01` | waar mediagebruik wordt geëxporteerd, geldt die standaard |

---

*Deel 14 van 20.*
