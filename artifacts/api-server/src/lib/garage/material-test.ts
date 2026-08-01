// Vergelijkingstest-engine — modelschatting vooraf + eerlijke rit-vergelijking.
//
// HONESTY CONTRACT:
// - De "modelschatting vooraf" is een klasse-vergelijking uit de kennisbank
//   (instap/amateur/elite/pro + aero/gewicht-richting). Het is expliciet een
//   MODELSCHATTING, geen meting: nooit verzonnen watts of seconden. Onbekende
//   onderdelen krijgen eerlijk "geen schatting mogelijk".
// - De rit-vergelijking zet uitsluitend ECHTE metingen van twee ritten naast
//   elkaar (tijd, afstand, snelheid, vermogen, hartslag). Sparki trekt alleen
//   een conclusie als de omstandigheden dat toelaten; anders benoemt hij de
//   vertroebelende factoren en zegt hij dat eerlijk.
// - Harde spelregel voor een zinvolle test: dezelfde dag, dezelfde route,
//   gelijke omstandigheden (wind, temperatuur, vorm van de dag).

import type { TrainingSession } from "@workspace/db";
import {
  assessComponent,
  CLASS_RANK,
  CLASS_LABEL,
  type ComponentAssessment,
} from "./knowledge-base";

// ── Testmodus-voorstel ──────────────────────────────────────────────────────

export type TestMode = {
  key: "vlak-constant" | "klim" | "vlak-duur" | "beperkt-meetbaar";
  title: string;
  // Plain-Dutch protocol: wat rijd je, waar let je op, wat vergelijk je.
  protocol: string;
  // Welke echte meting het verschil laat zien.
  meting: string;
};

const TEST_MODES: Record<TestMode["key"], TestMode> = {
  "vlak-constant": {
    key: "vlak-constant",
    title: "Vlakke test op constant vermogen",
    protocol:
      "Kies een vlak, rustig rondje van 10–20 km zonder stoplichten. Rijd het twee keer op dezelfde dag: eerst met je huidige opstelling, daarna met de nieuwe. Houd je vermogen zo gelijk mogelijk (vermogensmeter) en blijf in dezelfde houding.",
    meting:
      "Bij gelijk vermogen laat het snelheidsverschil het aero-effect zien.",
  },
  klim: {
    key: "klim",
    title: "Klimtest op dezelfde helling",
    protocol:
      "Kies één klim of brug en rijd hem twee keer op dezelfde dag: eerst met je huidige opstelling, daarna met de nieuwe. Start beide keren uitgerust en rijd op een vast vermogen of vaste hartslag.",
    meting:
      "Bij gelijk vermogen laat het tijdsverschil op de klim het gewichtseffect zien.",
  },
  "vlak-duur": {
    key: "vlak-duur",
    title: "Vlakke test op vaste snelheid",
    protocol:
      "Kies een vlak, rustig rondje van 10–20 km. Rijd het twee keer op dezelfde dag op precies dezelfde snelheid: eerst met je huidige opstelling, daarna met de nieuwe.",
    meting:
      "Bij gelijke snelheid laat het vermogensverschil de rolweerstandswinst zien.",
  },
  "beperkt-meetbaar": {
    key: "beperkt-meetbaar",
    title: "Beperkt meetbaar in een rittest",
    protocol:
      "Het verschil van dit onderdeel is in een rit-vergelijking nauwelijks betrouwbaar te meten — het effect valt weg in normale variatie tussen twee ritten.",
    meting:
      "Verwacht hier geen meetbaar getal; beoordeel dit onderdeel op gevoel, betrouwbaarheid en comfort.",
  },
};

// Deterministische keuze van de best passende testmodus voor een upgrade.
// Alleen op basis van categorie + kennisbank-richting (aero/gewicht) van het
// geplande onderdeel — nooit een gokje op onbekende data.
export function proposeTestMode(
  category: string,
  planned: { aero: string | null; gewicht: string | null },
): TestMode {
  const aeroDriven =
    category === "helm" ||
    category === "kleding" ||
    category === "cockpit" ||
    (category === "wielen" && planned.aero === "hoog");
  if (aeroDriven) return TEST_MODES["vlak-constant"];
  if (category === "banden") return TEST_MODES["vlak-duur"];
  const weightDriven =
    planned.gewicht === "licht" &&
    (category === "wielen" || category === "groepset" || category === "crankstel");
  if (weightDriven) return TEST_MODES.klim;
  if (category === "wielen") return TEST_MODES["vlak-constant"];
  return TEST_MODES["beperkt-meetbaar"];
}

