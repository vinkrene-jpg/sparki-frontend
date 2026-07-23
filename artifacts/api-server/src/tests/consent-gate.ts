// Verplichte juridische acceptatie — regressietest voor de server-side gate.
//
// Dekt: blokkade zonder acceptatie, toegang na acceptatie van alle documenten,
// nieuwe documentversie vereist opnieuw akkoord, intrekken sluit de poort weer,
// acceptatie van gebruiker A geldt niet voor gebruiker B, en publieke routes
// (health, /legal, documenten) blijven bereikbaar zonder akkoord.
//
// De gate wordt in dev-bypass alleen afgedwongen met `x-consent-enforce: 1`
// (test-hook); voor echte Clerk-sessies geldt hij altijd. Deze test gebruikt
// dat header om productiegedrag te simuleren.
//
// Run: `pnpm --filter @workspace/api-server run test:consent-gate`

import type { Server } from "node:http";
import { and, eq, isNull } from "drizzle-orm";
import app from "../app";
import {
  db,
  pool,
  legalAcceptancesTable,
  legalDocumentsTable,
} from "@workspace/db";
import { ensureAccount, silentLogger } from "../lib/account";
import { REQUIRED_LEGAL_KINDS } from "../lib/legal-texts";
import { invalidateConsentVersionCache } from "../lib/consent";

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

let baseUrl = "";
let server: Server | null = null;

const USER_A = "test_consent_user_a";
const USER_B = "test_consent_user_b";

function call(
  path: string,
  opts: { user?: string; enforce?: boolean; method?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.user) headers["x-dev-clerk-id"] = opts.user;
  if (opts.enforce !== false) headers["x-consent-enforce"] = "1";
  return fetch(`${baseUrl}${path}`, { method: opts.method ?? "GET", headers });
}

async function acceptAll(user: string) {
  for (const kind of REQUIRED_LEGAL_KINDS) {
    const res = await call(`/api/legal/${kind}/accept`, {
      user,
      method: "POST",
    });
    assert(res.status === 200, `accept ${kind} for ${user} → ${res.status}`);
  }
}

async function cleanup() {
  for (const user of [USER_A, USER_B]) {
    await db
      .delete(legalAcceptancesTable)
      .where(eq(legalAcceptancesTable.clerkId, user));
  }
  await db
    .delete(legalDocumentsTable)
    .where(
      and(
        eq(legalDocumentsTable.kind, "gezondheid"),
        eq(legalDocumentsTable.version, "2.0-test"),
      ),
    );
  invalidateConsentVersionCache();
}

