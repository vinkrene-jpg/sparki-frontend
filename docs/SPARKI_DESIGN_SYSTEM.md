# Sparki-designsysteem — technische fundering

Centrale, herbruikbare visuele fundering van Sparki, gebaseerd op de afgeronde
Figma-basis. Dit document is de bron van waarheid voor tokens, typografie,
basiscomponenten en iconen. De fundering is **additief**: bestaande pagina's,
flows en componenten blijven werken; nieuwe en aangeraakte UI bouwt op deze
laag.

- Testpagina (alleen ontwikkelomgeving): `/_dev/design`
- Componenten: `artifacts/sparki/src/components/ds/`
- Tokens & typografie: `artifacts/sparki/src/index.css`

---

## 1. Tokens

### 1.1 Waar de tokens staan

Alle tokens leven in `src/index.css`:

- **`@theme inline`-blok** — sectie „Sparki-designsysteem: semantische tokens".
  Tailwind v4 genereert hieruit utilities (`bg-surface`, `text-positive`,
  `rounded-card`, `p-card`, …).
- **`:root`** — `--accent-cyan` (het ruwe merkaccent) en `--radius`.

**Regel: nieuwe losse kleurwaarden (hex/rgb/oklch) horen uitsluitend in de
tokenlaag.** In componenten en pagina's gebruik je token-utilities.

### 1.2 Naamgeving

Semantisch, niet visueel: een token heet naar zijn **rol** (`surface`,
`control`, `positive`), nooit naar zijn kleur (~~`lichtgrijs`~~, ~~`groen`~~).
Bestaande shadcn-tokens (`background`, `foreground`, `border`, `card`,
`destructive`, …) blijven geldig; de Sparki-laag vult ze aan.

### 1.3 Kleurtokens

| Token                           | Utility                               | Waarde               | Gebruik                                                                  |
| ------------------------------- | ------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `--color-app`                   | `bg-app`                              | `#050608`            | App-achtergrond (body)                                                   |
| `--color-app-deep`              | `bg-app-deep`                         | `#040506`            | Diepste laag: onderbalk, overlays                                        |
| `--color-surface`               | `bg-surface`                          | wit 5%               | Kaarten/oppervlakken (glas)                                              |
| `--color-surface-strong`        | `bg-surface-strong`                   | wit 8%               | Opgelicht oppervlak (hover, nadruk)                                      |
| `--color-control`               | `bg-control`                          | wit 10%              | Bedieningsvlakken (knop, pill, input)                                    |
| `--color-foreground` (bestaand) | `text-foreground` / `text-white`      | ~wit                 | Primaire tekst                                                           |
| `--color-content-secondary`     | `text-content-secondary`              | wit 74%              | Secundaire tekst                                                         |
| `--color-border` (bestaand)     | `border-border` (= `border-white/10`) | wit 10%              | Standaardranden                                                          |
| `--color-positive`              | `text-positive` / `bg-positive`       | emerald-300          | Positieve status                                                         |
| `--color-warning`               | `text-warning` / `bg-warning`         | amber-300            | Waarschuwing                                                             |
| `--color-negative`              | `text-negative` / `bg-negative`       | red-300              | Fout (tekstniveau; gevulde destructieve knoppen: bestaand `destructive`) |
| `--color-tempo`                 | `text-tempo` / `bg-tempo`             | amber-400            | Trainingskleur tempo                                                     |
| `--color-accent-cyan`           | `text-accent-cyan` / `bg-accent-cyan` | `var(--accent-cyan)` | Merkaccent (actief, training, focus)                                     |
| `--color-on-accent`             | `text-on-accent`                      | `#04121a`            | Tekst óp een accent-cyaan vlak                                           |

De bestaande **leesbaarheidslift** (`.text-white/NN`-overrides) en de
dekkingstrappen op wit (`bg-white/5`, `border-white/10`, …) zijn onderdeel van
het systeem en blijven toegestaan; de tokens hierboven zijn er de benoemde
kernwaarden van.

### 1.4 Spacing

