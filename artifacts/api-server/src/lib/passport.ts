// Golf 20 — Sportpaspoort-engine.
//
// Eén herleidbaar sportprofiel bovenop de bestaande tabellen:
// athlete_profiles blijft de SSOT voor actuele waarden (alle bestaande
// schermen en engines blijven dezelfde getallen zien); dit bestand voegt
// alleen herkomst, historie, voorstellen en samengestelde weergaven toe.
// Eerlijkheid: geen waarde zonder herkomst verzinnen — bestaat er geen
// event, dan is de herkomst gewoon "onbekend (vóór het paspoort)".
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  ftpHistoryTable,
  athleteDailyMetricsTable,
  trainingSessionsTable,
  coachAthleteLinksTable,
  passportValueEventsTable,
  passportProposalsTable,
  type PassportOrigin,
  type PassportActorType,
} from "@workspace/db";

// ── Gevolgde velden ──────────────────────────────────────────────────────────
// Kernwaarden waarvan iedere wijziging een event krijgt. `zonesAffecting`
// betekent: automatische wijzigingen mogen NOOIT stil worden toegepast —
// alleen via een bevestigd voorstel.
export const PASSPORT_FIELDS = {
  ftp: { label: "FTP", unit: "watt", zonesAffecting: true },
  weightKg: { label: "Gewicht", unit: "kg", zonesAffecting: false },
  heightCm: { label: "Lengte", unit: "cm", zonesAffecting: false },
  weeklyHourTarget: { label: "Weekuren-doel", unit: "uur", zonesAffecting: false },
  discipline: { label: "Discipline", unit: null, zonesAffecting: false },
  developmentGoal: { label: "Ontwikkeldoel", unit: null, zonesAffecting: false },
  healthStatus: { label: "Gezondheidsstatus", unit: null, zonesAffecting: true },
  injuryHistory: { label: "Blessurehistorie", unit: null, zonesAffecting: false },
} as const;
export type PassportField = keyof typeof PASSPORT_FIELDS;

export function isPassportField(f: string): f is PassportField {
  return Object.prototype.hasOwnProperty.call(PASSPORT_FIELDS, f);
}

const STALE_AFTER_DAYS = 180;

// Uitvoerder: de globale db óf een lopende transactie. Zo kunnen schrijfpaden
// waarde-wijziging en event ATOMAIR vastleggen — nooit het één zonder het
// ander ("nooit stil overschrijven" geldt ook bij een storing halverwege).
export type PassportDbx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Events ───────────────────────────────────────────────────────────────────

export async function recordValueEvent(input: {
  clerkId: string;
  field: PassportField;
  oldValue: string | null;
  newValue: string | null;
  origin: PassportOrigin;
  source?: string | null;
  actorType: PassportActorType;
  actorId: string;
  measuredAt?: string | null;
  confidence?: number | null;
  note?: string | null;
}, dbx: PassportDbx = db): Promise<void> {
  // Geen wijziging = geen event (historie blijft betekenisvol).
  if ((input.oldValue ?? null) === (input.newValue ?? null)) return;
  await dbx.insert(passportValueEventsTable).values({
    clerkId: input.clerkId,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
    origin: input.origin,
    source: input.source ?? null,
    actorType: input.actorType,
    actorId: input.actorId,
    measuredAt: input.measuredAt ?? null,
    confidence:
      input.confidence != null && input.confidence >= 0 && input.confidence <= 1
        ? String(input.confidence)
        : null,
    note: input.note ?? null,
  });
}

// Huidige waarde van een gevolgd veld als tekst-snapshot.
async function currentValue(
  clerkId: string,
  field: PassportField,
): Promise<string | null> {
  const [p] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!p) return null;
  const v = (p as Record<string, unknown>)[field];
  return v == null ? null : String(v);
}

// ── Waarde toepassen (schrijven + event, atomair gedrag) ─────────────────────

