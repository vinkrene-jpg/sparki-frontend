// Privacy, accountbeheer & beveiliging — DB-backed contract test (Afbouwgolf 3).
//
// Boots the REAL Express app and proves, end-to-end against the real database:
//   1.  Token-encryptie: roundtrip + "enc:v1:"-prefix (nooit plaintext at rest).
//   2.  Legacy plaintext-doorloop: decryptSecret geeft oude waarden ongewijzigd terug.
//   3.  Auditlog: writeAudit schrijft een regel (append-only pad).
//   4.  Juridische documenten: GET zaait versie 1.0 met echte Nederlandse tekst.
//   5.  Akkoord: accept legt versie + datum vast én schrijft consent_change-audit.
//   6.  Accountoverzicht: wieZietWat volgt live de echte deelinstellingen.
//   7.  Export: bevat eigen data uit meerdere tabellen, NOOIT tokens, en niets van een ander.
//   8.  Export schrijft een verplichte auditregel.
//   9.  Verwijderen zonder exacte bevestigingszin → 400, er verandert niets.
//   10. Verwijderverzoek: hersteltermijn gepland + audit; annuleren maakt het ongedaan.
//   11. Hersteltermijn: niet-verstreken verzoek wordt NIET uitgevoerd.
//   12. Definitieve verwijdering: rij + cascade weg, audit met uitzonderingenregister blijft.
//   13. Minderjarige (<16) zonder oudertoestemming: coach-delen valt terug op "none".
//   14. Minderjarige mét geaccepteerde toestemming: ingestelde niveau geldt weer.
//   15. Uploadvalidatie: te groot en verkeerd bestandstype → 400 + upload_rejected-audit.
//   16. Rate limiting: na de limiet volgt een generieke Nederlandse 429 + audit.
//   17. Sessies beëindigen: route antwoordt eerlijk en schrijft sessions_ended-audit.
//   18. Koppeling verbreken schrijft link_change-audit.
//
// Run: `pnpm --filter @workspace/api-server run test:privacy-security`

import type { Server } from "node:http";
import { and, desc, eq, gt } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  securityAuditLogTable,
  legalDocumentsTable,
  coachAthleteLinksTable,
  racesTable,
} from "@workspace/db";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  encryptSecret,
  decryptSecret,
  isEncryptedSecret,
} from "../lib/token-crypto";
import { writeAudit } from "../lib/security/audit";
import { coachSharingLevel } from "../lib/sharing";
import {
  processDueAccountDeletions,
  recoveryDaysFor,
  allowsDirectDeletion,
  resolveAccountType,
  type AccountType,
} from "../lib/account-privacy";

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

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
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

async function latestAudit(event: string, subject?: string) {
  const rows = await db
    .select()
    .from(securityAuditLogTable)
    .where(
      subject
        ? and(
            eq(securityAuditLogTable.event, event),
            eq(securityAuditLogTable.subjectClerkId, subject),
          )
        : eq(securityAuditLogTable.event, event),
    )
    .orderBy(desc(securityAuditLogTable.at))
    .limit(1);
  return rows[0] ?? null;
}

const RUN = `test_privsec_${Date.now()}`;
const clerkA = `${RUN}_a`; // volwassen atleet
const clerkB = `${RUN}_b`; // tweede atleet (isolatie)
const clerkMinor = `${RUN}_minor`; // minderjarige
const clerkDel = `${RUN}_del`; // wordt verwijderd
const clerkDirect = `${RUN}_direct`; // direct definitief (GF8-05/08)
const coachId = `${RUN}_coach`;

