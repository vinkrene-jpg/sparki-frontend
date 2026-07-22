// Golf 28 — regressietest voor store-distributie:
// kanaal→releasegroep-plafond, versievergelijking en het rustige
// update-advies op /api/release/version-check.

import assert from "node:assert/strict";
import {
  channelCap,
  leastPermissive,
} from "../lib/release-groups";
import {
  compareVersions,
  isParsableVersion,
  invalidateVersionCache,
} from "../lib/version-gate";
import { db, versionRequirementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const API = process.env.API_BASE ?? "http://localhost:8080";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  OK  ${name}`);
}

async function main() {
  // ── 1. Kanaal → releasegroep (fail-closed) ────────────────────────────────
  ok("kanaal ontwikkeling ⇒ intern", channelCap("ontwikkeling") === "intern");
  ok("kanaal testflight ⇒ test", channelCap("testflight") === "test");
  ok("kanaal pilot ⇒ pilot", channelCap("pilot") === "pilot");
  ok("kanaal productie ⇒ productie", channelCap("productie") === "productie");
  ok("onbekend kanaal ⇒ productie (fail-closed)", channelCap("nep-kanaal") === "productie");
  ok("geen header ⇒ geen plafond", channelCap(null) === null && channelCap("") === null);
  ok(
    "plafond: intern-gebruiker op productie-build ⇒ productie",
    leastPermissive("intern", "productie") === "productie",
  );
  ok(
    "plafond: productie-gebruiker op intern kanaal blijft productie",
    leastPermissive("productie", "intern") === "productie",
  );

  // ── 2. Versievergelijking ─────────────────────────────────────────────────
  ok("1.2.0 < 1.10.0", compareVersions("1.2.0", "1.10.0") < 0);
  ok("1.0 == 1.0.0", compareVersions("1.0", "1.0.0") === 0);
  ok("versie 'abc' is niet parseerbaar", !isParsableVersion("abc"));

  // ── 3. Update-advies op /api/release/version-check ────────────────────────
  // Zet een aanbevolen versie hoger dan de client en controleer het advies;
  // ruim daarna netjes op (alleen de recommended-kolom, additief).
  const [before] = await db
    .select()
    .from(versionRequirementsTable)
    .where(eq(versionRequirementsTable.platform, "mobiel"));
  await db
    .insert(versionRequirementsTable)
    .values({ platform: "mobiel", minVersion: before?.minVersion ?? "0.0.1", recommendedVersion: "99.0.0" })
    .onConflictDoUpdate({
      target: versionRequirementsTable.platform,
      set: { recommendedVersion: "99.0.0" },
    });
  invalidateVersionCache();

  const res = await fetch(`${API}/api/release/version-check`, {
    headers: {
      "x-sparki-app-version": "1.0.0",
      "x-sparki-platform": "mobiel",
    },
  });
  const body = (await res.json()) as {
    ok: boolean;
    updateAdvies: { recommendedVersion: string } | null;
  };
  ok("version-check blijft 200 (nooit blokkade)", res.status === 200 && body.ok === true);
  ok(
    "update-advies met aanbevolen versie",
    body.updateAdvies?.recommendedVersion === "99.0.0",
  );

  const res2 = await fetch(`${API}/api/release/version-check`, {
    headers: {
      "x-sparki-app-version": "99.0.0",
      "x-sparki-platform": "mobiel",
    },
  });
  const body2 = (await res2.json()) as { updateAdvies: unknown };
  ok("client op aanbevolen versie ⇒ geen advies", body2.updateAdvies === null);

  // Opruimen: herstel de oorspronkelijke recommended-waarde.
  await db
    .update(versionRequirementsTable)
    .set({ recommendedVersion: before?.recommendedVersion ?? null })
    .where(eq(versionRequirementsTable.platform, "mobiel"));
  if (!before) {
    await db
      .delete(versionRequirementsTable)
      .where(eq(versionRequirementsTable.platform, "mobiel"));
  }

  console.log(`\nstore-release: ${passed} controles geslaagd`);
  process.exit(0);
}

main().catch((err) => {
  console.error("store-release test FAILED:", err);
  process.exit(1);
});