Basis is de Tailwind-4px-schaal (`gap-2`, `p-4`, …). Vaste semantische stappen:

| Token                    | Utility          | Waarde | Gebruik                 |
| ------------------------ | ---------------- | ------ | ----------------------- |
| `--spacing-card`         | `p-card`         | 20px   | Standaard kaart-padding |
| `--spacing-card-compact` | `p-card-compact` | 12px   | Compacte kaart-padding  |

### 1.5 Radius

| Token              | Utility           | Waarde        | Gebruik               |
| ------------------ | ----------------- | ------------- | --------------------- |
| `--radius-card`    | `rounded-card`    | 16px          | Kaarten en containers |
| `--radius-control` | `rounded-control` | volledig rond | Knoppen en pills      |

### 1.6 Schaduwen

Er is bewust **geen schaduwtoken**: het donkere ontwerp werkt met randen en
glasoppervlakken in plaats van slagschaduwen. De enige bestaande gloed is de
icoon-gloed `drop-shadow(0 0 6px var(--accent-cyan))` op actieve
navigatie-iconen.

### 1.7 Breekpunten

Mobiel-eerst (basisviewport 390px, contentbreedte 358px). Desktopgedrag begint
bij **1024px** (`lg:`) — hetzelfde breekpunt gebruiken de typografiestijlen.
Tussenmaten (`sm:` 640px, `md:` 768px) alleen voor gridverdichting.

---

## 2. Typografie

Lettertype: **Inter** (`@fontsource-variable/inter`, al geladen; nooit via
Next.js-`var(--font-…)`-constructies). Alle vaste stijlen zijn klassen in
`src/index.css`; maten in rem (schaalt mee met gebruikersinstellingen),
mobiel → desktop bij 1024px.

| Klasse               | Figma-naam           | Mobiel | Desktop | Gewicht                      |
| -------------------- | -------------------- | ------ | ------- | ---------------------------- |
| `type-display`       | Display/Page         | 38     | 42      | Bold                         |
| `type-metric`        | Metric/Primary       | 58     | 68      | ExtraBold, tabulaire cijfers |
| `type-title-card`    | Title/Card           | 17     | 22      | SemiBold                     |
| `type-title-insight` | Title/Insight/Mobile | 22     | 22      | SemiBold                     |
| `type-wordmark`      | Brand/Wordmark       | 20     | 22      | Bold                         |
| `type-body`          | Body/Default         | 14     | 14      | Regular                      |
| `type-body-sm`       | Body/Small           | 12     | 12      | Regular                      |
| `type-label`         | Label/Small          | 11     | 11      | SemiBold                     |
| `type-action`        | Action               | 14     | 15      | Medium                       |
| `type-action-inline` | Action/Inline        | 12     | 12      | Medium                       |

**Regel:** geen nieuwe losse `text-[..px]`-maten voor deze rollen — gebruik de
klasse. De bestaande micro-labels `.label-xs`/`.label-sm` (mono, uppercase,
tracking) blijven bestaan voor het cinematische donkere idioom.

---

## 3. Basiscomponenten

Locatie: `src/components/ds/` — import via `@/components/ds`. Alle componenten
gebruiken uitsluitend tokens en typografieklassen; demo- en voorbeeldteksten
zijn Nederlands, neutraal en zonder verzonnen persoonsgegevens.

### 3.1 `DsCard` — kaartcontainer

- Varianten: `standaard` (p-card) · `compact` (p-card-compact).
- Glasoppervlak: `bg-surface` + `border-border` + `rounded-card` + `backdrop-blur`.
- `DsCardTitel` zet de kaarttitel in `type-title-card`.

```tsx
<DsCard>
  <DsCardTitel>Trainingsweek</DsCardTitel>
  <p className="type-body mt-1.5 text-white/60">…</p>
</DsCard>
```

### 3.2 `DsButton` — knop

- Varianten: `primair` (accent-cyaan vlak, `text-on-accent`), `secundair`
  (glas-pill met rand), `tekst` (tekstactie in accentkleur).
- Staten: normaal, hover, focus (ring), `disabled`, `loading`
  (spinner + `aria-busy` + geblokkeerd).
