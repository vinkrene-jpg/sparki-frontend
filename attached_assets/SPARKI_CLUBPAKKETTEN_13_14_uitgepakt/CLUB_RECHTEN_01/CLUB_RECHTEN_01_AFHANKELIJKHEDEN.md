# CLUB_RECHTEN_01 — AFHANKELIJKHEDEN

## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| `clubRoles` | `schema/club.ts` r30–42 | de elf rollen, additief uitgebreid | tweede rolmodel |
| `resolveFeatureAccess` | `lib/entitlements.ts` L407 | rollen samen met vlaggen en kill-switches | tweede rechtencontrole |
| `club_consents` | `schema/club.ts` r477 | toestemming naast rol | rol zonder toestemmingsgrens |
| `admin_ops_log` | `schema/admin-ops-log.ts` | audit bij elke rolwijziging | geen bewijs achteraf |
| Isolatietests | `cross-account-isolation`, `links-*-isolation`, `coach-parent-*`, `wp-r1-parent-rights` | bewijs dat scheiding houdt | geen regressiebewijs |
| Taakplanner voor verval | bestaande `scheduled-tasks` | tijdelijke rollen automatisch laten vervallen | handmatig verval |

## 2. Verplicht MIRROR_PROVEN vóór start
1. `ROUTE_PAKKET_01` — rechtenresolver en drie niet-legacy testidentiteiten.
2. `DATA_TRUST_01` — lege toestanden en herkomst; rolbeheer toont persoonsgegevens.

`TRAINER_CLUB_01` is **geen** voorwaarde, maar overlapt: dat pakket maakt de bestaande rechten lekvrij, dit pakket vervangt het rolmodel eronder. Loopt `TRAINER_CLUB_01` nog, wacht dan tot het Mirror-goedgekeurd is — anders raken twee opdrachten dezelfde controles.

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| `CLUB_ONBOARDING_01` nog niet uitgevoerd | rolbeheer werkt op bestaande clubs |
| `CLUB_LEDEN_01` nog niet uitgevoerd | rollen toekennen kan; uitnodigen volgt daar |
| `JEUGD_OUDER_01` nog niet uitgevoerd | ouder/verzorger bestaat als rol; de toestemmingsflow volgt daar |
| Communicatietemplates uit `DOCUMENTEN_COMMUNICATIE_01` | eenvoudige melding volstaat, af te stemmen bij samenkomst |

Een restpunt is pas een blokkade wanneer het punt 1 of 2 raakt.

## 4. Dit pakket gaat vóór
`CLUB_LEDEN_01`, `JEUGD_OUDER_01` en `TRAINER_KOPPELING_01` steunen alle drie op het rolmodel. Worden zij eerder gebouwd, dan bouwen ze op een model dat daarna verandert.
