// Mechanieker — onderhoudsregels & signalen.
//
// Deterministisch en eerlijk. Drie duidelijk gescheiden niveaus:
//   - "controleadvies"      — op basis van kilometers/tijd is een CHECK
//                             verstandig (geen uitspraak over de staat).
//   - "vermoedelijke_slijtage" — het gebruik ligt ruim boven de drempel;
//                             slijtage is waarschijnlijk maar NIET vastgesteld.
//   - "vastgesteld_defect"  — UITSLUITEND wanneer de gebruiker dat zelf heeft
//                             vastgelegd (componentstatus of defect-event).
//                             Nooit afgeleid uit een foto of uit kilometers.
//
// De kilometerstand per component wordt ALTIJD live afgeleid uit gekoppelde
// activiteiten sinds de montagedatum (zie bike-usage.ts) — een verwijderde of
// dubbel geïmporteerde activiteit kan dus nooit een vals signaal veroorzaken.
// Zonder gebruiksdata is er GEEN signaal (nul data = nul signalen).

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  garageBikesTable,
  garageComponentsTable,
  componentEventsTable,
  type GarageBike,
  type GarageComponent,
} from "@workspace/db";
import {
  componentUsage,
  bikeUsageSince,
  type UsageTotals,
} from "./bike-usage";

export type SignalLevel =
  | "controleadvies"
  | "vermoedelijke_slijtage"
  | "vastgesteld_defect";

export interface MaintenanceSignal {
  bikeId: number;
  bikeName: string;
  componentId: number | null; // null = fiets-breed (periodieke controle)
  category: string;
  label: string;
  level: SignalLevel;
  // Klare-taaluitleg met de echte getallen erin — altijd uitlegbaar.
  message: string;
  // Voorzichtig handelingsadvies. Nooit een diagnose op afstand.
  advice: string;
  usedKm: number | null;
  thresholdKm: number | null;
}

interface WearRule {
  categories: readonly string[]; // garage_components.category waarden
  label: string;
  checkKm: number; // vanaf hier: controleadvies
  wearKm: number; // vanaf hier: vermoedelijke slijtage
  why: string;
}

// Conservatieve, uitlegbare drempels (km op het component sinds montage).
const WEAR_RULES: readonly WearRule[] = [
  { categories: ["ketting"], label: "ketting", checkKm: 2500, wearKm: 4000, why: "Een ketting rekt geleidelijk uit met de kilometers" },
  { categories: ["cassette"], label: "cassette", checkKm: 6000, wearKm: 10000, why: "Een cassette slijt mee met (versleten) kettingen" },
  { categories: ["banden"], label: "banden", checkKm: 3500, wearKm: 6000, why: "Banden slijten en verharden naarmate je meer rijdt" },
  { categories: ["remmen"], label: "remmen (blokken/schijven)", checkKm: 4000, wearKm: 7000, why: "Remblokken en -schijven slijten geleidelijk weg" },
  { categories: ["wielen"], label: "wiellagers", checkKm: 8000, wearKm: 15000, why: "Lagers verliezen na veel kilometers hun soepelheid" },
  { categories: ["crankstel", "achterderailleur", "voorderailleur", "groepset"], label: "aandrijving", checkKm: 8000, wearKm: 15000, why: "De aandrijving slijt als geheel met de kilometers" },
];

// Fiets-brede periodieke controle: na zoveel km sinds de laatste
// controle/onderhoudsbeurt (van welk component dan ook) is een algemene
// check-up verstandig.
const PERIODIC_CHECK_KM = 5000;

const CHECK_ADVICE =
  "Dit is een controleadvies op basis van je echte kilometers — geen vaststelling. Bekijk het onderdeel zelf of laat het bij twijfel door je fietsenmaker nakijken.";
const WEAR_ADVICE =
  "Slijtage is op deze kilometerstand waarschijnlijk, maar alleen een fysieke controle kan dat vaststellen. Meet of laat meten (bijv. kettingmaat) voordat je vervangt.";
const DEFECT_ADVICE =
  "Je hebt dit defect zelf vastgelegd. Rijd er niet mee door als het de veiligheid raakt en laat het herstellen voordat je weer intensief traint of koerst.";

function ruleFor(category: string): WearRule | null {
  return WEAR_RULES.find((r) => r.categories.includes(category)) ?? null;
}

