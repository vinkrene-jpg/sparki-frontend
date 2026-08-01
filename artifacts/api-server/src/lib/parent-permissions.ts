// Ouder-/verzorgeromgeving — deterministische rechtenlaag.
//
// Regels:
// - Zichtbaarheid is per gegevenstype en per koppeling (nooit gekopieerd).
// - `dataSharingParent = "none"` is de kill-switch: alles dicht.
// - Zonder expliciete keuze geldt het veiligheidsminimum (gezondheid + herstel),
//   afgeleid van het bestaande deelniveau (backward-compatibel).
// - Leeftijdscategorieën: <16 (ouderlijke toestemming vereist, ouder mag rechten
//   beheren), 16–17 (sporter beheert, ouder alleen-lezen), 18+ (sporter beheert
//   volledig). Onbekende leeftijd: fail-closed — ouder mag NIET beheren.
// - Passeert de sporter een leeftijdsgrens t.o.v. de laatste bevestiging, dan is
//   herbevestiging nodig: niet-veiligheidscategorieën vallen dicht; voor 18+
//   valt ALLES dicht tot de sporter herbevestigt.
// - Vermogenswaarden, volledige analyses, medische details en coachnotities
//   kennen geen categorie en zijn dus nooit deelbaar.

import { and, eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  parentAthleteLinksTable,
  parentDataCategories,
  type ParentAthleteLink,
  type ParentDataCategory,
  type ParentAgeTier,
} from "@workspace/db";
import { getAgeClass } from "./consent-service";
import { getEffectivePrivacy } from "./privacy";

export type EffectiveParentAccess = {
  level: "none" | "safety_only" | "summary";
  tier: ParentAgeTier;
  reconfirmRequired: boolean;
  permissions: Record<ParentDataCategory, boolean>;
  parentMayEdit: boolean;
};

export const PARENT_CATEGORY_LABELS: Record<ParentDataCategory, string> = {
  planning: "Planning",
  aanwezigheid: "Aanwezigheid",
  herstel: "Algemene herstelstatus",
  gezondheid: "Blessure-/ziektesignaal",
  slaap: "Slaap- en vermoeidheidssamenvatting",
  locatie: "Locatie tijdens activiteit",
  wedstrijd: "Wedstrijdinformatie",
  communicatie: "Berichten",
};

// Veiligheidsminimum: blijft zichtbaar zolang delen niet volledig uit staat.
export const SAFETY_CATEGORIES: ParentDataCategory[] = ["gezondheid", "herstel"];

function allOff(): Record<ParentDataCategory, boolean> {
  return Object.fromEntries(
    parentDataCategories.map((c) => [c, false]),
  ) as Record<ParentDataCategory, boolean>;
}

// Backward-compatibele standaard per bestaand deelniveau, gebruikt zolang er
// geen expliciete per-categorie keuze op de koppeling staat.
function defaultsForLevel(
  level: "safety_only" | "summary",
): Record<ParentDataCategory, boolean> {
  const p = allOff();
  for (const c of SAFETY_CATEGORIES) p[c] = true;
  p.slaap = true;
  if (level === "summary") {
    p.planning = true;
    p.wedstrijd = true;
    p.aanwezigheid = true;
  }
  return p;
}

export async function athleteAgeTier(
  athleteClerkId: string,
): Promise<ParentAgeTier> {
  // Eén leeftijdsclassificatie voor de hele consentlaag (F-P0-01): de
  // categorisering leeft in consent-service.getAgeClass; hier niet dupliceren.
  return getAgeClass(athleteClerkId);
}

export async function getParentLink(
  parentClerkId: string,
  athleteClerkId: string,
): Promise<ParentAthleteLink | null> {
  const [row] = await db
    .select()
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row ?? null;
}

/**
 * Bereken de effectieve toegang van een ouder tot een kind, op leesmoment.
 * Fail-closed op elk onduidelijk punt.
 */
