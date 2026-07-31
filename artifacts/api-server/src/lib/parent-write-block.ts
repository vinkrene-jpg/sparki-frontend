// WP-R1 — centrale ouder-schrijfblokkade (GEEN parallel rechtenmodel).
//
// Productregel: een ouder heeft een toezichtrol en maakt géén eigen
// sportergegevens aan — geen training, rit, doel of wedstrijd. De bestaande
// rollenlaag (user_profiles.activeRole) is de enige bron: staat het account in
// de ouderrol, dan worden muterende verzoeken op sporter-schrijfroutes
// server-side met 403 geweigerd. Leesverzoeken blijven ongemoeid (de
// betreffende routes tonen toch alleen eigen data; ouders lezen kinddata
// uitsluitend via /api/parent/* met de bestaande toestemmingslaag).
//
// Wisselt de gebruiker (met sporterrol) terug naar de sporterrol, dan werkt
// alles weer — de blokkade volgt de actieve rol, niet het account.
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { getClerkUserId } from "./auth";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RoleLoader = (clerkId: string) => Promise<string | null>;

const defaultRoleLoader: RoleLoader = async (clerkId) => {
  const [profile] = await db
    .select({ activeRole: userProfilesTable.activeRole })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return profile?.activeRole ?? null;
};

// Testbaar via injecteerbare rol-lader; productie gebruikt de DB-lader.
export function makeParentWriteBlock(
  loadRole: RoleLoader = defaultRoleLoader,
  getId: (req: Request) => string | null = getClerkUserId,
) {
  return async function blockParentSporterWrites(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!MUTATING.has(req.method)) {
      next();
      return;
    }
    const clerkId = getId(req);
    if (!clerkId) {
      // Niet ingelogd → de auth-guard van de route zelf geeft de nette 401.
      next();
      return;
    }
    let activeRole: string | null;
    try {
      activeRole = await loadRole(clerkId);
    } catch {
      // Fail-closed: als de rol niet vastgesteld kan worden, mag een
      // muterende schrijfactie NIET doorgaan — een autorisatiecheck die bij
      // storing doorlaat is een bypass. Eerlijke 503, geen 403 (het is geen
      // weigering op inhoud maar een tijdelijke storing).
      res.status(503).json({
        error:
          "Je rol kon tijdelijk niet gecontroleerd worden. Probeer het zo opnieuw.",
        code: "role_check_unavailable",
      });
      return;
    }
    if (activeRole === "parent") {
      res.status(403).json({
        error:
          "Als ouder kun je geen trainingen, ritten, doelen of wedstrijden aanmaken of wijzigen. Wissel naar de sporterrol als je zelf sport.",
        code: "parent_write_blocked",
      });
      return;
    }
    next();
  };
}

export const blockParentSporterWrites = makeParentWriteBlock();
