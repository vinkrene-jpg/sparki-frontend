// Golf 14 — releasegroepen, gefaseerde uitrol, kill switches, versiecheck en
// foutgroepering (regressietest).
//
// Scenario's:
//   1. mostPermissive: leeg ⇒ productie; intern wint van productie.
//   2. effectiveReleaseGroup: onbekende gebruiker ⇒ productie (fail-closed).
//   3. compareVersions/isParsableVersion: semver-vergelijking en validatie.
//   4. rolloutBucket: deterministisch en binnen 0..99.
//   5. resolveFlags: groepvrijgave + rollout 100% ⇒ aan; rollout 0% ⇒ uit;
//      override negeert percentage; platformpoort sluit verkeerd platform uit.
//   6. Kill switch: actieve switch ⇒ 503 op een bewaakt endpoint; uit ⇒ open.
//   7. Versiecheck: client onder minimum ⇒ 426 met code; op minimum ⇒ door;
//      zonder versieheader ⇒ nooit geblokkeerd.
//   8. Foutregistratie: twee gelijke meldingen ⇒ zelfde groep, eventCount 2.
//
// Run: `pnpm --filter @workspace/api-server run test:rollout` (via shell)
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  featureFlagsTable,
  userFlagOverridesTable,
  userProfilesTable,
  killSwitchesTable,
  versionRequirementsTable,
  errorGroupsTable,
  errorEventsTable,
  type FeatureFlag,
} from "@workspace/db";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { mostPermissive, effectiveReleaseGroup } from "../lib/release-groups";
import { compareVersions, isParsableVersion, invalidateVersionCache } from "../lib/version-gate";
import { rolloutBucket, resolveFlags } from "../lib/flags";
import { invalidateKillSwitchCache } from "../lib/kill-switches";

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

const RUN = `test_rollout_${Date.now()}`;
const clerkA = `${RUN}_a`;
const FLAG_KEY = "climb_explorer" as const;
const ERR_MSG = `Rollout-testfout ${RUN}`;

let savedFlag: FeatureFlag | null = null;
let savedWebRequirement: { minVersion: string; message: string | null } | null =
  null;
let hadWebRequirement = false;

async function setFlag(patch: {
  enabledGlobally?: boolean;
  enabledRoles?: string[];
  enabledGroups?: string[];
  enabledPlatforms?: string[];
  rolloutPercentage?: number;
}) {
  await db
    .insert(featureFlagsTable)
    .values({
      key: FLAG_KEY,
      enabledGlobally: false,
      enabledRoles: [],
      enabledGroups: [],
      enabledPlatforms: [],
      rolloutPercentage: 100,
      ...patch,
    })
    .onConflictDoUpdate({
      target: featureFlagsTable.key,
      set: {
        enabledGlobally: patch.enabledGlobally ?? false,
        enabledRoles: patch.enabledRoles ?? [],
        enabledGroups: patch.enabledGroups ?? [],
        enabledPlatforms: patch.enabledPlatforms ?? [],
        rolloutPercentage: patch.rolloutPercentage ?? 100,
      },
    });
}

async function cleanup(): Promise<void> {
  await db
    .delete(userFlagOverridesTable)
    .where(eq(userFlagOverridesTable.clerkId, clerkA));
  // Flagrij terugzetten zoals aangetroffen.
  if (savedFlag) {
    await db
      .update(featureFlagsTable)
      .set({
        enabledGlobally: savedFlag.enabledGlobally,
        enabledRoles: savedFlag.enabledRoles,
        enabledGroups: savedFlag.enabledGroups,
        enabledPlatforms: savedFlag.enabledPlatforms,
        rolloutPercentage: savedFlag.rolloutPercentage,
      })
      .where(eq(featureFlagsTable.key, FLAG_KEY));
  } else {
    await db.delete(featureFlagsTable).where(eq(featureFlagsTable.key, FLAG_KEY));
  }
  // Kill switch uit.
  await db
    .update(killSwitchesTable)
    .set({ active: false })
    .where(eq(killSwitchesTable.key, "club_features"));
  invalidateKillSwitchCache();
  // Versievereiste terugzetten.
  if (hadWebRequirement && savedWebRequirement) {
    await db
      .update(versionRequirementsTable)
      .set({
        minVersion: savedWebRequirement.minVersion,
        message: savedWebRequirement.message,
      })
      .where(eq(versionRequirementsTable.platform, "web"));
  } else {
    await db
      .delete(versionRequirementsTable)
      .where(eq(versionRequirementsTable.platform, "web"));
  }
  invalidateVersionCache();
  // Testfoutgroepen + events weg.
  const groups = await db
    .select({ id: errorGroupsTable.id })
    .from(errorGroupsTable)
    .where(eq(errorGroupsTable.message, ERR_MSG));
  if (groups.length > 0) {
    const ids = groups.map((g) => g.id);
    await db.delete(errorEventsTable).where(inArray(errorEventsTable.groupId, ids));
    await db.delete(errorGroupsTable).where(inArray(errorGroupsTable.id, ids));
  }
  // Testaccount weg.
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, clerkA));
}

