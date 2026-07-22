// Deterministische voedings- en hydratatie-engine voor één inspanning.
//
// Dit is de rekenkern achter het voedingsplan: eerlijke, conservatieve
// bandbreedtes op basis van wat ECHT bekend is (duur, intensiteit, gewicht,
// temperatuur, leeftijdstier). Ontbreekt een gegeven, dan wordt de betreffende
// richtwaarde weggelaten en als "ontbreekt" benoemd — er wordt nooit een getal
// verzonnen. Jeugd (<16) krijgt bewust GEEN gram- of calorie-doelen (RED-S).
//
// Soorten regels — het onderscheid is onderdeel van het contract:
//   richtwaarde      = berekende bandbreedte uit duur/intensiteit/gewicht/weer
//   voorkeur         = gebaseerd op eigen producten/voorkeuren van de sporter
//   coachinstructie  = letterlijke instructie van de coach; altijd leidend
//   ontbreekt        = eerlijk gat: welk gegeven mist en wat dat betekent

export type FuelItemKind = "richtwaarde" | "voorkeur" | "coachinstructie" | "ontbreekt";

export type FuelItem = {
  kind: FuelItemKind;
  text: string;
};

export type FuelRange = { min: number; max: number };

export type SessionFuelInput = {
  /** Geplande duur in minuten; null = onbekend. */
  durationMin: number | null;
  /** Wedstrijd of training. */
  isRace: boolean;
  /** Ruwe intensiteitsindicatie: doel-belastingsscore (TSS) indien bekend. */
  targetTss: number | null;
  /** Verwachte maximumtemperatuur (°C) thuis/op locatie; null = onbekend. */
  tempC: number | null;
  /** Gewicht in kg; null = onbekend. */
  weightKg: number | null;
  /** Jeugdsporter (<16): alleen lichte gewoonte-adviezen, geen getallen. */
  isYouth: boolean;
  /** Vormbalans (TSB); sterk negatief = vermoeid ⇒ extra herstelnadruk. */
  tsb: number | null;
  /** Eigen beschikbare producten (alleen mét toestemming meegegeven). */
  availableProducts: string | null;
  /** Allergieën/intoleranties in eigen woorden (alleen mét toestemming). */
  allergies: string | null;
  /** Eigen maag-darmervaringen (alleen mét toestemming). */
  gutExperiences: string | null;
  /** Letterlijke coachinstructie(s) rond voeding; null = geen. */
  coachInstructions: string[];
};

export type SessionFuelTargets = {
  level: "youth" | "adult";
  durationMin: number | null;
  /** Koolhydraten per uur tijdens; null = niet nodig of niet te bepalen. */
  carbsPerHourG: FuelRange | null;
  /** Vocht per uur tijdens. */
  fluidPerHourMl: FuelRange | null;
  /** Natrium per uur; alleen bij warmte/lange duur. */
  sodiumPerHourMg: FuelRange | null;
  /** Koolhydraten vooraf (1–3 u voor de start); vereist gewicht. */
  preCarbsG: FuelRange | null;
  /** Herstel: koolhydraten direct na; vereist gewicht. */
  recoveryCarbsG: FuelRange | null;
  /** Herstel: eiwit direct na; vereist gewicht. */
  recoveryProteinG: FuelRange | null;
  /** Warm-weer-signaal (temp ≥ 25 °C). */
  heatWarning: boolean;
  items: FuelItem[];
  gaps: string[];
};

