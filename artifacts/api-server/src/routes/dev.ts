import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, userProfilesTable, athleteProfilesTable } from "@workspace/db";
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

function computeAgeFrom(birthDate: string | null, birthYear: number | null): number | null {
  if (birthDate) {
    const d = new Date(`${birthDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      if (
        now.getMonth() < d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
      )
        age -= 1;
      return age;
    }
  }
  if (birthYear) return new Date().getFullYear() - birthYear;
  return null;
}

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

    const byId = new Map(rows.map((r) => [r.clerkId, r]));
    const athletes = PREVIEW_PERSONAS.flatMap((p) => {
      const r = byId.get(p.clerkId);
      if (!r) return []; // niet geseed → eerlijk weglaten

      const parts: string[] = [];
      // Rol
      if (r.activeRole === "coach") parts.push("coach");
      else if (r.activeRole === "parent") parts.push("ouder");
      // Leeftijd (alleen tonen als bekend; jeugdregels hangen hieraan)
      const age = computeAgeFrom(r.birthDate, r.birthYear);
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

export default router;
