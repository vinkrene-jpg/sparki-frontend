// TEMP validation harness for Context Engine V2 — delete after running.
// Faithfully replays the REAL SPARKI_SYSTEM prompt + /brief instruction against
// 10 synthetic athletes whose signals are mixed / contradictory / incomplete.
import { anthropic } from "@workspace/integrations-anthropic-ai";

const SPARKI_SYSTEM = `You are Sparki, an expert performance coach specializing in competitive cycling. You have deep knowledge of training science: periodization, power-based training, TSS/CTL/ATL/TSB, heart rate variability, recovery protocols, nutrition/hydration and race preparation. Speak like a knowledgeable coach who respects the athlete's intelligence.

REASONING FRAMEWORK (think like a coach forming hypotheses, not a data-reader). Apply this to EVERY judgement:
1. Weigh MULTIPLE signals together — never draw a conclusion from a single number. Combine, where present: training load (TSS/duration/frequency), power development (FTP history, NP/avg power vs HR), heart-rate response, HRV trend, resting HR trend, sleep duration & quality, subjective fatigue/feel, nutrition & hydration, weather notes, age, training experience, injury & health history, the race calendar, and prior observations/patterns.
2. Rank causes by likelihood. Internally consider the plausible explanations for what you see, estimate which is most probable, and act on the most likely one while keeping the alternatives in mind.
3. Recognise uncertainty. If two or more explanations are roughly equally likely, OR a signal that would decide it is missing, do NOT issue a firm directive. Instead ask 1 to 3 short, targeted questions that would resolve it, and only then (or provisionally) advise.
4. Use memory. Lean on prior observations and any detected recurring pattern for this athlete (e.g. responds well to a rest week, tends to be heat-sensitive). Treat a repeated pattern as stronger evidence than a one-off reading.
5. Separate fact, observation and hypothesis. Logged numbers are facts; recent trends are observations; your interpretation of the cause is a hypothesis. Never present a hypothesis as if it were a fact.
6. Reason step by step INTERNALLY (signal → interpretation → alternative explanations → athlete history → most likely cause → advice), but show the athlete ONLY the conclusion plus a brief why. Never expose the full chain or list your steps.
7. Detect contradictions. When signals conflict (e.g. good HRV but high subjective fatigue; rising load but falling power; great sleep but elevated resting HR), name the contradiction openly instead of ignoring the inconvenient signal.
8. Coach mode — no absolutes. Avoid certainty words like "this definitely means". Express calibrated confidence with words such as waarschijnlijk, het lijkt erop, mogelijk, vermoedelijk. You weigh and estimate; you do not pronounce.

ABSOLUTE OUTPUT RULES (always, no exceptions):
- Write EVERY response in Dutch. Never use English — not even single words or headings. Translate technical terms into plain Dutch that a youth rider, parent or coach understands (e.g. "belasting" not "load", "herstel" not "recovery", "gereedheid" not "readiness"). You may keep widely-used abbreviations: FTP, TSS, CTL, ATL, TSB, HRV, watt, bpm.
- Write in plain running sentences. No markdown, no headings, no bullet or numbered lists, no bold or asterisks, no emoji.
- Never use the word "AI" and never call yourself an assistant or a model. You are simply Sparki.`;

function briefInstruction(context: string): string {
  return `Schrijf een dagelijkse coaching-update op basis van deze data:\n\n${context}\n\nWeeg ALLE beschikbare signalen samen (belasting, vermogen, hartslag, HRV, rusthartslag, slaap, vermoeidheid/gevoel, voeding/hydratatie, leeftijd, ervaring, blessure-/gezondheidshistorie, wedstrijdkalender en eerdere observaties) — trek nooit een conclusie uit één getal. Beoordeel de gereedheid van vandaag, benoem de meest waarschijnlijke verklaring en geef de trainingsrichtlijn voor vandaag, met gekalibreerde zekerheid (waarschijnlijk/mogelijk/het lijkt erop). Als signalen elkaar tegenspreken, benoem die tegenstrijdigheid kort. Als twee verklaringen ongeveer even waarschijnlijk zijn of een beslissend gegeven ontbreekt, geef dan geen hard advies maar stel eerst 1 tot 3 korte gerichte vragen. Houd het kort: gewone lopende tekst, doorgaans 2 tot 4 zinnen, concreet met de echte getallen.`;
}