export async function applyValueChange(input: {
  clerkId: string;
  field: PassportField;
  newValue: string | null;
  origin: PassportOrigin;
  source?: string | null;
  actorType: PassportActorType;
  actorId: string;
  measuredAt?: string | null;
  confidence?: number | null;
  note?: string | null;
}, dbxOuter?: PassportDbx): Promise<{ changed: boolean; oldValue: string | null }> {
  const old = await currentValue(input.clerkId, input.field);
  if ((old ?? null) === (input.newValue ?? null))
    return { changed: false, oldValue: old };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  switch (input.field) {
    case "ftp": {
      const n = input.newValue == null ? null : Math.round(Number(input.newValue));
      if (n != null && (!Number.isFinite(n) || n < 50 || n > 600))
        throw new Error("FTP buiten plausibel bereik (50–600 watt)");
      set.ftp = n;
      // Een gemeten/handmatige FTP is geen schatting meer.
      if (input.origin === "gemeten" || input.origin === "handmatig")
        set.ftpEstimated = false;
      break;
    }
    case "weightKg": {
      if (input.newValue != null) {
        const n = Number(input.newValue);
        if (!Number.isFinite(n) || n < 25 || n > 250)
          throw new Error("Gewicht buiten plausibel bereik (25–250 kg)");
        set.weightKg = n.toFixed(1);
      } else set.weightKg = null;
      break;
    }
    case "heightCm": {
      const n = input.newValue == null ? null : Math.round(Number(input.newValue));
      if (n != null && (!Number.isFinite(n) || n < 100 || n > 230))
        throw new Error("Lengte buiten plausibel bereik (100–230 cm)");
      set.heightCm = n;
      break;
    }
    case "weeklyHourTarget": {
      const n = input.newValue == null ? null : Math.round(Number(input.newValue));
      if (n != null && (!Number.isFinite(n) || n < 1 || n > 40))
        throw new Error("Weekuren buiten plausibel bereik (1–40)");
      set.weeklyHourTarget = n;
      if (n != null && (input.origin === "handmatig" || input.origin === "gemeten"))
        set.weeklyHourTargetEstimated = false;
      break;
    }
    case "healthStatus": {
      const allowed = ["ok", "sick", "injured"];
      if (input.newValue == null || !allowed.includes(input.newValue))
        throw new Error("Ongeldige gezondheidsstatus");
      set.healthStatus = input.newValue;
      break;
    }
    default:
      set[input.field] = input.newValue;
  }

  // Waarde + event + ftp_history in één transactie: een storing halverwege
  // laat nooit een gewijzigde waarde zonder herleidbaar event achter.
  const run = async (tx: PassportDbx) => {
    const updatedRows = await tx
      .update(athleteProfilesTable)
      .set(set)
      .where(eq(athleteProfilesTable.clerkId, input.clerkId))
      .returning({ clerkId: athleteProfilesTable.clerkId });
    // Geen profielrij ⇒ er is NIETS opgeslagen; een event schrijven zou een
    // herkomst claimen voor een waarde die niet bestaat. Hard falen (rollback).
    if (updatedRows.length === 0)
      throw new Error(
        `Geen profielrij voor ${input.clerkId} — kernwaarde ${input.field} niet opgeslagen`,
      );

    await recordValueEvent({ ...input, oldValue: old }, tx);

    // Gemeten/handmatige FTP hoort ook in ftp_history zodat belastingscores
    // per datum de juiste waarde blijven gebruiken (bestaand mechanisme).
    if (
      input.field === "ftp" &&
      input.newValue != null &&
      (input.origin === "gemeten" || input.origin === "handmatig")
    ) {
      const measuredAt =
        input.measuredAt ?? new Date().toISOString().slice(0, 10);
      const [existing] = await tx
        .select({ id: ftpHistoryTable.id })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, input.clerkId),
            eq(ftpHistoryTable.measuredAt, measuredAt),
            eq(ftpHistoryTable.testType, "manual"),
          ),
        )
        .limit(1);
      const watts = Math.round(Number(input.newValue));
      if (existing) {
        await tx
          .update(ftpHistoryTable)
          .set({ ftpWatts: watts, notes: input.source ?? null })
          .where(eq(ftpHistoryTable.id, existing.id));
      } else {
        await tx.insert(ftpHistoryTable).values({
          clerkId: input.clerkId,
          measuredAt,
          ftpWatts: watts,
          testType: "manual",
          notes: input.source ?? null,
        });
      }
    }
  };

  if (dbxOuter) await run(dbxOuter);
  else await db.transaction(async (tx) => run(tx));

  return { changed: true, oldValue: old };
}

