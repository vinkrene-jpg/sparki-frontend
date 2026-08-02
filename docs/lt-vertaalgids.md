# LT-vertaalgids — donkere hardcodes → lichte tokens

**Context:** LICHT_THEMA_01. De hele web-app gaat van donker naar één licht
thema (geen schakelaar). De tokens in `artifacts/sparki/src/index.css` zijn
omgezet naar licht (LT-01); de tokennamen zijn ongewijzigd, dus consumers
blijven werken. Deze gids is de bindende omzettabel voor LT-02: elke
hardgecodeerde donkere kleur → het juiste token/utility.

## Grondregel

**Niets hardcodeert nog zijn eigen kleur.** Een component dat een achtergrond-,
tekst-, rand- of ringkleur vastlegt hoort dat niet te doen — het gebruikt een
token/utility uit deze tabel. Losse nieuwe kleurwaarden horen uitsluitend in de
`@theme`-laag van `index.css`, nergens anders.

## Kern-tokens (licht)

| Betekenis            | Token / utility           | Waarde (oklch)            |
|----------------------|---------------------------|---------------------------|
| App/paginabg         | `bg-background`           | warm gebroken wit ~0.985  |
| Kaart/oppervlak      | `bg-card` / `bg-surface`  | dekkend wit + `shadow-card`|
| Primaire tekst       | `text-foreground`        | donker ~0.21              |
| Secundaire tekst     | `text-muted-foreground`  | ~0.44                     |
| Standaardrand        | `border-border`          | donker / 12%              |
| Focus-ring           | `ring-ring`              | donkerder accent          |
| Invoerrand           | `border-input`           | donker / 18%              |
| Merkaccent           | `text-accent-cyan` / `bg-accent-cyan` | cyaan ~0.58 (donker) |
| Tekst op accent      | `text-[color:var(--color-on-accent)]` | licht         |
| Diepte (schaduw)     | `shadow-card` / `shadow-float` | gelaagde box-shadow  |

## Omzettabel — donker patroon → lichte vervanging

| Donker hardcoded patroon                     | Vervanging (licht)                              | Toelichting |
|----------------------------------------------|-------------------------------------------------|-------------|
| `bg-black`                                    | `bg-background` (pagina) of `bg-foreground` (echte inkt-vlek) | pagina-bg = token; alleen een bewuste donkere inkt gebruikt `bg-foreground` |
| `bg-black/40`..`/90` (overlay/scrim)          | `bg-foreground/40`..`/60`                        | overlays dimmen nu met de donkere voorgrond, niet met zwart |
| `bg-zinc-900` / `bg-zinc-950`                 | `bg-card` of `bg-secondary`                      | kaart/oppervlak-token |
| `bg-neutral-900`..`950`                       | `bg-card` / `bg-muted`                           | oppervlak-token |
| `bg-slate-900`..`950`                         | `bg-card` / `bg-muted`                           | oppervlak-token |
| `bg-gray-900`..`950`                          | `bg-card` / `bg-muted`                           | oppervlak-token |
| `bg-[#0…]` / `bg-[#05070e]` / `bg-[#040506]`  | `bg-background` (pagina) / `bg-card` (vlak)      | nooit een losse hex; kies het semantische token |
| `bg-[oklch(0.16_0_0)]` (donker inputvlak)     | `bg-background` / `bg-muted`                     | inputvlak = token |
| `from-black` / `to-black` (gradients)         | `from-background` / `to-background`              | fade naar de pagina-achtergrond |
| `from-[#040506]` (bottom-nav fade)            | `from-background`                                | idem |
| `text-white`                                  | `text-foreground`                                | primaire tekst = donker |
| `text-white/80`..`/90`                        | `text-foreground/80`..`/90`                      | dekking behouden, kleur = foreground |
| `text-white/40`..`/70`                        | `text-muted-foreground` (of `text-foreground/NN`)| gedempte tekst |
| `text-white/20`..`/30`                        | `text-muted-foreground`                          | zeer gedempt maar leesbaar |
| `text-black` (op accent)                      | `text-[color:var(--color-on-accent)]`            | tekst op accentvlak = on-accent token |
| `border-white/8`..`/15`                       | `border-border`                                  | standaardrand-token |
| `border-white/NN` (nadruk)                    | `border-border` of `border-foreground/NN`        | subtiele donkergetinte rand |
| `ring-white/NN`                               | `ring-ring` (of `ring-border`)                   | focus-ring-token |
| `ring-cyan-300/60`                            | `ring-ring/60`                                   | ring volgt accent |
| `hover:bg-white/5`..`/10`                     | `hover:bg-muted` (of `hover:bg-foreground/5`)    | hover-oppervlak op licht |
| `bg-white/5`..`/10` (glas op donker)          | `bg-muted` / `bg-secondary`                      | licht oppervlak, geen glas |
| `text-cyan-300` / `text-cyan-300/80`          | `text-accent-cyan`                               | merkaccent-token (nu donkerder) |
| `bg-cyan-300` / `bg-[oklch(0.82_0.16_200)]`   | `bg-accent-cyan`                                 | merkaccent-token |
| `drop-shadow(... var(--accent-cyan))` (gloed) | **verwijderen** — gebruik `shadow-card`/`shadow-float` | gloed werkt op donker, op licht = schaduw |
| doorschijnend wit voor as/raster (charts)     | doorschijnend donker `rgba(20,24,31,α)`          | zie `lib/chart-kleuren.ts` (LT-03) |

