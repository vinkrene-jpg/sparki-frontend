# F12 — Centrale inbox en notificaties

**Pakket:** SPARKI_BUILD_01 (platformdienst PD-5)
**Fase:** F12
**Nagekeken tegen:** main `e67ccc40`, 2 augustus 2026
**Status:** sterk ingekort — het meeste staat er al

---

## Hoofdcorrectie — dit is grotendeels gebouwd

De oorspronkelijke specificatie beschrijft F12 als een nieuw te bouwen laag, met de kanttekening dat er "al iets van een notificatielaag" is. **Gemeten: het model staat er vrijwel compleet.**

In `lib/db/src/schema/notifications.ts` staat `notifications` met onder meer:

| Veld | Dekt welke eis |
|---|---|
| `category` (twaalf waarden) | de meldingsoorten |
| `audience` | de rol van de ontvanger op het moment van aanmaken — bewaakt dat een melding binnen de eigen bevoegdheid blijft, ook als rollen later wijzigen |
| `readAt` | **gelezen** |
| `resolvedAt` + `resolutionKey` | **afgehandeld** — de onderliggende situatie is voorbij |
| `expiresAt` | geldigheid; verlopen is niet verwijderd |
| `dedupeKey` | ontdubbeling van herhaalde meldingen |
| `source`, `actionUrl` | herkomst en de plek waar de melding heen brengt |
| `priority` | laag, normaal, hoog |

In `lib/db/src/schema/reminder-preferences.ts` staan `quietHoursStart` en `quietHoursEnd`, met de regel dat veiligheids- en privacymeldingen de stille uren **wel** passeren.

**Gevolg: gelezen versus afgehandeld, stille uren, rolbewaking en context zijn geen bouwtaak meer. Verifieer ze en ga door.**

---

## Correctie — het zijn twaalf categorieën, niet tien

Gebruik de opsomming, niet het getal: training · wedstrijd · herstel · coach · club · ouder · materiaal · sync · privacy · veiligheid · sociaal · systeem.

Veiligheid en privacy zijn kritiek en kunnen nooit volledig worden uitgeschakeld — wel terughoudend geleverd.

---

## Wat er wél ontbreekt — dit is de opdracht

`NOT-01` — **Bundeling.** Er is ontdubbeling (`dedupeKey`), maar geen samenvoeging. Tien wijzigingen in hetzelfde wedstrijdplan moeten één overzichtelijke melding worden, niet tien losse. Bepaal de drempel en het tijdvenster zelf en onderbouw ze; leg ze configureerbaar vast.

`NOT-02` — **Omzetten van losse meldingslijsten per module.** Meet welke modules nog een eigen lijst voeren en zet die om naar het centrale model. Er mag geen tweede meldingssysteem naast staan.

`NOT-03` — **Pushtekst.** Controleer elke plek waar een pushmelding wordt samengesteld: **geen gevoelige inhoud.** Niet de tekst van een bericht, niet een bestandsnaam, niet een gezondheids- of prestatiegegeven, niet de naam van een minderjarige in combinatie met een signaal. Openen brengt de gebruiker in de juiste rol en context — dat is waar `actionUrl` en `audience` voor zijn.

`NOT-04` — **De inbox zelf.** Meet of er een werkende inboxweergave per rol en context bestaat. Het model is er; of het scherm er is, is niet vastgesteld. Bouw of herstel alleen wat ontbreekt.

`NOT-05` — **Ingetrokken rol.** `audience` legt de bedoelde rol vast. Verifieer dat een melding voor een rol die iemand niet meer heeft, ook werkelijk niet meer zichtbaar of actief is — inclusief via een directe aanroep, niet alleen in het scherm.

---

## Wat er niet bij hoort

Geen meldingenlijst per module · geen tweede notificatiesysteem · geen workflow- of ticketsysteem naast de inbox · geen nieuwe categorieën zonder besluit.

---

## Acceptatiecriteria

- tien wijzigingen in hetzelfde object leveren één gebundelde melding, niet tien
- een melding opent de juiste rol en context
- gelezen is aantoonbaar iets anders dan afgehandeld
- geen enkele pushtekst bevat berichtinhoud, bestandsnaam, gezondheids- of prestatiegegeven
- stille uren worden gerespecteerd; een urgente veiligheidsmelding komt er wél doorheen
- een melding voor een ingetrokken rol is niet meer zichtbaar of actief, ook niet via een directe aanroep
- geen module voert nog een eigen meldingenlijst

---

## Instructie aan Replit

Meet eerst — de meting hierboven is van `e67ccc40` en kan achterhaald zijn. Bevestig per eis of hij al gedekt is; bouw alleen wat ontbreekt.

Meld terug welke drempel en welk tijdvenster je voor bundeling kiest, met de reden.

Lever de bewijsbundel op een vaste SHA, met per acceptatiecriterium de uitkomst.
