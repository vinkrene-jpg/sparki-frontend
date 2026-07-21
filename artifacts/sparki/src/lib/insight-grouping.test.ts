// Tests for the insight grouping + series-mapping engine (`insight-grouping.ts`).
//
// The /train PatternsLayer and the /you Core lenses both render insight cards
// through this engine. Two contracts matter most and must not silently break:
//   - GROUPING: multiple same-metric observations (e.g. three HRV reads) collapse
//     into ONE card (lead + members), while non-chartable insights stay separate
//     single-member groups. This is the whole point of "minder tekst".
//   - HONESTY: a chart series is always derived from REAL sources or is absent —
//     non-metric insights map to `series: null` (no chart), and a metric with no
//     data yields an empty `values` array (the card shows "nog geen meetreeks"),
//     never a fabricated line.
//
// A SURFACE GUARD also lives here: the derived-observation surfaces (Trainen
// PatternsLayer, /you Core, and the Inzicht "Sparki Geheugen" panel) must all
// render through groupObservations + GraphInsightCard so the same metric never
// reappears as several near-identical cards. The guard fails if any of those
// surfaces stops grouping or reintroduces the old per-observation ObservationCard
// pattern — catching a regression by test instead of by eye.
//
// Pure functions, no DB — run with: `pnpm --filter @workspace/sparki run test:insight-grouping`
// Exits non-zero on any failure.
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { AiObservation } from "@/hooks/use-ai-memory"
import type { AthleteDailyMetric, FtpHistoryEntry } from "@/lib/athlete-types"
import {
  classifyObservation,
  groupObservations,
  dedupeObservationsByText,
  dedupeObservationsByFact,
  seriesForKind,
  type InsightSources,
} from "./insight-grouping"
import {
  coachOwnsObservations,
  OBSERVATION_PROSE_FIELDS,
  observationTabOwner,
  ownerOf,
  ownsObservation,
} from "./insight-ownership"

type Status = "pass" | "fail"
const results: { scenario: string; status: Status; note?: string }[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function scenario(name: string, fn: () => void) {
  try {
    fn()
    results.push({ scenario: name, status: "pass" })
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    })
  }
}

