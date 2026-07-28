import { gatherSignals } from "./gather";

// Eerlijke "wat is er nodig"-analyse voor de verbanden-analyse. De drempels
// hieronder spiegelen exact de gates van de regels in correlations.ts — als
// die veranderen, moet dit mee. We beloven nooit een verband: genoeg data
// betekent dat er GEZOCHT kan worden, niet dat er iets gevonden wordt.

export type ReadinessStep = {
  id: "trainingen" | "gevoel_slaap" | "ochtendmetingen" | "feedback";
  titel: string;
  uitleg: string;
  /** Hoeveel er nu is (echt geteld, nooit geschat). */
  heb: number;
  /** Hoeveel er minimaal nodig is voor de bijbehorende regel. */
  nodig: number;
  klaar: boolean;
  /** Welke actie in de app dit vult. */
  actie: "logtraining" | "checkin" | "feedback";
};

export type ConnectionReadiness = {
  windowDays: number;
  /** Minstens één regel heeft genoeg data om überhaupt te kunnen zoeken. */
  analyseMogelijk: boolean;
  stappen: ReadinessStep[];
};

export async function connectionReadiness(
  clerkId: string,
  windowDays = 45,
): Promise<ConnectionReadiness> {
  const bundle = await gatherSignals(clerkId, windowDays);

  // Regel A (slaap ↔ gevoel): dagen met een gevoel-score bij de training ÉN
  // slaapuren in de check-in van diezelfde dag.
  const metricByDate = new Map(bundle.metrics.map((m) => [m.metricDate, m]));
  const paired = bundle.sessions.filter((s) => {
    if (s.feelScore == null) return false;
    const m = metricByDate.get(s.sessionDate);
    const sleep = m?.sleepHours == null ? null : Number(m.sleepHours);
    return sleep != null && Number.isFinite(sleep) && sleep > 0;
  }).length;

  // Regel B (belasting ↔ herstel): ≥4 trainingen en ≥6 dagen met een
  // ochtendmeting (rusthartslag of HRV).
  const morgen = bundle.metrics.filter(
    (m) => m.restingHR != null || m.hrv != null,
  ).length;

  const stappen: ReadinessStep[] = [
    {
      id: "trainingen",
      titel: "Log of importeer trainingen",
      uitleg: `Minimaal 4 trainingen in de laatste ${windowDays} dagen — de basis voor elk verband.`,
      heb: bundle.sessions.length,
      nodig: 4,
      klaar: bundle.sessions.length >= 4,
      actie: "logtraining",
    },
    {
      id: "gevoel_slaap",
      titel: "Vul gevoel én slaap in op trainingsdagen",
      uitleg:
        "Op minimaal 4 trainingsdagen zowel een gevoel-score bij de training als slaapuren in je dagelijkse check-in. Dan kan Sparki slaap en trainingsgevoel vergelijken.",
      heb: paired,
      nodig: 4,
      klaar: paired >= 4,
      actie: "checkin",
    },
    {
      id: "ochtendmetingen",
      titel: "Vul ochtendmetingen in",
      uitleg:
        "Op minimaal 6 dagen een rusthartslag of HRV. Dan kan Sparki je belasting naast je herstel leggen.",
      heb: morgen,
      nodig: 6,
      klaar: morgen >= 6,
      actie: "checkin",
    },
    {
      id: "feedback",
      titel: "Geef terugkoppeling op trainingen",
      uitleg:
        "Minimaal 3 keer terugkoppeling (bijv. te zwaar, vermoeid of pijn) op een training. Terugkerende signalen worden dan zichtbaar.",
      heb: bundle.feedback.length,
      nodig: 3,
      klaar: bundle.feedback.length >= 3,
      actie: "feedback",
    },
  ];

  // Zelfde definitie als de stap hierboven: dagen met een échte ochtendmeting
  // (rustHR/HRV), niet elke metric-rij — anders kan de knop verschijnen terwijl
  // de belasting-herstel-regel feitelijk niets heeft om mee te vergelijken.
  const analyseMogelijk =
    paired >= 4 ||
    (bundle.sessions.length >= 4 && morgen >= 6) ||
    bundle.feedback.length >= 3;

  return { windowDays: bundle.windowDays, analyseMogelijk, stappen };
}
