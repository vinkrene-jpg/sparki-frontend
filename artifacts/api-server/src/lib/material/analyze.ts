import { anthropic } from "@workspace/integrations-anthropic-ai";
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

export type MaterialAnalysisResult = {
  detectedItem: string;
  confidence: MaterialConfidenceLevel;
  needsMorePhoto: boolean;
  followUpQuestion: string | null;
  advice: MaterialAdvice;
  costEstimate: MaterialCostEstimate | null;
};

const SYSTEM = `Je bent Sparki, een ervaren materiaal- en voedingscoach voor wielrenners. Je beoordeelt ECHTE foto's van uitrusting (wielset, banden, remblokken, ketting, helm, fietsproblemen) en van voeding (ontbijt, wedstrijdvoeding).

EERLIJKHEIDSREGELS (altijd, geen uitzonderingen):
- Beoordeel ALLEEN wat je echt op de foto ziet. Verzin nooit een merk, model, maat of toestand die je niet kunt waarnemen.
- Geef altijd een expliciet zekerheidsniveau: "high" (duidelijk zichtbaar en herkenbaar), "medium" (waarschijnlijk maar niet zeker), "low" (vermoeden, te weinig zichtbaar), "unknown" (niet te beoordelen).
- Als je het niet zeker genoeg kunt zien, zet needsMorePhoto op true en stel via followUpQuestion één concrete vraag: welke extra foto of hoek je nodig hebt (bijv. close-up van het profiel, andere belichting, zijaanzicht). Geef in dat geval alvast voorzichtig, voorlopig advies maar geen harde conclusies.
- Bij twijfel tussen meerdere mogelijkheden: benoem ze en kies niet zomaar één als zekerheid.

ADVIES:
- summary: korte heldere samenvatting van wat je ziet en wat het betekent.
- pros, cons, risks, alternatives: lijsten met korte, concrete punten. Risks zijn veiligheids- of prestatierisico's. Alternatives zijn realistische opties. Laat een lijst leeg ([]) als er niets relevants is — vul nooit met holle tekst.

KOSTENINSCHATTING (alleen bij materiaal, NIET bij voeding):
- diy: zelf doen — materials (benodigdheden), costRange (bereik in euro's, bijv. "€15 – €30"), difficulty (bijv. "makkelijk", "gemiddeld", "lastig"), timeEstimate (bijv. "20 min").
- professional: laten doen — laborCost (arbeid in euro's) en totalCost (totaal incl. onderdelen).
- confidence: eigen zekerheidsniveau voor de kosten. Gebruik Nederlandse prijzen. Als je iets niet eerlijk kunt inschatten, zet die kant op null en leg het uit in note.
- Bij voeding: laat costEstimate volledig weg (null).

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
  "costEstimate": null | { "diy": null | { "materials": string[], "costRange": string, "difficulty": string, "timeEstimate": string }, "professional": null | { "laborCost": string, "totalCost": string }, "confidence": "high" | "medium" | "low" | "unknown", "note": string | null }
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

// Analyse one material/nutrition case from real photos. Throws on a malformed
// model response so the route can fail honestly rather than persist a guess.
export async function analyzeMaterial(input: {
  category: MaterialCategory;
  photos: MaterialPhotoInput[];
  userNote?: string | null;
  athleteHint?: string | null;
}): Promise<MaterialAnalysisResult> {
  const { category, photos } = input;
  if (photos.length === 0) {
    throw new Error("Minstens één foto is nodig");
  }

  const noteLine = input.userNote?.trim()
    ? `\nWat de renner erbij zegt: "${input.userNote.trim()}"`
    : "";
  const athleteLine = input.athleteHint?.trim()
    ? `\nContext renner: ${input.athleteHint.trim()}`
    : "";
  const costLine =
    category.kind === "material"
      ? "Geef ook een kosteninschatting (zelf doen vs. laten doen) met een eigen zekerheidsniveau."
      : "Dit is voeding: geef geen kosteninschatting (costEstimate = null), alleen advies.";

  const userText = `Onderwerp: ${category.label}.${noteLine}${athleteLine}
Bekijk de bijgevoegde foto('s) en beoordeel wat zichtbaar is. ${costLine}
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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM,
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

  return {
    detectedItem: asStr(parsed.detectedItem) || category.label,
    confidence,
    needsMorePhoto,
    followUpQuestion: asStr(parsed.followUpQuestion) || null,
    advice,
    costEstimate,
  };
}
