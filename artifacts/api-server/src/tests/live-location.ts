// Vrienden live op de kaart (Opdracht 4) — route- en engine-test.
//
// Kernprincipes die hier hard worden bewezen:
//   - Delen staat standaard UIT; zonder actieve sessie is er niets te lezen.
//   - Autorisatie wordt bij ELKE lezing opnieuw gecontroleerd (vriendschap
//     die eindigt = positie direct weg).
//   - Eerlijke veroudering: Live ≤20s, daarna "x geleden", ≥5 min geen
//     coördinaten meer, ≥15 min helemaal weg.
//   - Geen locatiegeschiedenis: één positierij per sessie, bij stoppen
//     wordt die rij verwijderd.
//   - Minderjarig/onbekende leeftijd: groepszichtbaarheid fail-closed tot
//     geaccepteerde vrienden/begeleiders.
//
// Run: `pnpm --filter @workspace/api-server run test:live-location`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  friendLinksTable,
  clubsTable,
  clubTrainingsTable,
  clubTrainingSignupsTable,
  liveLocationSessionsTable,
  liveLocationGrantsTable,
  liveLocationPositionsTable,
} from "@workspace/db";
import app from "../app";
import { classifyAge, reliableHeading, initialsFor } from "../lib/live-location";

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

const RUN = `test_liveloc_${Date.now()}`;
const A = `${RUN}_a`; // deler (volwassen)
const B = `${RUN}_b`; // geaccepteerde vriend
const C = `${RUN}_c`; // vreemde (groepsgenoot, geen vriend)
const M = `${RUN}_m`; // deler zonder bekende leeftijd (fail-closed)

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
      } else reject(new Error("failed to determine server port"));
    });
  });
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
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

function amsToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(
    new Date(),
  );
}

async function seed() {
  await db.insert(userProfilesTable).values([
    { clerkId: A, email: `${A}@test.local`, displayName: "Anna Atleet" },
    { clerkId: B, email: `${B}@test.local`, displayName: "Bram Buddy" },
    { clerkId: C, email: `${C}@test.local`, displayName: "Cas Clublid" },
    { clerkId: M, email: `${M}@test.local`, displayName: "Milan Minder" },
  ]);
  await db.insert(athleteProfilesTable).values([
    { clerkId: A, birthYear: 1990 }, // volwassen
    { clerkId: B, birthYear: 1992 },
    { clerkId: C, birthYear: 1991 },
    { clerkId: M }, // GEEN leeftijd bekend → fail-closed
  ]);
  // A ↔ B geaccepteerde vrienden; M ↔ B geaccepteerd (voor groepsfilter).
  await db.insert(friendLinksTable).values([
    { requesterClerkId: A, addresseeClerkId: B, status: "accepted" },
    { requesterClerkId: M, addresseeClerkId: B, status: "accepted" },
  ]);
}