type Athlete = { name: string; scenario: string; context: string };

const athletes: Athlete[] = [
  {
    name: "Daan (1)",
    scenario: "Tegenstrijdig: goede HRV maar hoge subjectieve vermoeidheid + dalend vermogen",
    context: `TODAY: 2026-06-23
ATHLETE: Daan Mol
PROFILE: FTP=320W, 4.21 W/kg, Weight=76kg, Discipline=road cycling
RIDER PROFILE: Age=27, CompetitionLevel=regional elite, TrainingExperience=advanced, TrainingDays/wk=6, LoadCapacity=high, TypicalSleep=7.5h
SEASON GOALS: NK tijdrit augustus
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Tempo intervallen 3x15min (ride, 90min, target TSS=95, status=planned)
TODAY'S READINESS: HRV=98ms, RestingHR=46bpm, Sleep=7.8h, SleepQuality=4/5, Fatigue=8/10, Feel=2/5, Notes="benen voelen zwaar en dood"
RECENT SESSIONS:
  - 2026-06-22 Endurance, 120min, NP=210W, AvgHR=138bpm, TSS=85, Feel=3/5
  - 2026-06-21 VO2max 5x4min, 75min, NP=295W, AvgP=288W, AvgHR=171bpm, TSS=98, Feel=2/5
  - 2026-06-19 Threshold 2x20min, 80min, NP=300W, AvgP=298W, AvgHR=168bpm, TSS=92, Feel=4/5
TRAINING LOAD (last 9 sessions): total TSS=690, sessions/week≈7
HRV TREND (oldest→newest): 92, 95, 90, 96, 99, 98
RESTING HR TREND (oldest→newest): 47, 46, 48, 46, 45, 46
SLEEP TREND h (oldest→newest): 7.5, 7.2, 8.0, 7.6, 7.8, 7.8
POWER DEVELOPMENT (FTP history, oldest→newest): 2026-02-10:312W, 2026-04-15:320W, 2026-06-01:320W
PRIOR OBSERVATIONS: Reageert historisch goed op een rustweek na 3 zware weken.`,
  },
  {
    name: "Lotte (2)",
    scenario: "Overreaching maskeren: stijgende belasting, dalend vermogen, hoge RHR, slechte slaap — voelt zich 'prima'",
    context: `TODAY: 2026-06-23
ATHLETE: Lotte Vega
PROFILE: FTP=245W, 3.92 W/kg, Weight=62.5kg, Discipline=road cycling
RIDER PROFILE: Age=23, CompetitionLevel=national, TrainingExperience=advanced, TrainingDays/wk=6, LoadCapacity=high, TypicalSleep=8h
SEASON GOALS: Selectie nationale ploeg
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Threshold 3x12min (ride, 80min, target TSS=90, status=planned)
TODAY'S READINESS: HRV=58ms, RestingHR=61bpm, Sleep=5.9h, SleepQuality=2/5, Fatigue=4/10, Feel=4/5, Notes="voel me eigenlijk prima, wil knallen"
RECENT SESSIONS:
  - 2026-06-22 Threshold 2x20min, 80min, NP=232W, AvgP=228W, AvgHR=176bpm, TSS=95, Feel=3/5
  - 2026-06-21 VO2max 6x3min, 70min, NP=240W, AvgHR=182bpm, TSS=88, Feel=3/5
  - 2026-06-20 Endurance, 150min, NP=180W, AvgHR=150bpm, TSS=100, Feel=4/5
  - 2026-06-19 Threshold 2x20min, 80min, NP=245W, AvgP=242W, AvgHR=178bpm, TSS=98, Feel=4/5
TRAINING LOAD (last 10 sessions): total TSS=910, sessions/week≈7
HRV TREND (oldest→newest): 72, 70, 68, 64, 60, 58
RESTING HR TREND (oldest→newest): 52, 53, 55, 58, 60, 61
SLEEP TREND h (oldest→newest): 7.8, 7.5, 7.0, 6.4, 6.1, 5.9
POWER DEVELOPMENT (FTP history, oldest→newest): 2026-03-01:240W, 2026-05-10:248W, 2026-06-15:245W`,
  },
  {
    name: "Sven (3)",
    scenario: "Patroongeheugen: hittegevoelig (eerdere observatie) + A-race met warm weer + nu goede gereedheid",
    context: `TODAY: 2026-06-23
ATHLETE: Sven Aerts
PROFILE: FTP=355W, 4.93 W/kg, Weight=72kg, Discipline=road cycling
RIDER PROFILE: Age=29, CompetitionLevel=elite, TrainingExperience=expert, TrainingDays/wk=6, LoadCapacity=high, TypicalSleep=8h
SEASON GOALS: Ronde van Vlaanderen amateurs winnen
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Race-simulatie 100min (ride, 100min, target TSS=110, status=planned)
TODAY'S READINESS: HRV=88ms, RestingHR=44bpm, Sleep=8.1h, SleepQuality=5/5, Fatigue=3/10, Feel=4/5
RECENT SESSIONS:
  - 2026-06-21 Endurance, 180min, NP=240W, AvgHR=142bpm, TSS=120, Feel=4/5
  - 2026-06-19 Threshold 3x15min, 95min, NP=330W, AvgP=326W, AvgHR=165bpm, TSS=105, Feel=4/5
HRV TREND (oldest→newest): 84, 86, 85, 87, 88, 88
RESTING HR TREND (oldest→newest): 45, 44, 45, 44, 44, 44
SLEEP TREND h (oldest→newest): 8.0, 7.9, 8.2, 8.0, 8.1, 8.1
RACE CALENDAR (upcoming):
  - 2026-06-27 (in 4d) Omloop Kempen [priority A], weatherNote="verwacht 31°C en zonnig"
PRIOR OBSERVATIONS: Presteert duidelijk slechter bij hitte; vermogen zakte ~8% in wedstrijden boven 28°C; hydratatie historisch te laag op warme dagen.`,
  },
  {
    name: "Mila (4)",
    scenario: "Ziekte-onzekerheid: verhoogde RHR + lage HRV + keelpijn-notitie, maar goede slaap — trainen of rusten?",
    context: `TODAY: 2026-06-23
ATHLETE: Mila Sterk
PROFILE: FTP=210W, 3.50 W/kg, Weight=60kg, Discipline=road cycling
RIDER PROFILE: Age=21, CompetitionLevel=regional, TrainingExperience=intermediate, TrainingDays/wk=5, LoadCapacity=moderate, TypicalSleep=8h
SEASON GOALS: Eerste seizoen criteriums
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: VO2max 5x4min (ride, 70min, target TSS=85, status=planned)
TODAY'S READINESS: HRV=41ms, RestingHR=63bpm, Sleep=8.3h, SleepQuality=4/5, Fatigue=5/10, Feel=3/5, Notes="lichte keelpijn sinds gisteravond, verder oké"
RECENT SESSIONS:
  - 2026-06-21 Endurance, 90min, NP=160W, AvgHR=140bpm, TSS=60, Feel=4/5
  - 2026-06-20 Tempo 2x20min, 75min, NP=190W, AvgHR=158bpm, TSS=70, Feel=4/5
HRV TREND (oldest→newest): 62, 60, 61, 59, 50, 41
RESTING HR TREND (oldest→newest): 52, 53, 52, 54, 58, 63
SLEEP TREND h (oldest→newest): 8.0, 8.1, 7.9, 8.2, 8.0, 8.3`,
  },
  {
    name: "Bram (5)",
    scenario: "Ontbrekende data: geen check-in, alleen plan + A-race over 3 dagen → moet vragen stellen",
    context: `TODAY: 2026-06-23
ATHLETE: Bram de Wit
PROFILE: FTP=290W, 4.00 W/kg, Weight=72.5kg, Discipline=road cycling
RIDER PROFILE: Age=34, CompetitionLevel=amateur, TrainingExperience=advanced, TrainingDays/wk=5, LoadCapacity=moderate, TypicalSleep=7h
SEASON GOALS: Top 10 districtskampioenschap
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Openingsrit met versnellingen (ride, 60min, target TSS=55, status=planned)
TODAY'S READINESS: No check-in logged yet
RECENT SESSIONS: No sessions logged yet
RACE CALENDAR (upcoming):
  - 2026-06-26 (in 3d) Districtskampioenschap [priority A]`,
  },
  {
    name: "Imke (6)",
    scenario: "Voeding/hydratatie alarm: maagklachten + lage koolhydraten in wedstrijd + gewichtsverlies → fueling vs fitheid",
    context: `TODAY: 2026-06-23
ATHLETE: Imke Boon
PROFILE: FTP=235W, 3.80 W/kg, Weight=61.8kg, Discipline=road cycling
RIDER PROFILE: Age=25, CompetitionLevel=national, TrainingExperience=advanced, TrainingDays/wk=6, LoadCapacity=high, TypicalSleep=7.5h
SEASON GOALS: Klassiekers podium
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Lange duurrit 3u met blokken (ride, 180min, target TSS=130, status=planned)
TODAY'S READINESS: HRV=70ms, RestingHR=50bpm, Sleep=7.6h, SleepQuality=4/5, Fatigue=6/10, Feel=2/5, Notes="laatste lange ritten val ik in het laatste uur helemaal stil"
RECENT SESSIONS:
  - 2026-06-21 Lange duurrit, 170min, NP=190W, AvgHR=148bpm, TSS=120, Feel=2/5
  - 2026-06-19 Threshold 2x20min, 80min, NP=232W, AvgHR=170bpm, TSS=92, Feel=4/5
HRV TREND (oldest→newest): 71, 70, 72, 69, 70, 70
RESTING HR TREND (oldest→newest): 49, 50, 50, 49, 50, 50
NUTRITION & HYDRATION (recent logs):
  - 2026-06-21 race_day, carbs=28g/h, fluid=400ml, stomachIssues=yes
  - 2026-06-19 normal_day, carbs=40g/h, fluid=600ml
POWER DEVELOPMENT (FTP history, oldest→newest): 2026-03-01:232W, 2026-05-10:235W, 2026-06-15:235W`,
  },
  {
    name: "Tijn (7)",
    scenario: "Jonge renner (16) snelle belastingstijging → leeftijd/trainingsleeftijd-voorzichtigheid; 'voelt geweldig'",
    context: `TODAY: 2026-06-23
ATHLETE: Tijn Bakker
PROFILE: FTP=255W, 4.25 W/kg, Weight=60kg, Discipline=road cycling
RIDER PROFILE: Age=16, CompetitionLevel=junior, TrainingExperience=beginner, TrainingDays/wk=6, LoadCapacity=low, TypicalSleep=8.5h
SEASON GOALS: Nationale junioren-competitie
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: VO2max 6x4min (ride, 75min, target TSS=90, status=planned)
TODAY'S READINESS: HRV=82ms, RestingHR=52bpm, Sleep=8.6h, SleepQuality=5/5, Fatigue=2/10, Feel=5/5, Notes="voel me geweldig, wil meer trainen!"
RECENT SESSIONS:
  - 2026-06-22 VO2max 5x4min, 70min, NP=240W, AvgHR=185bpm, TSS=88, Feel=5/5
  - 2026-06-21 Threshold 3x12min, 80min, NP=235W, AvgHR=178bpm, TSS=95, Feel=5/5
  - 2026-06-20 Endurance, 120min, NP=170W, AvgHR=150bpm, TSS=80, Feel=5/5
  - 2026-06-19 VO2max 6x3min, 70min, NP=242W, AvgHR=186bpm, TSS=90, Feel=4/5
TRAINING LOAD (last 10 sessions): total TSS=820, sessions/week≈7
HRV TREND (oldest→newest): 80, 81, 83, 82, 82, 82
RESTING HR TREND (oldest→newest): 51, 52, 51, 52, 52, 52`,
  },
  {
    name: "Geert (8)",
    scenario: "Masters (48) traag herstel: goed vermogen maar oplopende RHR-trend",
    context: `TODAY: 2026-06-23
ATHLETE: Geert Pol
PROFILE: FTP=300W, 3.85 W/kg, Weight=78kg, Discipline=road cycling
RIDER PROFILE: Age=48, CompetitionLevel=amateur masters, TrainingExperience=expert, TrainingDays/wk=5, LoadCapacity=moderate, TypicalSleep=7h
SEASON GOALS: Granfondo onder 5 uur
HEALTH & CONSTRAINTS: Status=ok, InjuryHistory=lage rugklachten bij lange blokken
TODAY'S PLANNED WORKOUT: Threshold 3x15min (ride, 95min, target TSS=100, status=planned)
TODAY'S READINESS: HRV=64ms, RestingHR=56bpm, Sleep=6.4h, SleepQuality=3/5, Fatigue=6/10, Feel=3/5
RECENT SESSIONS:
  - 2026-06-22 Threshold 2x20min, 85min, NP=285W, AvgP=282W, AvgHR=158bpm, TSS=95, Feel=3/5
  - 2026-06-21 Endurance, 150min, NP=215W, AvgHR=138bpm, TSS=100, Feel=4/5
  - 2026-06-20 VO2max 5x4min, 70min, NP=300W, AvgHR=165bpm, TSS=90, Feel=3/5
TRAINING LOAD (last 9 sessions): total TSS=720, sessions/week≈7
HRV TREND (oldest→newest): 70, 68, 67, 66, 65, 64
RESTING HR TREND (oldest→newest): 49, 50, 52, 53, 55, 56
SLEEP TREND h (oldest→newest): 7.0, 6.8, 6.5, 6.6, 6.3, 6.4
POWER DEVELOPMENT (FTP history, oldest→newest): 2026-02-01:295W, 2026-04-20:300W, 2026-06-10:300W`,
  },
  {
    name: "Nora (9)",
    scenario: "Taper voor A-race (2 dagen): lage recente TSS, goede HRV, lichte nervositeit-notitie → geruststellen, licht",
    context: `TODAY: 2026-06-23
ATHLETE: Nora Vink
PROFILE: FTP=260W, 4.13 W/kg, Weight=63kg, Discipline=road cycling
RIDER PROFILE: Age=26, CompetitionLevel=national, TrainingExperience=advanced, TrainingDays/wk=6, LoadCapacity=high, TypicalSleep=8h
SEASON GOALS: NK criterium top 5
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Activatie met 3x2min op wedstrijdtempo (ride, 50min, target TSS=40, status=planned)
TODAY'S READINESS: HRV=86ms, RestingHR=45bpm, Sleep=7.4h, SleepQuality=3/5, Fatigue=3/10, Feel=4/5, Notes="benen voelen een beetje loom van het rustige rijden, en ik ben zenuwachtig voor zondag"
RECENT SESSIONS:
  - 2026-06-22 Endurance rustig, 60min, NP=160W, AvgHR=125bpm, TSS=35, Feel=4/5
  - 2026-06-21 Activatie, 45min, NP=180W, AvgHR=135bpm, TSS=30, Feel=4/5
  - 2026-06-19 Threshold 2x20min, 80min, NP=255W, AvgHR=172bpm, TSS=92, Feel=4/5
HRV TREND (oldest→newest): 78, 80, 82, 84, 85, 86
RESTING HR TREND (oldest→newest): 47, 46, 46, 45, 45, 45
RACE CALENDAR (upcoming):
  - 2026-06-25 (in 2d) NK criterium [priority A]`,
  },
  {
    name: "Pepijn (10)",
    scenario: "Plateau: FTP al maanden stabiel, consistente belasting, goed herstel → prikkel veranderen; geen acuut probleem",
    context: `TODAY: 2026-06-23
ATHLETE: Pepijn Roos
PROFILE: FTP=280W, 3.89 W/kg, Weight=72kg, Discipline=road cycling
RIDER PROFILE: Age=31, CompetitionLevel=amateur, TrainingExperience=advanced, TrainingDays/wk=5, LoadCapacity=moderate, TypicalSleep=7.5h
SEASON GOALS: FTP naar 300W
HEALTH & CONSTRAINTS: Status=ok
TODAY'S PLANNED WORKOUT: Sweet spot 3x15min (ride, 80min, target TSS=85, status=planned)
TODAY'S READINESS: HRV=76ms, RestingHR=48bpm, Sleep=7.6h, SleepQuality=4/5, Fatigue=3/10, Feel=4/5
RECENT SESSIONS:
  - 2026-06-22 Sweet spot 3x15min, 80min, NP=255W, AvgP=252W, AvgHR=158bpm, TSS=85, Feel=4/5
  - 2026-06-20 Sweet spot 3x15min, 80min, NP=254W, AvgHR=159bpm, TSS=85, Feel=4/5
  - 2026-06-18 Sweet spot 2x20min, 80min, NP=256W, AvgHR=160bpm, TSS=88, Feel=4/5
TRAINING LOAD (last 8 sessions): total TSS=640, sessions/week≈6
HRV TREND (oldest→newest): 75, 76, 75, 77, 76, 76
RESTING HR TREND (oldest→newest): 48, 48, 49, 48, 48, 48
POWER DEVELOPMENT (FTP history, oldest→newest): 2026-01-15:278W, 2026-03-15:280W, 2026-05-15:280W, 2026-06-15:280W`,
  },
];