// ── WP-K1: events voor een bestaand patch-schrijfpad ─────────────────────────
// Sommige paden (onboarding, seeds, connector-sync) schrijven een patch met
// meerdere velden in één upsert. Deze helper legt voor elk paspoortveld in de
// patch een herkomst-event vast t.o.v. de oude rij — aanroepen BINNEN dezelfde
// transactie als de waarde-schrijf, zodat waarde en herkomst atomair blijven.
export function samePassportValue(a: string | null, b: string | null): boolean {
  if ((a ?? null) === (b ?? null)) return true;
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export async function recordEventsForPatch(
  input: {
    clerkId: string;
    patch: Record<string, unknown>;
    before: Record<string, unknown> | null | undefined;
    origin: PassportOrigin;
    source: string;
    actorType: PassportActorType;
    actorId: string;
  },
  dbx: PassportDbx,
): Promise<void> {
  for (const f of Object.keys(input.patch)) {
    if (!isPassportField(f)) continue;
    const nvRaw = input.patch[f];
    const nv = nvRaw == null ? null : String(nvRaw);
    const ovRaw = input.before ? (input.before as Record<string, unknown>)[f] : null;
    const ov = ovRaw == null ? null : String(ovRaw);
    if (samePassportValue(ov, nv)) continue;
    await recordValueEvent(
      {
        clerkId: input.clerkId,
        field: f,
        oldValue: ov,
        newValue: nv,
        origin: input.origin,
        source: input.source,
        actorType: input.actorType,
        actorId: input.actorId,
      },
      dbx,
    );
  }
}

// ── Voorstellen ──────────────────────────────────────────────────────────────

export async function createProposal(input: {
  clerkId: string;
  field: PassportField;
  proposedValue: string;
  origin: PassportOrigin;
  source?: string | null;
  reason: string;
  proposedBy: string;
}): Promise<{ created: boolean }> {
  const cur = await currentValue(input.clerkId, input.field);
  // Geen voorstel voor wat al zo is.
  if ((cur ?? null) === input.proposedValue) return { created: false };
  const rows = await db
    .insert(passportProposalsTable)
    .values({
      clerkId: input.clerkId,
      field: input.field,
      proposedValue: input.proposedValue,
      currentValue: cur,
      origin: input.origin,
      source: input.source ?? null,
      reason: input.reason,
      status: "open",
      proposedBy: input.proposedBy,
    })
    .onConflictDoNothing()
    .returning({ id: passportProposalsTable.id });
  return { created: rows.length > 0 };
}

export async function isAcceptedCoachOf(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: coachAthleteLinksTable.status })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, coachClerkId),
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  return row != null;
}

export async function decideProposal(input: {
  proposalId: number;
  deciderClerkId: string;
  decision: "geaccepteerd" | "afgewezen";
}): Promise<
  | { ok: true; status: string }
  | { ok: false; code: 403 | 404 | 409; error: string }
