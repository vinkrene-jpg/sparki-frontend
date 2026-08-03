// ── Gedeelde prijzenbron (MKT-04) ────────────────────────────────────────────
// ÉÉN bron voor alle abonnementsprijzen. Wordt gelezen door:
//   • de api-server Stripe-gateway (facturatie — bedragen in eurocenten),
//   • de app-UI (profielinstellingen/paywall),
//   • de marketingsite (prijspagina's).
// Wijzig prijzen UITSLUITEND hier; nergens hardcoden.

/** Betaalde tiers. FREE heeft geen prijs en staat hier bewust niet in. */
export type PaidTier = "GO" | "COMPLETE" | "TEAM" | "TRAINER";
export type PricingInterval = "month" | "year";

export interface TierPrice {
  /** Prijs per maand in eurocenten. */
  month: number;
  /** Prijs per jaar in eurocenten. */
  year: number;
  /** Sparki-zijdige proefperiode in dagen. */
  trialDays: number;
  /** Stripe-productnaam (stabiel; nooit hernoemen zonder migratie). */
  productName: string;
  /** Nederlandse weergavenaam. */
  displayName: string;
}

export const TIER_PRICING: Record<PaidTier, TierPrice> = {
  GO: {
    month: 299,
    year: 2990,
    trialDays: 7,
    productName: "sparki_go_tier",
    displayName: "Sparki Go",
  },
  COMPLETE: {
    month: 999,
    year: 9990,
    trialDays: 14,
    productName: "sparki_complete_tier",
    displayName: "Sparki Complete",
  },
  // TEAM_ABONNEMENT_01: centrale facturatie voor een teamorganisatie.
  TEAM: {
    month: 14900,
    year: 149000,
    trialDays: 14,
    productName: "sparki_team_tier",
    displayName: "Sparki Team",
  },
  // Besluitenpatch 01-08-2026 hoofdstuk E: basistier tot 25 sporters. De
  // staffels (€179/€1.790 tot 50; €9,90 p/sporter vanaf nr. 51) horen bij de
  // facturatie-/koppelingslaag, niet bij deze vaste prijsconfiguratie.
  TRAINER: {
    month: 9900,
    year: 99000,
    trialDays: 14,
    productName: "sparki_trainer_tier",
    displayName: "Sparki Trainer",
  },
};

// Besluitenpatch 01-08-2026 hoofdstuk E: Sparki Trainer-staffels. De vaste
// tiers hierboven dekken de basistier; deze staffels gelden per aantal
// actieve sporterkoppelingen en worden gelezen door de facturatielaag én de
// kostencalculator op de marketingsite.
export const TRAINER_STAFFELS = [
  { totSporters: 25, month: 9900, year: 99000 },
  { totSporters: 50, month: 17900, year: 179000 },
] as const;
/** Vanaf sporter nr. 51: per extra sporter per maand, in eurocenten. */
export const TRAINER_EXTRA_PER_SPORTER_MONTH = 990;

/** Eurocenten → Nederlandse prijsnotatie, bv. 299 → "€ 2,99", 149000 → "€ 1.490". */
export function formatEuro(cents: number): string {
  const euros = cents / 100;
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(euros);
}