async function main() {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("no port"));
    });
  });

  await ensureAccount(USER_A, "consent-a@test.local", "Consent A", silentLogger);
  await ensureAccount(USER_B, "consent-b@test.local", "Consent B", silentLogger);
  await cleanup();

  await scenario("zonder akkoord: persoonlijke route geblokkeerd (403 consent_required)", async () => {
    const res = await call("/api/athlete/profile", { user: USER_A });
    assert(res.status === 403, `verwacht 403, kreeg ${res.status}`);
    const body = (await res.json()) as { code?: string; missing?: unknown[] };
    assert(body.code === "consent_required", `code=${body.code}`);
    assert(
      Array.isArray(body.missing) && body.missing.length === 3,
      `missing hoort 3 documenten te bevatten, kreeg ${JSON.stringify(body.missing)}`,
    );
  });

  await scenario("zonder akkoord: publieke/allowlist-routes blijven bereikbaar", async () => {
    for (const path of [
      "/api/healthz",
      "/api/legal/terms",
      "/api/legal/privacy",
      "/api/legal/gezondheid",
      "/api/legal/status",
      "/api/auth/me",
    ]) {
      const res = await call(path, { user: USER_A });
      assert(
        res.status !== 403,
        `${path} mag niet door de gate geblokkeerd worden (kreeg 403)`,
      );
    }
  });

  await scenario("status toont drie verplichte documenten, alle niet-geaccepteerd", async () => {
    const res = await call("/api/legal/status", { user: USER_A });
    const body = (await res.json()) as {
      complete: boolean;
      documents: { kind: string; accepted: boolean }[];
    };
    assert(body.complete === false, "complete hoort false te zijn");
    assert(body.documents.length === 3, `documenten: ${body.documents.length}`);
    assert(
      body.documents.every((d) => d.accepted === false),
      "geen document mag als geaccepteerd gelden zonder bewijsrij",
    );
  });

  await scenario("na acceptatie van alle documenten: toegang open", async () => {
    await acceptAll(USER_A);
    const status = await call("/api/legal/status", { user: USER_A });
    const body = (await status.json()) as { complete: boolean };
    assert(body.complete === true, "complete hoort true te zijn na acceptatie");
    const res = await call("/api/athlete/profile", { user: USER_A });
    assert(res.status !== 403, `route hoort open te zijn, kreeg ${res.status}`);
  });

  await scenario("acceptatie legt bron en versie vast in legal_acceptances", async () => {
    const rows = await db
      .select()
      .from(legalAcceptancesTable)
      .where(eq(legalAcceptancesTable.clerkId, USER_A));
    assert(rows.length === 3, `verwacht 3 bewijsrijen, kreeg ${rows.length}`);
    assert(
      rows.every((r) => r.version === "1.0" && r.source.length > 0 && r.revokedAt === null),
      "elke rij hoort versie 1.0 + bron te hebben en niet ingetrokken te zijn",
    );
  });

  await scenario("gelijktijdige accepts leveren precies één actieve bewijsrij", async () => {
    // Race-veiligheid: 6 parallelle accepts voor hetzelfde document mogen
    // dankzij de partiële unieke index nooit meer dan één actieve rij opleveren.
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        call("/api/legal/terms/accept", { user: USER_A, method: "POST" }),
      ),
    );
    assert(
      responses.every((r) => r.status === 200),
      `alle parallelle accepts horen 200 te geven, kreeg ${responses.map((r) => r.status).join(",")}`,
    );
    const rows = await db
      .select()
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.clerkId, USER_A),
          eq(legalAcceptancesTable.kind, "terms"),
          isNull(legalAcceptancesTable.revokedAt),
        ),
      );
    assert(
      rows.length === 1,
      `verwacht exact 1 actieve terms-rij, kreeg ${rows.length}`,
    );
  });

  await scenario("akkoord van A geldt niet voor B (cross-user isolatie)", async () => {
    const res = await call("/api/athlete/profile", { user: USER_B });
    assert(res.status === 403, `B hoort geblokkeerd te blijven, kreeg ${res.status}`);
  });

  await scenario("nieuwe documentversie vereist opnieuw akkoord", async () => {
    await db.insert(legalDocumentsTable).values({
      kind: "gezondheid",
      version: "2.0-test",
      title: "Gezondheids- en trainingsdisclaimer",
      bodyMd: "Testversie 2.0",
      publishedAt: new Date(Date.now() + 1000),
    });
    invalidateConsentVersionCache();
    const res = await call("/api/athlete/profile", { user: USER_A });
    assert(res.status === 403, `nieuwe versie hoort te blokkeren, kreeg ${res.status}`);
    const status = await call("/api/legal/status", { user: USER_A });
    const body = (await status.json()) as {
      documents: { kind: string; accepted: boolean; requiredVersion: string }[];
    };
    const gez = body.documents.find((d) => d.kind === "gezondheid")!;
    assert(gez.requiredVersion === "2.0-test", `vereiste versie: ${gez.requiredVersion}`);
    assert(gez.accepted === false, "oud akkoord mag niet gelden voor nieuwe versie");

    // Opnieuw accepteren opent de poort weer.
    const accept = await call("/api/legal/gezondheid/accept", {
      user: USER_A,
      method: "POST",
    });
    assert(accept.status === 200, `heraccept → ${accept.status}`);
    const after = await call("/api/athlete/profile", { user: USER_A });
    assert(after.status !== 403, `na heraccept hoort toegang open, kreeg ${after.status}`);
  });

  await scenario("intrekken sluit de poort weer (bewijsrij blijft bestaan)", async () => {
    const res = await call("/api/legal/privacy/revoke", {
      user: USER_A,
      method: "POST",
    });
    assert(res.status === 200, `revoke → ${res.status}`);
    const blocked = await call("/api/athlete/profile", { user: USER_A });
    assert(blocked.status === 403, `na intrekken hoort 403, kreeg ${blocked.status}`);
    const rows = await db
      .select()
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.clerkId, USER_A),
          eq(legalAcceptancesTable.kind, "privacy"),
        ),
      );
    assert(rows.length > 0 && rows.every((r) => r.revokedAt !== null),
      "bewijsrij hoort te blijven bestaan met revoked_at gezet");
  });

  await scenario("zonder enforce-header (dev-preview) blijft de bestaande flow werken", async () => {
    const res = await call("/api/athlete/profile", { user: USER_B, enforce: false });
    assert(res.status !== 403, `dev-preview hoort niet geblokkeerd, kreeg ${res.status}`);
  });
}

async function shutdown(code: number) {
  await cleanup().catch(() => {});
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== verplichte juridische acceptatie — testresultaten ===");
    for (const r of results) {
      console.log(`[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} geslaagd.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await shutdown(1);
  });
