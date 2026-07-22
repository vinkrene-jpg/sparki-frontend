// Clubomgeving — route-contracttest voor Afbouwgolf 10.
//
// Boot de ECHTE Express-app en test het volledige clubcontract:
//   • Club aanmaken → maker is owner, proefabonnement actief.
//   • Toegangsgates fail-closed: niet-lid 403 op alle clubroutes.
//   • Uitnodigingen: alleen beheer; accepteren maakt lidmaatschap met rol.
//   • Trainingen: alleen beheer/trainer plant; vol → reserve; afmelden
//     promoveert reserve + notificatie; conflicts[] eerlijk gemeld.
//   • Schema-koppeling: NIEUWE planned_workouts-rij (source "club");
//     coachtraining vervangen → 409, wordt nooit automatisch overschreven.
//   • Aanwezigheid: alleen trainer van de training of beheer.
//   • Wedstrijden: beheer/teammanager beheert; lid zet eigen beschikbaarheid.
//   • Berichten: club-scope alleen door wie mag posten; lezen door leden.
//   • Jeugd-consent fail-closed: minderjarig/onbekende leeftijd → zelf 403,
//     alleen gekoppelde ouder; trainer-samenvatting consent-gated.
//   • Export zonder sportdata; audit; uitschrijven bewaart historie.
//
// Run: `pnpm --filter @workspace/api-server run test:club`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  parentAthleteLinksTable,
  plannedWorkoutsTable,
  invitationsTable,
  notificationsTable,
  clubsTable,
  clubMembersTable,
  clubTrainingsTable,
  clubTrainingSignupsTable,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubMessagesTable,
  clubConsentsTable,
  clubSubscriptionsTable,
  clubAuditLogTable,
  clubTrainerAssignmentsTable,
  clubTeamsTable,
  clubTeamMembersTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Server boot ──────────────────────────────────────────────────────────────
