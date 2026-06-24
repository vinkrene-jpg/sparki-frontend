// Document Analysis engine.
//
// Reads an uploaded race/technical guide (PDF or image) for real and returns a
// structured result: which key facts were found, which are missing, and the
// targeted Dutch follow-up questions Sparki should ask. Never fabricates values
// — an absent fact is reported as missing, not invented. Consumed by the
// document-analyses route, which persists results per athlete and links them to
// a race in the agenda.

export * from "../../lib/document-analysis/fields";
export * from "../../lib/document-analysis/analyze";