> {
  const [prop] = await db
    .select()
    .from(passportProposalsTable)
    .where(eq(passportProposalsTable.id, input.proposalId))
    .limit(1);
  if (!prop) return { ok: false, code: 404, error: "Voorstel niet gevonden" };

  const isSelf = prop.clerkId === input.deciderClerkId;
  const isCoach =
    !isSelf && (await isAcceptedCoachOf(input.deciderClerkId, prop.clerkId));
  if (!isSelf && !isCoach)
    return { ok: false, code: 403, error: "Geen recht om dit voorstel te besluiten" };

  // Atomair én race-veilig: statuswissel (alleen het OPEN voorstel) en het
  // toepassen van de waarde gebeuren in ÉÉN transactie — nooit een "besloten"
  // voorstel zonder toegepaste waarde of andersom.
  let alreadyDecided = false;
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(passportProposalsTable)
      .set({
        status: input.decision,
        decidedBy: input.deciderClerkId,
        decidedAt: new Date(),
      })
      .where(
        and(
          eq(passportProposalsTable.id, input.proposalId),
          eq(passportProposalsTable.status, "open"),
        ),
      )
      .returning({ id: passportProposalsTable.id });
    if (updated.length === 0) {
      alreadyDecided = true;
      return;
    }

    if (input.decision === "geaccepteerd" && isPassportField(prop.field)) {
      await applyValueChange({
        clerkId: prop.clerkId,
        field: prop.field,
        newValue: prop.proposedValue,
        origin: prop.origin as PassportOrigin,
        source: prop.source,
        actorType: isSelf ? "sporter" : "coach",
        actorId: input.deciderClerkId,
        note: `Bevestigd voorstel: ${prop.reason}`,
      }, tx);
      // Berekende FTP (ondergrens) blijft een schatting — vlag expliciet houden.
      if (prop.field === "ftp" && prop.origin === "berekend") {
        await tx
          .update(athleteProfilesTable)
          .set({ ftpEstimated: true })
          .where(eq(athleteProfilesTable.clerkId, prop.clerkId));
      }
    }
  });
  if (alreadyDecided)
    return { ok: false, code: 409, error: "Voorstel is al besloten" };
  return { ok: true, status: input.decision };
}

// ── Samengesteld paspoort ────────────────────────────────────────────────────

type FieldView = {
  field: PassportField;
  label: string;
  unit: string | null;
  value: string | null;
  origin: PassportOrigin | "onbekend";
  source: string | null;
  since: string | null; // wanneer laatst vastgesteld (event createdAt of measuredAt)
  confidence: number | null;
  estimated: boolean;
  stale: boolean; // langer dan STALE_AFTER_DAYS niet (her)bevestigd
  zonesAffecting: boolean;
};

