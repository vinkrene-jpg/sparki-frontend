// SPARKI_BUILD_01 F1 — centrale leeftijds- en toestemmingsservice — bewijs.
//
// Boot de ECHTE Express-app en bewijst server-side (BB-01..BB-03):
//   1. een minderjarige die zichzelf ouderlijke toestemming geeft → geweigerd + gelogd;
//   2. een minderjarige die verplicht oudertoezicht uitzet → geweigerd + gelogd;
//   3. een minderjarige die zijn eigen parentConsentStatus zet → geweigerd;
//   4. een geaccepteerde ouder verleent → granted, met reconfirmation_due_at;
//   5. meerdere ouders: tweede geaccepteerde ouder mag ook inzien en verlenen;
//   6. intrekken werkt onmiddellijk (status revoked bij eerstvolgende read);
//   7. een vreemde krijgt geen inzage (403) en kan niet verlenen (403);
//   8. volwassene geeft zichzelf een niet-ouderlijke toestemming → toegestaan;
//   9. onbekende leeftijd = strengste regime (zelf-verlenen geweigerd);
//  10. gedeelde status-enumeratie: legacy "accepted" wordt "granted".
//
// Run: `node ./scripts/run-test.mjs consent-service` (met DEV_AUTH_BYPASS=true)

import type { Server } from "node:http";
import { and, desc, eq, like } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  parentAthleteLinksTable,
  consentGrantsTable,
  consentAuditLogTable,
  normalizeConsentStatus,
} from "@workspace/db";
import app from "../app";

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
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const RUN = `test_consent_${Date.now()}`;
const MINOR = `${RUN}_minor`;
const PARENT1 = `${RUN}_parent1`;
const PARENT2 = `${RUN}_parent2`;
const ADULT = `${RUN}_adult`;
const NOAGE = `${RUN}_noage`;
const STRANGER = `${RUN}_stranger`;

function ymdYearsAgo(years: number): string {
  const d = new Date();
  return `${d.getFullYear() - years}-06-15`;
}

async function seed(): Promise<void> {
  const all = [MINOR, PARENT1, PARENT2, ADULT, NOAGE, STRANGER];
  for (const clerkId of all) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId, email: `${clerkId}@test.local`, displayName: clerkId })
      .onConflictDoNothing();
  }
  await db.insert(athleteProfilesTable).values([
    { clerkId: MINOR, birthDate: ymdYearsAgo(14) },
    { clerkId: ADULT, birthDate: ymdYearsAgo(30) },
    { clerkId: NOAGE }, // geen geboortedatum → age_class unknown
  ]);
  await db.insert(parentAthleteLinksTable).values([
    { parentClerkId: PARENT1, athleteClerkId: MINOR, status: "accepted" },
    { parentClerkId: PARENT2, athleteClerkId: MINOR, status: "accepted" },
  ]);
  // Legacy-status voor de mapping-check (10).
  await db
    .insert(privacySettingsTable)
    .values({ clerkId: MINOR, parentConsentRequired: true, parentConsentStatus: "accepted" })
    .onConflictDoNothing();
}

