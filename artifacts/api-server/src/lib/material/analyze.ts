import { aiMessage, UPLOAD_DATA_RULE } from "../ai/gateway";
import type {
  MaterialAdvice,
  MaterialCostEstimate,
  MaterialConfidenceLevel,
} from "@workspace/db";

// ── Category registry ────────────────────────────────────────────────────────
// The Materiaalcoach only ever asks relevant material/nutrition questions — never
// a mandatory form, and never during onboarding. Each category carries the Dutch
// label, the photo prompt Sparki shows, and whether a cost estimate applies
// (material cases get cost; nutrition cases get advice only).

export type MaterialKind = "material" | "nutrition";

export type MaterialCategory = {
  key: string;
  label: string;
  prompt: string;
  kind: MaterialKind;
};

export const MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  {
    key: "wheelset",
    label: "Wielset",
    prompt: "Laat je wielset of velg zien",
    kind: "material",
  },
  {
    key: "tyres",
    label: "Banden",
    prompt: "Laat je band en het profiel van dichtbij zien",
    kind: "material",
  },
  {
    key: "brakes",
    label: "Remblokken",
    prompt: "Laat je remblokken of remschijven zien",
    kind: "material",
  },
  {
    key: "chain",
    label: "Ketting",
    prompt: "Laat je ketting en tandwielen zien",
    kind: "material",
  },
  {
    key: "helmet",
    label: "Helm",
    prompt: "Laat je helm zien (binnen- en buitenkant)",
    kind: "material",
  },
  {
    key: "breakfast",
    label: "Ontbijt",
    prompt: "Laat je ontbijt van vandaag zien",
    kind: "nutrition",
  },
  {
    key: "race_nutrition",
    label: "Wedstrijdvoeding",
    prompt: "Laat je wedstrijdvoeding (gels, repen, bidons) zien",
    kind: "nutrition",
  },
  {
    key: "bike_problem",
    label: "Fietsprobleem",
    prompt: "Laat het probleem aan je fiets van dichtbij zien",
    kind: "material",
  },
  {
    key: "other",
    label: "Anders",
    prompt: "Laat zien waar je advies over wilt",
    kind: "material",
  },
] as const;

export function getCategory(key: string): MaterialCategory | null {
  return MATERIAL_CATEGORIES.find((c) => c.key === key) ?? null;
}

// ── Analysis result ──────────────────────────────────────────────────────────

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const ALLOWED_MEDIA_TYPES: readonly ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export function normalizeMediaType(raw: string): ImageMediaType | null {
  const m = raw.trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(m)
    ? (m as ImageMediaType)
    : null;
}

export type MaterialPhotoInput = {
  base64: string;
  mediaType: ImageMediaType;
};

// Qualitative amount for a nutrient — always safe to show (also for youth).
export type MealNutrientLevel = "hoog" | "gemiddeld" | "laag" | "onbekend";

export type MealMicronutrient = {
  name: string;
  level: MealNutrientLevel;
  note: string | null;
};

// Honest nutrition estimate read off a real meal photo. Numbers are only ever
// filled for adults (showNumbers); for youth (<16) they stay null and only the
// qualitative levels are used — RED-S safety, no calorie/gram targets.
export type MealNutritionEstimate = {
  showNumbers: boolean;
  caloriesKcal: number | null;
  carbsGrams: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  carbsLevel: MealNutrientLevel;
  proteinLevel: MealNutrientLevel;
  fatLevel: MealNutrientLevel;
  fiberLevel: MealNutrientLevel;
  micronutrients: MealMicronutrient[];
  confidence: MaterialConfidenceLevel;
  note: string | null;
};

export type MaterialAnalysisResult = {
  detectedItem: string;
  confidence: MaterialConfidenceLevel;
  needsMorePhoto: boolean;
  followUpQuestion: string | null;
  advice: MaterialAdvice;
  costEstimate: MaterialCostEstimate | null;
  nutrition: MealNutritionEstimate | null;
};