## Uitzonderingen (bewust donker — NIET omzetten)

1. **Foto-overlays voor leesbaarheid op afbeeldingen.** Waar tekst óp een foto
   staat (heldenafbeeldingen, foto-labels), blijft een donkere gradient/scrim
   nodig voor contrast — ongeacht het lichte thema. Regel: gebruik
   `bg-gradient-to-t from-black/60` alléén rechtstreeks over een `<img>` voor
   tekstleesbaarheid, en documenteer dat ter plekke. Dit is een leesbaarheids-
   maatregel, geen thema-kleur.

2. **Kaart-tegels / Leaflet-overlays (route-navigator).** **BESLUIT: de kaart-
   stijl blijft DONKER.** De CARTO-donkere tegels + de overlay-panelen, pills,
   scrims en waarschuwingsvlakken erboven blijven donker. Reden: een dynamische
   navigatiekaart met route-highlight, snelheids-/waarschuwingspanelen en
   straatnamen is op een donkere ondergrond rustiger en beter afleesbaar tijdens
   het rijden; de bestaande helderheidsfilter (`.sparki-map-tiles`) is daarop
   afgestemd. De bijbehorende tokens blijven daarom donker en ongewijzigd:
   `--color-map-ink`, `--color-map-panel`, `--color-map-scrim`,
   `--color-map-warn-panel`, `--color-map-warn-deep`, `--color-map-warn-soft`,
   plus `.leaflet-control-attribution` en `.sparki-map-tiles`. Componenten die
   deze map-tokens gebruiken hoeven NIET omgezet te worden.

3. **Native `<select>`-popup** is juist naar LICHT omgezet (donkere tekst op
   wit) — dit was eerder een donkere uitzondering, maar hoort op het lichte
   thema licht te zijn.

## Reikwijdte / status

- LT-01 (tokens), LT-03 (charts) en LT-04-web (dieptelaag: `zweefkaart.ts`
  blijft pure transform-logica; schaduw i.p.v. gloed in `ds/card.tsx`,
  `ui/card.tsx`; lichte, rustige `cinematic-scene.tsx`) zijn gebouwd.
- Basispagina's token-schoon gemaakt als eerste bewijs: `App.tsx`,
  `components/sparki/screen-shell.tsx`, `components/sparki/bottom-nav.tsx`.
- LT-02 (de resterende ~177 bestanden) volgt deze tabel. Overbruggingsvangnet:
  `index.css` remapt tijdelijk alle `text-white/NN`-utilities naar de donkere
  voorgrond zodat nog-niet-opgeschoonde tekst leesbaar blijft; dit is een
  vangnet, geen norm — nieuw werk gebruikt de tokens uit deze gids.