// Signalen voor alle actieve fietsen van deze renner.
export async function maintenanceSignals(
  clerkId: string,
): Promise<MaintenanceSignal[]> {
  const bikes = await db
    .select()
    .from(garageBikesTable)
    .where(
      and(
        eq(garageBikesTable.clerkId, clerkId),
        eq(garageBikesTable.status, "actief"),
      ),
    );
  if (bikes.length === 0) return [];
  const bikeIds = bikes.map((b) => b.id);
  const components = await db
    .select()
    .from(garageComponentsTable)
    .where(
      and(
        eq(garageComponentsTable.clerkId, clerkId),
        inArray(garageComponentsTable.bikeId, bikeIds),
      ),
    );

  const signals: MaintenanceSignal[] = [];
  const bikeById = new Map(bikes.map((b) => [b.id, b] as const));

  for (const c of components) {
    if (c.bikeId == null || c.status === "vervangen") continue;
    const bike = bikeById.get(c.bikeId);
    if (!bike) continue;

    // Vastgesteld defect — alleen uit de eigen registratie van de gebruiker.
    if (c.status === "defect_vastgesteld") {
      signals.push({
        bikeId: bike.id,
        bikeName: bike.name,
        componentId: c.id,
        category: c.category,
        label: c.category,
        level: "vastgesteld_defect",
        message: `Je hebt een defect vastgelegd aan de ${c.category} van ${bike.name}.`,
        advice: DEFECT_ADVICE,
        usedKm: null,
        thresholdKm: null,
      });
      continue;
    }

    const rule = ruleFor(c.category);
    if (!rule) continue;
    const usage = await componentUsage(clerkId, c);
    if (usage.km <= 0) continue; // nul data = nul signalen

    if (usage.km >= rule.wearKm) {
      signals.push({
        bikeId: bike.id,
        bikeName: bike.name,
        componentId: c.id,
        category: c.category,
        label: rule.label,
        level: "vermoedelijke_slijtage",
        message: `De ${rule.label} van ${bike.name} heeft zo'n ${Math.round(usage.km)} km gedaan sinds ${usage.basis === "montagedatum" ? "montage" : "registratie"} (richtwaarde ${rule.wearKm} km). ${rule.why}.`,
        advice: WEAR_ADVICE,
        usedKm: Math.round(usage.km),
        thresholdKm: rule.wearKm,
      });
    } else if (usage.km >= rule.checkKm) {
      signals.push({
        bikeId: bike.id,
        bikeName: bike.name,
        componentId: c.id,
        category: c.category,
        label: rule.label,
        level: "controleadvies",
        message: `De ${rule.label} van ${bike.name} zit op zo'n ${Math.round(usage.km)} km sinds ${usage.basis === "montagedatum" ? "montage" : "registratie"} (controle verstandig vanaf ${rule.checkKm} km). ${rule.why}.`,
        advice: CHECK_ADVICE,
        usedKm: Math.round(usage.km),
        thresholdKm: rule.checkKm,
      });
    }
  }

  // Periodieke controle per fiets: km sinds laatste onderhoud/controle-event.
  for (const bike of bikes) {
    const comps = components.filter((c) => c.bikeId === bike.id);
    const compIds = comps.map((c) => c.id);
    let sinceDate: string | null = null;
    if (compIds.length > 0) {
      const [lastEvent] = await db
        .select({ eventDate: componentEventsTable.eventDate })
        .from(componentEventsTable)
        .where(
          and(
            eq(componentEventsTable.clerkId, clerkId),
            inArray(componentEventsTable.componentId, compIds),
            inArray(componentEventsTable.eventType, [
              "onderhoud",
              "controle",
              "vervanging",
            ]),
          ),
        )
        .orderBy(desc(componentEventsTable.eventDate))
        .limit(1);
      sinceDate = lastEvent?.eventDate ?? null;
    }
    const usage: UsageTotals = await bikeUsageSince(clerkId, bike.id, sinceDate);
    if (usage.km >= PERIODIC_CHECK_KM) {
      signals.push({
        bikeId: bike.id,
        bikeName: bike.name,
        componentId: null,
        category: "periodiek",
        label: "periodieke controle",
        level: "controleadvies",
        message: sinceDate
          ? `${bike.name} heeft zo'n ${Math.round(usage.km)} km gedaan sinds de laatste geregistreerde beurt (${sinceDate}).`
          : `${bike.name} heeft zo'n ${Math.round(usage.km)} km gedaan zonder geregistreerde onderhoudsbeurt.`,
        advice:
          "Een periodieke check-up (schroefverbindingen, lagers, remmen, slijtage) is verstandig. " +
          CHECK_ADVICE,
        usedKm: Math.round(usage.km),
        thresholdKm: PERIODIC_CHECK_KM,
      });
    }
  }

  // Vastgesteld defect eerst, dan vermoedelijke slijtage, dan controleadvies.
  const order: Record<SignalLevel, number> = {
    vastgesteld_defect: 0,
    vermoedelijke_slijtage: 1,
    controleadvies: 2,
  };
  signals.sort((a, b) => order[a.level] - order[b.level]);
  return signals;
}

// Relevantie-gating: alleen tonen op het moment dat het ertoe doet.
// - Vandaag/dagoverzicht: alleen defecten en vermoedelijke slijtage.
// - Wedstrijdvoorbereiding (dagen t/m wedstrijd ≤ 7): alles, want dan wil je
//   ook een controleadvies nog kunnen opvolgen.
// - Garage/Mechanieker zelf: altijd alles (dat is de beheerplek).
export function relevantSignals(
  signals: MaintenanceSignal[],
  context: "vandaag" | "wedstrijd" | "garage",
): MaintenanceSignal[] {
  if (context === "garage" || context === "wedstrijd") return signals;
  return signals.filter((s) => s.level !== "controleadvies");
}

export type { GarageBike, GarageComponent };