async function main() {
  await startServer();
  await ensureAccount(clerkA, `${clerkA}@example.test`, "Rollout", silentLogger);

  const [existingFlag] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, FLAG_KEY));
  savedFlag = existingFlag ?? null;
  const [existingReq] = await db
    .select()
    .from(versionRequirementsTable)
    .where(eq(versionRequirementsTable.platform, "web"));
  hadWebRequirement = Boolean(existingReq);
  savedWebRequirement = existingReq
    ? { minVersion: existingReq.minVersion, message: existingReq.message }
    : null;

  await scenario("mostPermissive: leeg ⇒ productie, intern wint", () => {
    assert(mostPermissive([]) === "productie", "leeg moet productie zijn");
    assert(mostPermissive([null, "onzin", undefined]) === "productie", "onbekend moet productie zijn");
    assert(mostPermissive(["productie", "pilot", "intern"]) === "intern", "intern moet winnen");
    assert(mostPermissive(["productie", "test"]) === "test", "test moet winnen van productie");
  });

  await scenario("effectiveReleaseGroup: onbekende gebruiker ⇒ productie", async () => {
    const g = await effectiveReleaseGroup(`${RUN}_bestaat_niet`);
    assert(g === "productie", `verwacht productie, kreeg ${g}`);
  });

  await scenario("compareVersions + isParsableVersion", () => {
    assert(compareVersions("1.0.0", "1.0.0") === 0, "gelijk moet 0 zijn");
    assert(compareVersions("1.0.0", "1.0.1") < 0, "1.0.0 < 1.0.1");
    assert(compareVersions("2.0", "1.9.9") > 0, "2.0 > 1.9.9");
    assert(compareVersions("1.0", "1.0.0") === 0, "ontbrekend deel telt als 0");
    assert(isParsableVersion("1.2.3"), "1.2.3 is geldig");
    assert(!isParsableVersion("v1.2.3"), "v-prefix is ongeldig");
    assert(!isParsableVersion("abc"), "tekst is ongeldig");
  });

  await scenario("rolloutBucket: deterministisch, 0..99", () => {
    const b1 = rolloutBucket(clerkA, FLAG_KEY);
    const b2 = rolloutBucket(clerkA, FLAG_KEY);
    assert(b1 === b2, "bucket moet stabiel zijn");
    assert(b1 >= 0 && b1 < 100, `bucket buiten bereik: ${b1}`);
    const other = rolloutBucket(`${clerkA}x`, FLAG_KEY);
    assert(other >= 0 && other < 100, "andere gebruiker ook 0..99");
  });

  await scenario("resolveFlags: groepvrijgave met rollout 100% ⇒ aan", async () => {
    await setFlag({ enabledGroups: ["test"], rolloutPercentage: 100 });
    const flags = await resolveFlags(clerkA, "athlete", { releaseGroup: "test" });
    assert(flags[FLAG_KEY] === true, "flag moet aan zijn binnen de groep");
    const buiten = await resolveFlags(clerkA, "athlete", { releaseGroup: "productie" });
    assert(buiten[FLAG_KEY] === false, "buiten de groep moet uit zijn");
  });

  await scenario("resolveFlags: rollout 0% ⇒ uit ondanks vrijgave", async () => {
    await setFlag({ enabledGroups: ["test"], rolloutPercentage: 0 });
    const flags = await resolveFlags(clerkA, "athlete", { releaseGroup: "test" });
    assert(flags[FLAG_KEY] === false, "0% moet iedereen uitsluiten");
  });

  await scenario("resolveFlags: override negeert percentage", async () => {
    await db
      .insert(userFlagOverridesTable)
      .values({ clerkId: clerkA, flagKey: FLAG_KEY, enabled: true })
      .onConflictDoUpdate({
        target: [userFlagOverridesTable.clerkId, userFlagOverridesTable.flagKey],
        set: { enabled: true },
      });
    const flags = await resolveFlags(clerkA, "athlete", { releaseGroup: "productie" });
    assert(flags[FLAG_KEY] === true, "override true moet altijd winnen");
    await db
      .delete(userFlagOverridesTable)
      .where(eq(userFlagOverridesTable.clerkId, clerkA));
  });

  await scenario("resolveFlags: platformpoort sluit verkeerd platform uit", async () => {
    await setFlag({ enabledGlobally: true, enabledPlatforms: ["web"], rolloutPercentage: 100 });
    const web = await resolveFlags(clerkA, "athlete", { platform: "web" });
    assert(web[FLAG_KEY] === true, "web moet aan zijn");
    const mobiel = await resolveFlags(clerkA, "athlete", { platform: "mobiel" });
    assert(mobiel[FLAG_KEY] === false, "mobiel moet uit zijn");
  });

  await scenario("kill switch: actief ⇒ 503, uit ⇒ open", async () => {
    await db
      .insert(killSwitchesTable)
      .values({ key: "club_features", active: true, reason: "test" })
      .onConflictDoUpdate({
        target: killSwitchesTable.key,
        set: { active: true, reason: "test" },
      });
    invalidateKillSwitchCache();
    const blocked = await fetch(`${baseUrl}/api/clubs/mine`, {
      headers: { "x-dev-clerk-id": clerkA },
    });
    assert(blocked.status === 503, `verwacht 503, kreeg ${blocked.status}`);
    const body = (await blocked.json()) as { killSwitch?: string };
    assert(body.killSwitch === "club_features", "antwoord moet de switch benoemen");
    await db
      .update(killSwitchesTable)
      .set({ active: false })
      .where(eq(killSwitchesTable.key, "club_features"));
    invalidateKillSwitchCache();
    const open = await fetch(`${baseUrl}/api/clubs/mine`, {
      headers: { "x-dev-clerk-id": clerkA },
    });
    assert(open.status !== 503, `switch uit maar toch ${open.status}`);
  });

  await scenario("versiecheck: oud ⇒ 426, actueel ⇒ door, geen header ⇒ door", async () => {
    await db
      .insert(versionRequirementsTable)
      .values({ platform: "web", minVersion: "2.0.0" })
      .onConflictDoUpdate({
        target: versionRequirementsTable.platform,
        set: { minVersion: "2.0.0", message: null },
      });
    invalidateVersionCache();
    const oud = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        "x-dev-clerk-id": clerkA,
        "x-sparki-app-version": "1.0.0",
        "x-sparki-platform": "web",
      },
    });
    assert(oud.status === 426, `verwacht 426, kreeg ${oud.status}`);
    const oudBody = (await oud.json()) as { code?: string; minVersion?: string };
    assert(oudBody.code === "version_incompatible", "code moet version_incompatible zijn");
    assert(oudBody.minVersion === "2.0.0", "minVersion moet meekomen");
    const actueel = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        "x-dev-clerk-id": clerkA,
        "x-sparki-app-version": "2.0.0",
        "x-sparki-platform": "web",
      },
    });
    assert(actueel.status !== 426, `actuele versie geblokkeerd: ${actueel.status}`);
    const zonder = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { "x-dev-clerk-id": clerkA },
    });
    assert(zonder.status !== 426, `zonder header geblokkeerd: ${zonder.status}`);
  });

  await scenario("foutregistratie: gelijke meldingen groeperen", async () => {
    const post = () =>
      fetch(`${baseUrl}/api/release/errors`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-clerk-id": clerkA,
          "x-sparki-platform": "web",
          "x-sparki-app-version": "2.0.0",
        },
        body: JSON.stringify({
          message: ERR_MSG,
          stack: `Error: ${ERR_MSG}\n    at test (rollout.ts:1:1)`,
          severity: "fout",
          screen: "/test",
        }),
      });
    const r1 = await post();
    assert(r1.status === 202, `verwacht 202, kreeg ${r1.status}`);
    const b1 = (await r1.json()) as { groupId?: number };
    const r2 = await post();
    const b2 = (await r2.json()) as { groupId?: number };
    assert(
      b1.groupId != null && b1.groupId === b2.groupId,
      `zelfde fout moet zelfde groep zijn (${b1.groupId} vs ${b2.groupId})`,
    );
    const [group] = await db
      .select()
      .from(errorGroupsTable)
      .where(eq(errorGroupsTable.id, b1.groupId!));
    assert(group != null, "groep moet bestaan");
    assert(group.eventCount === 2, `eventCount moet 2 zijn, is ${group.eventCount}`);
    const events = await db
      .select({ id: errorEventsTable.id })
      .from(errorEventsTable)
      .where(eq(errorEventsTable.groupId, b1.groupId!));
    assert(events.length === 2, `2 events verwacht, ${events.length} gevonden`);
  });

  await cleanup();
  await stopServer();

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
  console.error("Testrun crashte:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
