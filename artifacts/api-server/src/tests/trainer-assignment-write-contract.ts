// Taak 412 — contracttest: wat mag een assignment-only club-trainer op een
// SCHRIJFPAD (coach-bericht sturen, POST /api/coach/athletes/:id/messages)?
//
// Contract per productbesluit René 29/30-07-2026 (WP-01C + aanvullende
// opdracht §1): individuele berichten zijn een SCHRIJFACTIE en vereisen een
// DIRECTE geaccepteerde coach-sporterlink. Een trainer met ALLEEN een
// club-/teamtoewijzing (geen directe link) mag NIET schrijven. Deze test pint
// dat vast, plus de fail-closed randen eromheen:
//
//   1. Positieve controle: trainer-1 → volwassen sporter (directe link) = 201.
//   2. Assignment-only: trainer-1 → jeugdsporter (GEEN link, wél via
//      teamtoewijzing) = 403 en er wordt géén berichtrij geschreven.
//      (Tot 30-07-2026 stond hier het oude taak-412-contract met 201; het
//      besluit heeft die verwachting definitief omgeklapt.)
//   3. Clublid-trainer ZONDER toewijzing of link (trainer-2) = 403, nul rijen.
//   4. Buitenstaander zonder coach-rol = 403, nul rijen.
//   5. Beëindigd clublidmaatschap van trainer-1 raakt het directe-linkpad
//      (adult) niet; naar de jeugdsporter blijft het 403.
//
// Run: node ./scripts/run-test.mjs trainer-assignment-write-contract
// Vereist: DATABASE_URL, NODE_ENV!=production, DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { db, pool, clubMembersTable, coachMessagesTable } from "@workspace/db";
import { and, eq, isNull, like } from "drizzle-orm";
import app from "../app";
import {
  createFixtures,
  removeFixtures,
  clerkIdFor,
  GOVERNOR_FIXTURE_PREFIX,
} from "../scripts/governor-role-fixtures";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: unknown = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// Mutatiebewaking: het aantal berichten van deze coach aan deze sporter.
async function messageCount(coachId: string, athleteId: string): Promise<number> {
  const rows = await db
    .select({ id: coachMessagesTable.id })
    .from(coachMessagesTable)
    .where(
      and(
        eq(coachMessagesTable.coachClerkId, coachId),
        eq(coachMessagesTable.athleteClerkId, athleteId),
      ),
    );
  return rows.length;
}

async function cleanupMessages() {
  await db
    .delete(coachMessagesTable)
    .where(like(coachMessagesTable.coachClerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    console.error("Deze test draait alleen buiten productie.");
    process.exit(1);
  }
  if (process.env.DEV_AUTH_BYPASS !== "true") {
    console.error("DEV_AUTH_BYPASS=true vereist (x-dev-clerk-id actorheader).");
    process.exit(1);
  }

  await removeFixtures();
  const { clubId } = await createFixtures();
  await cleanupMessages();
  await startServer();

  const t1 = clerkIdFor("trainer-1");
  const t2 = clerkIdFor("trainer-2");
  const outsider = clerkIdFor("outsider");
  const adult = clerkIdFor("athlete-adult");
  const jeugd = clerkIdFor("athlete-jeugd");
  const write = (actor: string, athleteId: string) =>
    req("POST", `/api/coach/athletes/${athleteId}/messages`, actor, {
      body: "TESTFIXTURE contractbericht (taak 412)",
    });

  await scenario("1. positieve controle: directe link mag schrijven (201)", async () => {
    const r = await write(t1, adult);
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    assert((await messageCount(t1, adult)) === 1, "berichtrij ontbreekt na 201");
  });

  await scenario(
    "2. assignment-only trainer (geen link, wél teamtoewijzing): 403 + nul rijen — besluit 30-07-2026",
    async () => {
      const r = await write(t1, jeugd);
      assert(
        r.status === 403,
        `verwacht 403 (besluit: schrijfacties eisen directe link), kreeg ${r.status}`,
      );
      assert((await messageCount(t1, jeugd)) === 0, "assignment-only trainer schreef tóch een rij");
    },
  );

  await scenario("3. clublid-trainer zonder toewijzing/link: 403 + nul rijen", async () => {
    for (const athlete of [adult, jeugd]) {
      const r = await write(t2, athlete);
      assert(r.status === 403, `verwacht 403 voor trainer-2 → ${athlete}, kreeg ${r.status}`);
      assert((await messageCount(t2, athlete)) === 0, `trainer-2 schreef toch een rij naar ${athlete}`);
    }
  });

  await scenario("4. buitenstaander zonder coach-rol: 403 + nul rijen", async () => {
    const r = await write(outsider, adult);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    assert((await messageCount(outsider, adult)) === 0, "buitenstaander schreef toch een rij");
  });

  await scenario(
    "5. beëindigd clublidmaatschap: jeugdpad blijft 403; directe-linkpad blijft werken",
    async () => {
      await db
        .update(clubMembersTable)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(clubMembersTable.clubId, clubId),
            eq(clubMembersTable.clerkId, t1),
            isNull(clubMembersTable.endedAt),
          ),
        );
      try {
        const before = await messageCount(t1, jeugd);
        const rJeugd = await write(t1, jeugd);
        assert(rJeugd.status === 403, `ex-clublid: verwacht 403 naar jeugd, kreeg ${rJeugd.status}`);
        assert((await messageCount(t1, jeugd)) === before, "ex-clublid schreef toch een rij");
        const rAdult = await write(t1, adult);
        assert(rAdult.status === 201, `directe link hoort te blijven werken, kreeg ${rAdult.status}`);
      } finally {
        await createFixtures(); // herstelt actief clublidmaatschap idempotent
      }
    },
  );

  await stopServer();
  await cleanupMessages();
  await removeFixtures();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results)
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd.`);
  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
