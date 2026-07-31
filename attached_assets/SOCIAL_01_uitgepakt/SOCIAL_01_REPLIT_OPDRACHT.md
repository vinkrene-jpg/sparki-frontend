# SOCIAL_01 — FEED, VRIENDEN, GROEPEN, CHALLENGES EN MODERATIE

**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

## Doel
Het sociale deel van Sparki wordt één samenhangend product: een feed die uitsluitend echte inhoud van echte mensen toont, vrienden en groepen met heldere privacy, challenges die eerlijk meten, en moderatie die werkt vóór er iets misgaat.

## Scope
Feed · vrienden · groepen · challenges · reacties · moderatie · privacy.

## Buiten scope
De clubomgeving — dat is een echte organisatie met trainers en rollen, nadrukkelijk **geen** sociale clubfunctie (`CLUB_RECHTEN_01`). Wedstrijd-room · routedelen als functie (`route_shares` blijft waar hij is) · marketing- of groeimechanismen · notificatiekanalen zelf.

## 0. Bestaande onderdelen — hergebruiken

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Sociale routes | `routes/social.ts`, `routes/world-social.ts`, `routes/feed.ts` | bestaande sociale endpoints |
| Toegangscontrole | `lib/world-social/access.ts` | wie mag wat zien |
| Feed-engine | `engines/world-feed/` | feedopbouw |
| Media | `engines/world-media/` | beeld bij sociale items |
| Affiniteit | `engines/world-affinity/` | relevantiebepaling |
| Delen van routes | `schema/route-shares.ts`, `routes/share.ts` | bestaand deelmechanisme |
| Tests | `test:world-social`, `test:social-privacy`, `test:share-honesty`, `test:world-feed`, `test:world-media`, `test:world-affinity`, `test:world-consistency` | vertrekpunt |
| Moderatiebasis | `routes/bug-reports`, `support_tickets` | meldstructuur |

Geen tweede feed, geen tweede deelmechanisme, geen tweede toegangscontrole.

## 1. De hoofdregel van dit pakket: echt en gesimuleerd raken elkaar nooit

Sparki bevat een **wereldsimulatie**: `engines/world-population/`, `engines/world-simulation/`, `lib/world-seed.ts`, plus dev-persona's in `lib/preview-athletes.ts`. Die laatste draagt in zijn eigen commentaar de regel dat het uitsluitend ontwikkelgereedschap is en nooit in productiepaden voor authenticatie of data wordt gebruikt.

**Die scheiding is in dit pakket de belangrijkste eis.**

1. In de feed van een echte gebruiker verschijnt **nooit** gesimuleerde of geseede inhoud, in geen enkele vorm — geen activiteit, geen reactie, geen deelnemer, geen challengeklassement, geen aantal.
2. Een leeg sociaal beeld is een **geldig** beeld. Een nieuwe gebruiker zonder vrienden ziet een eerlijke lege toestand met een volgende stap, geen gevulde feed.
3. Simulatie-inhoud is server-side herkenbaar aan zijn herkomst en wordt bij de bron uitgesloten, niet in de weergave weggefilterd. Een filter dat je kunt vergeten is geen scheiding.
4. Een deelnemersaantal, een klassement of een reactieteller telt **alleen echte mensen**. Een challenge met drie deelnemers toont drie, niet dertig.

Kan een bestaande feedbron dit onderscheid niet maken, dan is dat een **stopconditie** — niet iets om met een filter te overbruggen.

## 2. Productregels

5. Alles wat je deelt is standaard privé; delen is een handeling, geen instelling die aan staat.
6. Zichtbaarheid per item: alleen ik · vrienden · groep · openbaar. Openbaar is nooit de standaard.
7. Locatie in sociale inhoud volgt de bestaande privacyzones; een start- of eindpunt bij huis wordt nooit gedeeld.
8. Een minderjarige heeft geen openbare zichtbaarheid en kan geen openbare groep aanmaken. Vrienden en groepen lopen via de bestaande jeugd- en toestemmingsregels.
9. Reacties zijn verwijderbaar door de schrijver én door de eigenaar van het item.
10. Een challenge meet uitsluitend op aantoonbare echte activiteiten met een herleidbare bron.
11. Blokkeren werkt in twee richtingen en direct: een geblokkeerde gebruiker ziet niets meer van jou en jij niets van hem.
12. Moderatie is **preventief waar het kan**: melden is altijd mogelijk, en een gemeld item is voor de melder direct onzichtbaar terwijl de beoordeling loopt.

## 3. Frontend
Feed met een duidelijk zichtbare bron per item — wie, wanneer, en of het gedeeld is met jou of openbaar. Zichtbaarheidskeuze bij elk deelmoment, niet verstopt in instellingen. Groepen met leden, rollen en een eigen privacyniveau. Challenges met deelnemers, regels en een stand. Een meldknop op elk item en elke reactie. Op mobiel dezelfde handelingen.

