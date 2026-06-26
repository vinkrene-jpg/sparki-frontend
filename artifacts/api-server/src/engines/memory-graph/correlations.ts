import type { ObservationSignal } from "@workspace/db";
import type { SignalBundle } from "./gather";
import { type Connection, buildConfidence, scoreToConfidence } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const nlDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });

// A prior observation with the same dedupeKey means Sparki saw this before —
// treat a repeat as stronger evidence (memory reinforcement).
function memoryReinforced(bundle: SignalBundle, dedupeKey: string): ObservationSignal | null {
  const prior = bundle.priorObservations.find(
    (o) => o.dedupeKey === dedupeKey && o.sourceType === "connection_analysis",
  );
  if (!prior) return null;
  return {
    kind: "memory",
    label: "Eerder waargenomen",
    value: "Dit patroon kwam al eens voor",
    date: new Date(prior.createdAt).toISOString().slice(0, 10),
  };
}

// ── Rule A: slaap → trainingsgevoel ──────────────────────────────────────────
// Pairs each training session that has a feel score with that day's sleep, and
// compares mean feel after short nights vs normal nights.
function ruleSleepFeel(bundle: SignalBundle): Connection | null {
  const dedupeKey = "conn:sleep-feel";
  const metricByDate = new Map(bundle.metrics.map((m) => [m.metricDate, m]));

  const paired = bundle.sessions
    .filter((s) => s.feelScore != null)
    .map((s) => {
      const m = metricByDate.get(s.sessionDate);
      const sleep = m ? num(m.sleepHours) : null;
      return sleep == null
        ? null
        : { date: s.sessionDate, feel: s.feelScore as number, sleep };
    })
    .filter((x): x is { date: string; feel: number; sleep: number } => x != null);

  if (paired.length < 4) return null;

  const avgSleep = mean(paired.map((p) => p.sleep));
  const shortNights = paired.filter((p) => p.sleep < avgSleep - 0.75);
  const normalNights = paired.filter((p) => p.sleep >= avgSleep - 0.75);
  if (shortNights.length < 2 || normalNights.length < 2) return null;

  const feelShort = mean(shortNights.map((p) => p.feel));
  const feelNormal = mean(normalNights.map((p) => p.feel));
  const delta = feelNormal - feelShort;
  if (delta < 0.6) return null; // no meaningful drop → no claim

  const agreement =
    shortNights.filter((p) => p.feel < feelNormal).length / shortNights.length;
  const confidenceScore = buildConfidence({
    sample: paired.length,
    effect: delta / 4,
    agreement,
    memoryReinforced: !!memoryReinforced(bundle, dedupeKey),
  });

  const signals: ObservationSignal[] = [];
  for (const p of shortNights.slice(-3)) {
    signals.push({
      kind: "sleep",
      label: "Korte nacht",
      value: `${p.sleep.toFixed(1)} u → gevoel ${p.feel}/5`,
      date: p.date,
    });
  }
  signals.push({
    kind: "training",
    label: "Gemiddeld gevoel",
    value: `na korte nacht ${feelShort.toFixed(1)} vs normaal ${feelNormal.toFixed(1)} (/5)`,
  });
  const mem = memoryReinforced(bundle, dedupeKey);
  if (mem) signals.push(mem);

  return {
    dedupeKey,
    title: "Kortere nachten gaan samen met een minder trainingsgevoel",
    summary: `Na nachten korter dan ${(avgSleep - 0.75).toFixed(1)} u lag je trainingsgevoel gemiddeld ${delta.toFixed(1)} punt lager.`,
    observationText: `Sparki vergeleek je slaap met hoe je trainingen voelden. Op ${shortNights.length} korte nachten was je gevoel gemiddeld ${feelShort.toFixed(1)}/5, tegenover ${feelNormal.toFixed(1)}/5 na normalere nachten. Dat is een verband, geen zekerheid — gebruik het als signaal, niet als regel.`,
    category: "recovery",
    severity: delta >= 1.2 ? "watch" : "info",
    detectedPattern: "short_sleep_lowers_training_feel",
    signals,
    confidenceScore,
    confidence: scoreToConfidence(confidenceScore),
    alternativeExplanations: [
      "Een beginnende verkoudheid of infectie kan zowel je slaap als je gevoel drukken.",
      "Mentale druk (school, werk, wedstrijdspanning) verklaart soms beide tegelijk.",
      "Een zware training de dag ervoor kan het gevoel los van de slaap verlagen.",
      "Meetfouten van de slaaptracker maken korte nachten soms korter dan ze waren.",
    ],
    recommendedAction:
      "Plan na een aantoonbaar korte nacht een rustigere sessie of verschuif de intensiteit.",
  };
}