const HEAT_THRESHOLD_C = 25;
const LONG_MIN = 150;
const SHORT_MIN = 75;

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function computeSessionFuelTargets(input: SessionFuelInput): SessionFuelTargets {
  const items: FuelItem[] = [];
  const gaps: string[] = [];

  // Coachinstructies eerst en letterlijk — die zijn leidend, Sparki vervangt
  // ze nooit stilzwijgend.
  for (const instr of input.coachInstructions) {
    const t = instr.trim();
    if (t) items.push({ kind: "coachinstructie", text: t });
  }

  if (input.isYouth) {
    // Jeugd: licht en positief, geen getallen, geen gewichtsdruk.
    items.push(
      { kind: "richtwaarde", text: "Eet op tijd een gewone maaltijd voor je vertrekt en neem een gevulde bidon mee." },
      { kind: "richtwaarde", text: "Duurt de rit lang? Neem iets kleins mee voor onderweg, zoals een banaan of een boterham." },
      { kind: "richtwaarde", text: "Eet na afloop gewoon met de rest mee — eten is brandstof én plezier." },
    );
    if (input.tempC != null && input.tempC >= HEAT_THRESHOLD_C) {
      items.push({ kind: "richtwaarde", text: `Het wordt warm (~${Math.round(input.tempC)} °C): drink vaker een slok en zoek onderweg schaduw voor een pauze.` });
    }
    return {
      level: "youth",
      durationMin: input.durationMin,
      carbsPerHourG: null,
      fluidPerHourMl: null,
      sodiumPerHourMg: null,
      preCarbsG: null,
      recoveryCarbsG: null,
      recoveryProteinG: null,
      heatWarning: input.tempC != null && input.tempC >= HEAT_THRESHOLD_C,
      items,
      gaps,
    };
  }

  const dur = input.durationMin;
  const hot = input.tempC != null && input.tempC >= HEAT_THRESHOLD_C;
  const intense = input.isRace || (input.targetTss != null && dur != null && dur > 0 && (input.targetTss / (dur / 60)) >= 70);

  // Koolhydraten tijdens — puur uit duur + intensiteit.
  let carbsPerHourG: FuelRange | null = null;
  if (dur == null) {
    gaps.push("De geplande duur is onbekend, dus koolhydraten per uur zijn niet te berekenen.");
    items.push({ kind: "ontbreekt", text: "Zonder geplande duur kan er geen koolhydraatrichtwaarde per uur worden berekend. Vul de duur van de training in." });
  } else if (dur < SHORT_MIN && !input.isRace) {
    items.push({ kind: "richtwaarde", text: `Korter dan ${SHORT_MIN} minuten: extra koolhydraten tijdens de rit zijn meestal niet nodig. Een gevulde bidon volstaat.` });
  } else {
    if (dur > LONG_MIN) carbsPerHourG = { min: 60, max: 90 };
    else carbsPerHourG = intense ? { min: 45, max: 60 } : { min: 30, max: 60 };
    items.push({
      kind: "richtwaarde",
      text: `Richtwaarde tijdens: ${carbsPerHourG.min}–${carbsPerHourG.max} g koolhydraten per uur${input.isRace ? " (wedstrijd: houd de bovenkant van de bandbreedte aan en oefen dit vooraf in training)" : ""}.`,
    });
  }

  // Vocht per uur — basis + warmte.
  let fluidPerHourMl: FuelRange = hot ? { min: 750, max: 1000 } : { min: 400, max: 750 };
  if (input.tempC == null) {
    gaps.push("De temperatuur is onbekend; de vochtrichtwaarde is de standaardbandbreedte.");
  }
  items.push({
    kind: "richtwaarde",
    text: hot
      ? `Warm weer (~${Math.round(input.tempC!)} °C): drink ${fluidPerHourMl.min}–${fluidPerHourMl.max} ml per uur en begin de rit goed gehydrateerd. Uitdroging bouw je sneller op dan je merkt.`
      : `Richtwaarde vocht: ${fluidPerHourMl.min}–${fluidPerHourMl.max} ml per uur, afhankelijk van temperatuur en zweetverlies.`,
  });

  // Natrium — alleen relevant bij warmte of lange duur.
  let sodiumPerHourMg: FuelRange | null = null;
  if (hot || (dur != null && dur > LONG_MIN)) {
    sodiumPerHourMg = { min: 300, max: 600 };
    items.push({ kind: "richtwaarde", text: `Neem bij ${hot ? "warmte" : "lange ritten"} ${sodiumPerHourMg.min}–${sodiumPerHourMg.max} mg natrium per uur mee (elektrolytendrank of -tablet).` });
  }

  // Vooraf en herstel — vereisen gewicht.
  let preCarbsG: FuelRange | null = null;
  let recoveryCarbsG: FuelRange | null = null;
  let recoveryProteinG: FuelRange | null = null;
  if (input.weightKg != null && input.weightKg > 0) {
    const w = input.weightKg;
    preCarbsG = { min: round5(w * 1), max: round5(w * 2) };
    items.push({ kind: "richtwaarde", text: `Vooraf (1 tot 3 uur voor de start): ${preCarbsG.min}–${preCarbsG.max} g koolhydraten als onderdeel van een gewone maaltijd.` });
    if (dur == null || dur >= SHORT_MIN || input.isRace) {
      recoveryCarbsG = { min: round5(w * 1), max: round5(w * 1.2) };
      recoveryProteinG = { min: Math.round(w * 0.25), max: Math.round(w * 0.4) };
      items.push({ kind: "richtwaarde", text: `Direct erna (binnen 30–60 min): ${recoveryCarbsG.min}–${recoveryCarbsG.max} g koolhydraten en ${recoveryProteinG.min}–${recoveryProteinG.max} g eiwit voor het herstel.` });
    }
  } else {
    gaps.push("Je gewicht is onbekend, dus richtwaarden vooraf en voor herstel (per kg lichaamsgewicht) zijn niet te berekenen.");
    items.push({ kind: "ontbreekt", text: "Zonder gewicht kunnen de richtwaarden vooraf en voor herstel niet per kg worden berekend. Vul je gewicht in bij je profiel." });
  }

  // Herstelstatus: sterk vermoeid ⇒ herstelnadruk (geen calorietekort).
  if (input.tsb != null && input.tsb <= -20) {
    items.push({ kind: "richtwaarde", text: "Je vormbalans staat diep negatief: eet vandaag ruim en volwaardig. Dit is geen dag voor minder eten — herstel gaat voor." });
  }

  // Eigen producten en ervaringen — alleen aanwezig als er toestemming is
  // (de aanroeper geeft deze velden anders niet mee).
  if (input.availableProducts?.trim()) {
    items.push({ kind: "voorkeur", text: `Gebruik wat je zelf in huis hebt: ${input.availableProducts.trim()}. Reken globaal: een gel ≈ 25 g, een banaan ≈ 25 g, een reep ≈ 40 g, een bidon sportdrank ≈ 30–40 g koolhydraten.` });
  } else {
    items.push({ kind: "richtwaarde", text: "Voorbeelden om aan de richtwaarde te komen: een gel ≈ 25 g, een banaan ≈ 25 g, een reep ≈ 40 g, een bidon sportdrank ≈ 30–40 g koolhydraten." });
  }
  if (input.allergies?.trim()) {
    items.push({ kind: "voorkeur", text: `Let op je allergieën/intoleranties (${input.allergies.trim()}): kies producten die daarbij passen.` });
  }
  if (input.gutExperiences?.trim()) {
    items.push({ kind: "voorkeur", text: `Jouw maag-darmervaring: ${input.gutExperiences.trim()}. Houd daar rekening mee — test nieuwe producten in training, nooit in een wedstrijd.` });
  }

  return {
    level: "adult",
    durationMin: dur,
    carbsPerHourG,
    fluidPerHourMl,
    sodiumPerHourMg,
    preCarbsG,
    recoveryCarbsG,
    recoveryProteinG,
    heatWarning: hot,
    items,
    gaps,
  };
}