export async function composePassport(clerkId: string) {
  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile) return null;

  // Laatste event per veld in één query.
  const events = await db
    .select()
    .from(passportValueEventsTable)
    .where(eq(passportValueEventsTable.clerkId, clerkId))
    .orderBy(desc(passportValueEventsTable.createdAt))
    .limit(400);
  const latestByField = new Map<string, (typeof events)[number]>();
  for (const e of events)
    if (!latestByField.has(e.field)) latestByField.set(e.field, e);

  const now = Date.now();
  const fields: FieldView[] = (
    Object.keys(PASSPORT_FIELDS) as PassportField[]
  ).map((f) => {
    const meta = PASSPORT_FIELDS[f];
    const raw = (profile as Record<string, unknown>)[f];
    const value = raw == null ? null : String(raw);
    const ev = latestByField.get(f);
    // Event telt alleen als het de huidige waarde beschrijft — anders is de
    // waarde langs een oud pad gewijzigd en is de herkomst eerlijk onbekend.
    // Numeriek vergelijken waar mogelijk: een numeric-kolom rendert "71.50"
    // terwijl het event "71.5" vastlegde — dat is dezelfde waarde.
    const sameValue = (a: string | null, b: string | null): boolean => {
      if ((a ?? null) === (b ?? null)) return true;
      if (a == null || b == null) return false;
      const na = Number(a);
      const nb = Number(b);
      return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
    };
    const evMatches = ev != null && sameValue(ev.newValue, value);
    const estimated =
      (f === "ftp" && profile.ftpEstimated === true) ||
      (f === "weeklyHourTarget" && profile.weeklyHourTargetEstimated === true);
    const sinceIso = evMatches
      ? (ev!.measuredAt ?? ev!.createdAt.toISOString().slice(0, 10))
      : null;
    const stale =
      value != null &&
      sinceIso != null &&
      now - new Date(`${sinceIso}T00:00:00`).getTime() >
        STALE_AFTER_DAYS * 86400_000;
    return {
      field: f,
      label: meta.label,
      unit: meta.unit,
      value,
      origin: evMatches
        ? (ev!.origin as PassportOrigin)
        : value != null && estimated
          ? "geschat"
          : "onbekend",
      source: evMatches ? ev!.source : null,
      since: sinceIso,
      confidence: evMatches && ev!.confidence != null ? Number(ev!.confidence) : null,
      estimated,
      stale,
      zonesAffecting: meta.zonesAffecting,
    };
  });

  const proposals = await db
    .select()
    .from(passportProposalsTable)
    .where(
      and(
        eq(passportProposalsTable.clerkId, clerkId),
        eq(passportProposalsTable.status, "open"),
      ),
    )
    .orderBy(desc(passportProposalsTable.createdAt));

  // Datakwaliteit: eerlijk over gaten, schattingen en veroudering.
  const missing = fields.filter((f) => f.value == null).map((f) => f.field);
  const estimatedFields = fields
    .filter((f) => f.estimated && f.value != null)
    .map((f) => f.field);
  const staleFields = fields.filter((f) => f.stale).map((f) => f.field);
  const unknownOrigin = fields
    .filter((f) => f.value != null && f.origin === "onbekend")
    .map((f) => f.field);

  return {
    fields,
    history: events.slice(0, 100),
    proposals,
    quality: {
      missing,
      estimated: estimatedFields,
      stale: staleFields,
      unknownOrigin,
      staleAfterDays: STALE_AFTER_DAYS,
    },
  };
}

// ── Ontwikkelingsweergave (betrouwbaarheidsgates, nooit verzonnen trends) ────

export async function composeOntwikkeling(clerkId: string) {
  const ftpSeries = await db
    .select({
      measuredAt: ftpHistoryTable.measuredAt,
      ftpWatts: ftpHistoryTable.ftpWatts,
      testType: ftpHistoryTable.testType,
    })
    .from(ftpHistoryTable)
    .where(eq(ftpHistoryTable.clerkId, clerkId))
    .orderBy(ftpHistoryTable.measuredAt);

  const weightSeries = await db
    .select({
      metricDate: athleteDailyMetricsTable.metricDate,
      weightKg: athleteDailyMetricsTable.weightKg,
    })
    .from(athleteDailyMetricsTable)
    .where(
      and(
        eq(athleteDailyMetricsTable.clerkId, clerkId),
        sql`${athleteDailyMetricsTable.weightKg} IS NOT NULL`,
      ),
    )
    .orderBy(athleteDailyMetricsTable.metricDate);

  // Beste vermogens per venster over alle sessies (JSONB power_bests).
  const bests = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      powerBests: trainingSessionsTable.powerBests,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        sql`${trainingSessionsTable.powerBests} IS NOT NULL`,
      ),
    );
  const bestByWindow: Record<string, { watts: number; date: string }> = {};
  for (const s of bests) {
    const pb = s.powerBests as Record<string, number> | null;
    if (!pb) continue;
    for (const [win, watts] of Object.entries(pb)) {
      if (typeof watts !== "number" || !Number.isFinite(watts) || watts <= 0)
        continue;
      const cur = bestByWindow[win];
      if (!cur || watts > cur.watts)
        bestByWindow[win] = { watts: Math.round(watts), date: s.sessionDate };
    }
  }

  const [sessionCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId));

  // Betrouwbaarheidsgate: pas een ontwikkelingsverhaal tonen als er echt
  // genoeg meetpunten zijn. Anders eerlijk "nog onvoldoende gegevens".
  const reliable =
    ftpSeries.length >= 2 || weightSeries.length >= 5 || (sessionCount?.n ?? 0) >= 8;

  return {
    reliable,
    reliableReason: reliable
      ? null
      : "Nog onvoldoende meetpunten voor een betrouwbaar ontwikkelingsbeeld. Voeg een FTP-test toe of importeer meer ritten.",
    ftpSeries,
    weightSeries: weightSeries.map((w) => ({
      date: w.metricDate,
      weightKg: w.weightKg == null ? null : Number(w.weightKg),
    })),
    powerBests: bestByWindow,
    sessionCount: sessionCount?.n ?? 0,
  };
}

