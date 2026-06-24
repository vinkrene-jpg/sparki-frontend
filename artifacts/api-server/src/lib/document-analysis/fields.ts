import type { DocumentAnalysisKind } from "@workspace/db";

// Canonical field set Sparki tries to read from a race/technical guide.
// `tier` decides whether a missing value is "ontbreekt" (core — must have for a
// race) or "wenselijk" (desired — nice to have). Labels & questions are plain
// Dutch (no tech-jargon) so youth riders, parents and coaches all understand.

export type FieldTier = "core" | "desired";

export type FieldDef = {
  key: string;
  label: string;
  // Targeted follow-up question shown when the field is missing.
  question: string;
};

export const DOCUMENT_FIELDS: Record<FieldTier, FieldDef[]> = {
  core: [
    {
      key: "eventName",
      label: "Naam van de wedstrijd",
      question: "Hoe heet de wedstrijd of het evenement?",
    },
    {
      key: "date",
      label: "Datum",
      question: "Op welke datum is de wedstrijd?",
    },
    {
      key: "startTime",
      label: "Starttijd",
      question: "Hoe laat is de start?",
    },
    {
      key: "startLocation",
      label: "Startlocatie",
      question: "Waar is de start (plaats of adres)?",
    },
    {
      key: "finishLocation",
      label: "Finishlocatie",
      question: "Waar is de finish?",
    },
    {
      key: "distanceKm",
      label: "Afstand",
      question: "Hoeveel kilometer is het parcours?",
    },
    {
      key: "elevationM",
      label: "Hoogtemeters",
      question: "Hoeveel hoogtemeters telt het parcours?",
    },
  ],
  desired: [
    {
      key: "stageType",
      label: "Type rit",
      question:
        "Wat voor type rit is het (vlak, heuvelachtig, bergrit, tijdrit)?",
    },
    {
      key: "feeding",
      label: "Bevoorrading",
      question: "Waar en hoe is de bevoorrading geregeld?",
    },
    {
      key: "timeSchedule",
      label: "Tijdschema",
      question:
        "Wat is het tijdschema (handtekeningen, briefing, start, prijsuitreiking)?",
    },
    {
      key: "specialNotes",
      label: "Bijzonderheden",
      question:
        "Zijn er bijzonderheden (gevaarlijke punten, materiaalregels, weer)?",
    },
  ],
};

export const ALL_FIELDS: FieldDef[] = [
  ...DOCUMENT_FIELDS.core,
  ...DOCUMENT_FIELDS.desired,
];

export const FIELD_KEYS: string[] = ALL_FIELDS.map((f) => f.key);

export function fieldDef(key: string): FieldDef | undefined {
  return ALL_FIELDS.find((f) => f.key === key);
}

export function fieldLabel(key: string): string {
  return fieldDef(key)?.label ?? key;
}

export function isCoreField(key: string): boolean {
  return DOCUMENT_FIELDS.core.some((f) => f.key === key);
}

export const DOCUMENT_KIND_LABEL: Record<DocumentAnalysisKind, string> = {
  technische_gids: "Technische gids",
  wedstrijdgids: "Wedstrijdgids",
  etappeboek: "Etappeboek",
  routekaart: "Routekaart",
  tijdschema: "Tijdschema",
  onbekend: "Onbekend document",
};