async function main() {
  process.env.SPARKI_TOKEN_KEY =
    process.env.SPARKI_TOKEN_KEY || "test-key-for-privacy-security-suite";

  await startServer();

  // Seed
  for (const [id, mail] of [
    [clerkA, "a"],
    [clerkB, "b"],
    [clerkMinor, "minor"],
    [clerkDel, "del"],
    [clerkDirect, "direct"],
    [coachId, "coach"],
  ] as const) {
    const p = await ensureAccount(id, `${RUN}_${mail}@example.test`, mail, silentLogger);
    assert(p, `seed ${id} failed`);
  }

  // ── 1+2: token-encryptie ────────────────────────────────────────────────
  await scenario("token-encryptie roundtrip met enc:v1:-prefix", () => {
    const enc = encryptSecret("strava-token-xyz");
    assert(enc && enc.startsWith("enc:v1:"), "geen enc:v1:-prefix");
    assert(isEncryptedSecret(enc), "isEncryptedSecret vals negatief");
    assert(decryptSecret(enc) === "strava-token-xyz", "roundtrip mislukt");
  });
  await scenario("legacy plaintext-token blijft leesbaar (doorloop)", () => {
    assert(decryptSecret("old-plain-token") === "old-plain-token", "plaintext niet doorgegeven");
    assert(!isEncryptedSecret("old-plain-token"), "plaintext gemarkeerd als versleuteld");
  });

  // ── 3: auditlog schrijft ────────────────────────────────────────────────
  await scenario("auditlog: writeAudit schrijft een regel", async () => {
    await writeAudit(
      { event: "suspicious", actorClerkId: clerkA, subjectClerkId: clerkA, meta: { test: RUN } },
      { required: true },
    );
    const row = await latestAudit("suspicious", clerkA);
    assert(row, "geen auditregel gevonden");
    assert((row!.meta as any)?.test === RUN, "meta niet bewaard");
  });

  // ── 4+5: juridische documenten ──────────────────────────────────────────
  await scenario("juridische documenten: GET zaait versie met echte tekst", async () => {
    for (const kind of ["privacy", "terms"] as const) {
      const r = await req("GET", `/api/legal/${kind}`, clerkA);
      assert(r.status === 200, `${kind}: status ${r.status}`);
      assert(r.json.version, `${kind}: geen versie`);
      assert(
        typeof r.json.bodyMd === "string" && r.json.bodyMd.length > 500,
        `${kind}: tekst ontbreekt of te kort`,
      );
      assert(!/\bAI\b/.test(r.json.bodyMd), `${kind}: bevat 'AI' in gebruikers-tekst`);
    }
  });
  await scenario("akkoord legt versie+datum vast en schrijft consent-audit", async () => {
    const r = await req("POST", "/api/legal/privacy/accept", clerkA);
    assert(r.status === 200 && r.json.ok, `accept faalde: ${r.status}`);
    const [ps] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkA));
    assert(ps?.acceptedPrivacyAt, "acceptedPrivacyAt niet gezet");
    assert(ps?.acceptedPrivacyVersion === r.json.version, "versie niet vastgelegd");
    const audit = await latestAudit("consent_change", clerkA);
    assert(audit && (audit.meta as any)?.document === "privacy", "consent-audit ontbreekt");
  });

  // ── 6: wieZietWat volgt echte instellingen ──────────────────────────────
  await scenario("accountoverzicht: wieZietWat volgt deelinstellingen", async () => {
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: clerkA, dataSharingCoach: "none" })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { dataSharingCoach: "none" },
      });
    let r = await req("GET", "/api/account/overview", clerkA);
    assert(r.status === 200, `overview ${r.status}`);
    assert(r.json.wieZietWat.coach.level === "none", "coach-niveau volgt niet");
    assert(r.json.wieZietWat.coach.ziet.length === 0, "coach ziet bij 'none' toch iets");
    await db
      .update(privacySettingsTable)
      .set({ dataSharingCoach: "full" })
      .where(eq(privacySettingsTable.clerkId, clerkA));
    r = await req("GET", "/api/account/overview", clerkA);
    assert(r.json.wieZietWat.coach.level === "full", "full niet doorgevoerd");
    assert(
      r.json.wieZietWat.coach.ziet.some((z: string) => z.toLowerCase().includes("ruwe")),
      "full toont geen ruwe data",
    );
    assert(r.json.wieZietWat.club.ziet.length === 0, "club heeft directe toegang?");
  });

  // ── 7+8: export ─────────────────────────────────────────────────────────
  await scenario("export: eigen data uit meerdere tabellen, geen tokens, niets van een ander", async () => {
    await db.insert(racesTable).values({
      clerkId: clerkA,
      name: `${RUN} export race`,
      raceDate: "2026-09-01",
    });
    const r = await req("GET", "/api/account/export", clerkA);
    assert(r.status === 200, `export ${r.status}`);
    const tables = r.json.tables as Record<string, any[]>;
    assert(tables.user_profiles?.length === 1, "user_profiles ontbreekt");
    assert(tables.races?.some((x) => x.name === `${RUN} export race`), "race ontbreekt");
    const flat = JSON.stringify(tables);
    assert(!flat.includes(clerkB), "export bevat data van een ander account");
    assert(!flat.includes("access_token\":\"enc:v1:"), "export lekt versleutelde tokens");
  });
  await scenario("export schrijft verplichte auditregel", async () => {
    const audit = await latestAudit("data_export", clerkA);
    assert(audit, "data_export-audit ontbreekt");
  });

  // ── 9+10: verwijderflow ─────────────────────────────────────────────────
  await scenario("verwijderen zonder exacte bevestigingszin → 400", async () => {
    const r = await req("POST", "/api/account/delete", clerkA, { confirm: "verwijder" });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    const [ps] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkA));
    assert(!ps?.deleteRequestedAt, "deleteRequestedAt tóch gezet");
  });
  await scenario("verwijderverzoek plant hersteltermijn; annuleren draait terug", async () => {
    const r = await req("POST", "/api/account/delete", clerkA, {
      confirm: "VERWIJDER MIJN ACCOUNT",
    });
    assert(
      r.status === 200 && r.json.hersteltermijnDagen === recoveryDaysFor("athlete"),
      "verzoek faalde",
    );
    let [ps] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkA));
    assert(ps?.deleteRequestedAt, "deleteRequestedAt niet gezet");
    assert(await latestAudit("delete_requested", clerkA), "delete_requested-audit ontbreekt");
    const c = await req("POST", "/api/account/delete/cancel", clerkA);
    assert(c.status === 200, "cancel faalde");
    [ps] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkA));
    assert(!ps?.deleteRequestedAt, "cancel wiste verzoek niet");
  });

  // ── 10b: accounttype-beleid (GF8-08) ────────────────────────────────────
  await scenario("beleidshelpers: club = 30 dagen + geen direct definitief", () => {
    // De helpers zijn de ENE bron voor het beleid; de routes leunen erop.
    assert(recoveryDaysFor("club") === 30, "club-termijn moet altijd 30 zijn");
    assert(
      allowsDirectDeletion("club") === false,
      "club mag NOOIT direct definitief verwijderen",
    );
    assert(
      allowsDirectDeletion("athlete") === true,
      "atleet mag wél direct definitief verwijderen",
    );
  });
  await scenario("resolveAccountType is de enige plek en geeft vandaag 'athlete'", async () => {
    const t = await resolveAccountType(clerkA);
    assert(t === "athlete", `verwacht athlete, kreeg ${t}`);
  });
  await scenario("overview geeft server-side termijn + directDefinitiefMogelijk", async () => {
    const r = await req("GET", "/api/account/overview", clerkA);
    const type = await resolveAccountType(clerkA);
    assert(r.status === 200, `overview ${r.status}`);
    assert(
      r.json.hersteltermijnDagen === recoveryDaysFor(type),
      "hersteltermijnDagen wijkt af van server-side beleid",
    );
    assert(
      r.json.directDefinitiefMogelijk === allowsDirectDeletion(type),
      "directDefinitiefMogelijk wijkt af van server-side beleid",
    );
  });
  await scenario(
    "delete-route dwingt directDefinitief-beleid af per accounttype",
    async () => {
      // Contract: de route MOET direct definitief weigeren met 403 precies wanneer
      // allowsDirectDeletion(type) false is, en anders meteen definitief verwijderen.
      // Vandaag is elk account 'athlete' (toegestaan); een 'club' zou 403 geven.
      const type: AccountType = await resolveAccountType(clerkDirect);
      const r = await req("POST", "/api/account/delete", clerkDirect, {
        confirm: "VERWIJDER MIJN ACCOUNT",
        directDefinitief: true,
      });
      if (allowsDirectDeletion(type)) {
        // Toegestaan → meteen definitief, geen hersteltermijn gepland.
        assert(
          r.status === 200 && r.json.definitief === true,
          `direct definitief zou moeten slagen, kreeg ${r.status}`,
        );
        const [row] = await db
          .select()
          .from(userProfilesTable)
          .where(eq(userProfilesTable.clerkId, clerkDirect));
        assert(!row, "account niet direct verwijderd bij direct definitief");
        const audit = await latestAudit("delete_executed", clerkDirect);
        assert(audit, "delete_executed-audit ontbreekt bij direct definitief");
        assert(
          (audit!.meta as any)?.reason === "direct_verzoek",
          "reden is niet direct_verzoek",
        );
      } else {
        // Niet toegestaan (bijv. club) → 403, account blijft bestaan.
        assert(r.status === 403, `verwacht 403 voor ${type}, kreeg ${r.status}`);
        const [row] = await db
          .select()
          .from(userProfilesTable)
          .where(eq(userProfilesTable.clerkId, clerkDirect));
        assert(row, "account tóch verwijderd terwijl beleid dit verbiedt");
      }
    },
  );

  // ── 11+12: hersteltermijn + definitieve verwijdering ────────────────────
  await scenario("niet-verstreken verzoek wordt NIET uitgevoerd", async () => {
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: clerkDel, deleteRequestedAt: new Date() })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { deleteRequestedAt: new Date() },
      });
    await processDueAccountDeletions();
    const [row] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkDel));
    assert(row, "account te vroeg verwijderd");
  });
  await scenario("verstreken verzoek: cascade-verwijdering + audit met uitzonderingen", async () => {
    const past = new Date(
      Date.now() - (recoveryDaysFor("athlete") + 1) * 24 * 60 * 60 * 1000,
    );
    await db
      .update(privacySettingsTable)
      .set({ deleteRequestedAt: past })
      .where(eq(privacySettingsTable.clerkId, clerkDel));
    const n = await processDueAccountDeletions();
    assert(n >= 1, "geen verwijdering uitgevoerd");
    const [row] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkDel));
    assert(!row, "user_profiles-rij bestaat nog");
    const [child] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkDel));
    assert(!child, "athlete_profiles niet mee-verwijderd (cascade)");
    const audit = await latestAudit("delete_executed", clerkDel);
    assert(audit, "delete_executed-audit ontbreekt");
    const exceptions = (audit!.meta as any)?.exceptions as any[];
    assert(Array.isArray(exceptions) && exceptions.length > 0, "uitzonderingenregister leeg");
  });

  // ── 13+14: minderjarigenflow ────────────────────────────────────────────
  await scenario("minderjarige zonder oudertoestemming: coach-delen valt terug op 'none'", async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 14);
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: dob.toISOString().slice(0, 10) })
      .where(eq(athleteProfilesTable.clerkId, clerkMinor));
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: clerkMinor, dataSharingCoach: "full", parentConsentStatus: "pending" })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { dataSharingCoach: "full", parentConsentStatus: "pending" },
      });
    assert((await coachSharingLevel(clerkMinor)) === "none", "minor zonder consent niet fail-closed");
    // En via de echte coach-route:
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "coach"], activeRole: "coach" })
      .where(eq(userProfilesTable.clerkId, coachId));
    await db
      .insert(coachAthleteLinksTable)
      .values({ coachClerkId: coachId, athleteClerkId: clerkMinor, status: "accepted" })
      .onConflictDoNothing();
    const r = await req("GET", `/api/coach/athletes/${clerkMinor}`, coachId);
    assert(r.status === 200 && r.json.sharing === "none", "coach-route lekt data van minor");
    assert(r.json.athlete === null, "coach-route geeft toch atleetdata");
  });
  await scenario("minderjarige mét geaccepteerde toestemming: ingesteld niveau geldt", async () => {
    await db
      .update(privacySettingsTable)
      .set({ parentConsentStatus: "accepted" })
      .where(eq(privacySettingsTable.clerkId, clerkMinor));
    assert((await coachSharingLevel(clerkMinor)) === "full", "consent heft blokkade niet op");
  });

  // ── 15: uploadvalidatie ─────────────────────────────────────────────────
  await scenario("upload: te groot en verkeerd type → 400 + audit", async () => {
    const big = await req("POST", "/api/storage/uploads/request-url", clerkB, {
      name: "x.png",
      contentType: "image/png",
      size: 26 * 1024 * 1024,
    });
    assert(big.status === 400, `te groot: ${big.status}`);
    const wrong = await req("POST", "/api/storage/uploads/request-url", clerkB, {
      name: "x.exe",
      contentType: "application/x-msdownload",
      size: 100,
    });
    assert(wrong.status === 400, `verkeerd type: ${wrong.status}`);
    const audit = await latestAudit("upload_rejected");
    assert(audit && audit.actorClerkId === clerkB, "upload_rejected-audit ontbreekt");
  });

  // ── 16: rate limiting ───────────────────────────────────────────────────
  await scenario("rate limiting: na limiet volgt Nederlandse 429 + audit", async () => {
    // account_delete: max 5 per uur — 5 foute pogingen tellen mee, de 6e is 429.
    let got429 = false;
    let lastError = "";
    for (let i = 0; i < 7; i++) {
      const r = await req("POST", "/api/account/delete", clerkB, { confirm: "nee" });
      if (r.status === 429) {
        got429 = true;
        lastError = String(r.json?.error ?? "");
        break;
      }
      assert(r.status === 400, `onverwachte status ${r.status}`);
    }
    assert(got429, "geen 429 na overschrijding");
    assert(/te veel|probeer/i.test(lastError), "429 heeft geen Nederlandse uitleg");
    // audit is fire-and-forget — even wachten
    await new Promise((res) => setTimeout(res, 300));
    const audit = await latestAudit("rate_limited");
    assert(audit, "rate_limited-audit ontbreekt");
  });

  // ── 17: sessies beëindigen ──────────────────────────────────────────────
  await scenario("sessies beëindigen: eerlijk antwoord + audit", async () => {
    const r = await req("POST", "/api/account/sessions/end", clerkB);
    assert(r.status === 200 && r.json.ok, `sessions/end ${r.status}`);
    assert(await latestAudit("sessions_ended", clerkB), "sessions_ended-audit ontbreekt");
  });

  // ── 18: koppeling verbreken → audit ─────────────────────────────────────
  await scenario("koppeling verbreken schrijft link_change-audit", async () => {
    await db
      .insert(coachAthleteLinksTable)
      .values({ coachClerkId: coachId, athleteClerkId: clerkB, status: "accepted" })
      .onConflictDoNothing();
    const r = await req("DELETE", `/api/links/coach/${coachId}`, clerkB);
    assert(r.status === 200 && r.json.removed === 1, "unlink faalde");
    // audit is fire-and-forget — even wachten
    await new Promise((res) => setTimeout(res, 300));
    const audit = await latestAudit("link_change", clerkB);
    assert(audit, "link_change-audit ontbreekt");
  });

  // ── Cleanup ─────────────────────────────────────────────────────────────
  for (const id of [clerkA, clerkB, clerkMinor, clerkDel, clerkDirect, coachId]) {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id));
  }

  await stopServer();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test crashed:", err);
  try {
    await stopServer();
    await pool.end();
  } catch {
    // best effort
  }
  process.exit(1);
});
