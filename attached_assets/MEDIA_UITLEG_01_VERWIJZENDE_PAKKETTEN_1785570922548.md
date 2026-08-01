# MEDIA_UITLEG_01 — VERWIJZENDE PAKKETTEN

**Deel 20 van 20**

---

## 1. Pakketten die later naar deze laag moeten verwijzen

Ieder pakket hieronder krijgt de regel: **"Media, uitleg en beweging conform `MEDIA_UITLEG_01`."**

| Pakket | Waarom |
|---|---|
| `KENNIS_01` | levert de inhoud die deze laag toont; grensparagraaf verplicht |
| `25_COACH_ADAPTIEF_01` | levert de adviesgrond voor CMP-44 |
| `AI_ENGINE_01` | AI-tekst binnen uitleg en coachmelding volgt MUX-90 t/m 92 |
| `29_ANALYSE_01` | uitleg om de analyse te begrijpen |
| `26_WEDSTRIJD_01` | uitleg wedstrijdvoorbereiding; stil in de wedstrijddagmodus |
| `22_PLOEGLEIDER_01` | wedstrijddagkaart met diepte; verder geen media tijdens de operatie |
| `23_TEAM_MECHANIEKER_01` | materiaalinstructie met poster en tekstvariant |
| `27_VOEDING_01` | voedingsinstructie; jeugdgrens geldt onverkort |
| `16_JEUGD_OUDER_01` | uitleg toestemming en afmelding; geen coachadvies over het kind |
| `31_HELPDESK_01` | Help is de vindplaats van Uitleg en Academy |
| `34_TOEGANKELIJKHEID_01` | verwijst naar Verminder beweging in plaats van een eigen norm |
| `30_PROFIEL_01` | de instelling Verminder beweging staat in het profiel of de instellingen |
| `TEAM_ONBOARDING_01` · `CLUB_ONBOARDING_01` | geen mediacomponent in de inrichtingswizard |
| `REPORT_DESIGN_STANDARD_01` | waar mediagebruik wordt geëxporteerd |
| `SPARKI_CONTROL_01` | Product Health kan later de metingen uit deel 17 gebruiken |

---

## 2. Reeds gebouwde pakketten

Worden **niet** met terugwerkende kracht herbouwd. Ze worden getoetst bij de eerstvolgende wijziging aan een van hun schermen; gevonden afwijkingen gaan naar de herstellijst.

---

## 3. Regel voor nieuwe pakketten

Een nieuw pakket dat media, uitleg of beweging toont, gebruikt deze laag. Het bouwt geen eigen speler, geen eigen animatie en geen eigen helppagina. Ontbreekt er iets, dan wordt eerst de componentbibliotheek uitgebreid — met een eigen besluit, niet in het bouwpakket.

---

*Deel 20 van 20. Einde `MEDIA_UITLEG_01`.*