// ── Gepland vs. geregistreerd ────────────────────────────────────────────────
// Deterministische vergelijking van richtwaarden met wat de sporter echt heeft
// geregistreerd. Alle logs van dezelfde dag+context worden éénmalig opgeteld;
// er wordt nooit een causale of medische conclusie getrokken.

export type FuelComparison = {
  carbs: { plannedPerHourG: FuelRange | null; loggedTotalG: number | null; verdict: string } | null;
  fluid: { plannedPerHourMl: FuelRange | null; loggedTotalMl: number | null; verdict: string } | null;
  energyFeel: number | null;
  stomachIssues: boolean;
  notes: string[];
};

export function compareFuelPlanToLogs(
  targets: SessionFuelTargets,
  logs: Array<{
    duringTrainingCarbsGrams: number | null;
    duringTrainingFluidMl: number | null;
    energyFeel: number | null;
    stomachIssues: boolean;
  }>,
  actualDurationMin: number | null,
): FuelComparison {
  const loggedCarbs = logs.reduce<number | null>(
    (acc, l) => (l.duringTrainingCarbsGrams == null ? acc : (acc ?? 0) + l.duringTrainingCarbsGrams),
    null,
  );
  const loggedFluid = logs.reduce<number | null>(
    (acc, l) => (l.duringTrainingFluidMl == null ? acc : (acc ?? 0) + l.duringTrainingFluidMl),
    null,
  );
  const energyFeel = logs.map((l) => l.energyFeel).find((v) => v != null) ?? null;
  const stomachIssues = logs.some((l) => l.stomachIssues);
  const notes: string[] = [];

  const dur = actualDurationMin ?? targets.durationMin;
  const hours = dur != null && dur > 0 ? dur / 60 : null;

  let carbs: FuelComparison["carbs"] = null;
  if (targets.carbsPerHourG) {
    let verdict: string;
    if (loggedCarbs == null) {
      verdict = "Er is geen koolhydraatinname geregistreerd, dus vergelijken kan niet.";
    } else if (hours == null) {
      verdict = `Je registreerde ${loggedCarbs} g in totaal; zonder duur is de inname per uur niet te bepalen.`;
    } else {
      const perHour = Math.round(loggedCarbs / hours);
      if (perHour < targets.carbsPerHourG.min) verdict = `Je zat rond ${perHour} g per uur — onder de richtwaarde van ${targets.carbsPerHourG.min}–${targets.carbsPerHourG.max} g.`;
      else if (perHour > targets.carbsPerHourG.max) verdict = `Je zat rond ${perHour} g per uur — boven de richtwaarde van ${targets.carbsPerHourG.min}–${targets.carbsPerHourG.max} g.`;
      else verdict = `Je zat rond ${perHour} g per uur — binnen de richtwaarde van ${targets.carbsPerHourG.min}–${targets.carbsPerHourG.max} g.`;
    }
    carbs = { plannedPerHourG: targets.carbsPerHourG, loggedTotalG: loggedCarbs, verdict };
  }

  let fluid: FuelComparison["fluid"] = null;
  if (targets.fluidPerHourMl) {
    let verdict: string;
    if (loggedFluid == null) {
      verdict = "Er is geen vochtinname geregistreerd, dus vergelijken kan niet.";
    } else if (hours == null) {
      verdict = `Je registreerde ${loggedFluid} ml in totaal; zonder duur is de inname per uur niet te bepalen.`;
    } else {
      const perHour = Math.round(loggedFluid / hours);
      if (perHour < targets.fluidPerHourMl.min) verdict = `Je dronk rond ${perHour} ml per uur — onder de richtwaarde van ${targets.fluidPerHourMl.min}–${targets.fluidPerHourMl.max} ml.`;
      else verdict = `Je dronk rond ${perHour} ml per uur — binnen of boven de richtwaarde van ${targets.fluidPerHourMl.min}–${targets.fluidPerHourMl.max} ml.`;
    }
    fluid = { plannedPerHourMl: targets.fluidPerHourMl, loggedTotalMl: loggedFluid, verdict };
  }

  if (stomachIssues) {
    notes.push(
      "Je meldde maag-darmklachten. Dat kán met voeding, timing of intensiteit te maken hebben — een oorzaak is hieruit niet vast te stellen. Komt dit vaker terug, bespreek het dan met je ouder, coach of een (sport)arts/diëtist.",
    );
  }
  if (energyFeel != null && energyFeel <= 2 && carbs?.loggedTotalG != null && targets.carbsPerHourG && hours != null) {
    const perHour = Math.round(carbs.loggedTotalG / hours);
    if (perHour < targets.carbsPerHourG.min) {
      notes.push("Je energiegevoel was laag én je inname lag onder de richtwaarde. Dat kan samenhangen, maar hoeft niet — probeer bij een vergelijkbare rit dichter bij de richtwaarde te komen en kijk of het verschil maakt.");
    }
  }

  return { carbs, fluid, energyFeel, stomachIssues, notes };
}
