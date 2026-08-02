# F10 — Migratie-overzicht contacten & relaties (voor René)

**Pakket:** SPARKI_BUILD_01 (platformdienst PD-3)
**Status:** DRY-RUN uitgevoerd op de dev-database. **De echte migratie is NOG NIET gedraaid.**
Dit overzicht gaat eerst naar René; pas na akkoord volgt de echte run.

De dry-run draait binnen één transactie die aan het einde bewust wordt
teruggerold — er is dus **niets** in de database gewijzigd. Verificatie na de
run: `contacts`, `contact_relations` en `contact_merge_review` zijn alle drie
leeg (0 rijen).

---

## Model in het kort

- **Eén contactrecord per identiteit.** `clerkId` is het identiteitsanker voor
  accounthouders (uniek waar niet-null). Contacten zonder account (klant zonder
  login, noodcontact, betaler, leverancier) hebben `clerkId = NULL`.
- **Klant en sporter zijn NOOIT één samengevoegde entiteit.** Een contact dat
  beide is, draagt twee kindTags én twee relaties — geen samengevoegd record.
  Dat geldt voor élk rollenpaar (ouder+trainer, betaler+sporter …).
- **Geen tweede personenlijst.** De bestaande tabellen blijven; ze krijgen een
  nullable `contact_id` en gaan verwijzen i.p.v. dupliceren.
- **Nooit automatisch samenvoegen bij twijfel** → `contact_merge_review`.

### Dedupe-regels (bij aanmaken én migratie)

| Situatie | Besluit |
|---|---|
| `clerkId` gelijk | Zelfde identiteit → hergebruik het contact (vul tags/gegevens aan) |
| Geverifieerd/genormaliseerd e-mail exact gelijk | Duidelijk duplicaat → aanmaak **geweigerd** (409) met uitleg + bestaand contact benoemd |
| Alleen dezelfde naam | **Nooit** een duplicaat (twee mensen mogen dezelfde naam hebben) |
| Zelfde naam **én** telefoon, geen e-mailmatch | Onduidelijk → nieuw contact toegestaan, maar **op de beoordelingslijst** |

E-mail wordt genormaliseerd (getrimd, lowercase) vóór vergelijken.

**Racebestendig (0040).** Naast het clerkId-anker (uniek waar niet-null) is er
nu óók een partial unique index op het genormaliseerde, niet-lege e-mailadres
(`lower(trim(primary_email))`). Twee gelijktijdige creates met hetzelfde adres
kunnen daardoor niet meer beide slagen: de tweede raakt de unique index en
`findOrCreateContact` vertaalt die violation naar dezelfde nette 409-uitleg
(bestaand contact benoemd). Gecontroleerd in dev: geen bestaande dubbelen, index
aangemaakt.

**Samenvoegen is verliesvrij én conflictvrij.** Samenvoegen gebeurt alleen op
expliciet menselijk besluit met een doelcontact; het broncontact wordt nooit
verwijderd. Omdat de unique index op relaties dubbele ACTIEVE relaties verbiedt,
gebeurt het overbrengen in één transactie in deze volgorde: (1) bron↔doel-
relaties worden beëindigd (worden nooit een zelfrelatie), (2) relaties die het
doel al actief heeft van hetzelfde type met dezelfde tegenpartij worden aan de
bronkant beëindigd (geen botsing op de index), (3) de resterende relaties worden
verplaatst. Elke beëindiging/verplaatsing is traceerbaar via een `F10-merge`-
notitie met het bron- en doelcontact.

---

## Dry-run cijfers (dev-database)

| Bron | Identiteiten | Contacten aangemaakt/gekoppeld | Vermoedelijke duplicaten | Twijfelgevallen | Relaties |
|---|---:|---:|---:|---:|---:|
| user_profiles | 204 | 204 | 0 | 0 | 0 |
| athlete_profiles | 191 | 191 | 0 | 0 | 0 |
| coaching_profiles | 2 | 2 | 0 | 0 | 0 |
| club_members | 12 | 15 | 0 | 0 | 21 |
| coach_athlete_links | 4 | 4 | 0 | 0 | 4 |
| parent_athlete_links | 5 | 5 | 0 | 0 | 5 |
| trainer_clients | 0 | 0 | 0 | 0 | 0 |
| client_athlete_links | 0 | 0 | 0 | 0 | 0 |
| billing_parties | 0 | 0 | 0 | 0 | 0 |
| emergency_contacts | 0 | 0 | 0 | 0 | 0 |
| invitations | 16 | 1 (gedekt) | 0 | 0 | 0 |
| trainer_groups | 0 | 0 | 0 | 0 | 0 |
| trainer_group_members | 0 | 0 | 0 | 0 | 0 |
| club_teams | 2 | 2 | 0 | 0 | 0 |
| club_team_members | 2 | 2 | 0 | 0 | 2 |
| club_groups | 0 | 0 | 0 | 0 | 0 |
| club_group_members | 0 | 0 | 0 | 0 | 0 |
| **Totaal** | **438** | **426** | **0** | **0** | **32** |