const SYSTEM = `Je bent Sparki, een ervaren materiaal- en voedingscoach voor wielrenners. Je beoordeelt ECHTE foto's van uitrusting (wielset, banden, remblokken, ketting, helm, fietsproblemen) en van voeding (ontbijt, wedstrijdvoeding).

EERLIJKHEIDSREGELS (altijd, geen uitzonderingen):
- Beoordeel ALLEEN wat je echt op de foto ziet. Verzin nooit een merk, model, maat of toestand die je niet kunt waarnemen.
- Geef altijd een expliciet zekerheidsniveau: "high" (duidelijk zichtbaar en herkenbaar), "medium" (waarschijnlijk maar niet zeker), "low" (vermoeden, te weinig zichtbaar), "unknown" (niet te beoordelen).
- Als je het niet zeker genoeg kunt zien, zet needsMorePhoto op true en stel via followUpQuestion één concrete vraag: welke extra foto of hoek je nodig hebt (bijv. close-up van het profiel, andere belichting, zijaanzicht). Geef in dat geval alvast voorzichtig, voorlopig advies maar geen harde conclusies.
- Bij twijfel tussen meerdere mogelijkheden: benoem ze en kies niet zomaar één als zekerheid.
- HOEVEELHEID (bij voeding): als de renner zelf een hoeveelheid noemt (bijv. "10 broodjes", "2 bidons", "een dubbele portie"), is die hoeveelheid LEIDEND boven wat je op de foto telt — de renner was erbij en de foto toont mogelijk niet alles (overlappende of al opgegeten stukken). Reken de voedingswaarde dan op de door de renner genoemde hoeveelheid. Noemt de renner niets, dan tel je zo eerlijk mogelijk uit de foto en benoem je in note dat het aantal een schatting is en dat de foto niet alles hoeft te tonen.

ADVIES (houd het KORT en bruikbaar — de renner wil een snelle check, geen verslag):
- summary: één of twee korte zinnen — wat je ziet en wat het betekent. Niet meer.
- pros, cons, risks, alternatives: lijsten met korte, concrete punten (maximaal ~3 per lijst, telkens één korte regel). Risks zijn veiligheids- of prestatierisico's. Alternatives zijn realistische opties. Laat een lijst leeg ([]) als er niets relevants is — vul nooit met holle tekst.

KOSTENINSCHATTING (alleen bij materiaal, NIET bij voeding):
- diy: zelf doen — materials (benodigdheden), costRange (bereik in euro's, bijv. "€15 – €30"), difficulty (bijv. "makkelijk", "gemiddeld", "lastig"), timeEstimate (bijv. "20 min").
- professional: laten doen — laborCost (arbeid in euro's) en totalCost (totaal incl. onderdelen).
- confidence: eigen zekerheidsniveau voor de kosten. Gebruik Nederlandse prijzen. Als je iets niet eerlijk kunt inschatten, zet die kant op null en leg het uit in note.
- Bij voeding: laat costEstimate volledig weg (null).

VOEDINGSWAARDE (ALLEEN bij voeding, anders nutrition = null):
- Schat op basis van wat je op de foto ziet de voedingswaarde van de HELE getoonde portie. Dit is altijd een schatting; benoem dat eerlijk in note en kies confidence conservatief. Zie je te weinig om iets te schatten, laat dat veld null en zeg het.
- Kwalitatieve niveaus (carbsLevel, proteinLevel, fatLevel, fiberLevel): "hoog" | "gemiddeld" | "laag" | "onbekend". Deze vul je ALTIJD zo goed mogelijk in — ze zijn ook veilig voor jonge sporters.
- micronutrients: lijst met de belangrijkste zichtbare vitaminen en mineralen (bijv. "Vitamine C", "IJzer", "Calcium", "Kalium"). Per stuk: name, level ("hoog"/"gemiddeld"/"laag"/"onbekend") en een korte note (waar zit het in, of null). Alleen wat je op basis van de zichtbare ingrediënten redelijk kunt onderbouwen — verzin geen precieze mg-waarden. Laat leeg ([]) als je niets betrouwbaars kunt zeggen.
- Getallen (caloriesKcal, carbsGrams, proteinGrams, fatGrams, fiberGrams): VUL DEZE ALLEEN als in de context "TOON GETALLEN" staat. Staat er "GEEN GETALLEN" (jonge sporter), zet dan al deze getallen op null en gebruik uitsluitend de kwalitatieve niveaus — geen calorieën, geen gram-doelen, geen afval-taal.

KOPPEL AAN DE TRAINING (kort):
- Als er trainingscontext is meegegeven, voeg HOOGUIT ÉÉN korte zin toe of dit eten bij die inspanning past (bijv. genoeg koolhydraten of goede timing). Geen uitgebreide trainingsanalyse, geen herhaling van de training. Is er geen trainingscontext, laat deze koppeling dan volledig weg.

TAAL & VORM:
- Alles in gewoon Nederlands dat een jeugdrenner, ouder of coach begrijpt. Geen Engels.
- Noem nooit het woord "AI" en noem jezelf geen assistent of model. Je bent Sparki.

UITVOER: antwoord UITSLUITEND met geldige JSON, zonder code-blokken of extra tekst, in exact dit formaat:
{
  "detectedItem": string,
  "confidence": "high" | "medium" | "low" | "unknown",
  "needsMorePhoto": boolean,
  "followUpQuestion": string | null,
  "advice": { "summary": string, "pros": string[], "cons": string[], "risks": string[], "alternatives": string[] },
  "costEstimate": null | { "diy": null | { "materials": string[], "costRange": string, "difficulty": string, "timeEstimate": string }, "professional": null | { "laborCost": string, "totalCost": string }, "confidence": "high" | "medium" | "low" | "unknown", "note": string | null },
  "nutrition": null | { "caloriesKcal": number | null, "carbsGrams": number | null, "proteinGrams": number | null, "fatGrams": number | null, "fiberGrams": number | null, "carbsLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "proteinLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "fatLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "fiberLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "micronutrients": [ { "name": string, "level": "hoog" | "gemiddeld" | "laag" | "onbekend", "note": string | null } ], "confidence": "high" | "medium" | "low" | "unknown", "note": string | null }
}`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Geen JSON gevonden in het antwoord");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asConfidence(v: unknown): MaterialConfidenceLevel {
  return v === "high" || v === "medium" || v === "low" ? v : "unknown";
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function coerceCost(raw: unknown): MaterialCostEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const diyRaw = r.diy as Record<string, unknown> | null | undefined;
  const proRaw = r.professional as Record<string, unknown> | null | undefined;

  const diy =
    diyRaw && typeof diyRaw === "object"
      ? {
          materials: asStringList(diyRaw.materials),
          costRange: asStr(diyRaw.costRange),
          difficulty: asStr(diyRaw.difficulty),
          timeEstimate: asStr(diyRaw.timeEstimate),
        }
      : null;
  const professional =
    proRaw && typeof proRaw === "object"
      ? {
          laborCost: asStr(proRaw.laborCost),
          totalCost: asStr(proRaw.totalCost),
        }
      : null;

  if (!diy && !professional && !r.note) return null;
  return {
    diy: diy && (diy.costRange || diy.materials.length) ? diy : null,
    professional:
      professional && (professional.totalCost || professional.laborCost)
        ? professional
        : null,
    confidence: asConfidence(r.confidence),
    note: asStr(r.note) || null,
  };
}

