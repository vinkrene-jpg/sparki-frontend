# SPARKI TODAY ORCHESTRATOR — technische architectuur (WP-T1)

**Status:** WP-T1 geleverd (31-07-2026). WP-T2 (rolvarianten trainer/ouder/club) en WP-T3 (debugweergave + volledige testmatrix §10) volgen.

## Architectuur

- **Engine:** `artifacts/api-server/src/engines/today/` (facade `index.ts`; routes importeren alleen de facade, conform engine-layer-doctrine).
  - `profile.ts` — `deriveTodayProfile`: deterministische profielvariant (jeugd · wedstrijd · prestatie · recreatief · beginner) uit bestaande profielvelden (exacte leeftijd via `computeAge`, ervaring, competitieniveau, sessie-aantal, komende wedstrijd). Jeugd (<18) gaat vóór alles.
  - `orchestrate.ts` — `orchestrateToday(clerkId)`: selectie + ranking + weergavehistorie.
- **Routes:** `routes/today.ts` → `GET /api/today` (orchestrator-uitkomst), `POST /api/today/interactions` (klik/afronding). Gemount op `/api/today`, `requireAuth`.
- **Frontend:** `hooks/use-today.ts` + `TodayOrchestratorSection` in `commercial-shell.tsx`. De sectie rendert onder de sfeerkop; profielvariant stuurt de kaartvolgorde (jeugd/beginner: training vóór weekbelasting). Geen parallel systeem: alle bestaande secties blijven de bestaande hooks gebruiken.

## Inputs (uitsluitend bestaande bronnen)

athlete_profiles (gezondheid, DOB, ervaring, niveau, ontwikkeldoel) · user_profiles (activeRole) · planned_workouts (vandaag, niet-cancelled) · races (eerstvolgende, niet-geannuleerd) · training_sessions (laatste 30) · state-engine (`runStateAnalysis`, try/catch: uitval ⇒ eerlijke degradatie, pagina blijft werken) · today_display_history.

## Ranking (opdracht §3)

1. **Urgent:** `healthStatus ≠ ok` ⇒ gezondheid-lead, `urgent: true`, blijft staan bij elke call.
2. **Openstaande actie:** geplande training vandaag, niet afgerond ⇒ workout-lead.
3. **Geen plan:** §7-handelingsperspectief uit echte feiten (herstelstatus uit state-band, wedstrijd-aftelling ≤21 dagen) + acties (voorstellen / bewust herstel). Jeugd krijgt eenvoudiger copy zonder trainingsjargon.
4. **Support:** onderbouwing = echte state-signalen (`why[].reading`) + bronvermelding; geen signalen ⇒ slot null.
5. **Insight:** alleen bij aantoonbare trend (richting stijgend/dalend én ≥2 signalen) — nooit "je gaat vooruit" zonder bewijs.
6. **Rotating:** dag-stabiele seed (hash clerkId+datum ⇒ geen flikkerende volgorde binnen een dag) kiest uit beschikbare pool (laatste rit ≤3 dagen, wedstrijdvoorbereiding ≤14 dagen (niet jeugd), routesuggestie).

Afgevallen kandidaten gaan met reden in `passedOver` — voedt de debugweergave van WP-T3.

## Weergavehistorie

Tabel `today_display_history` (lib/db/src/schema/today.ts, unique op clerkId+itemKey): slot, first/lastShownOn (Amsterdamse dagen), `daysShown` (telt alleen bij nieuwe dag op), clicked, completed. Regels:
- niet-urgente rotating-items ≥3 getoonde dagen zonder klik/afronding ⇒ gepauzeerd (aandacht-rotatieprincipe);
- urgente en openstaande leads roteren nooit weg;
- `POST /api/today/interactions` zet clicked/completed (404 op onbekende sleutel).

## AI, caching, fallback

WP-T1 is **volledig deterministisch — geen AI-call in dit pad**. AI-formulering komt later uitsluitend via de centrale `aiMessage`-poort met dag+inputhash-cache; de huidige deterministische teksten zijn dan de verplichte fallback (opdracht §8). Geen mock-/fallbackdata: ontbreekt een bron, dan is het slot `null` (eerlijke lege toestand) en staat de reden in `passedOver`.

## Privacy & rechten

Alles clerkId-gescoped; route achter `requireAuth`; geen nieuwe rechtenlaag (bestaande blijven gelden). Jeugdvariant volgt de minor-afleiding uit de volledige DOB.

## Bewijs

`pnpm --filter @workspace/api-server run test:today-orchestrator` — 7/7 scenario's (gezondheid wint; workout-lead; §7-perspectief met echte aftelling; jeugdvariant/copy; beginner zonder verzonnen inzicht; historie telt per dag + klik; rotatiepauze na 3 dagen).
