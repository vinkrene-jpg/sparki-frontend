// SPARKI_BUILD_04 F13 — AI-concepten voor de zelfstandige trainer.
//
// De AI maakt uitsluitend TEKSTCONCEPTEN voor: intake, doelen, plan,
// feedback, rapport, communicatie, factuuromschrijving en evaluatie.
//
// Harde regels (Mirror: één gegeven van klant A in een concept voor klant B
// is directe afkeur):
// - Kruisbestuiving onmogelijk gemaakt bij de BRON: de context wordt
//   uitsluitend opgebouwd uit rijen van de opgegeven klant (owner-checked);
//   er bestaat geen pad dat andere klanten inleest (buildClientDraftContext
//   selecteert op clientId + trainerClerkId).
// - AI bepaalt NOOIT een bedrag of btw-status: voor factuuromschrijvingen
//   worden bedrag-/btw-patronen uit het concept gestript en gemeld; bedragen
//   komen alleen van de trainer zelf (F6/F8).
// - AI verstuurt NOOIT iets: deze route schrijft alleen conceptteksten terug
//   aan de aanroeper; er is geen pad naar /send of naar een mailsysteem.
// - Concept blijft concept: er wordt geen status van factuur of document
//   gewijzigd.
//
// Alle modelverkeer loopt via de centrale gateway (aiMessage, purpose
// trainer_draft): killswitch, consent, redactie en logging gelden dus ook hier.

import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  trainerClientsTable,
  clientAthleteLinksTable,
  trainerServicesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { aiMessage, AiBlockedError } from "../lib/ai/gateway";

const router = Router();

export const DRAFT_KINDS = [
  "intake",
  "doelen",
  "plan",
  "feedback",
  "rapport",
  "communicatie",
  "factuuromschrijving",
  "evaluatie",
] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

// Bedrag-/btw-patronen die een AI-factuuromschrijving nooit mag bevatten:
// eurotekens, geldbedragen en btw-percentages. Deterministisch gestript.
const MONEY_PATTERNS = [
  /€\s?\d[\d.,]*/g,
  /\b\d[\d.,]*\s?(?:euro|eur)\b/gi,
  /\b\d{1,2}\s?%\s?(?:btw)?/gi,
  /\bbtw(?:-tarief|-percentage)?\s*(?:van|:)?\s*\d[\d.,]*\s?%?/gi,
];

export function stripMoneyClaims(text: string): { text: string; stripped: boolean } {
  let out = text;
  let stripped = false;
  for (const p of MONEY_PATTERNS) {
    if (p.test(out)) {
      stripped = true;
      out = out.replace(p, "[bedrag door trainer]");
    }
    p.lastIndex = 0;
  }
  return { text: out, stripped };
}

// Context UITSLUITEND uit rijen van deze ene klant. Dit is de enige
// contextbron voor trainer_draft; kruisbestuiving is daarmee structureel
// uitgesloten in plaats van "eruit gefilterd".
export async function buildClientDraftContext(
  trainerClerkId: string,
  clientId: number,
): Promise<{ client: typeof trainerClientsTable.$inferSelect; context: string } | null> {
  const [client] = await db
    .select()
    .from(trainerClientsTable)
    .where(
      and(
        eq(trainerClientsTable.id, clientId),
        eq(trainerClientsTable.trainerClerkId, trainerClerkId),
      ),
    );
  if (!client) return null;
  const links = await db
    .select()
    .from(clientAthleteLinksTable)
    .where(eq(clientAthleteLinksTable.clientId, client.id));
  // BEWUST GEEN work_objects in de context: die tabel is niet klantgebonden
  // (geen clientId-kolom). Documenten van de trainer meesturen zou juist
  // kruisbestuiving tussen klanten kunnen veroorzaken — dus weglaten tot er
  // een echte klantkoppeling bestaat. Eerlijk gat boven stil risico.
  const services = await db
    .select({ name: trainerServicesTable.name })
    .from(trainerServicesTable)
    .where(eq(trainerServicesTable.trainerClerkId, trainerClerkId));
  const parts = [
    `Klant: ${client.name} (type: ${client.clientType})`,
    client.note ? `Notities: ${client.note}` : null,
    links.length ? `Gekoppelde sporters: ${links.length} (relatie: ${links.map((l) => l.relationType).join(", ")})` : null,
    services.length ? `Dienstenaanbod (alleen namen, geen prijzen): ${services.map((s) => s.name).join(", ")}` : null,
  ].filter(Boolean);
  return { client, context: parts.join("\n") };
}

const KIND_INSTRUCTIONS: Record<DraftKind, string> = {
  intake: "Schrijf een concept-intakeverslag op basis van de context.",
  doelen: "Formuleer concept-doelen voor deze klant.",
  plan: "Schrijf een concept-plantoelichting (geen trainingsgetallen verzinnen).",
  feedback: "Schrijf concept-feedback voor deze klant.",
  rapport: "Schrijf een concept-voortgangsrapport.",
  communicatie: "Schrijf een concept-bericht aan de klant.",
  factuuromschrijving:
    "Schrijf uitsluitend een omschrijvingstekst voor een factuurregel. Noem NOOIT een bedrag, prijs of btw-percentage: die bepaalt de trainer zelf.",
  evaluatie: "Schrijf een concept-evaluatie van de begeleiding.",
};

router.post("/", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const clientId = Number(req.body?.clientId);
    const kind = String(req.body?.kind ?? "") as DraftKind;
    if (!Number.isInteger(clientId) || !DRAFT_KINDS.includes(kind)) {
      res.status(400).json({
        error: `clientId en kind (${DRAFT_KINDS.join(", ")}) zijn verplicht.`,
      });
      return;
    }
    const built = await buildClientDraftContext(trainerClerkId, clientId);
    if (!built) {
      res.status(404).json({ error: "Klant niet gevonden." });
      return;
    }
    const message = await aiMessage(
      "trainer_draft",
      trainerClerkId,
      {
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        system:
          "Je schrijft Nederlandse CONCEPTTEKSTEN voor een zelfstandige trainer. Antwoord uitsluitend in het Nederlands. Gebruik alléén de aangeleverde context; verzin geen feiten. Noem nooit bedragen, prijzen of btw-percentages. Je verstuurt niets en besluit niets: de trainer beoordeelt en bewerkt elk concept.",
        messages: [
          {
            role: "user",
            content: `${KIND_INSTRUCTIONS[kind]}\n\nContext van deze ene klant:\n${built.context}`,
          },
        ],
      },
      { dedupeKey: `trainer-draft:${clientId}:${kind}` },
    );
    const raw = message.content
      .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    let text = raw;
    let moneyStripped = false;
    if (kind === "factuuromschrijving") {
      const cleaned = stripMoneyClaims(raw);
      text = cleaned.text;
      moneyStripped = cleaned.stripped;
    }
    // Concept blijft concept: we geven alleen tekst terug; er wordt hier
    // niets opgeslagen, verzonden of van status veranderd.
    res.json({
      kind,
      clientId,
      draft: text,
      isConcept: true,
      moneyStripped,
      note: "Concept — de trainer beoordeelt, bewerkt en besluit. Er wordt niets automatisch verstuurd.",
    });
  } catch (err) {
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "trainer ai draft failed");
    res.status(500).json({ error: "Concept maken is niet gelukt." });
  }
});

export default router;