// ── Modelschatting vooraf ───────────────────────────────────────────────────

export const SAME_DAY_RULE =
  "Een vergelijkingstest is alleen zinvol op dezelfde dag, op dezelfde route en bij gelijke omstandigheden (wind, temperatuur, vorm van de dag). Twee ritten op verschillende dagen vergelijken vooral het weer en je benen — niet je materiaal.";

export type UpgradeEstimate =
  | {
      known: true;
      // Expliciet label voor de UI — dit is een schatting op klasse-niveau.
      label: "modelschatting";
      planned: {
        brand: string;
        model: string;
        klasse: string;
        klasseLabel: string;
        aero: string | null;
        gewicht: string | null;
        note: string;
      };
      current: {
        brand: string | null;
        model: string | null;
        klasseLabel: string | null;
        known: boolean;
      } | null;
      // Klasse-stappen tussen huidig en gepland (null zonder bekend huidig deel).
      klasseStappen: number | null;
      // Richting van de verwachte winst in plain Dutch — nooit een getal.
      verwachting: string;
      testMode: TestMode;
      sameDayRule: string;
    }
  | { known: false; reason: string };

export function estimateUpgrade(
  category: string,
  plannedBrand: string | null,
  plannedModel: string | null,
  current: { brand: string | null; model: string | null } | null,
): UpgradeEstimate {
  const planned = assessComponent(category, plannedBrand, plannedModel);
  if (!planned.known) {
    return {
      known: false,
      reason:
        "Dit merk en type staan nog niet in de kennisbank — er kan geen schatting van gemaakt worden. De vergelijkingstest met twee echte ritten werkt wél gewoon.",
    };
  }

  const currentAssessment: ComponentAssessment | null = current
    ? assessComponent(category, current.brand, current.model)
    : null;

  let klasseStappen: number | null = null;
  let verwachting: string;
  if (currentAssessment?.known) {
    klasseStappen =
      CLASS_RANK[planned.entry.klasse] - CLASS_RANK[currentAssessment.entry.klasse];
    if (klasseStappen >= 2) {
      verwachting =
        "Grote stap in klasse — dit verschil zou in een goede test meetbaar moeten zijn.";
    } else if (klasseStappen === 1) {
      verwachting =
        "Eén klasse hoger — een merkbaar maar bescheiden verschil; test zorgvuldig.";
    } else if (klasseStappen === 0) {
      verwachting =
        "Zelfde klasse als je huidige onderdeel — verwacht geen meetbaar verschil in een rittest.";
    } else {
      verwachting =
        "Dit onderdeel zit in een lágere klasse dan wat je nu hebt — een prestatiewinst is niet te verwachten.";
    }
  } else {
    verwachting =
      "Je huidige onderdeel is niet bekend in de kennisbank, dus de grootte van de stap is niet in te schatten. De rit-vergelijking meet het echte verschil.";
  }

  return {
    known: true,
    label: "modelschatting",
    planned: {
      brand: planned.entry.brand,
      model: planned.entry.model,
      klasse: planned.entry.klasse,
      klasseLabel: planned.entry.klasseLabel,
      aero: planned.entry.aero,
      gewicht: planned.entry.gewicht,
      note: planned.entry.note,
    },
    current: current
      ? {
          brand: current.brand,
          model: current.model,
          klasseLabel: currentAssessment?.known
            ? CLASS_LABEL[currentAssessment.entry.klasse]
            : null,
          known: currentAssessment?.known === true,
        }
      : null,
    klasseStappen,
    verwachting,
    testMode: proposeTestMode(category, {
      aero: planned.entry.aero,
      gewicht: planned.entry.gewicht,
    }),
    sameDayRule: SAME_DAY_RULE,
  };
}

// ── Rit-vergelijking ────────────────────────────────────────────────────────

type SessionLike = Pick<
  TrainingSession,
  | "id"
  | "sessionDate"
  | "title"
  | "sport"
  | "durationMin"
  | "distanceKm"
  | "elevationM"
  | "avgPower"
  | "normalizedPower"
  | "avgHR"
  | "avgSpeedKph"
>;

export type RideMetric = {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  // b − a, alleen wanneer beide echt gemeten zijn.
  delta: number | null;
  unit: string;
};

export type RideComparison = {
  a: { id: number; date: string; title: string | null };
  b: { id: number; date: string; title: string | null };
  metrics: RideMetric[];
  // Eerlijke kanttekeningen die de vergelijking vertroebelen.
  warnings: string[];
  // Alleen een duiding wanneer de test schoon genoeg is; anders null met
  // uitleg in warnings — nooit een conclusie die de data niet draagt.
  verdict: string | null;
  sameDayRule: string;
};

