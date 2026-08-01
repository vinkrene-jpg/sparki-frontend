# CLUB_ONBOARDING_01 — AFHANKELIJKHEDEN

## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| Clubmodel en rollen | `schema/club.ts` r30–42 | eigenaar, beheerder, trainer bij aanmaak | geen rolbepaling |
| Clubroutes | `routes/club.ts` | bestaande clubfunctionaliteit uitbreiden | parallel clubmodel |
| Uitnodigingsmechanisme | `routes/invitations.ts` | eerste beheerders en trainers | tweede mechanisme |
| Opslag | `routes/storage.ts` | logo-upload | geen upload |
| `admin_ops_log` | `schema/admin-ops-log.ts` | audit op activatie en import | geen bewijs achteraf |
| Uploadlimieten en fouttoestanden | `DOCUMENTEN_COMMUNICATIE_01` | logo-upload | eigen limietlogica |

## 2. Verplicht MIRROR_PROVEN vóór start
1. `DATA_TRUST_01` — lege toestanden en herkomst; dit pakket toont ledengegevens.
2. `ROUTE_PAKKET_01` — rechtenresolver en niet-legacy testidentiteiten.

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| `CLUB_RECHTEN_01` nog niet uitgevoerd | onboarding gebruikt de bestaande elf rollen; ploegleider komt later |
| `CLUB_LEDEN_01` nog niet uitgevoerd | import werkt; beheer ná activatie volgt daar |
| `JEUGD_OUDER_01` nog niet uitgevoerd | jeugdleden importeren mag, maar toestemmingsflow volgt daar — markeer ze als in afwachting |
| Bewaartermijn importbestand niet vastgesteld | configureerbaar maken en markeren |
| `DOCUMENTEN_COMMUNICATIE_01` nog niet uitgevoerd | logo-upload met eigen limieten, af te stemmen bij samenkomst |

Een restpunt is pas een blokkade wanneer het punt 1 of 2 raakt.