export async function effectiveParentAccess(
  link: ParentAthleteLink,
): Promise<EffectiveParentAccess> {
  const tier = await athleteAgeTier(link.athleteClerkId);
  const privacy = await getEffectivePrivacy(link.athleteClerkId);
  const level = privacy.dataSharingParent as "none" | "safety_only" | "summary";

  const base: EffectiveParentAccess = {
    level,
    tier,
    reconfirmRequired: false,
    permissions: allOff(),
    parentMayEdit: tier === "u16",
  };
  // BB-09 (BUILD_01 F2): een beëindigde koppeling geeft nooit toegang.
  if (link.status !== "accepted" || link.endedAt != null) return base;

  // Besluitenpatch 2026-08-01 (hoofdstuk B): een MINDERJARIGE mag niet alles
  // voor zijn ouder afschermen — gezondheid en herstel blijven altijd
  // zichtbaar, ook met dataSharingParent="none". Onbekende leeftijd telt als
  // strengste regime en dus als minderjarig. Voor een volwassen sporter (18+)
  // blijft "none" wél de volledige kill-switch.
  if (level === "none") {
    if (tier === "adult") return base;
    const safetyOnly = allOff();
    for (const c of SAFETY_CATEGORIES) safetyOnly[c] = true;
    return { ...base, permissions: safetyOnly };
  }

  // Herbevestiging nodig wanneer de leeftijdscategorie is gewijzigd sinds de
  // laatste bevestiging. Een koppeling zonder bevestiging heeft nooit meer dan
  // het veiligheidsminimum, maar vraagt geen herbevestiging (legacy).
  const storedTier = link.ageTierAtConsent as ParentAgeTier | null;
  // Herbevestiging bij tierwissel; een volwassen sporter (18+) heeft daarnaast
  // ALTIJD een bij de volwassen tier bevestigde keuze nodig — een legacy-link
  // zonder (adult-)bevestiging blijft anders via het veiligheidsminimum open.
  const reconfirmRequired =
    (storedTier != null && tier !== "unknown" && storedTier !== tier) ||
    (tier === "adult" && (!link.consentConfirmedAt || storedTier !== "adult"));

  let permissions: Record<ParentDataCategory, boolean>;
  if (link.permissions && link.consentConfirmedAt) {
    permissions = allOff();
    for (const c of parentDataCategories) {
      permissions[c] = link.permissions[c] === true;
    }
  } else if (link.consentConfirmedAt) {
    // Bevestigd maar zonder expliciete per-categorie keuze: standaard van het
    // deelniveau (backward-compatibel).
    permissions = defaultsForLevel(level === "summary" ? "summary" : "safety_only");
  } else {
    // Legacy-koppeling zonder bevestiging: strikt het veiligheidsminimum
    // (alleen SAFETY_CATEGORIES) — nooit méér, ongeacht het deelniveau.
    permissions = allOff();
    for (const c of SAFETY_CATEGORIES) permissions[c] = true;
  }

  // Onbekende leeftijd: fail-closed — nooit méér dan het veiligheidsminimum,
  // ook niet wanneer er eerder bredere rechten bevestigd zijn.
  if (tier === "unknown") {
    const safeOnly = allOff();
    for (const c of SAFETY_CATEGORIES) {
      safeOnly[c] = permissions[c];
    }
    permissions = safeOnly;
  }

  if (reconfirmRequired) {
    if (tier === "adult") {
      // Volwassen sporter: alle toegang dicht tot die sporter herbevestigt.
      permissions = allOff();
    } else {
      // Alleen het veiligheidsminimum blijft open.
      const safeOnly = allOff();
      for (const c of SAFETY_CATEGORIES) {
        safeOnly[c] = permissions[c];
      }
      permissions = safeOnly;
    }
  }

  return { ...base, reconfirmRequired, permissions };
}

/** Valideer en normaliseer een permissions-payload (alleen bekende keys). */
export function sanitizePermissions(
  input: unknown,
): Record<ParentDataCategory, boolean> | null {
  if (input == null || typeof input !== "object") return null;
  const out = allOff();
  for (const c of parentDataCategories) {
    const v = (input as Record<string, unknown>)[c];
    if (v != null && typeof v !== "boolean") return null;
    out[c] = v === true;
  }
  return out;
}