async function cleanup() {
  const ids = [A, B, C, M];
  const sessions = await db
    .select({ id: liveLocationSessionsTable.id })
    .from(liveLocationSessionsTable)
    .where(inArray(liveLocationSessionsTable.clerkId, ids));
  const sids = sessions.map((s) => s.id);
  if (sids.length > 0) {
    await db
      .delete(liveLocationPositionsTable)
      .where(inArray(liveLocationPositionsTable.sessionId, sids));
    await db
      .delete(liveLocationGrantsTable)
      .where(inArray(liveLocationGrantsTable.sessionId, sids));
    await db
      .delete(liveLocationSessionsTable)
      .where(inArray(liveLocationSessionsTable.id, sids));
  }
  await db
    .delete(clubTrainingSignupsTable)
    .where(inArray(clubTrainingSignupsTable.clerkId, ids));
  await db.delete(clubTrainingsTable).where(eq(clubTrainingsTable.title, RUN));
  await db.delete(clubsTable).where(eq(clubsTable.name, RUN));
  await db
    .delete(friendLinksTable)
    .where(inArray(friendLinksTable.requesterClerkId, ids));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ids));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await seed();
  await startServer();

  // ── Pure engine ────────────────────────────────────────────────────────
  await scenario("engine: classifyAge — Live ≤20s, verouderd, niet beschikbaar", () => {
    assert(classifyAge(5_000).kind === "live", "5s moet Live zijn");
    assert(classifyAge(45_000).kind === "verouderd", "45s moet verouderd zijn");
    assert(classifyAge(2 * 60_000).label === "2 minuten geleden", "2 min label");
    assert(classifyAge(6 * 60_000).kind === "niet_beschikbaar", "6 min niet beschikbaar");
    assert(classifyAge(-1).kind === "niet_beschikbaar", "negatief eerlijk niet beschikbaar");
  });

  await scenario("engine: reliableHeading alleen bij voldoende snelheid", () => {
    assert(reliableHeading(90, 3) === 90, "3 m/s → richting door");
    assert(reliableHeading(90, 0.5) === null, "stilstand → geen richting");
    assert(reliableHeading(null, 5) === null, "geen richting → null");
    assert(reliableHeading(-90, 5) === 270, "normalisatie naar 0–360");
  });

  await scenario("engine: initialsFor is eerlijk bij lege naam", () => {
    assert(initialsFor("Anna Atleet") === "AA", "AA verwacht");
    assert(typeof initialsFor("") === "string", "lege naam crasht niet");
  });

  // ── Standaard UIT ─────────────────────────────────────────────────────
  await scenario("standaard uit: geen sessie, vriend ziet niets", async () => {
    const cur = await req("GET", "/api/live-location/sessions/current", A);
    assert(cur.status === 200 && cur.json.session === null, "geen actieve sessie");
    const fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.status === 200 && fr.json.friends.length === 0, "B ziet niemand");
  });

  await scenario("positie zonder actieve sessie → 409, niets opgeslagen", async () => {
    const r = await req("POST", "/api/live-location/positions", A, {
      lat: 52.1,
      lon: 5.1,
    });
    assert(r.status === 409, `verwacht 409, kreeg ${r.status}`);
  });

  // ── Vrienden-whitelist ────────────────────────────────────────────────
  await scenario("delen met niet-vriend wordt geweigerd (400)", async () => {
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [C],
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await scenario("delen zonder gekozen vrienden wordt geweigerd (400)", async () => {
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [],
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  let sessionId = 0;
  await scenario("delen met geaccepteerde vriend start (201)", async () => {
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [B],
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert(r.json.session.viewerCount === 1, "1 kijker verwacht");
    sessionId = r.json.session.id;
  });

  await scenario("gekozen vriend ziet Live-positie; vreemde ziet niets", async () => {
    const p = await req("POST", "/api/live-location/positions", A, {
      lat: 52.09,
      lon: 5.12,
      speedMps: 6,
      headingDeg: 45,
    });
    assert(p.status === 200, `positie: ${p.status}`);
    const fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends.length === 1, "B ziet A");
    const f = fr.json.friends[0];
    assert(f.statusKind === "live" && f.status === "Live", "Live-status");
    assert(Math.abs(f.lat - 52.09) < 1e-6, "echte coördinaten");
    assert(f.headingDeg === 45, "richting bij 6 m/s");
    const frC = await req("GET", "/api/live-location/friends", C);
    assert(frC.json.friends.length === 0, "C ziet niets");
  });

  await scenario("één positierij per sessie (geen geschiedenis)", async () => {
    await req("POST", "/api/live-location/positions", A, { lat: 52.2, lon: 5.2 });
    const rows = await db
      .select()
      .from(liveLocationPositionsTable)
      .where(eq(liveLocationPositionsTable.sessionId, sessionId));
    assert(rows.length === 1, `precies 1 rij, kreeg ${rows.length}`);
    assert(Math.abs(Number(rows[0].lat) - 52.2) < 1e-6, "rij is bijgewerkt");
  });

  await scenario("richting bij stilstand wordt eerlijk weggelaten", async () => {
    await req("POST", "/api/live-location/positions", A, {
      lat: 52.2,
      lon: 5.2,
      speedMps: 0.2,
      headingDeg: 200,
    });
    const fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends[0].headingDeg === null, "geen richting bij stilstand");
  });

  await scenario("veroudering: ≥5 min geen coördinaten, ≥15 min weg", async () => {
    await db
      .update(liveLocationPositionsTable)
      .set({ updatedAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(liveLocationPositionsTable.sessionId, sessionId));
    let fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends.length === 1, "nog zichtbaar als status");
    assert(fr.json.friends[0].lat === null, "coördinaten verborgen ≥5 min");
    assert(fr.json.friends[0].statusKind === "niet_beschikbaar", "eerlijke status");
    await db
      .update(liveLocationPositionsTable)
      .set({ updatedAt: new Date(Date.now() - 16 * 60_000) })
      .where(eq(liveLocationPositionsTable.sessionId, sessionId));
    fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends.length === 0, "≥15 min volledig weg");
  });

  await scenario("autorisatie op leesmoment: vriendschap eindigt → weg", async () => {
    await req("POST", "/api/live-location/positions", A, { lat: 52.3, lon: 5.3 });
    await db
      .update(friendLinksTable)
      .set({ status: "declined" })
      .where(
        and(
          eq(friendLinksTable.requesterClerkId, A),
          eq(friendLinksTable.addresseeClerkId, B),
        ),
      );
    const fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends.length === 0, "geen vriendschap = geen positie");
    await db
      .update(friendLinksTable)
      .set({ status: "accepted" })
      .where(
        and(
          eq(friendLinksTable.requesterClerkId, A),
          eq(friendLinksTable.addresseeClerkId, B),
        ),
      );
  });

  await scenario("stoppen: sessie eindigt en positierij wordt verwijderd", async () => {
    const r = await req("DELETE", "/api/live-location/sessions/current", A);
    assert(r.status === 200 && r.json.ended >= 1, "sessie beëindigd");
    const rows = await db
      .select()
      .from(liveLocationPositionsTable)
      .where(eq(liveLocationPositionsTable.sessionId, sessionId));
    assert(rows.length === 0, "positie direct verwijderd (geen geschiedenis)");
    const fr = await req("GET", "/api/live-location/friends", B);
    assert(fr.json.friends.length === 0, "B ziet niets meer");
  });

  await scenario("nieuwe sessie beëindigt de oude automatisch", async () => {
    const r1 = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [B],
    });
    const r2 = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [B],
    });
    assert(r1.status === 201 && r2.status === 201, "beide starts ok");
    const open = await db
      .select()
      .from(liveLocationSessionsTable)
      .where(
        and(
          eq(liveLocationSessionsTable.clerkId, A),
          eq(liveLocationSessionsTable.audience, "vrienden"),
        ),
      );
    const active = open.filter((s) => s.endedAt === null);
    assert(active.length === 1, `precies 1 actieve sessie, kreeg ${active.length}`);
    await req("DELETE", "/api/live-location/sessions/current", A);
  });

  await scenario("idle-verval: stille sessie verloopt vanzelf", async () => {
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [B],
    });
    await db
      .update(liveLocationSessionsTable)
      .set({ startedAt: new Date(Date.now() - 31 * 60_000) })
      .where(eq(liveLocationSessionsTable.id, r.json.session.id));
    const cur = await req("GET", "/api/live-location/sessions/current", A);
    assert(cur.json.session === null, "idle-sessie is verlopen");
    const p = await req("POST", "/api/live-location/positions", A, {
      lat: 52,
      lon: 5,
    });
    assert(p.status === 409, "verlopen sessie accepteert geen posities");
    await req("DELETE", "/api/live-location/sessions/current", A);
  });

  await scenario("lange rit: actieve zender blijft delen (anker = laatste positie)", async () => {
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "vrienden",
      friendClerkIds: [B],
    });
    const p1 = await req("POST", "/api/live-location/positions", A, { lat: 52, lon: 5 });
    assert(p1.status === 200, "eerste positie ok");
    // Sessie is 31 min oud, maar de laatste positie is vers: delen loopt door.
    await db
      .update(liveLocationSessionsTable)
      .set({ startedAt: new Date(Date.now() - 31 * 60_000) })
      .where(eq(liveLocationSessionsTable.id, r.json.session.id));
    const p2 = await req("POST", "/api/live-location/positions", A, { lat: 52.01, lon: 5.01 });
    assert(p2.status === 200, `actieve lange rit mag doorsturen, kreeg ${p2.status}`);
    await req("DELETE", "/api/live-location/sessions/current", A);
  });

  // ── Groepsrit ─────────────────────────────────────────────────────────
  let clubId = 0;
  let trainingToday = 0;
  let trainingTomorrow = 0;
  await scenario("groep: alleen deelnemers van een rit van vandaag", async () => {
    const [club] = await db.insert(clubsTable).values({ name: RUN, ownerClerkId: A }).returning();
    clubId = club.id;
    const today = amsToday();
    const tomorrow = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Amsterdam",
    }).format(new Date(Date.now() + 24 * 3600_000));
    const [t1] = await db
      .insert(clubTrainingsTable)
      .values({ clubId, title: RUN, trainingDate: today, createdByClerkId: A })
      .returning();
    trainingToday = t1.id;
    const [t2] = await db
      .insert(clubTrainingsTable)
      .values({ clubId, title: RUN, trainingDate: tomorrow, createdByClerkId: A })
      .returning();
    trainingTomorrow = t2.id;
    // A is GEEN deelnemer → 403.
    let r = await req("POST", "/api/live-location/sessions", A, {
      audience: "groep",
      clubTrainingId: trainingToday,
    });
    assert(r.status === 403, `geen deelnemer: verwacht 403, kreeg ${r.status}`);
    // Rit van morgen → 409, ook als deelnemer.
    await db.insert(clubTrainingSignupsTable).values([
      { trainingId: trainingTomorrow, clerkId: A, status: "aangemeld" },
    ]);
    r = await req("POST", "/api/live-location/sessions", A, {
      audience: "groep",
      clubTrainingId: trainingTomorrow,
    });
    assert(r.status === 409, `rit van morgen: verwacht 409, kreeg ${r.status}`);
  });

  await scenario("groep: volwassen deler deelt met alle deelnemers", async () => {
    await db.insert(clubTrainingSignupsTable).values([
      { trainingId: trainingToday, clerkId: A, status: "aangemeld" },
      { trainingId: trainingToday, clerkId: B, status: "aangemeld" },
      { trainingId: trainingToday, clerkId: C, status: "aangemeld" },
      { trainingId: trainingToday, clerkId: M, status: "aangemeld" },
    ]);
    const r = await req("POST", "/api/live-location/sessions", A, {
      audience: "groep",
      clubTrainingId: trainingToday,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert(r.json.session.viewerCount === 3, `3 kijkers, kreeg ${r.json.session.viewerCount}`);
    await req("POST", "/api/live-location/positions", A, { lat: 52.4, lon: 5.4 });
    const frC = await req("GET", "/api/live-location/friends", C);
    assert(frC.json.friends.length === 1, "groepsgenoot C ziet A (volwassen deler)");
    await req("DELETE", "/api/live-location/sessions/current", A);
  });

  await scenario("groep: onbekende leeftijd fail-closed tot vrienden/begeleiders", async () => {
    const r = await req("POST", "/api/live-location/sessions", M, {
      audience: "groep",
      clubTrainingId: trainingToday,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    // M's vrienden: alleen B. C is groepsgenoot maar geen vriend → geen grant.
    assert(
      r.json.session.viewerCount === 1,
      `alleen vriend B mag kijken, kreeg ${r.json.session.viewerCount}`,
    );
    await req("POST", "/api/live-location/positions", M, { lat: 52.5, lon: 5.5 });
    const frC = await req("GET", "/api/live-location/friends", C);
    assert(frC.json.friends.length === 0, "C ziet minderjarige/onbekende NIET");
    const frB = await req("GET", "/api/live-location/friends", B);
    assert(frB.json.friends.length === 1, "vriend B ziet M wel");
    // Her-controle op LEESMOMENT: eindigt de vriendschap ná de start, dan
    // verdwijnt M direct — de grant van bij de start is niet genoeg.
    await db
      .update(friendLinksTable)
      .set({ status: "declined" })
      .where(
        and(
          eq(friendLinksTable.requesterClerkId, M),
          eq(friendLinksTable.addresseeClerkId, B),
        ),
      );
    const frB2 = await req("GET", "/api/live-location/friends", B);
    assert(frB2.json.friends.length === 0, "ex-vriend ziet minderjarige NIET meer");
    await db
      .update(friendLinksTable)
      .set({ status: "accepted" })
      .where(
        and(
          eq(friendLinksTable.requesterClerkId, M),
          eq(friendLinksTable.addresseeClerkId, B),
        ),
      );
    await req("DELETE", "/api/live-location/sessions/current", M);
  });

  await scenario("group-options: alleen ritten van vandaag met aanmelding", async () => {
    const r = await req("GET", "/api/live-location/group-options", A);
    assert(r.status === 200, `status ${r.status}`);
    const ids = r.json.options.map((o: any) => o.clubTrainingId);
    assert(ids.includes(trainingToday), "rit van vandaag aanwezig");
    assert(!ids.includes(trainingTomorrow), "rit van morgen afwezig");
    const rC = await req("GET", "/api/live-location/group-options", M);
    assert(rC.json.options.length >= 1, "aangemelde M ziet de rit ook");
  });

  // ── Rapport ────────────────────────────────────────────────────────────
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("test run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.error("cleanup failed:", err);
    }
    if (server) await new Promise<void>((res) => server!.close(() => res()));
    await pool.end();
  });
