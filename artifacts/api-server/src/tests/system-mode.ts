/**
 * system-mode fail-safe tests
 * ────────────────────────────
 * Verifieert dat readSystemMode() NOOIT automatisch terugvalt op NORMAL als
 * gevolg van een DB-fout of afwezige verbinding.
 *
 * Testscenario's:
 *   1. Succesvolle read → retourneert werkelijke DB-waarde
 *   2. DB-fout terwijl SALES_PAUSED actief is → retourneert SALES_PAUSED (niet NORMAL)
 *   3. DB-fout terwijl MAINTENANCE actief is → retourneert MAINTENANCE (niet NORMAL)
 *   4. Processtart zonder DB (geen eerdere read) → retourneert DEGRADED (niet NORMAL)
 *   5. Cache verloopt tijdens storing → retourneert laatste geldige status
 *   6. DB herstelt na storing → retourneert actuele DB-waarde
 *   7. Geen enkel pad opent onbedoeld checkout of nieuwe verkoop
 *
 * Run: pnpm --filter @workspace/api-server run test:system-mode
 */

import {
  readSystemMode,
  writeSystemMode,
  _resetSystemModeStateForTest,
  invalidateSystemModeCache,
} from "../lib/system-mode";
import { db, systemBusinessModeTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
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

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

/** Simuleer een altijd-falende DB-query (injecteerbaar in readSystemMode). */
function failingQuery(): never {
  throw new Error("Gesimuleerde DB-uitval voor testdoeleinden");
}

/**
 * Simuleer een succesvol DB-antwoord zonder echte verbinding.
 */
function successQuery(
  mode: string,
  reason: string | null = null,
): () => Promise<{ mode: string; reason: string | null; id: number }> {
  return async () => ({ id: 1, mode, reason });
}

/** Reset module-state EN zorg dat de echte DB-singleton op een bekende waarde staat. */
async function seedAndReset(
  mode: "NORMAL" | "SALES_PAUSED" | "MAINTENANCE" | "DEGRADED",
) {
  _resetSystemModeStateForTest();
  // Probeer echte DB te seeden voor integratiescenario's.
  try {
    await db
      .insert(systemBusinessModeTable)
      .values({ id: 1, mode, reason: `test-seed-${mode}` })
      .onConflictDoUpdate({
        target: systemBusinessModeTable.id,
        set: { mode, reason: `test-seed-${mode}` },
      });
  } catch {
    // DB niet beschikbaar — pure unit-scenario's werken zonder DB.
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Succesvolle read via injectie: retourneert werkelijke waarde
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "1. Succesvolle read retourneert DB-waarde (geen NORMAL-fabricatie)",
  async () => {
    _resetSystemModeStateForTest();

    const result = await readSystemMode(successQuery("SALES_PAUSED", "test"));
    assert(result.mode === "SALES_PAUSED", `Verwacht SALES_PAUSED, kreeg ${result.mode}`);
    assert(!result.dbError, "dbError moet false zijn bij succes");
    assert(!result.staleCache, "staleCache moet false zijn bij succes");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — DB-fout terwijl SALES_PAUSED actief was: behoudt SALES_PAUSED
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "2. DB-fout na SALES_PAUSED → behoudt SALES_PAUSED, niet NORMAL",
  async () => {
    _resetSystemModeStateForTest();

    // Stap 1: succesvolle read → lastValidRead wordt SALES_PAUSED.
    await readSystemMode(successQuery("SALES_PAUSED", "actieve pauze"));

    // Stap 2: cache wissen zodat volgende read de DB aanroept.
    invalidateSystemModeCache();

    // Stap 3: DB valt uit.
    const result = await readSystemMode(failingQuery as never);

    assert(
      result.mode === "SALES_PAUSED",
      `Verwacht SALES_PAUSED bij DB-fout, kreeg ${result.mode}`,
    );
    assert(result.dbError, "dbError moet true zijn bij DB-fout");
    assert(result.staleCache, "staleCache moet true zijn bij stale cache");
    assert(
      result.mode !== "NORMAL",
      "NORMAL mag NOOIT automatisch verschijnen na DB-fout",
    );
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — DB-fout terwijl MAINTENANCE actief was: behoudt MAINTENANCE
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "3. DB-fout na MAINTENANCE → behoudt MAINTENANCE, niet NORMAL",
  async () => {
    _resetSystemModeStateForTest();

    await readSystemMode(successQuery("MAINTENANCE", "gepland onderhoud"));
    invalidateSystemModeCache();

    const result = await readSystemMode(failingQuery as never);

    assert(
      result.mode === "MAINTENANCE",
      `Verwacht MAINTENANCE, kreeg ${result.mode}`,
    );
    assert(result.dbError, "dbError moet true zijn");
    assert(result.staleCache, "staleCache moet true zijn");
    assert(result.mode !== "NORMAL", "NORMAL verboden na DB-fout");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4 — Processtart zonder DB: retourneert DEGRADED, nooit NORMAL
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "4. Processtart zonder DB → DEGRADED (nooit NORMAL)",
  async () => {
    _resetSystemModeStateForTest(); // leeg — alsof proces net gestart is

    const result = await readSystemMode(failingQuery as never);

    assert(
      result.mode === "DEGRADED",
      `Verwacht DEGRADED bij koude start zonder DB, kreeg ${result.mode}`,
    );
    assert(result.dbError, "dbError moet true zijn");
    assert(!result.staleCache, "staleCache moet false zijn (geen eerdere cache)");
    assert(result.mode !== "NORMAL", "NORMAL verboden bij koude start zonder DB");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5 — Cache verloopt tijdens aanhoudende storing: houdt laatste modus
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "5. Cache verloopt tijdens storing → laatste geldige modus blijft",
  async () => {
    _resetSystemModeStateForTest();

    // Stel geldige toestand in.
    await readSystemMode(successQuery("BILLING_PAUSED"));
    invalidateSystemModeCache(); // simuleer verlopen TTL

    // Eerste fout.
    const r1 = await readSystemMode(failingQuery as never);
    assert(r1.mode === "BILLING_PAUSED", `Na eerste fout: ${r1.mode}`);
    assert(r1.staleCache, "staleCache verwacht");

    // Tweede fout (cache nog steeds ongeldig na DB-fout).
    const r2 = await readSystemMode(failingQuery as never);
    assert(r2.mode === "BILLING_PAUSED", `Na tweede fout: ${r2.mode}`);
    assert(r2.mode !== "NORMAL", "NORMAL verboden na aanhoudende storing");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6 — DB herstelt: retourneert actuele DB-waarde
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "6. DB herstelt → actuele DB-waarde wordt weer gebruikt",
  async () => {
    _resetSystemModeStateForTest();

    // Initieel: SALES_PAUSED bekend.
    await readSystemMode(successQuery("SALES_PAUSED"));
    invalidateSystemModeCache();

    // DB valt uit.
    await readSystemMode(failingQuery as never);

    // DB herstelt met een ANDERE modus.
    const restored = await readSystemMode(successQuery("NORMAL"));

    assert(
      restored.mode === "NORMAL",
      `Na herstel verwacht NORMAL, kreeg ${restored.mode}`,
    );
    assert(!restored.dbError, "dbError moet false zijn na herstel");
    assert(!restored.staleCache, "staleCache moet false zijn na herstel");
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7 — Checkout/verkoop-safe: DEGRADED blokkeert nieuwe verkoop
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "7. Geen enkel fout-pad opent onbedoeld nieuwe verkoop (DEGRADED ≠ NORMAL)",
  async () => {
    const CHECKOUT_ALLOWED_MODES = new Set(["NORMAL"]);
    const SALES_BLOCKED_MODES = new Set([
      "DEGRADED",
      "MAINTENANCE",
      "SALES_PAUSED",
      "BILLING_PAUSED",
      "SERVICE_SHUTDOWN",
    ]);

    // Koude start zonder DB → DEGRADED.
    _resetSystemModeStateForTest();
    const coldStart = await readSystemMode(failingQuery as never);
    assert(
      SALES_BLOCKED_MODES.has(coldStart.mode),
      `Koude start zonder DB geeft ${coldStart.mode} — moet checkout blokkeren`,
    );
    assert(
      !CHECKOUT_ALLOWED_MODES.has(coldStart.mode),
      `CHECKOUT mag niet openen bij ${coldStart.mode}`,
    );

    // DB-fout na SALES_PAUSED → SALES_PAUSED.
    _resetSystemModeStateForTest();
    await readSystemMode(successQuery("SALES_PAUSED"));
    invalidateSystemModeCache();
    const afterError = await readSystemMode(failingQuery as never);
    assert(
      SALES_BLOCKED_MODES.has(afterError.mode),
      `Na DB-fout vanuit SALES_PAUSED geeft ${afterError.mode} — moet blokkeren`,
    );
    assert(
      !CHECKOUT_ALLOWED_MODES.has(afterError.mode),
      `CHECKOUT mag niet openen bij ${afterError.mode}`,
    );
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATIE — Echte DB-lees (als DATABASE_URL beschikbaar is)
// ══════════════════════════════════════════════════════════════════════════════
await scenario(
  "8. Integratie: echte DB-read retourneert geldige modus",
  async () => {
    _resetSystemModeStateForTest();
    let result;
    try {
      // Echte DB-aanroep (geen override).
      result = await readSystemMode();
    } catch {
      // DB niet bereikbaar in deze omgeving — scenario overgeslagen.
      console.log("  [SKIP] DATABASE_URL niet beschikbaar — integratietest overgeslagen");
      return;
    }
    assert(
      (["NORMAL", "DEGRADED", "MAINTENANCE", "SALES_PAUSED", "BILLING_PAUSED", "SERVICE_SHUTDOWN"] as string[]).includes(result.mode),
      `Ongeldige modus ontvangen: ${result.mode}`,
    );
    assert(!result.dbError, "Echte DB moet dbError=false retourneren");
  },
);

// ─── Resultaten ───────────────────────────────────────────────────────────────
console.log("\n── system-mode fail-safe tests ─────────────────────────────────");
for (const r of results) {
  const icon = r.status === "pass" ? "✓" : "✗";
  console.log(`  ${icon} ${r.scenario}`);
  if (r.note) console.log(`      → ${r.note}`);
}

const failed = results.filter((r) => r.status === "fail");
const passed = results.filter((r) => r.status === "pass");
console.log(`\n  ${passed.length}/${results.length} geslaagd`);

if (failed.length > 0) {
  console.error(`\n  ${failed.length} test(s) mislukt.`);
  process.exit(1);
}
console.log("  Alle tests geslaagd.\n");
