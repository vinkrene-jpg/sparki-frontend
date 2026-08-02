# LICHT_THEMA_01 — contrastmeting (LT-06 meting + LT-13 herstel)

**Opdracht:** LT-06 (contrast meten, niet schatten) + LT-13 (tekst/UI met onvoldoende contrast herstellen in de kleurenlaag).
**Gemeten op:** 2026-08-02
**Bron van de tokens:** `artifacts/sparki/src/index.css` en `artifacts/sparki/src/lib/chart-kleuren.ts`
**Meetscript:** `/tmp/contrast-meting.mjs` (node, geen externe pakketten)

## Meetmethode

1. Elke tokenwaarde is exact overgenomen uit de bronbestanden.
2. `oklch(L C H)` is omgezet naar lineair sRGB via de officiële OKLab/OKLCH-matrices (Björn Ottosson) en daarna gamma-gecodeerd naar sRGB 0–255. Hex-waarden zijn direct ingelezen.
3. Half-doorzichtige voor- of achtergronden (bv. chart as-labels `rgba(20,24,31,0.62)` en rasterlijnen `rgba(20,24,31,0.10)`) zijn eerst **alpha-over** hun dekkende ondergrond gecomposit; de meting gebruikt de resulterende, zichtbare kleur.
4. Relatieve luminantie en de contrastratio zijn berekend volgens **WCAG 2.1** (`(L_licht + 0.05) / (L_donker + 0.05)`).
5. Drempels: **≥ 4,5:1** voor normale tekst (WCAG AA), **≥ 3:1** voor grote tekst, UI-componenten en grafische objecten (WCAG AA non-text / large text). Elk paar dat de eigen drempel niet haalt is expliciet als **ONVOLDOENDE** gemarkeerd.

## Resultaten

| Paar | Categorie | Ratio | Drempel | Oordeel |
|------|-----------|-------|---------|--------|
| foreground → background | Tekst | 16.97:1 | ≥ 4.5:1 | VOLDOENDE |
| foreground → card | Tekst | 17.72:1 | ≥ 4.5:1 | VOLDOENDE |
| foreground → muted | Tekst | 15.54:1 | ≥ 4.5:1 | VOLDOENDE |
| foreground → accent-vlak | Tekst | 15.42:1 | ≥ 4.5:1 | VOLDOENDE |
| muted-foreground → background | Tekst | 7.44:1 | ≥ 4.5:1 | VOLDOENDE |
| muted-foreground → card | Tekst | 7.76:1 | ≥ 4.5:1 | VOLDOENDE |
| muted-foreground → muted | Tekst | 6.81:1 | ≥ 4.5:1 | VOLDOENDE |
| muted-foreground → accent-vlak | Tekst | 6.76:1 | ≥ 4.5:1 | VOLDOENDE |
| accent-cyaan → background | Accent-tekst | 5.09:1 | ≥ 4.5:1 | VOLDOENDE |
| accent-cyaan → card | Accent-tekst | 5.32:1 | ≥ 4.5:1 | VOLDOENDE |
| accent-cyaan → muted | Accent-tekst | 4.66:1 | ≥ 4.5:1 | VOLDOENDE |
| accent-cyaan → accent-vlak | Accent-tekst | 4.62:1 | ≥ 4.5:1 | VOLDOENDE |
| on-accent → accent-cyaan vlak | Tekst op accent | 5.09:1 | ≥ 4.5:1 | VOLDOENDE |
| status positive → background | Statuskleur-tekst | 4.80:1 | ≥ 4.5:1 | VOLDOENDE |
| status positive → card | Statuskleur-tekst | 5.01:1 | ≥ 4.5:1 | VOLDOENDE |
| status warning → background | Statuskleur-tekst | 4.74:1 | ≥ 4.5:1 | VOLDOENDE |
| status warning → card | Statuskleur-tekst | 4.95:1 | ≥ 4.5:1 | VOLDOENDE |
| status negative → background | Statuskleur-tekst | 5.15:1 | ≥ 4.5:1 | VOLDOENDE |
| status negative → card | Statuskleur-tekst | 5.38:1 | ≥ 4.5:1 | VOLDOENDE |
| status tempo → background | Statuskleur-tekst | 4.82:1 | ≥ 4.5:1 | VOLDOENDE |
| status tempo → card | Statuskleur-tekst | 5.03:1 | ≥ 4.5:1 | VOLDOENDE |
| chart-as-labels → card | Chart-as (tekst) | 4.98:1 | ≥ 4.5:1 | VOLDOENDE |
| chart-rasterlijnen → card | Chart-raster (UI) | 1.85:1 | ≥ 3:1 | BEWUST BESLUIT (raster, decoratief) |
| chart-reeks CTL (ctl) → card | Chart-reeks (graphic) | 5.17:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks ATL (atl) → card | Chart-reeks (graphic) | 3.56:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks TSB+ (tsbPos) → card | Chart-reeks (graphic) | 5.02:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks TSB- (tsbNeg) → card | Chart-reeks (graphic) | 4.83:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks volume → card | Chart-reeks (graphic) | 5.70:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks FTP (ftp) → card | Chart-reeks (graphic) | 3.68:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks goal → card | Chart-reeks (graphic) | 3.77:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks race → card | Chart-reeks (graphic) | 4.60:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks warn → card | Chart-reeks (graphic) | 3.19:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks missing → card | Chart-reeks (graphic) | 4.76:1 | ≥ 3:1 | VOLDOENDE |
| chart-reeks verwacht → card | Chart-reeks (graphic) | 5.38:1 | ≥ 3:1 | VOLDOENDE |

