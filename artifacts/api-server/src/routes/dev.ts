import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  clubMembersTable,
} from "@workspace/db";
import { isNull, and } from "drizzle-orm";
import { isAdmin } from "../lib/flags";
import { computeAge } from "../lib/age";
import { resolvePersonality } from "../engines/observation";
import { PREVIEW_PERSONAS } from "../lib/preview-athletes";

// Dev-only routes. This router is mounted ONLY when NODE_ENV !== "production"
// (see routes/index.ts), so in production these endpoints simply do not exist
// (404). Nothing here touches real auth or grants access — it only lists the
// seeded preview gebruikers so the dev preview switcher knows who it can
// switch to.
const router = Router();

const VARIANT_LABELS: Record<string, string> = {
  sparki_go: "Go",
  sparki_basic: "Basis",
  sparki_performance: "Performance",
  sparki_pro: "Pro",
};

// F-P0-01: één leeftijdsdefinitie — lib/age.computeAge, geen eigen kopie.

// GET /api/dev/preview-athletes — the seeded preview gebruikers that actually
// exist, in canonical order and grouped (Atleten / Abonnement / Rol &
// leeftijd). Honest: an id that was never seeded is omitted (no fabricated
// entries). Each carries an honest subtitle built from the REAL resolved
// rol/leeftijd/entitlement, so the switcher shows what actually applies.
router.get("/preview-athletes", async (req, res) => {
  try {
    const ids = PREVIEW_PERSONAS.map((p) => p.clerkId);
    const rows = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        activeRole: userProfilesTable.activeRole,
        isHeadTester: userProfilesTable.isHeadTester,
        entitlementMode: userProfilesTable.entitlementMode,
        productVariant: userProfilesTable.productVariant,
        birthYear: athleteProfilesTable.birthYear,
        birthDate: athleteProfilesTable.birthDate,
        experienceLevel: athleteProfilesTable.experienceLevel,
        competitionLevel: athleteProfilesTable.competitionLevel,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, ids));

    // WP-R0: actieve clubrol per identiteit (eerlijk: alleen wat echt in
    // club_members staat), zodat clubbeheerder/mechanieker/ploegleider — die
    // app-rol "athlete" hebben — hun échte clubrol in de kiezer tonen.
    const clubRows = await db
      .select({
        clerkId: clubMembersTable.clerkId,
        role: clubMembersTable.role,
      })
      .from(clubMembersTable)
      .where(and(inArray(clubMembersTable.clerkId, ids), isNull(clubMembersTable.endedAt)));
    const clubRoleById = new Map(clubRows.map((r) => [r.clerkId, r.role]));

    const byId = new Map(rows.map((r) => [r.clerkId, r]));
    const athletes = PREVIEW_PERSONAS.flatMap((p) => {
      const r = byId.get(p.clerkId);
      if (!r) return []; // niet geseed → eerlijk weglaten

      const parts: string[] = [];
      // Rol
      if (r.activeRole === "coach") parts.push("coach");
      else if (r.activeRole === "parent") parts.push("ouder");
      // Clubrol + echte rechten (alleen wat server-side echt geldt)
      const clubRole = clubRoleById.get(r.clerkId);
      if (clubRole) parts.push(`club: ${clubRole}`);
      if (isAdmin(r.clerkId)) parts.push("admin");
      if (r.isHeadTester) parts.push("hoofdtester");
      // Leeftijd (alleen tonen als bekend; jeugdregels hangen hieraan)
      const age = computeAge(r.birthDate, r.birthYear);
      if (age != null && r.activeRole === "athlete") parts.push(`${age} jr`);
      // Entitlement
      if (r.entitlementMode === "subscription") {
        parts.push(
          r.productVariant
            ? `abonnement ${VARIANT_LABELS[r.productVariant] ?? r.productVariant}`
            : "gratis (geen pakket)",
        );
      } else {
        parts.push("legacy (onbeperkt)");
      }

      // Personality alleen zinvol voor sporters met profiel.
      const personality =
        r.activeRole === "athlete"
          ? resolvePersonality({
              birthYear: r.birthYear,
              experienceLevel: r.experienceLevel,
              competitionLevel: r.competitionLevel,
              activeRole: r.activeRole,
            })
          : null;

      return [
        {
          clerkId: r.clerkId,
          name: r.displayName,
          group: p.group,
          personaLabel: personality?.label ?? (r.activeRole === "coach" ? "Coach" : "Ouder"),
          basis: parts.join(" · "),
        },
      ];
    });

    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "dev.preview-athletes failed");
    res.status(500).json({ error: "Kon preview-gebruikers niet laden" });
  }
});

// ── ROUTEMETING_01: langlopende meetrun als kindproces van de api-server ────
// De sandbox kent geen losse achtergrondprocessen (ze sterven op de
// toolgrens) en de workflow-limiet is vol; de api-server zelf is wél een
// beheerd, langlevend proces. Deze dev-only endpoints starten de meting als
// los (detached) kindproces met logbestand, en rapporteren de voortgang.
// Alleen buiten productie bereikbaar (deze router bestaat daar niet).
import { spawn } from "node:child_process";
import { openSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const METING_LOG = "/tmp/routemeting-run.log";
const METING_PID = "/tmp/routemeting-run.pid";
const REPO_ROOT = path.resolve(process.cwd(), "../..");

function metingDraait(): number | null {
  try {
    const pid = Number(readFileSync(METING_PID, "utf8").trim());
    if (!Number.isFinite(pid)) return null;
    process.kill(pid, 0); // bestaat het proces nog?
    return pid;
  } catch {
    return null;
  }
}

router.post("/routemeting/start", async (req, res) => {
  const lopend = metingDraait();
  if (lopend) {
    res.status(409).json({ error: "meting draait al", pid: lopend });
    return;
  }
  const extraArgs = Array.isArray(req.body?.args)
    ? (req.body.args as unknown[]).map(String).filter((a) => /^[-\w.,=]+$/.test(a))
    : [];
  const out = openSync(METING_LOG, "a");
  const child = spawn(
    "pnpm",
    ["--filter", "@workspace/scripts", "run", "routemeting", ...extraArgs],
    { cwd: REPO_ROOT, detached: true, stdio: ["ignore", out, out] },
  );
  child.unref();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(METING_PID, String(child.pid ?? ""));
  res.json({ gestart: true, pid: child.pid, log: METING_LOG });
});

router.get("/routemeting/status", (_req, res) => {
  const pid = metingDraait();
  let staart: string[] = [];
  if (existsSync(METING_LOG)) {
    const raw = readFileSync(METING_LOG, "utf8");
    staart = raw.split("\n").filter(Boolean).slice(-8);
  }
  res.json({ draait: pid != null, pid, staart });
});

export default router;