let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_club_${Date.now()}`;
const clerkOwner = `${RUN}_owner`;
const clerkTrainer = `${RUN}_trainer`;
const clerkManager = `${RUN}_manager`;
const clerkAdult = `${RUN}_adult`; // volwassen lid
const clerkAdult2 = `${RUN}_adult2`; // tweede volwassen lid (reserve-flow)
const clerkYouth = `${RUN}_youth`; // minderjarig lid
const clerkUnknownAge = `${RUN}_unknown`; // leeftijd onbekend
const clerkParent = `${RUN}_parent`; // gekoppelde ouder van youth
const clerkOutsider = `${RUN}_outsider`; // GEEN lid
const ALL = [
  clerkOwner,
  clerkTrainer,
  clerkManager,
  clerkAdult,
  clerkAdult2,
  clerkYouth,
  clerkUnknownAge,
  clerkParent,
  clerkOutsider,
];

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

let clubId = 0;

async function seed() {
  await ensureAccount(clerkOwner, `${clerkOwner}@example.test`, "Club Eigenaar", silentLogger);
  await ensureAccount(clerkTrainer, `${clerkTrainer}@example.test`, "Club Trainer", silentLogger);
  await ensureAccount(clerkManager, `${clerkManager}@example.test`, "Team Manager", silentLogger);
  await ensureAccount(clerkAdult, `${clerkAdult}@example.test`, "Volwassen Lid", silentLogger);
  await ensureAccount(clerkAdult2, `${clerkAdult2}@example.test`, "Volwassen Lid 2", silentLogger);
  await ensureAccount(clerkYouth, `${clerkYouth}@example.test`, "Jeugd Lid", silentLogger);
  await ensureAccount(clerkUnknownAge, `${clerkUnknownAge}@example.test`, "Leeftijd Onbekend", silentLogger);
  await ensureAccount(clerkParent, `${clerkParent}@example.test`, "Ouder", silentLogger);
  await ensureAccount(clerkOutsider, `${clerkOutsider}@example.test`, "Buitenstaander", silentLogger);

  const year = new Date().getFullYear();
  // Volwassen: 30 jaar; jeugd: 13 jaar; onbekend: geen geboortedatum/-jaar.
  for (const [id, age] of [
    [clerkOwner, 45],
    [clerkTrainer, 38],
    [clerkManager, 40],
    [clerkAdult, 30],
    [clerkAdult2, 28],
    [clerkYouth, 13],
    [clerkParent, 44],
  ] as const) {
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: `${year - age}-03-15`, birthYear: year - age })
      .where(eq(athleteProfilesTable.clerkId, id));
  }
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: null, birthYear: null })
    .where(eq(athleteProfilesTable.clerkId, clerkUnknownAge));

  // Ouder gekoppeld aan het jeugdlid (geaccepteerd).
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: clerkParent,
    athleteClerkId: clerkYouth,
    status: "accepted",
  });
}

async function addMember(clerkId: string, role: string) {
  await db.insert(clubMembersTable).values({ clubId, clerkId, role: role as never });
}

async function cleanup() {
  if (clubId) {
    const trainingIds = (
      await db.select({ id: clubTrainingsTable.id }).from(clubTrainingsTable).where(eq(clubTrainingsTable.clubId, clubId))
    ).map((t) => t.id);
    if (trainingIds.length > 0)
      await db.delete(clubTrainingSignupsTable).where(inArray(clubTrainingSignupsTable.trainingId, trainingIds)).catch(() => {});
    const raceIds = (
      await db.select({ id: clubRaceEventsTable.id }).from(clubRaceEventsTable).where(eq(clubRaceEventsTable.clubId, clubId))
    ).map((r) => r.id);
    if (raceIds.length > 0)
      await db.delete(clubRaceSelectionsTable).where(inArray(clubRaceSelectionsTable.eventId, raceIds)).catch(() => {});
    for (const t of [
      clubMessagesTable,
      clubConsentsTable,
      clubTrainerAssignmentsTable,
      clubTrainingsTable,
      clubRaceEventsTable,
      clubAuditLogTable,
      clubSubscriptionsTable,
      clubMembersTable,
    ]) {
      await db.delete(t as never).where(eq((t as any).clubId, clubId)).catch(() => {});
    }
    await db.delete(invitationsTable).where(eq(invitationsTable.clubId, clubId)).catch(() => {});
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId)).catch(() => {});
  }
  await db.delete(parentAthleteLinksTable).where(eq(parentAthleteLinksTable.parentClerkId, clerkParent)).catch(() => {});
  for (const id of ALL) {
    await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, id)).catch(() => {});
    await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, id)).catch(() => {});
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, id)).catch(() => {});
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id)).catch(() => {});
  }
}

// ── Scenario's ───────────────────────────────────────────────────────────────
async function main() {
  await seed();
  await startServer();

  // 1. Club aanmaken → maker wordt owner, proefabonnement actief.
  await scenario("club aanmaken: maker=owner + proefabonnement", async () => {
    const r = await req("POST", "/api/clubs", clerkOwner, { name: `Testclub ${RUN}`, location: "Utrecht" });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    clubId = r.json?.club?.id ?? r.json?.id;
    assert(Number.isFinite(clubId), "geen club-id in antwoord");
    const [m] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, clerkOwner)));
    assert(m?.role === "owner", `maker is geen owner (${m?.role})`);
    const [sub] = await db.select().from(clubSubscriptionsTable).where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(sub && sub.packageKey === "proef" && sub.status === "trial", "geen proefabonnement");
  });

  // Overige leden direct via DB (uitnodigingsflow testen we apart in sc. 3/4).
  await addMember(clerkManager, "teammanager");
  await addMember(clerkAdult, "member");
  await addMember(clerkAdult2, "member");
  await addMember(clerkYouth, "member");
  await addMember(clerkUnknownAge, "member");
  await addMember(clerkParent, "parent");

  // 2. Niet-lid → 403 fail-closed op clubroutes.
  await scenario("niet-lid: 403 op dashboard/trainingen/berichten/export", async () => {
    for (const p of [`/api/clubs/${clubId}`, `/api/clubs/${clubId}/trainings`, `/api/clubs/${clubId}/messages`, `/api/clubs/${clubId}/export`]) {
      const r = await req("GET", p, clerkOutsider);
      assert(r.status === 403, `${p}: verwacht 403, kreeg ${r.status}`);
    }
  });

  // 3. Clubuitnodiging: alleen beheer mag maken.
  await scenario("uitnodiging: gewoon lid mag niet (403), beheer wel", async () => {
    const deny = await req("POST", "/api/invitations", clerkAdult, { relationship: "club_trainer", clubId });
    assert(deny.status === 403, `lid: verwacht 403, kreeg ${deny.status}`);
    const ok = await req("POST", "/api/invitations", clerkOwner, { relationship: "club_trainer", clubId });
    assert(ok.status === 201 && ok.json?.token, `beheer: verwacht 201+token, kreeg ${ok.status}`);
  });

  // 4. Uitnodiging accepteren → lidmaatschap met juiste clubrol.
  await scenario("uitnodiging accepteren: trainer-lidmaatschap ontstaat", async () => {
    const inv = await req("POST", "/api/invitations", clerkOwner, { relationship: "club_trainer", clubId });
    assert(inv.status === 201, `uitnodiging maken faalt: ${inv.status}`);
    const acc = await req("POST", `/api/invitations/${inv.json.token}/accept`, clerkTrainer);
    assert(acc.status === 200, `accepteren: verwacht 200, kreeg ${acc.status}: ${JSON.stringify(acc.json)}`);
    const [m] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, clerkTrainer)));
    assert(m?.role === "trainer", `verwacht trainer-rol, kreeg ${m?.role}`);
  });

  // 5. Training plannen: lid 403, trainer 201.
  let trainingId = 0;
  await scenario("training plannen: lid 403, trainer mag", async () => {
    const deny = await req("POST", `/api/clubs/${clubId}/trainings`, clerkAdult, { title: "X", trainingDate: isoOffset(3) });
    assert(deny.status === 403, `lid: verwacht 403, kreeg ${deny.status}`);
    const ok = await req("POST", `/api/clubs/${clubId}/trainings`, clerkTrainer, {
      title: "Duurtraining",
      trainingDate: isoOffset(3),
      maxParticipants: 1,
      durationMin: 90,
    });
    assert(ok.status === 201 && ok.json?.id, `trainer: verwacht 201, kreeg ${ok.status}`);
    trainingId = ok.json.id;
  });

  // 6. Vol → reserve.
  await scenario("aanmelden: bij vol automatisch reserve", async () => {
    const a = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/signup`, clerkAdult, { status: "aangemeld" });
    assert(a.status === 200 && a.json?.signup?.status === "aangemeld", `eerste: ${a.status} ${a.json?.signup?.status}`);
    const b = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/signup`, clerkAdult2, { status: "aangemeld" });
    assert(b.status === 200 && b.json?.signup?.status === "reserve", `tweede hoort reserve te zijn, kreeg ${b.json?.signup?.status}`);
  });

  // 7. Afmelden → reserve gepromoveerd + notificatie.
  await scenario("afmelden: reserve wordt gepromoveerd + notificatie", async () => {
    const r = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/signup`, clerkAdult, { status: "afgemeld" });
    assert(r.status === 200, `afmelden faalt: ${r.status}`);
    const [s2] = await db
      .select()
      .from(clubTrainingSignupsTable)
      .where(and(eq(clubTrainingSignupsTable.trainingId, trainingId), eq(clubTrainingSignupsTable.clerkId, clerkAdult2)));
    assert(s2?.status === "aangemeld", `reserve niet gepromoveerd (${s2?.status})`);
    // Notificatie is async (void) — kort wachten.
    await new Promise((r2) => setTimeout(r2, 300));
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.clerkId, clerkAdult2), eq(notificationsTable.type, "club_update")));
    assert(notes.length > 0, "geen club_update-notificatie voor gepromoveerd lid");
  });

  // 8. Conflictmelding: bestaande geplande training op dezelfde dag.
  let coachWorkoutId = 0;
  await scenario("aanmelden meldt conflicts[] eerlijk, past niets aan", async () => {
    const [w] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId: clerkAdult,
        scheduledDate: isoOffset(3),
        type: "ride",
        title: "Coachtraining bestaand",
        source: "coach",
        status: "planned",
      })
      .returning();
    coachWorkoutId = w!.id;
    // adult2 afmelden zodat er plek is voor adult.
    await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/signup`, clerkAdult2, { status: "afgemeld" });
    const r = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/signup`, clerkAdult, { status: "aangemeld" });
    assert(r.status === 200 && r.json?.signup?.status === "aangemeld", `aanmelden faalt: ${r.status}`);
    const conflict = (r.json?.conflicts ?? []).find((c: any) => c.id === coachWorkoutId);
    assert(conflict && conflict.source === "coach", "coachtraining niet in conflicts[]");
    const [w2] = await db.select().from(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.id, coachWorkoutId));
    assert(w2?.status === "planned", "coachtraining is aangepast — dat mag NOOIT automatisch");
  });

  // 9. Schema-koppeling: nieuwe rij source="club"; coachtraining vervangen → 409.
  await scenario("link-schedule: nieuwe club-rij; coach vervangen → 409", async () => {
    const deny = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/link-schedule`, clerkAdult, {
      mode: "vervangen",
      replaceWorkoutId: coachWorkoutId,
    });
    assert(deny.status === 409, `coach vervangen: verwacht 409, kreeg ${deny.status}`);
    const [wCoach] = await db.select().from(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.id, coachWorkoutId));
    assert(wCoach?.status === "planned", "coachtraining tóch aangepast");
    const ok = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/link-schedule`, clerkAdult, { mode: "toevoegen" });
    assert(ok.status === 201 && ok.json?.workout?.source === "club", `toevoegen: verwacht 201 source=club, kreeg ${ok.status}`);
    const dup = await req("POST", `/api/clubs/${clubId}/trainings/${trainingId}/link-schedule`, clerkAdult, { mode: "toevoegen" });
    assert(dup.status === 409, `dubbel koppelen: verwacht 409, kreeg ${dup.status}`);
  });

  // 10. Aanwezigheid: lid 403, trainer registreert.
  await scenario("aanwezigheid: alleen trainer/beheer", async () => {
    const deny = await req("PUT", `/api/clubs/${clubId}/trainings/${trainingId}/attendance`, clerkAdult, {
      entries: [{ clerkId: clerkAdult, attendance: "aanwezig" }],
    });
    assert(deny.status === 403, `lid: verwacht 403, kreeg ${deny.status}`);
    const ok = await req("PUT", `/api/clubs/${clubId}/trainings/${trainingId}/attendance`, clerkTrainer, {
      entries: [{ clerkId: clerkAdult, attendance: "aanwezig" }],
    });
    assert(ok.status === 200 && ok.json?.updated === 1, `trainer: verwacht updated=1, kreeg ${JSON.stringify(ok.json)}`);
  });

  // 11. Wedstrijden: lid 403 op aanmaken; teammanager mag; lid zet beschikbaarheid.
  await scenario("wedstrijd: teammanager beheert, lid zet beschikbaarheid", async () => {
    const deny = await req("POST", `/api/clubs/${clubId}/races`, clerkAdult, { name: "X", raceDate: isoOffset(10) });
    assert(deny.status === 403, `lid: verwacht 403, kreeg ${deny.status}`);
    const ok = await req("POST", `/api/clubs/${clubId}/races`, clerkManager, {
      name: "Clubkampioenschap",
      raceDate: isoOffset(10),
      meetPoint: "Clubhuis",
    });
    assert(ok.status === 201 && ok.json?.id, `manager: verwacht 201, kreeg ${ok.status}`);
    const av = await req("PUT", `/api/clubs/${clubId}/races/${ok.json.id}/availability`, clerkAdult, { availability: "beschikbaar" });
    assert(av.status === 200, `beschikbaarheid: verwacht 200, kreeg ${av.status}`);
  });

  // 12. Berichten: beheer post club-breed, lid leest, buitenstaander niet.
  await scenario("berichten: beheer post, lid leest en markeert gelezen", async () => {
    const post = await req("POST", `/api/clubs/${clubId}/messages`, clerkOwner, { body: "Welkom bij de club!", scope: "club" });
    assert(post.status === 201, `posten: verwacht 201, kreeg ${post.status}`);
    const list = await req("GET", `/api/clubs/${clubId}/messages`, clerkAdult);
    assert(list.status === 200 && Array.isArray(list.json) && list.json.some((m: any) => m.id === post.json.id), "lid ziet bericht niet");
    const read = await req("POST", `/api/clubs/${clubId}/messages/${post.json.id}/read`, clerkAdult);
    assert(read.status === 200, `gelezen markeren: ${read.status}`);
  });

  // 13. Consent volwassene: self grant; trainer-samenvatting gated.
  await scenario("consent volwassene: self ok; trainer summary consent-gated", async () => {
    // Toewijzing is expliciet via team: adult in team, trainer aan team.
    const [team] = await db.insert(clubTeamsTable).values({ clubId, name: "Testteam" }).returning();
    await db.insert(clubTeamMembersTable).values({ teamId: team!.id, clerkId: clerkAdult });
    await db.insert(clubTrainerAssignmentsTable).values({
      clubId,
      trainerClerkId: clerkTrainer,
      teamId: team!.id,
    });
    const before = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${clerkAdult}/summary`, clerkTrainer);
    assert(before.status === 403, `zonder consent: verwacht 403, kreeg ${before.status}`);
    const grant = await req("POST", `/api/clubs/${clubId}/consents`, clerkAdult, { action: "grant" });
    assert(grant.status === 200 && grant.json?.grantedByRelation === "self", `grant: ${grant.status}`);
    const after = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${clerkAdult}/summary`, clerkTrainer);
    assert(after.status === 200 && typeof after.json?.sessionCount === "number", `met consent: verwacht 200, kreeg ${after.status}`);
    assert(!("sessions" in (after.json ?? {})), "summary lekt losse sessies");
  });

  // 14. Jeugd-consent fail-closed: zelf 403, vreemde 403, alleen ouder.
  await scenario("jeugd-consent: zelf/vreemde 403, gekoppelde ouder ok", async () => {
    const self = await req("POST", `/api/clubs/${clubId}/consents`, clerkYouth, { action: "grant" });
    assert(self.status === 403, `minderjarig zelf: verwacht 403, kreeg ${self.status}`);
    const stranger = await req("POST", `/api/clubs/${clubId}/consents`, clerkAdult, { action: "grant", athleteClerkId: clerkYouth });
    assert(stranger.status === 403, `niet-ouder: verwacht 403, kreeg ${stranger.status}`);
    const parent = await req("POST", `/api/clubs/${clubId}/consents`, clerkParent, { action: "grant", athleteClerkId: clerkYouth });
    assert(parent.status === 200 && parent.json?.grantedByRelation === "parent", `ouder: verwacht 200, kreeg ${parent.status}`);
    // Onbekende leeftijd = fail-closed als minderjarig.
    const unknown = await req("POST", `/api/clubs/${clubId}/consents`, clerkUnknownAge, { action: "grant" });
    assert(unknown.status === 403, `leeftijd onbekend zelf: verwacht 403, kreeg ${unknown.status}`);
  });

  // 15. Export zonder sportdata + audit aanwezig; lid 403.
  await scenario("export: beheer-only, zonder sportdata, audit geschreven", async () => {
    const deny = await req("GET", `/api/clubs/${clubId}/export`, clerkAdult);
    assert(deny.status === 403, `lid: verwacht 403, kreeg ${deny.status}`);
    const r = await req("GET", `/api/clubs/${clubId}/export`, clerkOwner);
    assert(r.status === 200, `export: ${r.status}`);
    const dump = JSON.stringify(r.json);
    assert(!dump.includes("training_sessions") && !("sessions" in r.json), "export bevat sportdata");
    assert(Array.isArray(r.json.members) && r.json.members.length >= 8, "export mist leden");
    const audit = await req("GET", `/api/clubs/${clubId}/audit`, clerkOwner);
    assert(audit.status === 200 && audit.json.some((a: any) => a.action === "export_gemaakt"), "geen export-auditrij");
    const auditDeny = await req("GET", `/api/clubs/${clubId}/audit`, clerkAdult);
    assert(auditDeny.status === 403, `audit lid: verwacht 403, kreeg ${auditDeny.status}`);
  });

  // 16. Uitschrijven: historie blijft, toegang vervalt.
  await scenario("uitschrijven: endedAt gezet, historie blijft, toegang 403", async () => {
    const [m] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, clerkAdult2)));
    const r = await req("POST", `/api/clubs/${clubId}/members/${m!.id}/end`, clerkOwner, { reason: "test" });
    assert(r.status === 200, `uitschrijven: ${r.status}`);
    const [after] = await db.select().from(clubMembersTable).where(eq(clubMembersTable.id, m!.id));
    assert(after && after.endedAt != null, "rij verwijderd of endedAt leeg — historie moet blijven");
    const signups = await db
      .select()
      .from(clubTrainingSignupsTable)
      .where(eq(clubTrainingSignupsTable.clerkId, clerkAdult2));
    assert(signups.length > 0, "aanmeldhistorie verdwenen");
    const gate = await req("GET", `/api/clubs/${clubId}`, clerkAdult2);
    assert(gate.status === 403, `oud-lid: verwacht 403, kreeg ${gate.status}`);
  });

  await stopServer();
  await cleanup();

  // ── Rapport ────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("testrun crashte:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
