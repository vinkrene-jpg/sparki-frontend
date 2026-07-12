// Input Center engine.
//
// Owns the one central place where an athlete hands Sparki information — a photo,
// an image/PDF/file upload, a pasted link or a typed question — and gets a real
// grounded reply. Every turn (athlete + Sparki) is persisted to
// `sparki_input_messages` so the conversation, including the uploaded items,
// stays visible across sessions. This is the foundation other features
// (document analysis, race intelligence, materiaalcoach) build on.
//
// Honesty contract (no fabrication):
// - Real images and PDFs are downloaded from object storage and passed to the
//   model as genuine content blocks, so Sparki analyses what was actually sent.
// - A pasted link is shown to Sparki as text only — Sparki cannot open it, so it
//   must say so plainly and ask the athlete to paste the relevant content,
//   never invent what the page contains.
// - Files Sparki cannot read (e.g. .fit/.gpx/.zip/office docs) are named to
//   Sparki as "received but not readable here"; Sparki acknowledges them
//   honestly instead of pretending to have analysed them.

import { and, asc, desc, eq, lt } from "drizzle-orm";
import {
  db,
  sparkiInputMessagesTable,
  type SparkiInputMessage,
  type InputAttachment,
  type InputMessageSource,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ObjectStorageService } from "../../lib/objectStorage";
import { ObjectPermission } from "../../lib/objectAcl";
import {
  buildAthleteContext,
  systemPrompt,
  gatherKnowledge,
} from "../../lib/athlete-context";

const MODEL = "claude-sonnet-4-6";
const objectStorageService = new ObjectStorageService();

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Anthropic accepts these image media types as image blocks; PDFs go through the
// document block. Everything else is described to Sparki as text only.
const IMAGE_MEDIA_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ConversationTurn = SparkiInputMessage;

// Returns the full persisted conversation for an athlete, oldest first.
export async function getConversation(
  clerkId: string,
): Promise<ConversationTurn[]> {
  return db
    .select()
    .from(sparkiInputMessagesTable)
    .where(eq(sparkiInputMessagesTable.clerkId, clerkId))
    .orderBy(asc(sparkiInputMessagesTable.createdAt));
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: ImageMediaType; data: string };
    }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

// Downloads an owned attachment's bytes from object storage as base64, after
// re-checking ownership. Returns null when the caller is not the owner or the
// object is missing — the turn is then described as text only, never faked.
async function loadAttachmentBytes(
  clerkId: string,
  attachment: InputAttachment,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(
      attachment.objectPath,
    );
    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId: clerkId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) return null;
    const [buffer] = await objectFile.download();
    return {
      base64: buffer.toString("base64"),
      mediaType: attachment.contentType,
    };
  } catch {
    return null;
  }
}