- **Aanraakvlak is altijd ≥ 44px** (`min-h-11`) — ook op desktop.
- Standaard `type="button"` (nooit per ongeluk submit).

```tsx
<DsButton onClick={opslaan}>Opslaan</DsButton>
<DsButton variant="secundair" loading={bezig}>Synchroniseren</DsButton>
<DsButton variant="tekst">Toon meer</DsButton>
```

### 3.3 `DsStatus` — statusindicator

- Statussen: `positief` · `waarschuwing` · `fout` · `neutraal`.
- **Nooit alleen kleur:** elk label heeft een vast icoon én verplichte tekst
  (children). Kleuren uit de statustokens.

```tsx
<DsStatus status="waarschuwing">Controleer je zadelhoogte</DsStatus>
```

### 3.4 `DsState` — compacte toestand

- Soorten: `info` · `leeg` (nog geen gegevens) · `nietBeschikbaar`.
- Optionele herstelactie (`actie={{ label, onClick }}`) → `DsButton secundair`.
- **Data-trust-regel:** dit component toont uitsluitend aangeleverde, eerlijke
  tekst. Nooit nepdata, nooit een geschatte waarde als echte waarde
  presenteren; wat ontbreekt, blijft zichtbaar ontbrekend.

```tsx
<DsState
  soort="leeg"
  titel="Nog geen ritten"
  beschrijving="Zodra je eerste rit binnen is, verschijnt hier je overzicht."
  actie={{ label: "Rit toevoegen", onClick: openInvoer }}
/>
```

### 3.5 `DsWeek` — weekcomponent

- Precies 7 dagen (extra items worden genegeerd), past binnen **358px**.
- Dagstatussen: `training` (gevulde accentstip) · `herstel` (ring in
  positive) · `leeg` (streepje) + `actief` (vandaag, accentrand).
- Vorm + kleur + `aria-label` per dag (`"Di: training"`, `aria-current="date"`).

### 3.6 `DsMobileNav` — mobiele hoofdnavigatie