## 4. Backend
E�n server-side functie die bepaalt of een item voor deze kijker zichtbaar is, en die alle sociale endpoints gebruiken. Uitsluiting van simulatie-inhoud gebeurt in de bron van de feed. Challengestanden worden server-side berekend uit echte activiteiten; de frontend telt niet.

## 5. Database
Additief. Nodig: zichtbaarheidsniveau per gedeeld item, groepen met leden en rol, challenges met regels en deelnemers, reacties met eigenaar, blokkades tussen gebruikers, en meldingen met status. Bestaande `route_shares` blijft zoals hij is en wordt niet vervangen.

## 6. Rechten en privacy
Zichtbaarheid is server-side; de interface verbergt hoogstens. Een directe aanroep op een item-ID dat niet voor jou bestemd is, wordt geweigerd — ook wanneer je het ID kent. Trainer, ouder en club krijgen via dit pakket **geen** extra sociale inzage: hun toegang loopt via hun eigen rolregels en niet via de feed.

## 7. Communicatie
Melding bij een vriendschapsverzoek, een groepsuitnodiging en een reactie op je eigen item. Uitzetbaar per soort. Geen melding die aanzet tot vaker terugkomen; geen reeksen, geen strepen, geen druk.

## 8. Fout- en lege toestanden
Onderscheiden: nog geen vrienden · geen items in de feed · groep zonder leden · challenge zonder deelnemers · item verwijderd · geen toegang tot dit item · in beoordeling na melding · technische fout. Elk met een volgende stap.

## 9. Migratie
Bestaande gedeelde routes en bestaande sociale gegevens behouden alles en behouden hun huidige zichtbaarheid. Waar een zichtbaarheidsniveau ontbreekt, wordt **privé** ingevuld — nooit openbaar. Testen op verse database én op een kopie met bestaande data, met rij-aantallen vóór en ná.

## 10. Tests
1. Nieuwe gebruiker ziet een lege feed met een volgende stap — geen enkel item. 2. Geen gesimuleerde of geseede inhoud in de feed van een echt account, in geen enkele vorm. 3. Deelnemersaantal en klassement tellen alleen echte mensen. 4. Delen is standaard privé; openbaar is nooit de standaard. 5. Vier zichtbaarheidsniveaus werken en zijn server-side afgedwongen. 6. Directe aanroep op een niet-toegankelijk item-ID wordt geweigerd. 7. Privacyzones: geen start- of eindpunt bij huis in gedeelde inhoud. 8. Minderjarige heeft geen openbare zichtbaarheid en maakt geen openbare groep. 9. Reactie verwijderbaar door schrijver én itemeigenaar. 10. Challenge meet alleen op activiteiten met herleidbare bron. 11. Blokkeren werkt in twee richtingen en direct. 12. Gemeld item is voor de melder direct onzichtbaar. 13. Trainer, ouder en club krijgen geen extra sociale inzage. 14. Acht lege- en fouttoestanden zijn onderscheiden. 15. Meldingen zijn uitzetbaar en bevatten geen druk of reeksen. 16. Migratie: ontbrekende zichtbaarheid wordt privé, nooit openbaar. 17. Bestaande gedeelde routes behouden hun zichtbaarheid. 18. Mobiel biedt dezelfde handelingen. 19. Bestaande sociale en privacytests groen.

## 11. Acceptatiecriteria
1. Geen enkele gesimuleerde of geseede inhoud in een echte feed, uitgesloten bij de bron. 2. Lege toestanden zijn geldig en eerlijk. 3. Zichtbaarheid server-side afgedwongen, privé als standaard. 4. Tellingen op echte mensen en echte activiteiten. 5. Jeugdregels afgedwongen. 6. Blokkeren en melden werken direct. 7. Migratie zonder onbedoelde openbaarmaking. 8. Alle tests groen, typecheck exit 0. 9. Geen tweede feed, deelmechanisme of toegangscontrole.

## 12. Bewijsformat
Per regel: commando, resultaat, exitcode. Verder: aantonen **waar in de bron** simulatie-inhoud wordt uitgesloten · de feed van een vers account (leeg) naast die van een account met vrienden · een challengestand met de onderliggende activiteiten · een geweigerde directe aanroep op een vreemd item-ID · de migratieuitvoer met hoeveel items privé zijn gezet · schermafbeeldingen van de acht toestanden op desktop en mobiel · start- en eindcommit · gewijzigde bestanden.

## 13. Stopcondities
- een bestaande feedbron kan echt en gesimuleerd niet bij de bron scheiden;
- zichtbaarheid is niet server-side af te dwingen zonder herschrijving;
- privacyzones werken niet door in sociale inhoud;
- een bestaande privacytest wordt onhoudbaar;
- moderatie vereist een menselijke rol die nog niet bestaat — melden, niet zelf toewijzen.
