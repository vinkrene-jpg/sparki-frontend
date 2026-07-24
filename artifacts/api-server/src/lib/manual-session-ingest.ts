// Handmatige activiteit → Data Hub-conforme opname.
//
// Een handmatig gelogde sessie heeft alleen een datum (geen starttijd), dus de
// reguliere 5-minuten-bucket-dedupe van de Data Hub kan er niet op werken. We
// verzinnen GEEN starttijd (dat zou een vals dedupe-signaal zijn); in plaats
// daarvan dedupliceren we eerlijk op dag-niveau: bestaat er op dezelfde dag al
// een sessie van hetzelfde type die qua duur/afstand plausibel dezelfde rit is,
// dan vullen we die aan (bestaande waarden winnen) in plaats van een tweede rij
// te maken. Zo telt dezelfde training nooit dubbel mee in de belasting, ook
// niet wanneer de rit eerst via Strava/bestand binnenkwam en daarna nog eens
// handmatig wordt gelogd.
//
// De omgekeerde volgorde (eerst handmatig, daarna import met echte starttijd)
// wordt afgedekt in engines/data-hub/ingest.ts, dat handmatige zelfde-dag
// sessies als merge-kandidaat meeneemt.

import { and, eq } from "drizzle-orm";
import { db, trainingSessionsTable } from "@workspace/db";
import {
  activitiesPlausiblyEqual,
  buildMergePatch,
  mergeSources,
} from "../engines/data-hub/dedupe";
import { deriveTss, ftpAtDate, type FtpEntry } from "./derived-load";
import { recordComputation } from "../engines/data-origin";
import { athleteProfilesTable, ftpHistoryTable } from "@workspace/db";

export interface ManualSessionInput {
  sessionDate: string; // YYYY-MM-DD
  type: string;
  title?: string | null;
  durationMin?: number | null;
  distanceKm?: string | null;
  elevationM?: number | null;
  normalizedPower?: number | null;
  avgPower?: number | null;
  avgHR?: number | null;
  tss?: number | null;
  intensityFactor?: string | null;
  notes?: string | null;
  feelScore?: number | null;
}

export interface ManualIngestResult {
  session: typeof trainingSessionsTable.$inferSelect;
  merged: boolean;
}

async function loadFtp(clerkId: string): Promise<{
  profileFtp: number | null;
  history: FtpEntry[];
}> {
  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const history = await db
    .select({
      measuredAt: ftpHistoryTable.measuredAt,
      ftpWatts: ftpHistoryTable.ftpWatts,
    })
    .from(ftpHistoryTable)
    .where(eq(ftpHistoryTable.clerkId, clerkId));
  return { profileFtp: profile?.ftp ?? null, history };
}

/**
 * Neem een handmatige sessie op met dezelfde eerlijkheidsregels als de Data
 * Hub: dag-niveau dedupe (samenvoegen, nooit dubbel tellen) en een afgeleide
 * belastingscore wanneer vermogen + FTP dat toelaten. Ontbrekende data blijft
 * eerlijk leeg — er wordt niets verzonnen.
 */
