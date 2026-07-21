// Upgrade-advies-engine — deterministische ranking, geen verzonnen cijfers.
//
// Per specialisme (klimmen/tijdrit/duur/sprint) weegt elke onderdeel-categorie
// anders. De potentiële winst van een upgrade is: hoe belangrijk is deze
// categorie voor het specialisme × hoeveel klassen zit het huidige onderdeel
// onder de top. Output is een uitlegbare richting ("grote winst" / "merkbare
// winst" / "kleine winst"), nooit een verzonnen watt- of gram-getal. Onbekende
// onderdelen worden eerlijk apart gezet: zonder kennisbank-match kan Sparki
// geen winst inschatten.

import type { GarageComponent } from "@workspace/db";
import {
  assessComponent,
  CLASS_RANK,
  CLASS_LABEL,
  type ComponentClass,
} from "./knowledge-base";

export const SPECIALISMS = ["klimmen", "tijdrit", "duur", "sprint"] as const;
export type Specialism = (typeof SPECIALISMS)[number];

export const SPECIALISM_LABEL: Record<Specialism, string> = {
  klimmen: "Klimmen",
  tijdrit: "Tijdrijden",
  duur: "Duurwerk",
  sprint: "Sprinten",
};

// Hoe zwaar telt een categorie per specialisme (0–3). Breed gedragen
// vuistregels: gewicht telt bij klimmen (wielen), aero bij tijdrijden
// (helm/wielen), rolweerstand bij duurwerk (banden), stijfheid/aero bij sprint.
const CATEGORY_WEIGHT: Record<Specialism, Record<string, number>> = {
  klimmen: { wielen: 3, banden: 2, groepset: 2, helm: 1, kleding: 1, schoenen: 1, onderdeel: 1 },
  tijdrit: { wielen: 3, helm: 3, kleding: 2, banden: 2, groepset: 1, schoenen: 1, onderdeel: 1 },
  duur: { banden: 3, wielen: 2, groepset: 2, helm: 1, kleding: 1, schoenen: 1, onderdeel: 1 },
  sprint: { wielen: 3, banden: 2, groepset: 2, helm: 2, kleding: 1, schoenen: 1, onderdeel: 1 },
};

// Waarom een categorie telt voor dit specialisme — plain Dutch uitleg.
const CATEGORY_WHY: Record<Specialism, Record<string, string>> = {
  klimmen: {
    wielen: "Lichtere wielen voel je direct bergop: minder massa om te versnellen.",
    banden: "Soepele banden met lage rolweerstand schelen op elke klim.",
    groepset: "Een lichtere, strakker schakelende groep scheelt gewicht en frustratie.",
    helm: "Een lichte, goed geventileerde helm helpt op lange klimdagen.",
    kleding: "Goed zittende, lichte kleding voert warmte beter af.",
    schoenen: "Stijve, lichte schoenen geven directere krachtoverdracht bergop.",
    onderdeel: "Losse onderdelen kunnen gewicht besparen.",
  },
  tijdrit: {
    wielen: "Diepe aero-wielen leveren in een tijdrit de grootste materiaalwinst.",
    helm: "Een aero-helm is per euro één van de grootste tijdritwinsten.",
    kleding: "Een strak aero-pak scheelt aanzienlijk in luchtweerstand.",
    banden: "Snelle banden verlagen de rolweerstand over het hele parcours.",
    groepset: "Strak schakelen houdt je in het juiste verzet, winst is beperkt.",
    schoenen: "Gladde overschoenen/schoenen schelen iets in luchtweerstand.",
    onderdeel: "Aero-onderdelen (cockpit, kettingblad) kunnen iets toevoegen.",
  },
  duur: {
    banden: "Op lange ritten telt rolweerstand het zwaarst — hier zit de winst.",
    wielen: "Comfortabele, betrouwbare wielen houden je langer vers.",
    groepset: "Betrouwbaar en breed schakelbereik houdt de cadans efficiënt.",
    helm: "Ventilatie en comfort tellen op urenlange ritten.",
    kleding: "Comfort en pasvorm voorkomen kleine energie-lekken.",
    schoenen: "Comfortabele, stijve schoenen voorkomen vermoeide voeten.",
    onderdeel: "Kleine optimalisaties tellen beperkt mee.",
  },
  sprint: {
    wielen: "Stijve, snelle wielen reageren direct als je aanzet.",
    banden: "Grip en lage rolweerstand tellen in de laatste meters.",
    groepset: "Direct, betrouwbaar schakelen onder vol vermogen is cruciaal.",
    helm: "In een lange sprint telt aero mee.",
    kleding: "Strakke kleding scheelt luchtweerstand op topsnelheid.",
    schoenen: "Maximale stijfheid voor explosieve krachtoverdracht.",
    onderdeel: "Stijve onderdelen (crank, stuur) helpen bij explosief werk.",
  },
};

export type UpgradeSuggestion = {
  componentId: number;
  category: string;
  current: { brand: string | null; model: string | null; klasse: ComponentClass; klasseLabel: string };
  gain: "groot" | "merkbaar" | "klein";
  gainLabel: string;
  why: string;
  // Deterministic score used for ordering (weight × headroom); exposed for tests.
  score: number;
};

export type UnknownComponent = {
  componentId: number;
  category: string;
  brand: string | null;
  model: string | null;
  reason: string;
};

export type UpgradeAdvice = {
  specialism: Specialism;
  specialismLabel: string;
  suggestions: UpgradeSuggestion[];
  alreadyTop: { componentId: number; category: string; label: string }[];
  unknown: UnknownComponent[];
};

export function rankUpgrades(
  components: Pick<GarageComponent, "id" | "category" | "brand" | "model">[],
  specialism: Specialism,
): UpgradeAdvice {
  const weights = CATEGORY_WEIGHT[specialism];
  const whys = CATEGORY_WHY[specialism];
  const suggestions: UpgradeSuggestion[] = [];
  const alreadyTop: UpgradeAdvice["alreadyTop"] = [];
  const unknown: UnknownComponent[] = [];

  for (const c of components) {
    const a = assessComponent(c.category, c.brand, c.model);
    if (!a.known) {
      unknown.push({
        componentId: c.id,
        category: c.category,
        brand: c.brand,
        model: c.model,
        reason: a.reason,
      });
      continue;
    }
    const headroom = 3 - CLASS_RANK[a.entry.klasse];
    if (headroom <= 0) {
      alreadyTop.push({
        componentId: c.id,
        category: c.category,
        label: `${a.entry.brand} ${a.entry.model} zit al op topniveau — hier valt weinig te winnen.`,
      });
      continue;
    }
    const weight = weights[c.category] ?? 1;
    const score = weight * headroom;
    const gain: UpgradeSuggestion["gain"] =
      score >= 6 ? "groot" : score >= 3 ? "merkbaar" : "klein";
    suggestions.push({
      componentId: c.id,
      category: c.category,
      current: {
        brand: c.brand,
        model: c.model,
        klasse: a.entry.klasse,
        klasseLabel: CLASS_LABEL[a.entry.klasse],
      },
      gain,
      gainLabel:
        gain === "groot"
          ? "Grote winst mogelijk"
          : gain === "merkbaar"
            ? "Merkbare winst mogelijk"
            : "Kleine winst mogelijk",
      why: whys[c.category] ?? "Dit onderdeel telt beperkt mee voor dit specialisme.",
      score,
    });
  }

  suggestions.sort((a, b) => b.score - a.score || a.componentId - b.componentId);
  return {
    specialism,
    specialismLabel: SPECIALISM_LABEL[specialism],
    suggestions,
    alreadyTop,
    unknown,
  };
}