async function cleanup(): Promise<void> {
  // FK's cascaden vanaf user_profiles.
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${RUN}%`));
}

async function newestAudit(clerkId: string, field: string) {
  const [row] = await db
    .select()
    .from(consentAuditLogTable)
    .where(and(eq(consentAuditLogTable.clerkId, clerkId), eq(consentAuditLogTable.field, field)))
    .orderBy(desc(consentAuditLogTable.createdAt))
    .limit(1);
  return row ?? null;
}

async function main() {
  await seed();
  await startServer();

  await scenario("1. minderjarige geeft zichzelf ouderlijke toestemming → 403 + audit", async () => {
    const r = await req("POST", "/api/consent/grant", MINOR, {
      subjectClerkId: MINOR,
      type: "parental_consent",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    assert(r.json?.code === "self_grant_refused", `code=${r.json?.code}`);
    const a = await newestAudit(MINOR, "consent_grant_geweigerd");
    assert(a, "geen auditregel van de geweigerde poging");
  });

  await scenario("2. minderjarige zet oudertoezicht uit → 403 + audit", async () => {
    const r = await req("PUT", "/api/privacy", MINOR, { parentConsentRequired: false });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    const a = await newestAudit(MINOR, "oudertoezicht_wijziging_geweigerd");
    assert(a, "geen auditregel van de geweigerde poging");
    const [row] = await db
      .select({ v: privacySettingsTable.parentConsentRequired })
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, MINOR));
    assert(row?.v === true, "oudertoezicht is tóch uitgezet");
  });

  await scenario("3. minderjarige zet eigen parentConsentStatus → 403", async () => {
    const r = await req("PUT", "/api/privacy", MINOR, { parentConsentStatus: "accepted" });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  let grantId = 0;
  await scenario("4. geaccepteerde ouder verleent → granted + reconfirmation_due_at", async () => {
    const r = await req("POST", "/api/consent/grant", PARENT1, {
      subjectClerkId: MINOR,
      type: "parental_consent",
      legalBasis: "ouderlijk gezag",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    grantId = r.json?.grant?.id;
    assert(Number.isInteger(grantId) && grantId > 0, "geen grant-id terug");
    const view = await req("GET", `/api/consent/${MINOR}`, PARENT1);
    assert(view.status === 200, `inzage ouder: ${view.status}`);
    const g = view.json?.consent?.grants?.find((x: any) => x.type === "parental_consent");
    assert(g?.status === "granted", `status=${g?.status}`);
    assert(view.json?.consent?.reconfirmationDueAt, "reconfirmationDueAt ontbreekt (14-jarige → 16e verjaardag)");
    assert(view.json?.consent?.ageClass === "u16", `ageClass=${view.json?.consent?.ageClass}`);
  });

  await scenario("5. tweede geaccepteerde ouder mag inzien en verlenen", async () => {
    const view = await req("GET", `/api/consent/${MINOR}`, PARENT2);
    assert(view.status === 200, `inzage ouder 2: ${view.status}`);
    const r = await req("POST", "/api/consent/grant", PARENT2, {
      subjectClerkId: MINOR,
      type: "media_publication",
    });
    assert(r.status === 200, `ouder 2 verlenen: ${r.status}`);
  });

  await scenario("6. intrekken werkt onmiddellijk", async () => {
    const r = await req("POST", "/api/consent/revoke", PARENT1, { grantId });
    assert(r.status === 200, `revoke: ${r.status}`);
    const view = await req("GET", `/api/consent/${MINOR}`, PARENT1);
    const g = view.json?.consent?.grants?.find((x: any) => x.type === "parental_consent");
    assert(g?.status === "revoked", `status na intrekken=${g?.status}`);
  });

  await scenario("7. vreemde: geen inzage en geen verlenen (403)", async () => {
    const view = await req("GET", `/api/consent/${MINOR}`, STRANGER);
    assert(view.status === 403, `inzage vreemde: ${view.status}`);
    const r = await req("POST", "/api/consent/grant", STRANGER, {
      subjectClerkId: MINOR,
      type: "media_publication",
    });
    assert(r.status === 403, `verlenen vreemde: ${r.status}`);
  });

  await scenario("7b. beëindigde ouder (endedAt gezet): inzage, verlenen en intrekken geweigerd", async () => {
    // Beëindig de relatie van ouder 2 (BB-09: rij blijft, toegang direct weg).
    await db
      .update(parentAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, PARENT2),
          eq(parentAthleteLinksTable.athleteClerkId, MINOR),
        ),
      );
    const view = await req("GET", `/api/consent/${MINOR}`, PARENT2);
    assert(view.status === 403, `inzage beëindigde ouder: ${view.status}`);
    const g = await req("POST", "/api/consent/grant", PARENT2, {
      subjectClerkId: MINOR,
      type: "data_sharing",
    });
    assert(g.status === 403, `verlenen beëindigde ouder: ${g.status}`);
    const rv = await req("POST", "/api/consent/revoke", PARENT2, { grantId });
    assert(rv.status === 403 || rv.status === 404, `intrekken beëindigde ouder: ${rv.status}`);
  });

  await scenario("8. volwassene geeft zichzelf data_sharing → toegestaan", async () => {
    const r = await req("POST", "/api/consent/grant", ADULT, {
      subjectClerkId: ADULT,
      type: "data_sharing",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
  });

  await scenario("9. onbekende leeftijd = strengste regime (zelf verlenen geweigerd)", async () => {
    const r = await req("POST", "/api/consent/grant", NOAGE, {
      subjectClerkId: NOAGE,
      type: "data_sharing",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    assert(r.json?.code === "minor_self_grant_refused", `code=${r.json?.code}`);
  });

  await scenario("10. legacy 'accepted' mapt naar gedeelde status 'granted'", async () => {
    assert(normalizeConsentStatus("accepted") === "granted", "accepted→granted faalt");
    assert(normalizeConsentStatus(null) === "pending", "null→pending faalt (fail-closed)");
    const view = await req("GET", `/api/consent/${MINOR}`, MINOR);
    assert(view.status === 200, `zelf-inzage: ${view.status}`);
    assert(
      view.json?.consent?.legacyParentConsentStatus === "granted",
      `legacy=${view.json?.consent?.legacyParentConsentStatus}`,
    );
  });

  await cleanup();
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();

  let failed = 0;
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  // eslint-disable-next-line no-console
  console.log(`consent-service: ${results.length - failed}/${results.length} pass`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("consent-service test crashed:", err);
  process.exit(1);
});