export async function ingestManualSession(
  clerkId: string,
  input: ManualSessionInput,
): Promise<ManualIngestResult> {
  // Belastingscore afleiden zoals de hub dat doet, als die niet is opgegeven.
  let tss = input.tss ?? null;
  let intensityFactor = input.intensityFactor ?? null;
  let derivedTssParams: Record<string, unknown> | null = null;
  if (tss == null) {
    const ftpCtx = await loadFtp(clerkId);
    const ftpUsed = ftpAtDate(
      ftpCtx.history,
      input.sessionDate,
      ftpCtx.profileFtp,
    );
    const derived = deriveTss({
      durationMin: input.durationMin ?? null,
      normalizedPower: input.normalizedPower ?? null,
      avgPower: input.avgPower ?? null,
      ftp: ftpUsed,
    });
    if (derived) {
      tss = derived.tss;
      intensityFactor = String(derived.intensityFactor);
      derivedTssParams = {
        ftp: ftpUsed,
        durationMin: input.durationMin ?? null,
        normalizedPower: input.normalizedPower ?? null,
        avgPower: input.avgPower ?? null,
      };
    }
  }

  // Dag-niveau dedupe: zelfde dag + zelfde type + plausibel dezelfde rit.
  // Strengheidsregel: zonder minstens één sterke vergelijker (duur of afstand
  // aan BEIDE kanten aanwezig en geldig) mergen we NOOIT — twee sessies op
  // dezelfde dag zonder vergelijkbare cijfers kunnen net zo goed twee echte
  // trainingen zijn. Liever een dubbele rij die de sporter zelf kan opruimen
  // dan stilletjes iemands training wegvegen.
  const incomingDuration =
    typeof input.durationMin === "number" && Number.isFinite(input.durationMin)
      ? input.durationMin
      : null;
  const incomingDistanceRaw =
    input.distanceKm != null && input.distanceKm !== ""
      ? Number(input.distanceKm)
      : null;
  const incomingDistance =
    incomingDistanceRaw != null && Number.isFinite(incomingDistanceRaw)
      ? incomingDistanceRaw
      : null;

  const sameDay = await db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.sessionDate, input.sessionDate),
        eq(trainingSessionsTable.type, input.type),
      ),
    );
  const existing = sameDay.find((c) => {
    const candidateDuration =
      typeof c.durationMin === "number" && Number.isFinite(c.durationMin)
        ? c.durationMin
        : null;
    const candidateDistanceRaw =
      c.distanceKm != null ? Number(c.distanceKm) : null;
    const candidateDistance =
      candidateDistanceRaw != null && Number.isFinite(candidateDistanceRaw)
        ? candidateDistanceRaw
        : null;
    const hasStrongComparator =
      (incomingDuration != null && candidateDuration != null) ||
      (incomingDistance != null && candidateDistance != null);
    if (!hasStrongComparator) return false;
    return activitiesPlausiblyEqual(c, {
      durationMin: incomingDuration,
      distanceKm: incomingDistance,
    });
  });

  if (existing) {
    // Samenvoegen: bestaande (bron)waarden winnen, handmatige invoer vult
    // alleen gaten. De bron "manual" wordt wel geregistreerd.
    const incoming: Record<string, unknown> = {
      durationMin: input.durationMin ?? null,
      distanceKm: input.distanceKm ?? null,
      elevationM: input.elevationM ?? null,
      normalizedPower: input.normalizedPower ?? null,
      avgPower: input.avgPower ?? null,
      avgHR: input.avgHR ?? null,
      tss,
      intensityFactor,
      title: input.title ?? null,
      notes: input.notes ?? null,
    };
    const patch = buildMergePatch(
      existing as unknown as Record<string, unknown>,
      incoming,
    );
    // Subjectieve laag (gevoel) mag altijd aanvullen als die nog leeg is.
    if (existing.feelScore == null && input.feelScore != null) {
      (patch as Record<string, unknown>)["feelScore"] = input.feelScore;
    }
    const sources = mergeSources(existing.sources ?? null, "manual");
    const [updated] = await db
      .update(trainingSessionsTable)
      .set({ ...patch, sources, updatedAt: new Date() })
      .where(eq(trainingSessionsTable.id, existing.id))
      .returning();
    return { session: updated!, merged: true };
  }

  const [inserted] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId,
      sessionDate: input.sessionDate,
      type: input.type,
      title: input.title ?? null,
      durationMin: input.durationMin ?? null,
      distanceKm: input.distanceKm ?? null,
      elevationM: input.elevationM ?? null,
      normalizedPower: input.normalizedPower ?? null,
      avgPower: input.avgPower ?? null,
      avgHR: input.avgHR ?? null,
      tss,
      intensityFactor,
      notes: input.notes ?? null,
      feelScore: input.feelScore ?? null,
      source: "manual",
      sources: ["manual"],
    })
    .returning();
  // Herleidbaarheid: registreer de afgeleide belastingscore met engine,
  // parameters en brondata (Data Origin-framework).
  if (derivedTssParams && inserted) {
    await recordComputation({
      clerkId,
      subjectType: "derived_tss",
      subjectId: String(inserted.id),
      engine: "deriveTss",
      engineVersion: "1",
      parameters: derivedTssParams,
      inputs: [
        {
          bron: "manual",
          tabel: "training_sessions",
          recordId: inserted.id,
          veld: "avgPower/normalizedPower/durationMin",
        },
        { bron: "derived", tabel: "ftp_history", veld: "ftp_watts" },
      ],
      reliability: "afgeleid",
    });
  }
  return { session: inserted!, merged: false };
}
