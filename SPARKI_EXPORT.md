# Sparki — Frontend UI Export (voor Replit)

Dit document beschrijft hoe je het volledige Sparki Performance Lab front-end
ontwerp 1-op-1 overzet naar je bestaande Replit-project. **Er wordt niets
geherontworpen** — layout, kleuren, spacing, typografie, animaties en responsive
gedrag blijven exact gelijk.

Stack: **Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + lucide-react**.

---

## 1. Bestandsstructuur

Kopieer onderstaande bestanden naar dezelfde paden in je Replit-project:

```
.
├── app/
│   ├── layout.tsx                # root layout + dark mode + BottomNav + fonts
│   ├── globals.css               # ALLE styling, tokens, animaties (Tailwind v4)
│   ├── page.tsx                  # 1. HOME  (rendert TrainingDayHome)
│   ├── train/
│   │   └── page.tsx              # 2. TRAIN
│   ├── feed/
│   │   └── page.tsx              # 3. FEED
│   ├── lab/
│   │   └── page.tsx              # 4. LAB
│   └── you/
│       └── page.tsx              # 5. YOU
├── components/
│   └── sparki/
│       ├── training-day-home.tsx # de complete HOME-screen
│       ├── screen-shell.tsx      # gedeelde cinematic canvas (Train/Feed/Lab/You)
│       ├── bottom-nav.tsx        # vaste 5-tab navigatie
│       ├── sparki-core.tsx       # het "Sparki Core" AI-orb signatuur
│       ├── bio-radar.tsx         # 6-assige performance radar
│       ├── primitives.tsx        # sparkline, gauge-arc e.d.
│       └── ui.tsx                # SectionLabel, Delta, Stat, ACCENT, Divider
├── lib/
│   ├── sparki-data.ts            # ENIGE databron voor alle 5 schermen
│   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
└── public/
    └── concept-lab.png           # enige gebruikte achtergrond-asset
```

> De bestanden `public/concept-future.png`, `public/concept-pitwall.png` en
> `public/cyclist-hero.png` worden **niet** meer gebruikt en hoef je niet te
> kopiëren.

---

## 2. Welke bestanden 1-op-1 kopiëren

Kopieer deze exact (overschrijf bestaande gelijknamige bestanden):

**Pagina's (5 schermen)**
- `app/page.tsx`
- `app/train/page.tsx`
- `app/feed/page.tsx`
- `app/lab/page.tsx`
- `app/you/page.tsx`

**Componenten**
- `components/sparki/training-day-home.tsx`
- `components/sparki/screen-shell.tsx`
- `components/sparki/bottom-nav.tsx`
- `components/sparki/sparki-core.tsx`
- `components/sparki/bio-radar.tsx`
- `components/sparki/primitives.tsx`
- `components/sparki/ui.tsx`

**Data + helpers**
- `lib/sparki-data.ts`
- `lib/utils.ts`

**Styling + root**
- `app/globals.css`  → de Sparki-tokens + keyframes staan onderaan dit bestand
- `app/layout.tsx`   → bevat `className="dark ..."`, `bg-[#050608]` en de `<BottomNav />`

**Asset**
- `public/concept-lab.png`

---

## 3. Benodigde npm packages

Alle runtime-afhankelijkheden van dit ontwerp:

```
next@^16            react@^19            react-dom@^19
lucide-react        clsx                 tailwind-merge
```

Dev / build (Tailwind v4):

```
tailwindcss@^4      @tailwindcss/postcss@^4      postcss
typescript          @types/node      @types/react      @types/react-dom
```

Optioneel (alleen als je het al gebruikt): `tw-animate-css`. De Sparki-animaties
zelf zijn pure CSS keyframes in `globals.css` en hebben geen extra package nodig.

---

## 4. Installatie-instructies voor Replit

1. **Maak/gebruik een Next.js Repl** (template "Next.js", of een bestaand
   Next.js 16 project).

2. **Installeer de packages** in de Replit Shell:

   ```bash
   npm install lucide-react clsx tailwind-merge
   npm install -D tailwindcss@^4 @tailwindcss/postcss@^4 postcss
   ```

   (Next, React en TypeScript zitten al in de Next.js template.)

3. **Kopieer de bestanden** uit sectie 2 naar exact dezelfde paden.

4. **PostCSS-config** — zorg dat `postcss.config.mjs` bestaat met:

   ```js
   export default {
     plugins: { "@tailwindcss/postcss": {} },
   }
   ```

5. **Tailwind v4** gebruikt géén `tailwind.config.js`. Alle configuratie
   (tokens, fonts, animaties) zit in `app/globals.css`. Niets extra nodig.

6. **Path alias** — controleer dat `tsconfig.json` het `@/*` alias heeft:

   ```json
   { "compilerOptions": { "paths": { "@/*": ["./*"] } } }
   ```

7. **Start**:

   ```bash
   npm run dev
   ```

   Open de webview. De vijf schermen zijn bereikbaar via de onderste navigatie:
   `/` (Home), `/train`, `/feed`, `/lab`, `/you`.

---

## 5. Assets, iconen & fonts

- **Iconen**: volledig via `lucide-react` (o.a. `Home`, `Bike`, `Radio`,
  `FlaskConical`, `User`, `Megaphone`, `Users`, `Flag`, `Building2`,
  `MessageSquare`, `PlayCircle`). Geen losse icon-bestanden nodig.
- **Fonts**: **Geist** en **Geist Mono** via `next/font/google` (geconfigureerd
  in `layout.tsx` en gekoppeld in `globals.css` als `--font-sans` / `--font-mono`).
  Geen handmatige font-bestanden nodig; Next haalt ze automatisch op.
- **Afbeelding**: alleen `public/concept-lab.png` (de cinematic lab-achtergrond,
  op ~22% opacity achter elk scherm).
- **Placeholders**: er zijn geen externe placeholders nodig; alle inhoud komt uit
  `lib/sparki-data.ts`.

---

## 6. Belangrijke integratie-aandachtspunten

- **`globals.css`** bevat onderaan de essentiële Sparki-laag:
  - `--accent-cyan` token (de signatuur-accentkleur)
  - alle `@keyframes` (`sparki-breathe`, `sparki-scan`, `sparki-spin`, enz.)
  - de bijbehorende `.animate-*` utility classes

  Verwijder deze niet — zonder deze blok verdwijnen de animaties en het glow-effect.

- **`layout.tsx`** zet de hele app in dark mode (`className="dark ..."`),
  geeft de body `bg-[#050608]`, en rendert de globale `<BottomNav />`. De
  navigatie is `position: fixed`; daarom hebben de schermen `pb-32` aan de
  onderkant zodat content niet achter de balk valt.

- **Responsive gedrag**: elk scherm gebruikt `max-w-md` gecentreerd, dus het is
  mobile-first en blijft op desktop een gecentreerde mobiele kolom — exact zoals
  in het ontwerp.

- **Eén databron**: pas inhoud alleen aan in `lib/sparki-data.ts`; alle vijf de
  schermen lezen daaruit.

Dat is alles — na het kopiëren en `npm run dev` draait het ontwerp identiek aan
de preview.
