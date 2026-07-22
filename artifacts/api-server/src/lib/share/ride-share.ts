// Rit delen — officiële kanalen, eerlijk begrensd.
//
// HONESTY CONTRACT:
// - Strava-upload gebeurt uitsluitend via de officiële Strava API met de
//   OAuth-toestemming van de renner zelf (scope activity:write). Zonder die
//   toestemming: eerlijke melding + opnieuw koppelen.
// - We maken op Strava een activiteit aan met UITSLUITEND echte waarden
//   (titel, sport, echte starttijd, echte duur, echte afstand). Geen
//   GPS-spoor-upload: de originele bestanden met tijdstempels worden niet
//   bewaard, en tijdstempels verzinnen bij een kaal spoor zou een vals
//   snelheidsverloop fabriceren. Dat doen we dus niet.
// - Ritten die al van een platform kwamen (Strava/Garmin/Wahoo) worden niet
//   teruggeüpload — dat zou een duplicaat maken; eerlijke melding.
// - Instagram, Facebook, WhatsApp en X bieden GEEN officiële API om namens een
//   persoonlijk account in de feed te publiceren. Delen daarheen loopt via het
//   officiële deelmenu van het apparaat (Web Share / share intents). Dat wordt
//   in de UI eerlijk zo benoemd — nooit een nep-"direct publiceren"-knop.

import { and, eq } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  activityImportsTable,
  connectorConnectionsTable,
  type TrainingSession,
} from "@workspace/db";
import { aiMessage } from "../ai/gateway";
import { getValidStravaAccessToken } from "../connectors/providers/strava-oauth";

const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/activities";

// Bronnen die al bij een extern platform vandaan komen — terug-uploaden naar
// Strava zou een duplicaat maken.
const PLATFORM_SOURCES = new Set(["strava", "garmin", "wahoo"]);

export type ShareCapabilities = {
  strava: {
    connected: boolean;
    hasWriteScope: boolean;
    canUpload: boolean;
    // Plain-Dutch uitleg wanneer uploaden niet kan.
    reason: string | null;
  };
  // Eerlijke uitleg over de andere platforms — geen nep-API's.
  platformNote: string;
};

export const PLATFORM_NOTE =
  "Instagram, Facebook, WhatsApp en X bieden geen officiële manier om namens een persoonlijk account direct te publiceren. Delen daarheen gaat via het deelmenu van je apparaat — dat is de officiële route.";

export async function getShareCapabilities(
  clerkId: string,
  session: TrainingSession,
): Promise<ShareCapabilities> {
  const [conn] = await db
    .select({
      status: connectorConnectionsTable.status,
      scopes: connectorConnectionsTable.scopes,
    })
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    );
  const connected = conn?.status === "connected";
  const hasWriteScope =
    connected && Array.isArray(conn?.scopes) && conn.scopes.includes("activity:write");

  let reason: string | null = null;
  if (PLATFORM_SOURCES.has(session.source)) {
    reason =
      "Deze rit komt al van een gekoppeld platform — opnieuw uploaden zou een duplicaat maken.";
  } else if (!connected) {
    reason = "Strava is nog niet gekoppeld. Koppel Strava bij je verbindingen.";
  } else if (!hasWriteScope) {
    reason =
      "Je Strava-koppeling heeft nog geen upload-toestemming. Koppel Strava opnieuw en vink 'activiteiten uploaden' aan.";
  } else if (session.durationMin == null) {
    reason = "Van deze rit is geen duur bekend — Strava heeft die nodig.";
  } else {
    const startTime = await getSessionStartTime(clerkId, session.id);
    if (!startTime) {
      reason =
        "Van deze rit is geen echte starttijd bekend. Strava heeft een starttijd nodig en die verzint Sparki niet.";
    }
  }

  return {
    strava: {
      connected,
      hasWriteScope,
      canUpload: reason == null,
      reason,
    },
    platformNote: PLATFORM_NOTE,
  };
}