const num = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function compareTestRides(a: SessionLike, b: SessionLike): RideComparison {
  const metric = (
    key: string,
    label: string,
    va: number | null,
    vb: number | null,
    unit: string,
  ): RideMetric => ({
    key,
    label,
    a: va,
    b: vb,
    delta: va != null && vb != null ? Math.round((vb - va) * 100) / 100 : null,
    unit,
  });

  const distA = num(a.distanceKm);
  const distB = num(b.distanceKm);
  const speedA = num(a.avgSpeedKph);
  const speedB = num(b.avgSpeedKph);

  const metrics: RideMetric[] = [
    metric("duur", "Duur", a.durationMin, b.durationMin, "min"),
    metric("afstand", "Afstand", distA, distB, "km"),
    metric("snelheid", "Gem. snelheid", speedA, speedB, "km/u"),
    metric("vermogen", "Gem. vermogen", a.avgPower, b.avgPower, "W"),
    metric("np", "Genormaliseerd vermogen", a.normalizedPower, b.normalizedPower, "W"),
    metric("hartslag", "Gem. hartslag", a.avgHR, b.avgHR, "spm"),
    metric("hoogte", "Hoogtemeters", a.elevationM, b.elevationM, "m"),
  ];

  const warnings: string[] = [];
  // sessionDate is een kale datum (YYYY-MM-DD) — directe stringvergelijking is
  // hier veilig en omzeilt de UTC-valkuil van Date-parsing.
  const sameDay = a.sessionDate === b.sessionDate;
  if (!sameDay) {
    warnings.push(
      "De ritten zijn op verschillende dagen gereden — wind, temperatuur en je vorm van de dag verschillen dan vrijwel zeker. " +
        SAME_DAY_RULE,
    );
  }
  if (a.sport !== b.sport) {
    warnings.push("De ritten zijn verschillende sporten — deze vergelijking zegt niets over materiaal.");
  }
  if (distA != null && distB != null && distA > 0 && distB > 0) {
    const drift = Math.abs(distA - distB) / Math.max(distA, distB);
    if (drift > 0.05) {
      warnings.push(
        "De afstanden verschillen meer dan 5% — waarschijnlijk is dit niet dezelfde route, en dan vergelijk je routes in plaats van materiaal.",
      );
    }
  } else {
    warnings.push("Van minstens één rit is geen afstand bekend — routegelijkheid is niet te controleren.");
  }
  const hasPower = a.avgPower != null && b.avgPower != null;
  if (!hasPower) {
    warnings.push(
      "Zonder vermogensmeter op beide ritten is alleen tijd en snelheid te vergelijken — het watt-verschil bij gelijke snelheid blijft dan onbekend.",
    );
  }
  const elevA = a.elevationM;
  const elevB = b.elevationM;
  if (elevA != null && elevB != null && Math.abs(elevA - elevB) > Math.max(30, 0.15 * Math.max(elevA, elevB))) {
    warnings.push("De hoogtemeters verschillen duidelijk — het parcours was waarschijnlijk niet gelijk.");
  }

  // Harde gating: een duiding komt er ALLEEN bij een volledig schone test —
  // geen enkele kanttekening (zelfde dag, zelfde sport, gelijke afstand,
  // vergelijkbare hoogtemeters, vermogen op beide ritten) én snelheid gemeten.
  // Elke vertroebelende factor ⇒ verdict null; de kanttekeningen leggen uit
  // waarom er geen conclusie is.
  let verdict: string | null = null;
  const cleanTest = warnings.length === 0 && hasPower;
  if (cleanTest && speedA != null && speedB != null) {
    const dSpeed = Math.round((speedB - speedA) * 10) / 10;
    const dPower = (b.avgPower as number) - (a.avgPower as number);
    verdict =
      `Schone test: rit B was ${dSpeed >= 0 ? `${dSpeed} km/u sneller` : `${Math.abs(dSpeed)} km/u langzamer`} ` +
      `bij ${dPower >= 0 ? `${dPower} W meer` : `${Math.abs(dPower)} W minder`} gemiddeld vermogen. ` +
      "Sneller bij gelijk of lager vermogen wijst op echte materiaalwinst.";
  }

  return {
    a: { id: a.id, date: a.sessionDate, title: a.title },
    b: { id: b.id, date: b.sessionDate, title: b.title },
    metrics,
    warnings,
    verdict,
    sameDayRule: SAME_DAY_RULE,
  };
}