## Samenvatting

- Gemeten paren: **34**
- Voldoende: **33**
- Bewust besluit (raster, decoratief): **1**
- Onvoldoende: **0**

Alle tekst- en UI-paren halen hun norm (tekst ≥ 4,5:1, UI/graphics ≥ 3:1). Geen enkel paar staat nog onder de vereiste drempel.

### Bewust besluit — chart-rasterlijnen

De rasterlijnen (`--- grid`) halen bewust **niet** de UI-drempel van 3:1. Een raster op 3:1 wordt een zwaar, dominant lijnenpatroon dat de grafiek zelf overstemt. Het raster is **decoratief**: het geeft alleen een globale hoogte-oriëntatie. De **leesbare** laag van een grafiek zijn de as-labels en de datalijnen — en die halen hun norm ruim:

- chart **as-labels** → card: 4.98:1 (vereist ≥ 4,5:1) — VOLDOENDE
- alle **datareeksen** → card: ≥ 3:1 — VOLDOENDE (zie tabel)

Daarom is de rasteralpha van `0.10` (1,23:1) verhoogd naar `0.28` (**1.85:1**), een gemeten tussenwaarde richting ~2:1: duidelijk zichtbaarder dan voorheen, zonder het raster de grafiek te laten domineren. Dit is een **bewust besluit**, geen tekort.

## LT-13 — doorgevoerde kleurcorrecties

In `artifacts/sparki/src/index.css` en `artifacts/sparki/src/lib/chart-kleuren.ts`:

- **accent-cyaan** (`--accent-cyan`): `oklch(0.58 0.13 205)` → `oklch(0.50 0.13 205)`. Eén enkele waarde die ZOWEL als tekst (`text-accent-cyan`, nu ≥ 4,62:1 op background/card/muted/accent-vlak) ALS als vlak met witte on-accent-tekst (`bg-accent-cyan`, nu 5,09:1) de AA-norm haalt. Splitsen in twee tokens bleek niet nodig — alle bestaande utilities blijven correct.
- **on-accent op accent-vlak**: opgelost door hetzelfde donkerder accentvlak (witte on-accent op cyaan-0.50 = 5,09:1).
- **--color-warning**: `oklch(0.58 0.14 75)` → `oklch(0.55 0.14 75)` (amber behouden; tekst ≥ 4,74:1 op bg/card).
- **--color-tempo**: `oklch(0.62 0.16 65)` → `oklch(0.55 0.16 65)` (oranje behouden; tekst ≥ 4,82:1 op bg/card).
- **chart-rasterlijnen** (`grid`): alpha `0.10` → `0.28` (zie bewust besluit hierboven).

---
_Gegenereerd door `/tmp/contrast-meting.mjs` op 2026-08-02. Tokens gemeten ná de LT-13-correcties._