// Builds the model content blocks for the athlete's turn: real image/PDF blocks
// for readable uploads, plus a text block that states the question, the link
// (with the can't-open caveat) and any non-readable files honestly.
async function buildTurnBlocks(
  clerkId: string,
  text: string | null,
  link: string | null,
  attachments: InputAttachment[],
): Promise<AnthropicContentBlock[]> {
  const blocks: AnthropicContentBlock[] = [];
  const unreadable: string[] = [];

  for (const att of attachments) {
    if (IMAGE_MEDIA_TYPES.has(att.contentType)) {
      const bytes = await loadAttachmentBytes(clerkId, att);
      if (bytes) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: bytes.mediaType as ImageMediaType,
            data: bytes.base64,
          },
        });
        continue;
      }
      unreadable.push(att.name);
    } else if (att.contentType === "application/pdf") {
      const bytes = await loadAttachmentBytes(clerkId, att);
      if (bytes) {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: bytes.base64,
          },
        });
        continue;
      }
      unreadable.push(att.name);
    } else {
      unreadable.push(att.name);
    }
  }

  const textParts: string[] = [];
  if (text && text.trim()) {
    textParts.push(`Vraag van de atleet: ${text.trim()}`);
  }
  if (link && link.trim()) {
    textParts.push(
      `De atleet plakte deze link: ${link.trim()}\n` +
        `BELANGRIJK: je kunt deze link NIET openen of de inhoud ervan zien. ` +
        `Verzin niet wat erop staat. Vertel kort dat je de pagina zelf niet kunt ` +
        `bekijken en vraag de atleet om de relevante tekst of een schermafbeelding ` +
        `te plakken als je inhoudelijk moet meedenken.`,
    );
  }
  if (unreadable.length > 0) {
    textParts.push(
      `De atleet stuurde ${unreadable.length} bestand(en) die je hier niet kunt ` +
        `inlezen: ${unreadable.join(", ")}. Doe alsof je ze niet hebt geanalyseerd; ` +
        `benoem eerlijk dat je dit bestandstype hier nog niet kunt lezen en vraag ` +
        `zo nodig om de inhoud op een andere manier.`,
    );
  }
  if (attachments.some((a) => IMAGE_MEDIA_TYPES.has(a.contentType))) {
    textParts.push(
      `Er zijn een of meer afbeeldingen meegestuurd. Beschrijf en analyseer ` +
        `alleen wat je daadwerkelijk in de afbeelding ziet.`,
    );
  }
  if (attachments.some((a) => a.contentType === "application/pdf")) {
    textParts.push(
      `Er is een of meer PDF('s) meegestuurd. Analyseer alleen de werkelijke ` +
        `inhoud van het document.`,
    );
  }
  if (textParts.length === 0) {
    textParts.push(
      `De atleet stuurde iets zonder begeleidende tekst. Reageer op wat je ` +
        `daadwerkelijk hebt ontvangen.`,
    );
  }

  blocks.push({ type: "text", text: textParts.join("\n\n") });
  return blocks;
}

// How many prior persisted turns are replayed to the model so the chat is a
// flowing conversation instead of a series of isolated first messages.
const HISTORY_TURNS = 100;
const HISTORY_TURN_MAX_CHARS = 2000;

// Loads the most recent prior turns (before the just-persisted athlete turn)
// and maps them to alternating Anthropic messages. Attachments/links from old
// turns are described as text — bytes are only ever loaded for the current
// turn. Consecutive same-role turns are merged because the API requires
// alternating roles.
async function loadHistoryMessages(
  clerkId: string,
  beforeId: number,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await db
    .select()
    .from(sparkiInputMessagesTable)
    .where(
      and(
        eq(sparkiInputMessagesTable.clerkId, clerkId),
        lt(sparkiInputMessagesTable.id, beforeId),
      ),
    )
    .orderBy(desc(sparkiInputMessagesTable.createdAt))
    .limit(HISTORY_TURNS);
  rows.reverse();

  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of rows) {
    const role = row.role === "athlete" ? "user" : "assistant";
    const parts: string[] = [];
    if (row.text) {
      parts.push(
        row.text.length > HISTORY_TURN_MAX_CHARS
          ? `${row.text.slice(0, HISTORY_TURN_MAX_CHARS)} […ingekort]`
          : row.text,
      );
    }
    if (row.link) parts.push(`[Deelde eerder deze link: ${row.link}]`);
    const atts = (row.attachments ?? []) as InputAttachment[];
    if (atts.length > 0) {
      parts.push(
        `[Stuurde eerder ${atts.length === 1 ? "een bijlage" : `${atts.length} bijlagen`}: ${atts
          .map((a) => a.name)
          .join(", ")}]`,
      );
    }
    if (parts.length === 0) continue;
    const content = parts.join("\n");
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content += `\n\n${content}`;
    } else {
      out.push({ role, content });
    }
  }
  // The API requires the first message to be a user turn.
  while (out.length > 0 && out[0]!.role !== "user") out.shift();
  return out;
}

export type PostMessageInput = {
  clerkId: string;
  text: string | null;
  link: string | null;
  attachments: InputAttachment[];
  // Optional, already-verified context block (e.g. the ride the question is
  // about). Built and ownership-checked by the ROUTE layer — the engine only
  // injects it into the prompt so Sparki answers grounded in that real data.
  contextBlock?: string | null;
};

export type PostMessageResult = {
  athleteTurn: SparkiInputMessage;
  sparkiTurn: SparkiInputMessage;
};