function asLevel(v: unknown): MealNutrientLevel {
  return v === "hoog" || v === "gemiddeld" || v === "laag" ? v : "onbekend";
}

function asNumOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// Parse the nutrition estimate. `showNumbers` is decided by us (age), never by
// the model: for youth we drop every numeric field regardless of what came back.
function coerceNutrition(raw: unknown, showNumbers: boolean): MealNutritionEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const micronutrients: MealMicronutrient[] = Array.isArray(r.micronutrients)
    ? (r.micronutrients as unknown[])
        .map((m) => {
          const o = (m ?? {}) as Record<string, unknown>;
          const name = asStr(o.name);
          if (!name) return null;
          return { name, level: asLevel(o.level), note: asStr(o.note) || null };
        })
        .filter((m): m is MealMicronutrient => m != null)
        .slice(0, 8)
    : [];

  const carbsLevel = asLevel(r.carbsLevel);
  const proteinLevel = asLevel(r.proteinLevel);
  const fatLevel = asLevel(r.fatLevel);
  const fiberLevel = asLevel(r.fiberLevel);

  const hasAnything =
    micronutrients.length > 0 ||
    carbsLevel !== "onbekend" ||
    proteinLevel !== "onbekend" ||
    fatLevel !== "onbekend" ||
    fiberLevel !== "onbekend" ||
    asNumOrNull(r.caloriesKcal) != null;
  if (!hasAnything) return null;

  return {
    showNumbers,
    caloriesKcal: showNumbers ? asNumOrNull(r.caloriesKcal) : null,
    carbsGrams: showNumbers ? asNumOrNull(r.carbsGrams) : null,
    proteinGrams: showNumbers ? asNumOrNull(r.proteinGrams) : null,
    fatGrams: showNumbers ? asNumOrNull(r.fatGrams) : null,
    fiberGrams: showNumbers ? asNumOrNull(r.fiberGrams) : null,
    carbsLevel,
    proteinLevel,
    fatLevel,
    fiberLevel,
    micronutrients,
    confidence: asConfidence(r.confidence),
    note: asStr(r.note) || null,
  };
}