let nextId = 1
function obs(partial: Partial<AiObservation>): AiObservation {
  return {
    id: nextId++,
    sourceType: "engine",
    title: "",
    summary: null,
    observationText: "",
    confidence: "medium",
    category: "training",
    severity: "info",
    detectedPattern: null,
    signals: null,
    alternativeExplanations: null,
    confidenceScore: null,
    recommendedAction: null,
    status: "new",
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

function metric(partial: Partial<AthleteDailyMetric>): AthleteDailyMetric {
  return {
    hrv: null,
    restingHR: null,
    sleepHours: null,
    feelScore: null,
    ...partial,
  } as AthleteDailyMetric
}

// ── classifyObservation ──────────────────────────────────────────────────────

scenario("classify maps each maatstaf to its kind", () => {
  assert(
    classifyObservation(obs({ title: "Je HRV daalt deze week" })) === "hrv",
    "HRV title must classify as hrv",
  )
  assert(
    classifyObservation(obs({ title: "Je rusthartslag loopt op" })) === "rhr",
    "rusthartslag must classify as rhr",
  )
  assert(
    classifyObservation(obs({ title: "Je slaap wordt korter" })) === "sleep",
    "slaap must classify as sleep",
  )
  assert(
    classifyObservation(obs({ title: "Je FTP is gestegen" })) === "ftp",
    "FTP must classify as ftp",
  )
})

scenario("gemiste geplande trainingen collapse into ONE uitvoering card", () => {
  // The three near-identical cards from the field report: same story
  // ("alle geplande trainingen gemist"), different titles and figures.
  const a = obs({
    title: "Geen enkele geplande training gereden in 28 dagen",
    observationText:
      "De uitvoeringsscore staat op 15/100: 0 van de 29 geplande sessies zijn gereden.",
    severity: "important",
  })
  const b = obs({
    title: "29 van de 29 geplande trainingen gemist",
    observationText:
      "Alle 29 geplande trainingen in de laatste 28 dagen werden uitgesteld of overgeslagen.",
  })
  const c = obs({
    title: "Alle geplande trainingen gemist in 28 dagen",
    observationText:
      "Van de 21 geplande trainingen in de laatste 28 dagen is er geen enkele daadwerkelijk gereden.",
  })
  assert(classifyObservation(a) === "uitvoering", "a must classify as uitvoering")
  assert(classifyObservation(b) === "uitvoering", "b must classify as uitvoering")
  assert(classifyObservation(c) === "uitvoering", "c must classify as uitvoering")
  const groups = groupObservations([a, b, c], {})
  assert(groups.length === 1, `expected 1 card, got ${groups.length}`)
  assert(groups[0].kind === "uitvoering", "group kind must be uitvoering")
  assert(groups[0].lead.id === a.id, "strongest (important) observation must lead")
})

scenario("non-metric observation classifies as 'other'", () => {
  assert(
    classifyObservation(obs({ title: "Weersverwachting voor je wedstrijd", category: "race" })) ===
      "other",
    "a non-chartable note must classify as other",
  )
})

// ── grouping ─────────────────────────────────────────────────────────────────

scenario("three HRV observations collapse into ONE group", () => {
  const list = [
    obs({ title: "HRV daalt", severity: "watch" }),
    obs({ title: "HRV blijft laag", severity: "important" }),
    obs({ title: "HRV herstelt traag", severity: "info" }),
  ]
  const groups = groupObservations(list, {})
  const hrvGroups = groups.filter((g) => g.kind === "hrv")
  assert(hrvGroups.length === 1, `expected 1 HRV group, got ${hrvGroups.length}`)
  assert(
    hrvGroups[0].members.length === 3,
    `the HRV group must carry all 3 members, got ${hrvGroups[0].members.length}`,
  )
})

scenario("strongest observation leads the group", () => {
  const list = [
    obs({ title: "HRV daalt", severity: "watch", confidence: "low" }),
    obs({ title: "HRV blijft laag", severity: "important", confidence: "high" }),
  ]
  const [group] = groupObservations(list, {})
  assert(
    group.lead.title === "HRV blijft laag",
    `the most severe/confident observation must lead, got "${group.lead.title}"`,
  )
})

scenario("different metrics stay in separate groups; 'other' stays single", () => {
  const list = [
    obs({ title: "HRV daalt" }),
    obs({ title: "Je rusthartslag loopt op" }),
    obs({ title: "Weersverwachting wedstrijd", category: "race" }),
  ]
  const groups = groupObservations(list, {})
  assert(groups.length === 3, `expected 3 distinct groups, got ${groups.length}`)
  const other = groups.find((g) => g.kind === "other")
  assert(!!other && other.series === null, "an 'other' group must have no chart (null series)")
})

// ── regression: the "Geen check-in × 3" /you bug ─────────────────────────────
//
// Check-in / readiness observations used to be persisted under different DB
// categories (general / recovery) with day-specific titles, so they classified
// to different kinds and never collapsed — surfacing the same "Geen check-in"
// read several times on /you. They must all classify to ONE kind and group into
// a single card (lead + members), regardless of category.

scenario("check-in / readiness observations all classify to ONE kind", () => {
  const kinds = [
    classifyObservation(obs({ title: "Geen check-in gelogd op rustdag", category: "recovery" })),
    classifyObservation(obs({ title: "Geen check-in geregistreerd", category: "training" })),
    classifyObservation(obs({ title: "No readiness check-in logged", category: "recovery" })),
    classifyObservation(obs({ title: "Incheck van vandaag ontbreekt", category: "training" })),
  ]
  const unique = new Set(kinds)
  assert(
    unique.size === 1,
    `all check-in/readiness reads must share one kind, got ${JSON.stringify([...unique])}`,
  )
})

scenario("multiple check-in observations across categories collapse into ONE group", () => {
  const list = [
    obs({ title: "Geen check-in gelogd op wedstrijdvoorbereiding", category: "training", severity: "info", confidence: "high" }),
    obs({ title: "Geen check-in geregistreerd op rustdag", category: "recovery", severity: "info", confidence: "high" }),
    obs({ title: "Geen check-in gelogd op rustdag voor A-wedstrijd", category: "training", severity: "info", confidence: "high" }),
    obs({ title: "No readiness check-in logged", category: "recovery", severity: "info", confidence: "medium" }),
  ]
  const groups = groupObservations(list, {})
  assert(
    groups.length === 1,
    `the four check-in reads must collapse into ONE group, got ${groups.length}`,
  )
  assert(
    groups[0].members.length === 4,
    `the check-in group must carry all 4 members, got ${groups[0].members.length}`,
  )
})

// ── cross-maatstaf fact collapse ─────────────────────────────────────────────
//
// Prod bug: one hard ride (20 juni — 129 minuten, TSS 301) was persisted as a
// volume note AND a herstel note AND echoed in the ftp story, so the SAME fact
// led three separate cards. Notes citing the same figures must collapse to one
// card (strongest wins) regardless of maatstaf; notes sharing only a single
// figure must stay distinct.

scenario("the same fact under different maatstaven collapses to ONE card", () => {
  const volume = obs({
    title: "Trainingsbelasting boven het doelvolume",
    category: "load",
    observationText:
      "De rit op 20 juni duurde 129 minuten met een TSS van 301, ver boven het weekdoel.",
    severity: "important",
    confidence: "high",
  })
  const recovery = obs({
    title: "Herstel wordt onvoldoende ingepland",
    category: "recovery",
    observationText:
      "Na een piek van 129 minuten en een TSS van 301 ontbrak zichtbare lichte hersteltijd.",
    severity: "watch",
    confidence: "medium",
  })
  const groups = groupObservations([volume, recovery], {})
  assert(
    groups.length === 1,
    `the same fact across maatstaven must collapse to one card, got ${groups.length}`,
  )
  assert(
    groups[0].lead.id === volume.id,
    "the strongest observation must be the surviving lead",
  )
})

scenario("cross-maatstaf notes sharing only ONE figure stay separate", () => {
  const volume = obs({
    title: "Belasting loopt op",
    category: "load",
    observationText: "Je weekbelasting steeg naar 301 TSS.",
    severity: "important",
  })
  const recovery = obs({
    title: "Herstel blijft achter",
    category: "recovery",
    observationText: "Je hersteltoestand zakte naar 40 procent.",
    severity: "watch",
  })
  const groups = groupObservations([volume, recovery], {})
  assert(
    groups.length === 2,
    `notes sharing a single figure must stay separate, got ${groups.length}`,
  )
})

scenario("dedupeObservationsByFact keeps text-only notes and the strongest duplicate", () => {
  const strong = obs({
    observationText: "Rit van 129 minuten met TSS 301.",
    severity: "important",
    confidence: "high",
  })
  const weakDup = obs({
    observationText: "Een sessie van 129 minuten leverde een TSS van 301 op.",
    severity: "info",
    confidence: "low",
  })
  const textOnly = obs({ observationText: "Je consistentie liep de laatste weken terug." })
  const kept = dedupeObservationsByFact([weakDup, strong, textOnly])
  const keptIds = kept.map((k) => k.id)
  assert(
    keptIds.includes(strong.id) && keptIds.includes(textOnly.id),
    "the strongest duplicate and the figure-free note must survive",
  )
  assert(
    !keptIds.includes(weakDup.id),
    `the weaker same-figure duplicate must be dropped, kept ${JSON.stringify(keptIds)}`,
  )
  assert(
    keptIds.length === 2,
    `exactly the strong + text-only notes must remain, got ${kept.length}`,
  )
})

scenario("cross-maatstaf notes sharing two incidental figures but no shared word stay separate", () => {
  // Honesty guard against over-collapse: two genuinely different facts that
  // coincidentally cite the same two numbers (285 and 72) but share no content
  // word must BOTH stay — numeric overlap alone is not enough to merge.
  const power = obs({ observationText: "FTP steeg tot 285 watt bij 72 kilo." })
  const sleep = obs({
    observationText: "Slaapduur daalde richting 285 minuten met 72 procent diepgang.",
  })
  const kept = dedupeObservationsByFact([power, sleep])
  assert(
    kept.length === 2,
    `distinct facts sharing only incidental numbers must both stay, got ${kept.length}`,
  )
})

// ── series honesty ───────────────────────────────────────────────────────────

scenario("HRV series is real and chronological (oldest → newest)", () => {
  // API returns newest-first; the engine must reverse to chronological order.
  const sources: InsightSources = {
    metrics: [metric({ hrv: 70 }), metric({ hrv: 65 }), metric({ hrv: 60 })],
  }
  const series = seriesForKind("hrv", sources)
  assert(!!series, "hrv must yield a series object")
  assert(
    JSON.stringify(series!.values) === JSON.stringify([60, 65, 70]),
    `HRV values must be chronological, got ${JSON.stringify(series!.values)}`,
  )
})

scenario("a metric with no data yields an empty series (honest, not fabricated)", () => {
  const series = seriesForKind("hrv", { metrics: [] })
  assert(!!series, "hrv kind still returns a series shell")
  assert(series!.values.length === 0, "no metrics must yield zero values, never invented ones")
})

scenario("rusthartslag is flagged as good-when-down", () => {
  const series = seriesForKind("rhr", { metrics: [metric({ restingHR: 50 })] })
  assert(series!.trendGoodWhenDown === true, "rhr must mark a downward trend as the good direction")
})

scenario("FTP series sorts ascending by measurement date", () => {
  const ftpHistory: FtpHistoryEntry[] = [
    { ftpWatts: 250, measuredAt: "2026-03-01" },
    { ftpWatts: 240, measuredAt: "2026-01-01" },
    { ftpWatts: 245, measuredAt: "2026-02-01" },
  ] as FtpHistoryEntry[]
  const series = seriesForKind("ftp", { ftpHistory })
  assert(
    JSON.stringify(series!.values) === JSON.stringify([240, 245, 250]),
    `FTP values must be date-ascending, got ${JSON.stringify(series!.values)}`,
  )
})

scenario("'other' kind never produces a chart", () => {
  assert(seriesForKind("other", {}) === null, "other kind must map to null series")
})

// ── grouping + honesty at the groupObservations level ────────────────────────

scenario(
  "groupObservations collapses same-metric (lead + members) and never fabricates a series without data",
  () => {
    const list = [
      obs({ title: "HRV daalt", severity: "watch", confidence: "low" }),
      obs({ title: "HRV blijft laag", severity: "important", confidence: "high" }),
      obs({ title: "HRV herstelt traag", severity: "info", confidence: "medium" }),
      obs({ title: "Weersverwachting wedstrijd", category: "race" }),
    ]
    // No sources at all → nothing real to chart.
    const groups = groupObservations(list, {})

    const hrv = groups.find((g) => g.kind === "hrv")
    assert(!!hrv, "the three HRV observations must collapse into one hrv group")
    assert(
      hrv!.members.length === 3,
      `the hrv group must carry all 3 members, got ${hrv!.members.length}`,
    )
    assert(
      hrv!.lead.title === "HRV blijft laag",
      `the strongest observation must lead, got "${hrv!.lead.title}"`,
    )
    assert(
      hrv!.members[0].id === hrv!.lead.id,
      "the lead must be the first member of the group",
    )
    // A metric group with no source data must yield an empty (not fabricated) series.
    assert(!!hrv!.series, "a metric group still returns a series shell")
    assert(
      hrv!.series!.values.length === 0,
      "no source data must yield zero values, never an invented line",
    )

    // A non-chartable insight yields a null series (no chart at all).
    const other = groups.find((g) => g.kind === "other")
    assert(!!other, "the race-weather note must stay its own 'other' group")
    assert(
      other!.series === null,
      "an insight with no real series must yield a null series, never a fabricated one",
    )
  },
)

// ── surface guard: every observation surface must group ──────────────────────
//
// These surfaces render derived AiObservations. Each MUST funnel them through
// groupObservations + GraphInsightCard so the same maatstaf collapses into one
// card. The guard fails if a surface drops grouping or reintroduces a raw
// per-observation card (the old ObservationCard pattern) — locking the rule in.

const here = dirname(fileURLToPath(import.meta.url)) // …/src/lib
const SURFACES: { name: string; path: string }[] = [
  {
    name: "Inzicht — Sparki Geheugen panel",
    path: resolve(here, "../components/sparki/ai-memory-panel.tsx"),
  },
  {
    name: "Trainen — PatternsLayer",
    path: resolve(here, "../components/sparki/train/patterns-layer.tsx"),
  },
  { name: "/you — Core", path: resolve(here, "../pages/you.tsx") },
]

for (const surface of SURFACES) {
  scenario(`${surface.name} groups observations (no raw per-observation cards)`, () => {
    const src = readFileSync(surface.path, "utf8")
    assert(
      /\bgroupObservations\s*\(/.test(src),
      `${surface.name} must funnel observations through groupObservations() — it no longer groups`,
    )
    assert(
      src.includes("GraphInsightCard"),
      `${surface.name} must render insights via the shared GraphInsightCard`,
    )
    assert(
      !/\bObservationCard\b/.test(src),
      `${surface.name} reintroduced the old per-observation ObservationCard pattern — group instead`,
    )
  })
}

// ── dedup guard: coach vs observations own DISJOINT insight domains ──────────
//
// Two systems derive from the SAME observations: the daily coach (a synthesized
// day-advies) and the over-time observations (grafiek-eerst kaarten). To stop the
// SAME insight from appearing twice (coach prose + kaart), the coach surface owns
// ONLY the synthesized advies; the trend observations are owned solely by the
// GraphInsightCard surface. lib/insight-ownership is the SSOT; this guard locks it.

scenario("insight ownership map has exactly one owner per domain", () => {
  assert(
    ownerOf("daily_advice") === "coach_daily",
    "het dagadvies moet bij de coach-kaart horen",
  )
  assert(
    ownerOf("trend_observation") === "graph_cards",
    "trend-observaties moeten bij de grafiek-kaarten horen",
  )
  assert(
    !coachOwnsObservations(),
    "de coach-kaart mag nooit eigenaar van trend-observaties zijn",
  )
})

scenario("CoachAnalysisCard renders no trend-observation prose (advies-only)", () => {
  const src = readFileSync(
    resolve(here, "../components/sparki/coach/coach-analysis-card.tsx"),
    "utf8",
  )
  for (const field of OBSERVATION_PROSE_FIELDS) {
    assert(
      !new RegExp(`data\\.${field}\\b`).test(src),
      `coach card re-renders observation prose "data.${field}" — dat inzicht hoort bij de GraphInsightCard-kaarten; haal het hier weg (anders verschijnt het twee keer)`,
    )
  }
  // It must still render the synthesized advies it owns.
  assert(
    /data\.advice\b/.test(src),
    "coach card moet nog steeds het dagadvies tonen dat het bezit",
  )
})

scenario("grouped metric insights are all owned by the graph-card surface", () => {
  const groups = groupObservations(
    [
      obs({ title: "HRV blijft laag", severity: "important", confidence: "high" }),
      obs({ title: "FTP stijgt", severity: "info", confidence: "medium" }),
      obs({ title: "Rusthartslag daalt", severity: "watch", confidence: "low" }),
    ],
    {},
  )
  assert(groups.length > 0, "verwacht gegroepeerde trend-inzichten")
  const owner = ownerOf("trend_observation")
  assert(owner === "graph_cards", "trend-observaties renderen op de grafiek-kaarten")
  assert(
    owner !== "coach_daily",
    "geen enkele trend-observatie mag op de coach-kaart verschijnen",
  )
})

// ── cross-tab guard: Trainen and /you own DISJOINT observations ──────────────
//
// Trainen "Wat over tijd opvalt" and /you Core both render grafiek-eerst cards
// from the SAME ai_observations pool. Without ownership, a training-category read
// (e.g. HRV/fitheid) would appear on BOTH tabs. lib/insight-ownership partitions
// them by category — Trainen owns the training-pattern reads, /you owns the rest —
// so each observation has exactly one owning tab and renders once.

scenario("every observation is owned by exactly one tab (train XOR you)", () => {
  const payload = [
    obs({ title: "HRV blijft laag", category: "recovery" }),
    obs({ title: "Fitheid stijgt", category: "fitness" }),
    obs({ title: "Eiwitinname blijft laag", category: "nutrition" }),
    obs({ title: "Doel komt in zicht", category: "goal" }),
  ]
  for (const o of payload) {
    const ownedByTrain = ownsObservation("train", o)
    const ownedByYou = ownsObservation("you", o)
    assert(
      ownedByTrain !== ownedByYou,
      `observation "${o.title}" (${o.category}) must be owned by exactly one tab, got train=${ownedByTrain} you=${ownedByYou}`,
    )
    assert(
      observationTabOwner(o) === (ownedByTrain ? "train" : "you"),
      "observationTabOwner must agree with ownsObservation",
    )
  }
})

scenario("Trainen and /you render DISJOINT observation sets for the same payload", () => {
  const payload = [
    obs({ title: "HRV blijft laag", category: "recovery" }),
    obs({ title: "Fitheid stijgt", category: "fitness" }),
    obs({ title: "Belasting loopt op", category: "load" }),
    obs({ title: "Eiwitinname blijft laag", category: "nutrition" }),
    obs({ title: "Doel komt in zicht", category: "goal" }),
  ]
  const trainIds = payload.filter((o) => ownsObservation("train", o)).map((o) => o.id)
  const youIds = payload.filter((o) => ownsObservation("you", o)).map((o) => o.id)
  // Together they cover the whole payload (nothing dropped, nothing duplicated).
  assert(
    trainIds.length + youIds.length === payload.length,
    `every observation must land on one tab, got train=${trainIds.length} you=${youIds.length} of ${payload.length}`,
  )
  const overlap = trainIds.filter((id) => youIds.includes(id))
  assert(
    overlap.length === 0,
    `Trainen and /you must not share observations, overlapping ids: ${JSON.stringify(overlap)}`,
  )
  // The grafiek-eerst groups built per tab share no group key either.
  const trainKeys = groupObservations(
    payload.filter((o) => ownsObservation("train", o)),
    {},
  ).map((g) => g.key)
  const youKeys = groupObservations(
    payload.filter((o) => ownsObservation("you", o)),
    {},
  ).map((g) => g.key)
  const sharedKeys = trainKeys.filter((k) => youKeys.includes(k))
  assert(
    sharedKeys.length === 0,
    `Trainen and /you group keys must be disjoint, shared: ${JSON.stringify(sharedKeys)}`,
  )
})

// ── dedupeObservationsByText ─────────────────────────────────────────────────

scenario("near-identical FTP paraphrases collapse to one", () => {
  // The real-world bug: many same-fact FTP paragraphs stacked in one expanded
  // card. Different wording, same numbers/story → must collapse.
  const paraphrases = [
    obs({
      observationText:
        "Tussen januari en mei 2026 steeg het FTP van 262W naar 285W, een toename van 23W in ruim vier maanden.",
    }),
    obs({
      observationText:
        "De FTP-geschiedenis toont een stijgende lijn van 262W (januari) naar 285W (mei), maar het profiel vermeldt 245W.",
    }),
    obs({
      observationText:
        "FTP steeg van 262W naar 274W naar 285W, een toename van 23W in vijf maanden — het profiel vermeldt echter 245W.",
    }),
    obs({
      observationText:
        "Over drie meetpunten in 2026 is het FTP gestaag gestegen: 262W, 274W en 285W; de huidige waarde van 245W lijkt verouderd.",
    }),
  ]
  const kept = dedupeObservationsByText(paraphrases)
  assert(
    kept.length === 1,
    `four FTP paraphrases must collapse to one, got ${kept.length}`,
  )
  assert(kept[0].id === paraphrases[0].id, "the first (strongest) must win")
})

scenario("genuinely different same-metric notes are kept", () => {
  const a = obs({ observationText: "Je FTP stijgt gestaag." })
  const b = obs({
    observationText:
      "Je FTP-test is verouderd; plan binnenkort een nieuwe meting om je zones scherp te houden.",
  })
  const kept = dedupeObservationsByText([a, b])
  assert(kept.length === 2, `distinct FTP notes must both stay, got ${kept.length}`)
})

scenario("paraphrase of the lead is dropped via `against`", () => {
  const lead = obs({
    observationText: "Je vermogen ontwikkelt zich de goede kant op; je training slaat aan.",
  })
  const echo = obs({
    observationText: "Het vermogen ontwikkelt zich de goede kant op — de training slaat duidelijk aan.",
  })
  const fresh = obs({ observationText: "Je slaap was deze week korter dan gebruikelijk." })
  const kept = dedupeObservationsByText([echo, fresh], [lead])
  assert(
    kept.length === 1 && kept[0].id === fresh.id,
    `only the non-echo note must survive, got ${kept.map((k) => k.id).join(",")}`,
  )
})

scenario("same-metric notes sharing one figure are NOT merged", () => {
  // Precision guard: two genuinely different FTP notes that happen to share a
  // single number (here 285W) but reach different conclusions must both stay —
  // the number rule needs ≥2 shared figures with strong overlap to collapse.
  const a = obs({
    observationText: "Je FTP klom in 2026 van 262W naar 285W; je vorm trekt aan.",
  })
  const b = obs({
    observationText:
      "Bij 285W drempel en 72 kg blijft je vermogen-per-kilo laag; mik op 2027 voor de volgende stap.",
  })
  const kept = dedupeObservationsByText([a, b])
  assert(
    kept.length === 2,
    `distinct FTP notes sharing one figure must both stay, got ${kept.length}`,
  )
})

scenario("empty-text observations are never falsely merged", () => {
  const a = obs({ observationText: "", title: "" })
  const b = obs({ observationText: "", title: "" })
  const kept = dedupeObservationsByText([a, b])
  assert(kept.length === 2, `blank texts must not collapse, got ${kept.length}`)
})

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail")
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\ninsight-grouping: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  process.exit(1)
}