- Presentational: geen routerkennis; navigatie via `onNavigeer(href)`.
- Standaarditems (`DS_NAV_STANDAARD`): Vandaag · Plan · Rijden · Analyse · Meer.
- Actieve tab: accent-cyaan + gloed + `aria-current="page"`.
- Aandachtstatus: stip in `warning` **plus** sr-only-tekst („vraagt aandacht").
- Items ≥ 44px; balk respecteert `env(safe-area-inset-bottom)`.
- De bestaande app-navigatie (`BottomNav`) blijft tot de migratie ongewijzigd.

---

## 4. Iconen

- **Eén vectorbron: lucide-react**, via `@/components/ds` (`ds/icons.ts`).
  Semantische namen: `IconHome`, `IconPlan`, `IconRijden`, `IconAnalyse`,
  `IconMenu`, `IconCheck`, `IconInfo`, `IconWaarschuwing`, `IconFout`,
  `IconChevron` (+ `IconPositief`, `IconLeeg`, `IconNietBeschikbaar`,
  `IconLaden`).
- **Unicode-tekens en emoji zijn geen productie-iconen** (geen ⚡ ✓ ✕ 🔔 📍 als
  icoon). Pijltjes e.d. in code-commentaar of logteksten zijn geen iconen en
  vallen hierbuiten.
- Decoratieve iconen krijgen `aria-hidden="true"`; betekenisdragende iconen
  staan altijd naast tekst (zie `DsStatus`).

---

## 5. Mobiel- en desktopregels

- Mobiel-eerst: basis 390px breed, content 358px; geen horizontale overflow.
- Aanraakvlakken ≥ 44px (`min-h-11`); geldt voor knoppen én navigatie-items.
- Desktop vanaf `lg:` (1024px): typografie schaalt automatisch mee via de
  `type-*`-klassen; layouts mogen verdichten naar grids.
- Safe-area: vaste onderbalken gebruiken `env(safe-area-inset-bottom)`.

---

## 6. Lege-toestand- en data-trust-regels

1. Een lege toestand is **eerlijk**: benoem wat er ontbreekt en waarom.
2. **Nooit nepdata** of verzonnen voorbeeldwaarden in productie-UI.
3. Schattingen heten schattingen; ontbrekende bronnen blijven zichtbaar
   ontbrekend (geen stille terugval).
4. Bied waar zinvol één duidelijke herstelactie (`DsState` → `actie`).
5. Status altijd icoon + tekst, nooit alleen kleur (`DsStatus`).

---

## 7. Goed / fout

```tsx
// ✅ GOED — tokens + typografie + ds-componenten
<DsCard>
  <DsCardTitel>Herstel</DsCardTitel>
  <DsStatus status="positief">Synchronisatie gelukt</DsStatus>
</DsCard>

// ❌ FOUT — losse kleuren, losse maten, Unicode-icoon, te klein aanraakvlak
<div className="rounded-[14px] border border-[#1a2530] bg-[#0a0f14] p-[18px]">
  <h3 className="text-[17px] font-semibold">Herstel</h3>
  <span className="text-emerald-300">✓ Synchronisatie gelukt</span>
  <button className="h-7 px-2 text-[11px]">Opnieuw</button>
</div>
```

Verder fout: een nieuwe knop bouwen naast `DsButton`, een status alleen met
kleur, een icoon uit een tweede iconenbibliotheek, nepdata in een lege
toestand.

---

## 8. Migratiestrategie

1. **Additief, geen big-bang:** bestaande pagina's blijven zoals ze zijn;
   er is géén parallelle tweede huisstijl — de tokens beschrijven het
   bestaande donkere ontwerp.
2. **Bij aanraken migreren:** wie een scherm inhoudelijk wijzigt, vervangt
   daar ad-hoc waarden door tokens/`type-*`/ds-componenten (boy-scout-regel).
3. **Nieuwe UI** gebruikt vanaf nu altijd deze fundering.
4. De bestaande shadcn-primitives (`components/ui/*`) blijven staan voor
   lopende schermen; nieuwe knoppen/kaarten op sporterschermen komen uit
   `components/ds`.
5. Grote resterende duplicatie (o.a. `#070d16`/`#05070e`-achtergronden in
   `route-navigator.tsx`, herhaalde glass-card-strings) wordt per scherm
   opgeruimd wanneer dat scherm aan de beurt is — bewust niet in deze
   funderingsronde.

### Bekende resterende schuld

- ~~Hardcoded kaart-/navigatiekleuren in `route-navigator.tsx`~~ — opgelost:
  className-kleuren gebruiken de tokens `map-ink`/`map-panel`/`map-scrim`/
  `map-warn-*` uit `index.css`; JS-gegenereerde Leaflet-markup (divIcons/SVG/
  polylines) verwijst naar één lokale constantenlaag bovenin het bestand.
  Enkele losse pagina-achtergronden elders bestaan nog.
- ~~„✓"-tekens als tekst-suffix in kopieer-/opslaglabels~~ — opgelost: alle 12
  plekken (o.a. `tester-qr`, `invitations`, `route-panel`, `route-navigator`,
  `club`, `club-beheer`, `nav-settings-panel`, `route-library`) gebruiken nu
  `IconCheck` naast de tekst.
- `components/ui/button.tsx` (shadcn) heeft maten < 44px; bestaand gebruik
  blijft, nieuwe sporterschermen gebruiken `DsButton`.
- De oude `NAV_ICONS`-map in `bottom-nav.tsx` migreert pas mee met de
  navigatie-uniformering.

---

## 9. Testpagina & tests

- **`/_dev/design`** (Development Preview Mode, alleen dev-server; de route
  bestaat niet in productie): alle tokens, typografiestijlen en
  componentstaten, incl. 358px-frame en 390px-navigatiedemo.
- Componenttests: `src/components/ds/design-system.test.tsx`
  (`pnpm --filter @workspace/sparki run test:design-system`) — varianten,
  44px-contract, icoon+tekst-contract, week-aria's, aandachtstatus.