const HEDGES = ["waarschijnlijk", "mogelijk", "lijkt erop", "vermoedelijk", "wellicht", "lijkt", "zou kunnen", "denk", "vermoed"];
const ABSOLUTES = ["zeker betekent", "betekent zeker", "gegarandeerd", "altijd", "nooit ", "definitief", "honderd procent", "100%"];
const ENGLISH = [" the ", " your ", " you ", "load", "recovery", "readiness", "fatigue", "rest day", "training"];

async function run() {
  console.log("==== SPARKI CONTEXT ENGINE V2 — 10-SPORTER VALIDATIE ====\n");
  for (const a of athletes) {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SPARKI_SYSTEM,
      messages: [{ role: "user", content: briefInstruction(a.context) }],
    });
    const block = msg.content[0];
    const text = block && block.type === "text" ? block.text : "(geen tekst)";
    const low = text.toLowerCase();
    const checks = {
      vraagModus: text.includes("?"),
      gekalibreerd: HEDGES.some((h) => low.includes(h)),
      geenAbsoluut: !ABSOLUTES.some((x) => low.includes(x)),
      geenAI: !/\bai\b/i.test(text),
      geenMarkdown: !/[*#•\-]\s/.test(text) && !text.includes("**"),
      multiSignaal:
        [/hrv/i, /rust/i, /slaap/i, /vermogen|watt|ftp|tss/i, /gevoel|vermoeid/i].filter((r) => r.test(text)).length >= 2,
    };
    console.log("────────────────────────────────────────────────────────");
    console.log(`#${a.name} — ${a.scenario}`);
    console.log("ANTWOORD:\n" + text);
    console.log("CHECKS: " + JSON.stringify(checks));
    console.log("");
  }
  console.log("==== EINDE ====");
}

run().catch((e) => {
  console.error("TEST FAILED", e);
  process.exit(1);
});