// Analyse one material/nutrition case from real photos. Throws on a malformed
// model response so the route can fail honestly rather than persist a guess.
export async function analyzeMaterial(input: {
  category: MaterialCategory;
  photos: MaterialPhotoInput[];
  userNote?: string | null;
  athleteHint?: string | null;
  // Youth (<16): keep it qualitative — no calorie/gram numbers (RED-S safety).
  // Defaults to adult (numbers shown) when not provided.
  youth?: boolean;
  /** Voor wie de analyse loopt — vereist voor toestemmingscontrole. */
  clerkId?: string | null;
  /** AI-doel: voedingsfoto's lopen als gevoelig doel, materiaal als actie. */
  purpose?: "material_photo" | "nutrition_photo";
}): Promise<MaterialAnalysisResult> {
  const { category, photos } = input;
  if (photos.length === 0) {
    throw new Error("Minstens één foto is nodig");
  }

  const showNumbers = input.youth !== true;

  const noteLine = input.userNote?.trim()
    ? `\nWat de renner erbij zegt: "${input.userNote.trim()}"`
    : "";
  const athleteLine = input.athleteHint?.trim()
    ? `\nContext renner: ${input.athleteHint.trim()}`
    : "";
  const costLine =
    category.kind === "material"
      ? "Geef ook een kosteninschatting (zelf doen vs. laten doen) met een eigen zekerheidsniveau."
      : "Dit is voeding: geef geen kosteninschatting (costEstimate = null), alleen advies plus een voedingswaarde-schatting (nutrition).";
  const numbersLine =
    category.kind === "nutrition"
      ? showNumbers
        ? "\nVoedingswaarde: TOON GETALLEN — vul caloriesKcal en de gram-schattingen in als je ze redelijk kunt inschatten (altijd als schatting benoemen)."
        : "\nVoedingswaarde: GEEN GETALLEN — dit is een jonge sporter. Zet alle getallen op null en gebruik alleen de kwalitatieve niveaus. Geen calorieën, geen gram-doelen, geen afval-taal."
      : "";

  const userText = `Onderwerp: ${category.label}.${noteLine}${athleteLine}
Bekijk de bijgevoegde foto('s) en beoordeel wat zichtbaar is. ${costLine}${numbersLine}
Geef je zekerheidsniveau eerlijk aan en vraag om een extra foto als je het niet goed genoeg kunt zien.`;

  const content = [
    ...photos.map((p) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: p.mediaType,
        data: p.base64,
      },
    })),
    { type: "text" as const, text: userText },
  ];

  const message = await aiMessage("material_photo", null, {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `${SYSTEM}\n\n${UPLOAD_DATA_RULE}`,
    messages: [{ role: "user", content }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Onverwacht antwoord van Sparki");
  }

  const parsed = extractJson(block.text) as Record<string, unknown>;
  const adviceRaw = (parsed.advice ?? {}) as Record<string, unknown>;

  const advice: MaterialAdvice = {
    summary: asStr(adviceRaw.summary),
    pros: asStringList(adviceRaw.pros),
    cons: asStringList(adviceRaw.cons),
    risks: asStringList(adviceRaw.risks),
    alternatives: asStringList(adviceRaw.alternatives),
  };

  const confidence = asConfidence(parsed.confidence);
  const needsMorePhoto =
    parsed.needsMorePhoto === true || confidence === "unknown";

  // Cost estimate only applies to material cases; never for nutrition.
  const costEstimate =
    category.kind === "material" ? coerceCost(parsed.costEstimate) : null;

  // Nutrition estimate only applies to nutrition cases; never for material.
  const nutrition =
    category.kind === "nutrition"
      ? coerceNutrition(parsed.nutrition, showNumbers)
      : null;

  return {
    detectedItem: asStr(parsed.detectedItem) || category.label,
    confidence,
    needsMorePhoto,
    followUpQuestion: asStr(parsed.followUpQuestion) || null,
    advice,
    costEstimate,
    nutrition,
  };
}

// ── Text-based meal estimate ─────────────────────────────────────────────────
// Riders often just TYPE what they ate ("10 broodjes met kaas") without a photo.
// This produces the same honest estimate shape as the photo path so the UI can
// render the exact same nutrition card — never a dead-end with no values.

const SYSTEM_TEXT = `Je bent Sparki, een ervaren voedingscoach voor wielrenners. Een renner beschrijft in gewone taal wat hij at of dronk (er is GEEN foto). Schat op basis van die beschrijving de voedingswaarde en geef kort, eerlijk advies.

EERLIJKHEIDSREGELS (altijd):
- Ga uit van wat de renner beschrijft. Verzin geen ingrediënten of hoeveelheden die er niet staan.
- Een schatting op basis van tekst is minder nauwkeurig dan een foto: kies confidence conservatief (meestal "medium" of "low") en benoem in note dat het een schatting op basis van de beschrijving is.
- HOEVEELHEID is leidend: neem de door de renner genoemde hoeveelheid letterlijk (bijv. "10 broodjes" = 10 broodjes) en reken de voedingswaarde op die HELE hoeveelheid. Noemt de renner geen aantal, ga dan uit van een normale portie en zeg dat eerlijk in note.
- Is de beschrijving te vaag om iets te schatten, zet de betreffende velden op null en stel via followUpQuestion één concrete vraag over wat je mist (bijv. hoeveel, of waar het broodje mee belegd was).

ADVIES:
- summary: korte heldere samenvatting van wat deze voeding betekent voor de renner.
- pros, cons, risks, alternatives: lijsten met korte, concrete punten. Laat een lijst leeg ([]) als er niets relevants is — vul nooit met holle tekst.

VOEDINGSWAARDE:
- Kwalitatieve niveaus (carbsLevel, proteinLevel, fatLevel, fiberLevel): "hoog" | "gemiddeld" | "laag" | "onbekend". Vul deze ALTIJD zo goed mogelijk in — ze zijn ook veilig voor jonge sporters.
- micronutrients: de belangrijkste aannemelijke vitaminen en mineralen op basis van de genoemde ingrediënten. Per stuk name, level en een korte note (of null). Verzin geen precieze mg-waarden. Laat leeg ([]) als je niets betrouwbaars kunt zeggen.
- Getallen (caloriesKcal, carbsGrams, proteinGrams, fatGrams, fiberGrams): VUL DEZE ALLEEN als in de context "TOON GETALLEN" staat. Staat er "GEEN GETALLEN" (jonge sporter), zet dan al deze getallen op null en gebruik uitsluitend de kwalitatieve niveaus — geen calorieën, geen gram-doelen, geen afval-taal.

KOPPEL AAN DE TRAINING:
- Als er trainingscontext is meegegeven, betrek dat expliciet in summary en advies: past dit eten bij die inspanning (genoeg koolhydraten voor/na, herstel, timing)? Wees concreet maar eerlijk over wat je niet kunt weten.

TAAL & VORM:
- Alles in gewoon Nederlands dat een jeugdrenner, ouder of coach begrijpt. Geen Engels.
- Noem nooit het woord "AI" en noem jezelf geen assistent of model. Je bent Sparki.

UITVOER: antwoord UITSLUITEND met geldige JSON, zonder code-blokken of extra tekst, in exact dit formaat:
{
  "detectedItem": string,
  "confidence": "high" | "medium" | "low" | "unknown",
  "followUpQuestion": string | null,
  "advice": { "summary": string, "pros": string[], "cons": string[], "risks": string[], "alternatives": string[] },
  "nutrition": null | { "caloriesKcal": number | null, "carbsGrams": number | null, "proteinGrams": number | null, "fatGrams": number | null, "fiberGrams": number | null, "carbsLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "proteinLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "fatLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "fiberLevel": "hoog" | "gemiddeld" | "laag" | "onbekend", "micronutrients": [ { "name": string, "level": "hoog" | "gemiddeld" | "laag" | "onbekend", "note": string | null } ], "confidence": "high" | "medium" | "low" | "unknown", "note": string | null }
}`;

// Estimate a meal from the rider's free-text description (no photo). Throws on a
// malformed model response so the route can fail honestly instead of guessing.
export async function analyzeMealText(input: {
  mealText: string;
  athleteHint?: string | null;
  // Youth (<16): keep it qualitative — no calorie/gram numbers (RED-S safety).
  youth?: boolean;
  /** Voor wie de analyse loopt — vereist voor toestemmingscontrole. */
  clerkId?: string | null;
}): Promise<MaterialAnalysisResult> {
  const mealText = input.mealText.trim();
  if (!mealText) {
    throw new Error("Geen omschrijving van de voeding");
  }

  const showNumbers = input.youth !== true;
  const athleteLine = input.athleteHint?.trim()
    ? `\nContext renner: ${input.athleteHint.trim()}`
    : "";
  const numbersLine = showNumbers
    ? "\nVoedingswaarde: TOON GETALLEN — vul caloriesKcal en de gram-schattingen in als je ze redelijk kunt inschatten (altijd als schatting benoemen)."
    : "\nVoedingswaarde: GEEN GETALLEN — dit is een jonge sporter. Zet alle getallen op null en gebruik alleen de kwalitatieve niveaus. Geen calorieën, geen gram-doelen, geen afval-taal.";

  const userText = `De renner beschrijft wat hij at of dronk: "${mealText}".${athleteLine}${numbersLine}
Schat de voedingswaarde van de HELE beschreven hoeveelheid en geef kort, eerlijk advies.`;

  const message = await aiMessage("nutrition_text", input.clerkId ?? null, {
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `${SYSTEM_TEXT}\n\n${UPLOAD_DATA_RULE}`,
    messages: [{ role: "user", content: userText }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Onverwacht antwoord van Sparki");
  }

  const parsed = extractJson(block.text) as Record<string, unknown>;
  const adviceRaw = (parsed.advice ?? {}) as Record<string, unknown>;

  const advice: MaterialAdvice = {
    summary: asStr(adviceRaw.summary),
    pros: asStringList(adviceRaw.pros),
    cons: asStringList(adviceRaw.cons),
    risks: asStringList(adviceRaw.risks),
    alternatives: asStringList(adviceRaw.alternatives),
  };

  const confidence = asConfidence(parsed.confidence);
  const nutrition = coerceNutrition(parsed.nutrition, showNumbers);

  return {
    detectedItem: asStr(parsed.detectedItem) || "Wat je hebt ingevoerd",
    confidence,
    // No photo involved — a "stuur een extra foto"-vraag zou hier niet kloppen.
    needsMorePhoto: false,
    followUpQuestion: asStr(parsed.followUpQuestion) || null,
    advice,
    costEstimate: null,
    nutrition,
  };
}
