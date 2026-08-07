# RIJDEN_02 §5 — Ingevulde kleurtabel (stand 07-08-2026)

Bron van waarheid: `artifacts/sparki/scripts/kaartstijl-rijden02.mjs` (idempotent,
schrijft `public/kaart/sparki-stijl.json`). Wijzig kleuren dáár, nooit in de JSON.

## 1. Ondergrond

| Element | Kleur (ingezoomd, ≥z12) | Kleur (uitgezoomd, z6) | Zichtbaar vanaf |
|---|---|---|---|
| Achtergrond/land | `#f4f1ea` | `#f4f1ea` | altijd |
| Water (vlak) | `#a9cee2` | `#8ec2dd` (voller) | altijd |
| Water (lijn: rivier/kanaal/beek) | `#a9cee2` | idem | per bronlaag |
| Bos | `#cadfc0` | `#b3d2a4` (voller) | z7 |
| Gras/weide/park/tuin | `#dbe8cd` | `#cbdfb4` (voller) | z8 |
| Heide/struikgewas | `#dfe3c9` | — | z11 |
| Zand | `#efe4c8` | — | z11 |
| Rots | `#e6e0d6` | — | z11 |
| Bebouwd (woon/commercieel/industrie) | `#eae3d8` | — | z11 |
| Agrarisch | `#dbe8cd` (grasgroep) | — | z11 |
| Gebouwen (vlak/rand) | `#ded5c8` / `#cfc4b4` | — | z16 |

De uitgezoomde tinten lopen via een zoom-ramp (z6 → z12) over in de rustige
ingezoomde kleur — dit is de fix voor "uitgezoomd erg bleek" (bevinding 07-08).

## 2. Wegen (vul / rand, breedte op z14)

| Klasse | Vulling | Rand | Breedte z14 | Zichtbaar vanaf | Lijnstijl |
|---|---|---|---|---|---|
| Snelweg | `#f5b95a` | `#d99b3a` | 6 px | z5 | doorgetrokken |
| Hoofdweg (trunk/primary) | `#f8d68f` | `#dcae5c` | 5 px | z8 | doorgetrokken |
| Secundair (secondary/tertiary) | `#ffffff` | `#d5cec1` | 4 px | z11 | doorgetrokken |
| Woonstraat/klein | `#ffffff` | `#e1dbd1` | 3 px | z14 | doorgetrokken |
| Onverhard/track | `#e8dcc6` | `#c4b394` | 2,5 px | z14 | streep 3-2 |
| Pad/wandelpad | `#b9a688` | — | 2 px | z14 | streep 2-2 |
| Fietspad | `#7fa8b8` | — | 2 px | z14 | streep 2-2 |
| Spoor | `#b3aca2` | `#8f887e` | 2 px | per bronlaag | doorgetrokken |

Breedtecurve: z6 = max(1 px; 0,35×), z10 = max(1,2 px; 0,55×), z14 = 1×,
z16 = 2,2×, z18 = 6×, z20 = 18×. De ondergrens op z6/z10 houdt hoofdwegen
uitgezoomd zichtbaar (bevinding 07-08). Tunnels: 15% lichter. Bruggen: eigen
casing in de randkleur.

## 3. Teksten

| Element | Kleur | Halo | Zichtbaar vanaf |
|---|---|---|---|
| Stad/hoofdstad | `#3f3a33` | wit 1,5 px | z7 |
| Plaats (town) | `#3f3a33` | wit 1,5 px | z8 |
| Dorp/wijk/buurt/gehucht | `#3f3a33` | wit 1,5 px | z11 |
| Straatnamen | `#6b6459` | wit 1,25 px | z16 |
| Waternamen | n.v.t. | — | Shortbread heeft geen waternamen-laag (bekende beperking); kleur `#4a7d96` staat klaar in het script |
| POI-pictogrammen | bronkleur | — | z16 |

## 4. De vijf routekleuren (§5.5, C8)

Kleur is nooit het enige verschil — elke positie heeft een eigen lijnpatroon.
Bron: `ROUTE_KLEUREN`/`ROUTE_PATRONEN` in `src/pages/route-scherm.tsx`.

| Positie | Kleur | Naam | Lijnstijl |
|---|---|---|---|
| 1 | `#0f766e` | teal | doorgetrokken |
| 2 | `#c2410c` | terracotta | doorgetrokken |
| 3 | `#4338ca` | indigo | lange streep (3 / 1,5) |
| 4 | `#a16207` | oker | korte streep (1,2 / 1,2) |
| 5 | `#be185d` | framboos | stip-streep (0,2 / 1,4 / 2,4 / 1,4) |

Basisdikte 4 px; gekozen route: 1,5× dik + witte rand 1 px; overige routes
blijven op 45% dekking staan (verdwijnen nooit, C3).