// ── Export (door de sporter samengesteld; gevoelige delen standaard uit) ─────

export const EXPORT_SECTIONS = [
  "identiteit",
  "prestaties",
  "historie",
  "ontwikkeling",
  "gezondheid", // standaard UIT
  "locatie", // standaard UIT
  "notities", // standaard UIT (privé aantekeningen/motivatie)
] as const;
export type ExportSection = (typeof EXPORT_SECTIONS)[number];
export const DEFAULT_OFF_SECTIONS: ExportSection[] = [
  "gezondheid",
  "locatie",
  "notities",
];

export async function composeExport(
  clerkId: string,
  sections: ExportSection[],
): Promise<Record<string, unknown> | null> {
  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile) return null;

  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    sections,
  };
  const want = new Set(sections);

  if (want.has("identiteit")) {
    out.identiteit = {
      discipline: profile.discipline,
      sport: profile.sport,
      ervaring: profile.experienceLevel,
      ontwikkeldoel: profile.developmentGoal,
      geboortejaar: profile.birthYear,
    };
  }
  if (want.has("prestaties")) {
    out.prestaties = {
      ftp: profile.ftp,
      ftpGeschat: profile.ftpEstimated,
      gewichtKg: profile.weightKg,
      lengteCm: profile.heightCm,
      weekurenDoel: profile.weeklyHourTarget,
    };
  }
  if (want.has("historie")) {
    const events = await db
      .select({
        field: passportValueEventsTable.field,
        oldValue: passportValueEventsTable.oldValue,
        newValue: passportValueEventsTable.newValue,
        origin: passportValueEventsTable.origin,
        source: passportValueEventsTable.source,
        measuredAt: passportValueEventsTable.measuredAt,
        createdAt: passportValueEventsTable.createdAt,
      })
      .from(passportValueEventsTable)
      .where(eq(passportValueEventsTable.clerkId, clerkId))
      .orderBy(desc(passportValueEventsTable.createdAt))
      .limit(200);
    // Gezondheidsgerelateerde events alleen als de sectie gezondheid AAN is.
    out.historie = events.filter(
      (e) =>
        want.has("gezondheid") ||
        (e.field !== "healthStatus" && e.field !== "injuryHistory"),
    );
  }
  if (want.has("ontwikkeling")) {
    out.ontwikkeling = await composeOntwikkeling(clerkId);
  }
  if (want.has("gezondheid")) {
    out.gezondheid = {
      status: profile.healthStatus,
      blessurehistorie: profile.injuryHistory,
    };
  }
  if (want.has("locatie")) {
    out.locatie = {
      thuisLabel: profile.homeLabel,
      thuisLat: profile.homeLat,
      thuisLon: profile.homeLon,
    };
  }
  if (want.has("notities")) {
    out.notities = {
      doelen: profile.goals,
      motivatie: profile.motivation,
      trainingsvoorkeuren: profile.trainingPreferences,
    };
  }
  return out;
}