// ── Rule B: trainingsbelasting → herstel ─────────────────────────────────────
// Compares the most recent 7-day load with the prior 7 days, and checks whether
// resting HR rose / HRV fell over the same window (overreaching signal).
function ruleLoadRecovery(bundle: SignalBundle): Connection | null {
  const dedupeKey = "conn:load-recovery";
  if (bundle.sessions.length < 4 || bundle.metrics.length < 6) return null;

  const today = new Date();
  const dayKey = (offset: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const recentCut = dayKey(7);
  const priorCut = dayKey(14);

  const loadOf = (s: { tss: number | null; durationMin: number | null }) =>
    s.tss ?? (s.durationMin != null ? Math.round(s.durationMin * 0.7) : 0);

  const recentLoad = bundle.sessions
    .filter((s) => s.sessionDate > recentCut)
    .reduce((a, s) => a + loadOf(s), 0);
  const priorLoad = bundle.sessions
    .filter((s) => s.sessionDate > priorCut && s.sessionDate <= recentCut)
    .reduce((a, s) => a + loadOf(s), 0);
  if (recentLoad <= 0 || priorLoad <= 0) return null;

  const loadJump = (recentLoad - priorLoad) / priorLoad;
  if (loadJump < 0.25) return null; // load not meaningfully up

  const recentMetrics = bundle.metrics.filter((m) => m.metricDate > recentCut);
  const priorMetrics = bundle.metrics.filter(
    (m) => m.metricDate > priorCut && m.metricDate <= recentCut,
  );
  const rhrRecent = recentMetrics.map((m) => m.restingHR).filter((v): v is number => v != null);
  const rhrPrior = priorMetrics.map((m) => m.restingHR).filter((v): v is number => v != null);
  const hrvRecent = recentMetrics.map((m) => m.hrv).filter((v): v is number => v != null);
  const hrvPrior = priorMetrics.map((m) => m.hrv).filter((v): v is number => v != null);

  const rhrUp = rhrRecent.length && rhrPrior.length ? mean(rhrRecent) - mean(rhrPrior) : 0;
  const hrvDown = hrvRecent.length && hrvPrior.length ? mean(hrvPrior) - mean(hrvRecent) : 0;

  const recoveryStrained = rhrUp >= 2 || hrvDown >= 4;
  if (!recoveryStrained) return null;

  const effect = Math.min(1, loadJump) * 0.6 + Math.min(1, (rhrUp / 6 + hrvDown / 12)) * 0.4;
  const confidenceScore = buildConfidence({
    sample: recentMetrics.length + priorMetrics.length,
    effect,
    agreement: 1,
    memoryReinforced: !!memoryReinforced(bundle, dedupeKey),
  });

  const signals: ObservationSignal[] = [
    {
      kind: "training",
      label: "Belasting 7 dagen",
      value: `${recentLoad} vs ${priorLoad} (+${Math.round(loadJump * 100)}%)`,
    },
  ];
  if (rhrUp >= 2)
    signals.push({
      kind: "recovery",
      label: "Rusthartslag",
      value: `+${rhrUp.toFixed(1)} bpm tegenover vorige week`,
    });
  if (hrvDown >= 4)
    signals.push({
      kind: "recovery",
      label: "HRV",
      value: `−${hrvDown.toFixed(0)} tegenover vorige week`,
    });
  const mem = memoryReinforced(bundle, dedupeKey);
  if (mem) signals.push(mem);

  return {
    dedupeKey,
    title: "Je belasting steeg terwijl je herstel onder druk komt",
    summary: `Je trainingsbelasting ging ${Math.round(loadJump * 100)}% omhoog en je herstelwaarden bewegen de verkeerde kant op.`,
    observationText: `In de laatste 7 dagen was je belasting ${recentLoad} tegenover ${priorLoad} de week ervoor. Tegelijk ${rhrUp >= 2 ? `steeg je rusthartslag met ${rhrUp.toFixed(1)} bpm` : ""}${rhrUp >= 2 && hrvDown >= 4 ? " en " : ""}${hrvDown >= 4 ? `daalde je HRV met ${hrvDown.toFixed(0)}` : ""}. Dit kan een teken van oplopende vermoeidheid zijn.`,
    category: "recovery",
    severity: loadJump >= 0.5 ? "important" : "watch",
    detectedPattern: "rising_load_with_strained_recovery",
    signals,
    confidenceScore,
    confidence: scoreToConfidence(confidenceScore),
    alternativeExplanations: [
      "Een beginnende ziekte verhoogt je rusthartslag los van de training.",
      "Cafeïne, alcohol of een slechte nacht beïnvloeden HRV en rusthartslag sterk.",
      "Warmte of onvoldoende drinken kan de herstelwaarden tijdelijk vertekenen.",
      "Een afwijkende meting (laat gemeten, niet stil) kan de cijfers vertekenen.",
    ],
    recommendedAction:
      "Overweeg een herstelweek of een paar rustige dagen en meet je rusthartslag enkele ochtenden op rij.",
  };
}

// ── Rule C: herstel vóór wedstrijd → uitslag ─────────────────────────────────
// Links recovery in the days before each finished race to the relative result,
// but only claims a connection when an association is actually MEASURED in the
// data. It picks the recovery metric with the most coverage (sleep or resting
// HR), splits races by good/poor recovery around the median, and checks how
// consistently better recovery lines up with a better result. Both effect and
// agreement are computed from the races themselves — never assumed.
function ruleRecoveryRace(bundle: SignalBundle): Connection | null {
  const dedupeKey = "conn:recovery-race";
  const metricByDate = new Map(bundle.metrics.map((m) => [m.metricDate, m]));

  type RacePoint = {
    name: string;
    date: string;
    ratio: number; // position / fieldSize (lower = better)
    sleep: number | null;
    rhr: number | null;
  };
  const points: RacePoint[] = [];
  for (const r of bundle.races) {
    const res = r.result;
    if (!res || res.status !== "finished" || !res.position || !res.fieldSize) continue;
    // recovery in 3 days before the race
    const days: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(`${r.raceDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const ms = days.map((d) => metricByDate.get(d)).filter((m): m is NonNullable<typeof m> => !!m);
    const sleeps = ms.map((m) => num(m.sleepHours)).filter((v): v is number => v != null);
    const rhrs = ms.map((m) => m.restingHR).filter((v): v is number => v != null);
    points.push({
      name: r.name,
      date: r.raceDate,
      ratio: res.position / res.fieldSize,
      sleep: sleeps.length ? mean(sleeps) : null,
      rhr: rhrs.length ? mean(rhrs) : null,
    });
  }

  // Need at least 3 finished races with a usable recovery metric to even look
  // for a pattern — fewer than that is not evidence of anything.
  const withSleep = points.filter((p) => p.sleep != null);
  const withRhr = points.filter((p) => p.rhr != null);

  // Pick the better-covered metric. higherIsBetter: more sleep is good recovery;
  // for resting HR, lower is good recovery (so we invert).
  type Metric = {
    kind: "slaap" | "rusthartslag";
    unit: string;
    higherIsBetter: boolean;
    sample: { name: string; date: string; ratio: number; value: number }[];
  };
  let metric: Metric | null = null;
  if (withSleep.length >= 3 && withSleep.length >= withRhr.length) {
    metric = {
      kind: "slaap",
      unit: "u",
      higherIsBetter: true,
      sample: withSleep.map((p) => ({ name: p.name, date: p.date, ratio: p.ratio, value: p.sleep! })),
    };
  } else if (withRhr.length >= 3) {
    metric = {
      kind: "rusthartslag",
      unit: "bpm",
      higherIsBetter: false,
      sample: withRhr.map((p) => ({ name: p.name, date: p.date, ratio: p.ratio, value: p.rhr! })),
    };
  }
  if (!metric) return null;

  // Split around the median recovery value and the median result. "Good
  // recovery" aligning with "good result" (lower ratio) on most races is the
  // measured association.
  const medMetric = median(metric.sample.map((s) => s.value));
  const medRatio = median(metric.sample.map((s) => s.ratio));
  const goodRecovery = (v: number) =>
    metric!.higherIsBetter ? v >= medMetric : v <= medMetric;

  let aligned = 0;
  let comparable = 0;
  for (const s of metric.sample) {
    // ties on the median ratio carry no directional information
    if (s.ratio === medRatio) continue;
    comparable++;
    const recoveryGood = goodRecovery(s.value);
    const resultGood = s.ratio < medRatio;
    if (recoveryGood === resultGood) aligned++;
  }
  if (comparable < 2) return null; // not enough variation in results to judge

  const agreement = aligned / comparable;
  if (agreement < 0.6) return null; // no consistent association → no claim

  const goodSide = metric.sample.filter((s) => goodRecovery(s.value));
  const poorSide = metric.sample.filter((s) => !goodRecovery(s.value));
  if (goodSide.length < 1 || poorSide.length < 1) return null;
  const ratioGood = mean(goodSide.map((s) => s.ratio));
  const ratioPoor = mean(poorSide.map((s) => s.ratio));
  const effect = Math.max(0, ratioPoor - ratioGood); // result improves with recovery

  const mem = memoryReinforced(bundle, dedupeKey);
  const confidenceScore = buildConfidence({
    sample: metric.sample.length,
    effect: Math.min(1, effect * 2),
    agreement,
    memoryReinforced: !!mem,
  });

  const signals: ObservationSignal[] = [];
  for (const s of metric.sample.slice(-3)) {
    signals.push({
      kind: "race",
      label: s.name,
      value: `top ${Math.round(s.ratio * 100)}% · ${metric.kind} ${s.value.toFixed(metric.kind === "slaap" ? 1 : 0)} ${metric.unit}`,
      date: s.date,
    });
  }
  signals.push({
    kind: "recovery",
    label: `Uitslag naar ${metric.kind}`,
    value: `beter hersteld top ${Math.round(ratioGood * 100)}% vs minder hersteld top ${Math.round(ratioPoor * 100)}%`,
  });
  if (mem) signals.push(mem);

  return {
    dedupeKey,
    title: `Beter ${metric.kind === "slaap" ? "geslapen" : "hersteld"} vóór de start ging samen met een betere uitslag`,
    summary: `Bij wedstrijden met betere ${metric.kind} in de aanloop eindigde je gemiddeld in de top ${Math.round(ratioGood * 100)}%, tegenover top ${Math.round(ratioPoor * 100)}% na minder ${metric.kind}.`,
    observationText: `Sparki vergeleek je ${metric.kind} in de drie dagen vóór ${metric.sample.length} afgeronde wedstrijden met je relatieve uitslag (positie binnen het deelnemersveld). In ${aligned} van de ${comparable} vergelijkbare wedstrijden viel een betere uitslag samen met beter herstel. Het is een verband, geen zekerheid — uitslagen hangen van veel meer af.`,
    category: "race",
    severity: "info",
    detectedPattern: "prerace_recovery_vs_result",
    signals,
    confidenceScore,
    confidence: scoreToConfidence(confidenceScore),
    alternativeExplanations: [
      "Parcours, tegenstand en wedstrijdniveau bepalen de uitslag vaak méér dan je herstel.",
      "Tactiek, positionering en pech (lekke band, valpartij) wegen zwaar mee.",
      "Weersomstandigheden op de dag zelf kunnen alles overrulen.",
      "Een handvol wedstrijden blijft een klein aantal om een hard verband op te baseren.",
    ],
    recommendedAction:
      "Behandel goed herstel vóór een wedstrijd als één knop die je zelf in de hand hebt — blijf je uitslagen invullen zodat dit beeld scherper wordt.",
  };
}

// ── Rule D: terugkerende feedback ────────────────────────────────────────────
// Detects a recurring workout-feedback signal (e.g. repeatedly "too hard" or
// "pain") that is worth surfacing as a pattern.
function ruleRecurringFeedback(bundle: SignalBundle): Connection | null {
  const dedupeKey = "conn:recurring-feedback";
  if (bundle.feedback.length < 3) return null;

  const counts = new Map<string, typeof bundle.feedback>();
  for (const f of bundle.feedback) {
    const arr = counts.get(f.feedbackType) ?? [];
    arr.push(f);
    counts.set(f.feedbackType, arr);
  }

  // priority: pain > too_hard > tired
  const priority = ["pain", "too_hard", "tired"];
  let pickedType: string | null = null;
  for (const t of priority) {
    if ((counts.get(t)?.length ?? 0) >= 3) {
      pickedType = t;
      break;
    }
  }
  if (!pickedType) return null;
  const items = counts.get(pickedType)!;

  const LABELS: Record<string, string> = {
    pain: "pijn",
    too_hard: "te zwaar",
    tired: "vermoeid",
  };
  const label = LABELS[pickedType] ?? pickedType;
  const isHealth = pickedType === "pain";

  const signals: ObservationSignal[] = items.slice(-4).map((f) => ({
    kind: "feedback",
    label: `Terugkoppeling: ${label}`,
    value: f.note?.slice(0, 60) || `${items.length}× gemeld`,
    date: f.date,
  }));
  const mem = memoryReinforced(bundle, dedupeKey);
  if (mem) signals.push(mem);

  const confidenceScore = buildConfidence({
    sample: items.length,
    effect: Math.min(1, items.length / 6),
    agreement: 1,
    memoryReinforced: !!mem,
  });

  return {
    dedupeKey,
    title: isHealth
      ? `Je meldde ${items.length}× pijn bij je trainingen`
      : `"${label}" keert terug in je terugkoppeling (${items.length}×)`,
    summary: isHealth
      ? "Herhaalde pijnmeldingen verdienen aandacht voordat ze een blessure worden."
      : `Je gaf ${items.length} keer aan dat een training als "${label}" voelde.`,
    observationText: isHealth
      ? `Er staan ${items.length} pijnmeldingen in je terugkoppeling. Pijn is een gezondheidssignaal — neem het serieus en laat het bij twijfel nakijken.`
      : `Je markeerde ${items.length} trainingen als "${label}". Dat kan betekenen dat de belasting of opbouw niet past bij je huidige vorm.`,
    category: isHealth ? "health" : "training",
    severity: isHealth ? "important" : "watch",
    detectedPattern: `recurring_feedback_${pickedType}`,
    signals,
    confidenceScore,
    confidence: scoreToConfidence(confidenceScore),
    alternativeExplanations: isHealth
      ? [
          "Pijn kan van materiaal of zithouding komen, niet van de belasting zelf.",
          "Een eenmalige blessure kan meerdere meldingen veroorzaken zonder dat de training fout is.",
          "Spierpijn na een opbouw is normaal en iets anders dan gewrichts- of peespijn.",
        ]
      : [
          "De trainingen waren misschien terecht zwaar (geplande overload).",
          "Onderliggende vermoeidheid of slaaptekort kleurt hoe zwaar iets voelt.",
          "Voeding of hydratatie rond de training kan het gevoel sterk beïnvloeden.",
        ],
    recommendedAction: isHealth
      ? "Bespreek de terugkerende pijn met je coach of een fysiotherapeut voordat je doorbouwt."
      : "Stem de intensiteit beter af of bouw rustiger op; bespreek het zo nodig met je coach.",
  };
}

const RULES = [ruleSleepFeel, ruleLoadRecovery, ruleRecoveryRace, ruleRecurringFeedback];

// Run every deterministic rule over the gathered signals and return the
// connections that fired, strongest confidence first.
export function deriveConnections(bundle: SignalBundle): Connection[] {
  const out: Connection[] = [];
  for (const rule of RULES) {
    try {
      const c = rule(bundle);
      if (c) out.push(c);
    } catch {
      // a single faulty rule must never break the whole analysis
    }
  }
  return out.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
