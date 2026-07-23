// Opdracht 2 — afwijkingskeuze: drie duidelijke opties, wedstrijd-prioriteit,
// veilige standaard zonder keuze en geen herhaal-/herberekenlussen.
// Scenario's 1-3 draaien door de ECHTE afwijkingsdetectie (route-match.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allowNewRejoinRequest,
  createOffRoutePromptState,
  offRouteOptions,
  registerDismiss,
  shouldShowOffRoutePrompt,
} from "./off-route-choice";
import {
  createOffRouteState,
  updateOffRoute,
  type OffRouteInput,
  type OffRouteState,
} from "./route-match";

// Hulp: voer een reeks metingen door de detectie en geef eindstatus terug.
function run(
  state: OffRouteState,
  readings: Array<Partial<OffRouteInput> & { distanceM: number }>,
): { state: OffRouteState; events: Array<"enter" | "exit"> } {
  let s = state;
  const events: Array<"enter" | "exit"> = [];
  let t = 0;
  let along = 5;
  for (const r of readings) {
    t += 2500;
    const u = updateOffRoute(s, {
      lat: r.lat ?? 52.1,
      lon: r.lon ?? 5.2,
      timestampMs: r.timestampMs ?? t,
      distanceM: r.distanceM,
      alongKm: r.alongKm ?? along,
      accuracyM: r.accuracyM ?? 8,
      speedMps: r.speedMps ?? 7,
    });
    s = u.state;
    if (u.event) events.push(u.event);
  }
  return { state: s, events };
}

// ── Scenario's door de echte detectie ──────────────────────────────

test("scenario gemiste afslag: afwijking groeit aanhoudend → precies één 'enter' → kaart tonen", () => {
  const { state, events } = run(createOffRouteState(), [
    { distanceM: 40 },
    { distanceM: 90 },
    { distanceM: 140 },
    { distanceM: 190 },
    { distanceM: 240 },
  ]);
  assert.deepEqual(events, ["enter"]);
  assert.equal(state.active, true);
  const prompt = createOffRoutePromptState();
  assert.equal(
    shouldShowOffRoutePrompt(prompt, {
      active: true,
      episode: state.episode,
      distanceM: 240,
      hasDetour: false,
    }),
    true,
  );
});

test("scenario parallelweg: net buiten de corridor mét voortgang langs de route → géén afwijking, géén kaart", () => {
  // Corridor bij acc 8 / 7 m/s ≈ 30+16+10.5 = 56.5 m; 70 m is buiten maar
  // binnen de voortgangsfactor (1.6 × corridor ≈ 90 m) terwijl alongKm oploopt.
  const readings = [0, 1, 2, 3, 4, 5].map((i) => ({
    distanceM: 70,
    alongKm: 5 + i * 0.05,
  }));
  const { state, events } = run(createOffRouteState(), readings);
  assert.deepEqual(events, []);
  assert.equal(state.active, false);
  assert.equal(
    shouldShowOffRoutePrompt(createOffRoutePromptState(), {
      active: state.active,
      episode: state.episode,
      distanceM: 70,
      hasDetour: false,
    }),
    false,
  );
});

test("scenario bewuste afwijking + terugkeer: 'exit' sluit de kaart automatisch", () => {
  const first = run(createOffRouteState(), [
    { distanceM: 120, alongKm: 5 },
    { distanceM: 180, alongKm: 5 },
    { distanceM: 260, alongKm: 5 },
    { distanceM: 300, alongKm: 5 },
  ]);
  assert.equal(first.state.active, true);
  const back = run(first.state, [{ distanceM: 20, alongKm: 5 }]);
  assert.deepEqual(back.events, ["exit"]);
  assert.equal(
    shouldShowOffRoutePrompt(createOffRoutePromptState(), {
      active: back.state.active,
      episode: back.state.episode,
      distanceM: 20,
      hasDetour: false,
    }),
    false,
  );
});

// ── De drie keuzes ─────────────────────────────────────────────────

test("kaart biedt precies drie keuzes: terug / bestemming / negeren", () => {
  const ids = offRouteOptions(false).map((o) => o.id);
  assert.deepEqual(ids, ["terug", "bestemming", "negeren"]);
});

