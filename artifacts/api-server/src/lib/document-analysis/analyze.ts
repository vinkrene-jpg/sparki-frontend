import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  documentAnalysisKinds,
  type DocumentAnalysisKind,
  type ExtractedField,
} from "@workspace/db";
import {
  ALL_FIELDS,
  DOCUMENT_FIELDS,
  FIELD_KEYS,
  fieldDef,
  isCoreField,
} from "./fields";

export type AnalysisResult = {
  documentKind: DocumentAnalysisKind;
  summary: string;
  extractedFields: Record<string, ExtractedField>;
  foundFields: string[];
  missingFields: string[];
  followUpQuestions: string[];
};

// Media types Sparki can actually read. PDFs go in as a document block, images
// as an image block. Anything else is rejected up-front (no fake parsing).
export const SUPPORTED_PDF = "application/pdf";
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export function isSupportedMediaType(mediaType: string): boolean {
  return (
    mediaType === SUPPORTED_PDF ||
    (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mediaType)
  );
}

const FIELD_GUIDE = ALL_FIELDS.map(
  (f) => `  - ${f.key}: ${f.label}`,
).join("\n");

const SYSTEM = `Je bent Sparki en je leest een wedstrijd- of technisch document voor een wielrenner (technische gids, wedstrijdgids, etappeboek, routekaart of tijdschema).

Geef UITSLUITEND geldige JSON terug — geen uitleg, geen markdown, geen codeblok-tekens.

Schema:
{
  "documentKind": een van ${documentAnalysisKinds.map((k) => `"${k}"`).join(", ")},
  "summary": korte zin in het Nederlands die zegt wat dit document is,
  "fields": {
    "<key>": { "value": <string of null>, "confidence": "high" | "medium" | "low" }
  }
}

De velden (key: betekenis):
${FIELD_GUIDE}

Strikte regels:
- Vul een waarde ALLEEN in als die LETTERLIJK in het document staat. Verzin NOOIT iets.
- Staat een veld niet in het document? Zet "value": null en laat "confidence": null.
- distanceKm: alleen het getal in kilometers (bijv. "142"). elevationM: alleen het getal in meters.
- startTime: in 24-uurs notatie indien mogelijk (bijv. "10:30").
- date: in formaat JJJJ-MM-DD indien mogelijk, anders zoals vermeld.
- Twijfel je over een gelezen waarde? Gebruik confidence "low" of "medium".
- Schrijf alle tekstwaarden en de summary in het Nederlands.`;

type RawField = { value?: unknown; confidence?: unknown };

function coerceConfidence(v: unknown): ExtractedField["confidence"] {
  return v === "high" || v === "medium" || v === "low" ? v : null;
}

function coerceKind(v: unknown): DocumentAnalysisKind {
  return typeof v === "string" &&
    (documentAnalysisKinds as readonly string[]).includes(v)
    ? (v as DocumentAnalysisKind)
    : "onbekend";
}

function buildContentBlock(mediaType: string, base64Data: string) {
  if (mediaType === SUPPORTED_PDF) {
    return {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: base64Data,
      },
    };
  }
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType as (typeof SUPPORTED_IMAGE_TYPES)[number],
      data: base64Data,
    },
  };
}

function extractJson(text: string): unknown {
  let t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) t = fenced[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json object in response");
  return JSON.parse(t.slice(start, end + 1));
}