// Persists the athlete's turn, generates Sparki's grounded reply (real athlete
// context + real uploaded bytes + optional knowledge citations), and persists
// Sparki's turn. Both rows are returned so the client can append them to the
// visible conversation.
export async function postMessage(
  input: PostMessageInput,
): Promise<PostMessageResult> {
  const { clerkId } = input;
  const text = input.text?.trim() ? input.text.trim() : null;
  const link = input.link?.trim() ? input.link.trim() : null;
  const attachments = input.attachments;

  const [athleteTurn] = await db
    .insert(sparkiInputMessagesTable)
    .values({
      clerkId,
      role: "athlete",
      text,
      link,
      attachments: attachments.length > 0 ? attachments : null,
      sources: null,
    })
    .returning();

  // The objects were just uploaded via presigned PUT, so they exist now. Register
  // ownership (private, owner = this athlete) before reading any bytes, so the
  // owner-gated serve route and byte loader can authorise the real owner only.
  await Promise.all(
    attachments.map((a) =>
      objectStorageService
        .trySetObjectEntityAclPolicy(a.objectPath, {
          owner: clerkId,
          visibility: "private",
        })
        .catch(() => undefined),
    ),
  );

  const keywordSeed = [text ?? "", link ?? "", ...attachments.map((a) => a.name)]
    .join(" ")
    .trim();

  const [context, system, knowledge, turnBlocks, history] = await Promise.all([
    buildAthleteContext(clerkId),
    systemPrompt(clerkId),
    gatherKnowledge(clerkId, keywordSeed || "training"),
    buildTurnBlocks(clerkId, text, link, attachments),
    loadHistoryMessages(clerkId, athleteTurn!.id),
  ]);

  const contextText =
    `ATLEETCONTEXT (echte gelogde data — gebruik dit om je antwoord te onderbouwen):\n${context}` +
    (input.contextBlock
      ? `\n\nGESPREKSCONTEXT — de vraag van de atleet gaat specifiek over deze rit ` +
        `(echte gelogde data, beantwoord de vraag hierop gericht):\n${input.contextBlock}`
      : "") +
    (knowledge.promptBlock ? `\n\n${knowledge.promptBlock}` : "") +
    (history.length > 0
      ? `\n\nDit is een DOORLOPEND gesprek: de eerdere beurten hierboven zijn echt. ` +
        `Bouw voort op wat al gezegd is, verwijs ernaar waar dat helpt, en herhaal ` +
        `geen uitleg of vragen die al aan bod kwamen. Begin niet opnieuw met een ` +
        `algemene introductie.`
      : "");

  // The API requires strict user/assistant alternation. If the newest history
  // row is also a user turn (a prior request persisted the athlete turn but
  // failed before Sparki replied), fold that dangling turn into the current
  // user message instead of sending two consecutive user messages.
  const danglingUser =
    history.length > 0 && history[history.length - 1]!.role === "user"
      ? history.pop()!
      : null;

  const userBlocks: AnthropicContentBlock[] = [
    { type: "text", text: contextText },
    ...(danglingUser
      ? [
          {
            type: "text" as const,
            text: `[Eerder verstuurd bericht dat nog geen antwoord kreeg:]\n${danglingUser.content}`,
          },
        ]
      : []),
    ...turnBlocks,
  ];

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [
      ...history.map((h) => ({
        role: h.role,
        content: [{ type: "text" as const, text: h.content }],
      })),
      { role: "user", content: userBlocks },
    ],
  });

  const reply = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  const sources: InputMessageSource[] = knowledge.sources.map((s) => ({
    id: s.id,
    title: s.title,
    url: s.url,
    source: s.source,
  }));

  const [sparkiTurn] = await db
    .insert(sparkiInputMessagesTable)
    .values({
      clerkId,
      role: "sparki",
      text: reply || "Ik kon hier nu geen antwoord op vormen. Probeer het zo nog eens.",
      link: null,
      attachments: null,
      sources: sources.length > 0 ? sources : null,
    })
    .returning();

  return { athleteTurn: athleteTurn!, sparkiTurn: sparkiTurn! };
}