> Alle **17** bronadministraties (13 logische bronnen incl. hun ledentabellen)
> zijn nu expliciet gedekt en verschijnen in het rapport, óók de bronnen met
> 0 rijen in dev.

Toelichting op de aantallen:

- **user_profiles → 204 contacten.** Elke accounthouder krijgt precies één
  contact op zijn `clerkId`. Dit is de identiteitsbasis; alle andere bronnen
  hangen hieraan.
- **athlete_profiles / coaching_profiles** voegen alleen de kindTags `sporter`
  resp. `trainer` toe aan het bestaande contact — geen nieuwe identiteiten.
- **club_members: 12 identiteiten, 15 contact-koppelingen, 21 relaties.** Er
  zijn 15 lidmaatschapsrijen over 12 distinct personen (iemand kan in meerdere
  clubs/teams zitten). Per club is er één organisatie-anker (`bedrijf`); elk lid
  krijgt een `lid_van`-relatie (start = `joined_at`, einde = `ended_at`), en
  stafrollen (trainer, hoofdtrainer, teammanager, ploegleider, mechanieker,
  soigneur, medical_staff, assistent) daarnaast een `staf_van`-relatie.
- **coach_athlete_links → 4 `trainer_van`-relaties** (met start/einde uit de bron).
- **parent_athlete_links → 5 `ouder_van`-relaties** en de tag `ouder_verzorger`.
- **trainer_clients / billing_parties / emergency_contacts: 0 rijen** in dev —
  niets te migreren, maar de bron is wél in het script gedekt (relaties
  `klant_voor`, `betaler_voor`, `noodcontact_van` en verwijzingen via
  `contact_id` staan klaar zodra er data komt).
- **client_athlete_links → `klant_voor`-relatie (klant → sporter).** Dit is de
  kern van "klant + sporter = één contact, twee relaties": de relatie legt vast
  wélke sporter bij welke klant hoort. De klant kan een ander zijn dan de
  sporter (ouder betaalt kind) of dezelfde persoon (sporter is zelf klant); in
  dat laatste geval draagt één contact twee relaties, nooit een samengevoegde
  entiteit. In dev 0 rijen; de logica is bewezen via de acceptatietest
  (seed-data levert aantoonbaar een `klant_voor`-relatie).
- **trainer_groups / trainer_group_members → `lid_van`.** Sportergroepen van de
  zelfstandige trainer zijn organisatie/presentatie, géén rechtenbron. De groep
  is een organisatie-contact (`bedrijf`); het lidmaatschap is `lid_van`. Een
  groepslidmaatschap leidt nooit rechten af.
- **club_teams / club_team_members / club_groups / club_group_members →
  `lid_van`** naar het **club-organisatie-anker** (hetzelfde `bedrijf`-contact
  dat ook `club_members` gebruikt — geen tweede organisatielijst per team/groep).
  In dev: 2 teams met 2 leden → 2 `lid_van`-relaties; groepen 0 rijen.
- **invitations: 16, waarvan 1 gedekt.** Uitnodigingen zijn nog **geen**
  identiteiten (er is nog geen persoon/account). 15 uitnodigingen hebben geen
  e-mail (rol-only). Eén (invitation 85) heeft een e-mail die al bij een
  bestaand contact hoort → gedekt. Er wordt **bewust géén** contact aangemaakt
  voor een onbekende uitnodiging (fail-closed: pas acceptatie/een echt account
  maakt een identiteit). Elke uitnodiging staat individueel in het runrapport.

### Vermoedelijke duplicaten en twijfelgevallen

**Nul** in de dev-database — er zijn geen twee bronrijen die op aantoonbare
identiteit botsen, en geen twijfelgevallen (zelfde naam + telefoon zonder
e-mailmatch). De beoordelingslijst zou dus na de echte run leeg zijn.

> Dit betekent NIET dat de logica ongebruikt is: de unit-/acceptatietest
> `contacten-relaties` bewijst dat een duidelijk duplicaat wél wordt geweigerd
> en een twijfelgeval wél op de lijst komt.

---

## Dekking: geen bron verdwijnt stilzwijgend

Alle tien de bronnen uit de hermeting zijn expliciet in het script verwerkt en
verschijnen in het rapport — óók de bronnen met 0 rijen. Er is geen bron die
"gewoon overgeslagen" is. Personen zonder een bijbehorend user_profiles-contact
worden als notitie in het rapport vermeld (in dev: geen enkele).

---

## Reproduceren

```bash
# Dry-run (geen wijzigingen; rapport naar stdout)
pnpm --filter @workspace/api-server run f10:migrate -- --dry-run

# Echte run — PAS NA AKKOORD VAN RENÉ
pnpm --filter @workspace/api-server run f10:migrate
```

De echte run draait dezelfde logica zonder de terugrol; hij is idempotent
(nogmaals draaien maakt geen dubbele contacten of relaties aan).