// Echte starttijd uit het gekoppelde activiteitenbestand (parsedSummary.startTime,
// gezet bij ingest uit de tijdstempels in het bestand). Null = eerlijk onbekend.
export async function getSessionStartTime(
  clerkId: string,
  sessionId: number,
): Promise<string | null> {
  const [imp] = await db
    .select({ parsedSummary: activityImportsTable.parsedSummary })
    .from(activityImportsTable)
    .where(
      and(
        eq(activityImportsTable.linkedTrainingSessionId, sessionId),
        eq(activityImportsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  const summary = imp?.parsedSummary as { startTime?: unknown } | null;
  const raw = summary?.startTime;
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// ── Deeltekst ───────────────────────────────────────────────────────────────

// Deterministische basistekst uit uitsluitend echte, aanwezige waarden.
export function buildDeterministicShareText(session: TrainingSession): string {
  const parts: string[] = [];
  if (session.distanceKm != null && session.distanceKm !== "") {
    const km = Number(session.distanceKm);
    if (Number.isFinite(km)) parts.push(`${km.toLocaleString("nl-NL")} km`);
  }
  if (session.durationMin != null) {
    const h = Math.floor(session.durationMin / 60);
    const m = session.durationMin % 60;
    parts.push(h > 0 ? `${h}u${m.toString().padStart(2, "0")}` : `${m} min`);
  }
  if (session.elevationM != null) parts.push(`${session.elevationM} hoogtemeters`);
  if (session.avgPower != null) parts.push(`${session.avgPower} W gemiddeld`);
  const title = session.title?.trim() || "Rit";
  const stats = parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
  return `${title}${stats}. Vastgelegd met Sparki.`;
}

// Deeltekst met een vlot voorstel op basis van de ECHTE metingen. Faalt de
// tekstopbouw, dan valt hij terug op de deterministische versie — nooit een
// lege of verzonnen tekst.
export async function buildShareText(session: TrainingSession): Promise<{
  text: string;
  generated: boolean;
}> {
  const fallback = buildDeterministicShareText(session);
  const facts: string[] = [`Titel: ${session.title ?? "Rit"}`, `Datum: ${session.sessionDate}`];
  if (session.distanceKm) facts.push(`Afstand: ${session.distanceKm} km`);
  if (session.durationMin != null) facts.push(`Duur: ${session.durationMin} min`);
  if (session.elevationM != null) facts.push(`Hoogtemeters: ${session.elevationM} m`);
  if (session.avgPower != null) facts.push(`Gemiddeld vermogen: ${session.avgPower} W`);
  if (session.normalizedPower != null)
    facts.push(`Genormaliseerd vermogen: ${session.normalizedPower} W`);
  if (session.avgHR != null) facts.push(`Gemiddelde hartslag: ${session.avgHR}`);
  if (session.avgSpeedKph) facts.push(`Gemiddelde snelheid: ${session.avgSpeedKph} km/u`);
  if (session.feelScore != null) facts.push(`Gevoel (1-10): ${session.feelScore}`);
  if (session.notes) facts.push(`Eigen notitie: ${session.notes.slice(0, 300)}`);

  try {
    const message = await aiMessage("ride_story", null, {
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        "Je schrijft een korte, vlotte deeltekst in het Nederlands voor sociale media over een fietsrit. " +
        "Regels: gebruik UITSLUITEND de aangeleverde echte waarden — verzin niets en rond niets bij. " +
        "Maximaal 2 zinnen plus eventueel de kerngetallen. Eerste persoon (de renner deelt zelf). " +
        "Geen hashtags-overdaad (hoogstens één), geen emoji-overdaad (hoogstens één), geen Engels jargon, " +
        "noem nergens 'AI'. Eindig niet met een vraag.",
      messages: [
        {
          role: "user",
          content: `Schrijf de deeltekst op basis van deze echte ritdata:\n${facts.join("\n")}`,
        },
      ],
    });
    const block = message.content[0];
    if (block && block.type === "text" && block.text.trim().length > 0) {
      return { text: block.text.trim(), generated: true };
    }
  } catch {
    // eerlijk terugvallen — geen tekst verzinnen bovenop een fout
  }
  return { text: fallback, generated: false };
}

// ── Strava-upload (handmatige activiteit met echte totalen) ─────────────────

export type StravaUploadResult = {
  stravaActivityId: number;
  url: string;
};

export async function uploadSessionToStrava(
  clerkId: string,
  session: TrainingSession,
  description: string | null,
): Promise<StravaUploadResult> {
  const caps = await getShareCapabilities(clerkId, session);
  if (!caps.strava.canUpload) {
    throw new Error(caps.strava.reason ?? "Uploaden naar Strava kan nu niet.");
  }
  const startTime = await getSessionStartTime(clerkId, session.id);
  if (!startTime || session.durationMin == null) {
    throw new Error("Van deze rit ontbreken starttijd of duur.");
  }
  const accessToken = await getValidStravaAccessToken(clerkId);

  const body = new URLSearchParams({
    name: session.title?.trim() || "Rit",
    sport_type: session.sport === "running" ? "Run" : "Ride",
    start_date_local: startTime,
    elapsed_time: String(session.durationMin * 60),
  });
  const km = session.distanceKm != null ? Number(session.distanceKm) : NaN;
  if (Number.isFinite(km) && km > 0) body.set("distance", String(Math.round(km * 1000)));
  if (description && description.trim()) body.set("description", description.trim().slice(0, 500));

  const res = await fetch(STRAVA_ACTIVITIES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (res.status === 409) {
    throw new Error("Strava heeft deze activiteit al — er staat al een rit op dit tijdstip.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Strava weigerde de upload: geen toestemming. Koppel Strava opnieuw en vink 'activiteiten uploaden' aan.",
    );
  }
  if (!res.ok) {
    throw new Error("Strava kon de rit nu niet aannemen. Probeer het later opnieuw.");
  }
  const data = (await res.json()) as { id?: number };
  if (typeof data.id !== "number") {
    throw new Error("Strava gaf geen geldige activiteit terug.");
  }
  return {
    stravaActivityId: data.id,
    url: `https://www.strava.com/activities/${data.id}`,
  };
}

export async function loadOwnedSession(
  clerkId: string,
  sessionId: number,
): Promise<TrainingSession | null> {
  const [session] = await db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.id, sessionId),
        eq(trainingSessionsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  return session ?? null;
}