// Deterministically derive found / missing / desired and the Dutch follow-up
// questions from the extracted field map. Found = value present. Missing = core
// or desired field with no value. Low-confidence present values also earn a
// confirm-question so Sparki double-checks rather than trusting a shaky read.
export function deriveDerived(fields: Record<string, ExtractedField>): {
  foundFields: string[];
  missingFields: string[];
  followUpQuestions: string[];
} {
  const foundFields: string[] = [];
  const missingFields: string[] = [];
  const questions: string[] = [];

  for (const key of FIELD_KEYS) {
    const f = fields[key];
    const hasValue = !!f && f.value != null && String(f.value).trim() !== "";
    if (hasValue) {
      foundFields.push(key);
      if (f!.confidence === "low") {
        const def = fieldDef(key);
        if (def)
          questions.push(
            `Klopt het dat "${def.label.toLowerCase()}" ${f!.value} is?`,
          );
      }
    } else {
      missingFields.push(key);
    }
  }

  // Ask about missing core fields first, then desired ones.
  for (const f of DOCUMENT_FIELDS.core) {
    if (missingFields.includes(f.key)) questions.push(f.question);
  }
  for (const f of DOCUMENT_FIELDS.desired) {
    if (missingFields.includes(f.key)) questions.push(f.question);
  }

  return { foundFields, missingFields, followUpQuestions: questions };
}

// Run the real extraction against the uploaded document. Throws on a genuine
// failure (bad model output, API error) so the caller records status "failed"
// honestly rather than persisting fabricated data.
export async function analyzeDocument(
  mediaType: string,
  base64Data: string,
): Promise<AnalysisResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(mediaType, base64Data),
          {
            type: "text",
            text: "Lees dit document en geef nu de JSON terug volgens het schema.",
          },
        ],
      },
    ],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("model returned no text block");
  }

  const parsed = extractJson(block.text) as {
    documentKind?: unknown;
    summary?: unknown;
    fields?: Record<string, RawField>;
  };

  const rawFields = (parsed.fields ?? {}) as Record<string, RawField>;
  const extractedFields: Record<string, ExtractedField> = {};
  for (const key of FIELD_KEYS) {
    const raw = rawFields[key];
    const value =
      raw && typeof raw.value === "string" && raw.value.trim() !== ""
        ? raw.value.trim()
        : raw && typeof raw.value === "number"
          ? String(raw.value)
          : null;
    extractedFields[key] = {
      key,
      value,
      confidence: value == null ? null : coerceConfidence(raw?.confidence),
    };
  }

  const { foundFields, missingFields, followUpQuestions } =
    deriveDerived(extractedFields);

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Document gelezen.";

  return {
    documentKind: coerceKind(parsed.documentKind),
    summary,
    extractedFields,
    foundFields,
    missingFields,
    followUpQuestions,
  };
}

// Merge athlete-provided answers into the extracted map (manually answered =
// high confidence, since the athlete asserts it), then recompute derived sets.
export function applyAnswers(
  fields: Record<string, ExtractedField>,
  answers: Record<string, string>,
): {
  extractedFields: Record<string, ExtractedField>;
  foundFields: string[];
  missingFields: string[];
  followUpQuestions: string[];
} {
  const next: Record<string, ExtractedField> = { ...fields };
  for (const [key, value] of Object.entries(answers)) {
    if (!FIELD_KEYS.includes(key)) continue;
    const trimmed = typeof value === "string" ? value.trim() : "";
    next[key] = {
      key,
      value: trimmed === "" ? null : trimmed,
      confidence: trimmed === "" ? null : "high",
    };
  }
  return { extractedFields: next, ...deriveDerived(next) };
}

// Map extracted document fields onto the races table columns (only fills the
// ones we confidently have). Used when linking an analysis to a race so the
// agenda entry is enriched without overwriting existing non-empty values.
export function fieldsToRacePatch(
  fields: Record<string, ExtractedField>,
): Record<string, string> {
  const patch: Record<string, string> = {};
  const get = (k: string) => {
    const f = fields[k];
    return f && f.value != null && String(f.value).trim() !== ""
      ? String(f.value).trim()
      : null;
  };
  const startTime = get("startTime");
  if (startTime) patch.startTime = startTime;
  const startLocation = get("startLocation");
  if (startLocation) patch.location = startLocation;
  const distanceKm = get("distanceKm");
  if (distanceKm) patch.distanceKm = distanceKm;
  const stageType = get("stageType");
  if (stageType) patch.course = stageType;
  return patch;
}

export { isCoreField };
