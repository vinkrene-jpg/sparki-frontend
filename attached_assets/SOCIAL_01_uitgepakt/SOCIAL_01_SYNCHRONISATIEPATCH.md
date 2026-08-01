# SOCIAL_01 — SYNCHRONISATIEPATCH

Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix
- nieuwe regels in domein **4 Routes en navigatie** en **8 Club, team en jeugd**: `Feed` · `Vrienden` · `Groepen` · `Challenges` · `Reacties en moderatie` — elk `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (SOCIAL_01, commit <eind-SHA>)`;
- bestaande regel `Eenvoudige sociale route-/vriendenfuncties` → afhankelijkheid bijwerken naar `SOCIAL_01`;
- de wereldsimulatie blijft `OPEN` en komt **niet** op MIRROR_PROVEN — die is geen gebruikersfunctie.

## Dagkaart
**Afgerond** aanvullen met:
> - `SOCIAL_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Feed, vrienden, groepen, challenges en moderatie werken; gesimuleerde en geseede inhoud is bij de bron uitgesloten van elke echte feed.

**Open beslissingen** aanvullen met: wie beoordeelt gemelde inhoud, en binnen welke termijn.

## Releasestatus
Onder **Bewezen**:
> ### SOCIAL_01 — sociaal product
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Geen gesimuleerde of geseede inhoud in een echte feed; uitsluiting bij de bron, niet in de weergave.
> - Delen is standaard privé; zichtbaarheid server-side afgedwongen op vier niveaus.
> - Privacyzones werken door in gedeelde inhoud; minderjarigen hebben geen openbare zichtbaarheid.
> - Challenges meten uitsluitend op activiteiten met herleidbare bron.

Onder **Releaseblokkades die blijven gelden**:
> - Geen publieke sociale functies zonder een aangewezen beoordelaar voor gemelde inhoud.

## Roadmap
- blok **Sociaal** op prioriteit G, afgerond en Mirror-bewezen;
- moderatiebeoordeling als vervolgstap zodra de rol is toegewezen.

## Besluitregister
> ## SPARKI-BESLUIT-2026-0XX — Sociale zichtbaarheid en echtheid
> **Status:** te bevestigen door René
> - In de feed van een echte gebruiker verschijnt nooit gesimuleerde of geseede inhoud; uitsluiting gebeurt bij de bron.
> - Delen is standaard privé; openbaar is nooit de standaard.
> - Minderjarigen hebben geen openbare zichtbaarheid en maken geen openbare groepen.
> - Challenges tellen uitsluitend echte deelnemers en echte activiteiten.
> - De clubomgeving is geen sociale functie en blijft daarvan gescheiden.

## Functiematrix
Nieuwe rijen: feed · vrienden · groepen · challenges · reacties · moderatie — domein sociaal, bewijsstatus uit het Mirror-rapport.