test("wedstrijdroute: terug naar het parcours voorop; 'bestemming' draagt eerlijke kanttekening over de bewaarde wedstrijdroute", () => {
  const race = offRouteOptions(true);
  assert.equal(race[0]!.id, "terug");
  assert.equal(race[0]!.primary, true);
  assert.match(race[0]!.detail, /parcours/i);
  const best = race.find((o) => o.id === "bestemming")!;
  assert.equal(best.primary, false);
  assert.match(best.detail, /wedstrijdroute blijft bewaard/i);
});

test("recreatieve route: 'bestemming' is een volwaardig alternatief zonder wedstrijdwaarschuwing", () => {
  const best = offRouteOptions(false).find((o) => o.id === "bestemming")!;
  assert.match(best.detail, /bestemming/i);
  assert.doesNotMatch(best.detail, /wedstrijd|parcours/i);
});

// ── Negeren / veilige standaard / geen spam ────────────────────────

test("'negeren' sluit de kaart voor deze episode en hij blijft dicht bij gelijkblijvende afwijking", () => {
  let s = createOffRoutePromptState();
  s = registerDismiss(s, 3, 200);
  for (const d of [190, 210, 230, 250]) {
    assert.equal(
      shouldShowOffRoutePrompt(s, {
        active: true,
        episode: 3,
        distanceM: d,
        hasDetour: false,
      }),
      false,
    );
  }
});

test("na negeren alleen opnieuw tonen bij RELEVANTE groei (≥2× én ≥ +150 m) of een nieuwe episode", () => {
  const s = registerDismiss(createOffRoutePromptState(), 3, 200);
  // 2× maar < +150 m zou bij kleine basis niet gelden — hier basis 200: 450 m = 2.25× en +250 m → tonen.
  assert.equal(
    shouldShowOffRoutePrompt(s, { active: true, episode: 3, distanceM: 450, hasDetour: false }),
    true,
  );
  // Nieuwe episode (opnieuw afgeweken na herstel) → altijd tonen.
  assert.equal(
    shouldShowOffRoutePrompt(s, { active: true, episode: 4, distanceM: 60, hasDetour: false }),
    true,
  );
  // Kleine basis: 40 m → 90 m is >2× maar geen +150 m → dicht (geen spam bij ruis).
  const klein = registerDismiss(createOffRoutePromptState(), 5, 40);
  assert.equal(
    shouldShowOffRoutePrompt(klein, { active: true, episode: 5, distanceM: 90, hasDetour: false }),
    false,
  );
});

test("geen keuze = veilige standaard: kaart blijft rustig staan, zelfde invoer geeft zelfde uitkomst (geen herhaal-meldingen)", () => {
  const s = createOffRoutePromptState();
  const input = { active: true, episode: 2, distanceM: 180, hasDetour: false };
  const a = shouldShowOffRoutePrompt(s, input);
  const b = shouldShowOffRoutePrompt(s, input);
  const c = shouldShowOffRoutePrompt(s, input);
  assert.deepEqual([a, b, c], [true, true, true]); // stabiel — geen flikkeren
});

test("gekozen vervolg actief (overlay) → kaart dicht; originele route blijft de bron", () => {
  assert.equal(
    shouldShowOffRoutePrompt(createOffRoutePromptState(), {
      active: true,
      episode: 2,
      distanceM: 300,
      hasDetour: true,
    }),
    false,
  );
});

test("herberekenlus-beveiliging: nieuw rejoin-verzoek pas na afkoeltijd of echte verplaatsing", () => {
  const pos = { lat: 52.1, lon: 5.2 };
  const mark = { atMs: 100_000, ...pos };
  // Direct opnieuw op dezelfde plek → geblokkeerd.
  assert.equal(allowNewRejoinRequest(mark, 101_000, pos), false);
  // Na 15 s → toegestaan.
  assert.equal(allowNewRejoinRequest(mark, 115_500, pos), true);
  // Binnen de afkoeltijd maar ≥100 m verplaatst → toegestaan.
  assert.equal(
    allowNewRejoinRequest(mark, 101_000, { lat: 52.101, lon: 5.2 }),
    true,
  );
  // Zonder eerder verzoek altijd toegestaan.
  assert.equal(allowNewRejoinRequest(null, 0, pos), true);
});
