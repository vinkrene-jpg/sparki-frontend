// Upgrade-advies-engine — deterministische ranking, geen verzonnen cijfers.
//
// Per specialisme (klimmen/tijdrit/duur/sprint) weegt elke onderdeel-categorie
// anders. De potentiële winst van een upgrade is: hoe belangrijk is deze
// categorie voor het specialisme × hoeveel klassen zit het huidige onderdeel
// onder de top. Output is een uitlegbare richting ("grote winst" / "merkbare
// winst" / "kleine winst"), nooit een verzonnen watt- of gram-getal. Onbekende
// onderdelen worden eerlijk apart gezet: zonder kennisbank-match kan Sparki
// geen winst inschatten.
//
// Prijsinzicht: bij elke suggestie horen concrete upgrade-doelen uit de
// kennisbank (eerstvolgende klasse + topklasse) met hun indicatieve
// nieuwprijs-range. Dat zijn richtprijzen (adviesprijsniveau), geen actuele
// winkelprijzen — de UI zegt dat er eerlijk bij.

import type { GarageComponent } from "@workspace/db";
import {
  assessComponent,
  CLASS_RANK,
  CLASS_LABEL,
  KNOWLEDGE_BASE,
  type ComponentClass,
  type PriceRange,
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
// Losse aandrijfonderdelen tellen als lichte versie van "groepset".
const CATEGORY_WEIGHT: Record<Specialism, Record<string, number>> = {
  klimmen: { wielen: 3, banden: 2, groepset: 2, crankstel: 2, cassette: 1, achterderailleur: 1, voorderailleur: 1, ketting: 1, remmen: 1, cockpit: 1, zadel: 1, pedalen: 1, helm: 1, kleding: 1, schoenen: 1, onderdeel: 1 },
  tijdrit: { wielen: 3, helm: 3, kleding: 2, banden: 2, cockpit: 2, groepset: 1, crankstel: 1, cassette: 1, achterderailleur: 1, voorderailleur: 1, ketting: 1, remmen: 1, zadel: 1, pedalen: 1, schoenen: 1, onderdeel: 1 },
  duur: { banden: 3, wielen: 2, groepset: 2, cassette: 2, achterderailleur: 1, voorderailleur: 1, crankstel: 1, ketting: 1, remmen: 1, cockpit: 1, zadel: 1, pedalen: 1, helm: 1, kleding: 1, schoenen: 1, onderdeel: 1 },
  sprint: { wielen: 3, banden: 2, groepset: 2, crankstel: 2, achterderailleur: 1, voorderailleur: 1, cassette: 1, ketting: 1, remmen: 1, cockpit: 2, zadel: 1, pedalen: 1, helm: 2, kleding: 1, schoenen: 1, onderdeel: 1 },
};

// Waarom een categorie telt voor dit specialisme — plain Dutch uitleg.
const CATEGORY_WHY: Record<Specialism, Record<string, string>> = {
  klimmen: {
    wielen: "Lichtere wielen voel je direct bergop: minder massa om te versnellen.",
    banden: "Soepele banden met lage rolweerstand schelen op elke klim.",
    groepset: "Een lichtere, strakker schakelende groep scheelt gewicht en frustratie.",
    crankstel: "Een licht, stijf crankstel scheelt gewicht op de plek waar je trapt.",
    cassette: "Een lichtere cassette met de juiste verhoudingen helpt bergop.",
    achterderailleur: "Strak schakelen onder belasting houdt je in het juiste verzet.",
    voorderailleur: "Betrouwbaar voorschakelen scheelt op steile overgangen.",
    ketting: "Een soepel lopende ketting verliest minder energie.",
    remmen: "Lichtere remmen schelen wat gewicht; winst is beperkt.",
    cockpit: "Een lichte cockpit scheelt gewicht vooraan.",
    zadel: "Een licht zadel scheelt grammen; comfort blijft leidend.",
    pedalen: "Lichte, stijve pedalen geven directere krachtoverdracht.",
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
    cockpit: "Een aero-cockpit haalt de grootste luchtvanger uit de wind.",
    groepset: "Strak schakelen houdt je in het juiste verzet, winst is beperkt.",
    crankstel: "Aero-kettingbladen kunnen iets toevoegen.",
    cassette: "De juiste verhoudingen houden je cadans efficiënt.",
    achterderailleur: "Betrouwbaar schakelen telt, aero-winst is klein.",
    voorderailleur: "Betrouwbaar schakelen telt, aero-winst is klein.",
    ketting: "Een snelle ketting scheelt een beetje wrijving.",
    remmen: "Remmen tellen in een tijdrit nauwelijks mee.",
    zadel: "Een tijdritzadel helpt vooral je houding vol te houden.",
    pedalen: "Winst is klein; stijfheid telt licht mee.",
    schoenen: "Gladde overschoenen/schoenen schelen iets in luchtweerstand.",
    onderdeel: "Aero-onderdelen (cockpit, kettingblad) kunnen iets toevoegen.",
  },
  duur: {
    banden: "Op lange ritten telt rolweerstand het zwaarst — hier zit de winst.",
    wielen: "Comfortabele, betrouwbare wielen houden je langer vers.",
    groepset: "Betrouwbaar en breed schakelbereik houdt de cadans efficiënt.",
    cassette: "Een breed bereik houdt je cadans efficiënt, uur na uur.",
    achterderailleur: "Betrouwbaar schakelen voorkomt frustratie op lange ritten.",
    voorderailleur: "Betrouwbaar voorschakelen telt op wisselend terrein.",
    crankstel: "Stijfheid en betrouwbaarheid tellen; winst is beperkt.",
    ketting: "Een soepele, schone ketting verliest minder energie.",
    remmen: "Goed doseerbare remmen sparen energie in het verkeer.",
    cockpit: "Een comfortabele cockpit voorkomt vermoeide handen en nek.",
    zadel: "Het juiste zadel is op lange ritten goud waard.",
    pedalen: "Comfort en betrouwbaarheid tellen licht mee.",
    helm: "Ventilatie en comfort tellen op urenlange ritten.",
    kleding: "Comfort en pasvorm voorkomen kleine energie-lekken.",
    schoenen: "Comfortabele, stijve schoenen voorkomen vermoeide voeten.",
    onderdeel: "Kleine optimalisaties tellen beperkt mee.",
  },
  sprint: {
    wielen: "Stijve, snelle wielen reageren direct als je aanzet.",
    banden: "Grip en lage rolweerstand tellen in de laatste meters.",
    groepset: "Direct, betrouwbaar schakelen onder vol vermogen is cruciaal.",
    crankstel: "Een stijf crankstel geeft directe krachtoverdracht bij explosief werk.",
    cassette: "De juiste stappen houden je in het perfecte verzet.",
    achterderailleur: "Schakelen onder vol vermogen moet feilloos zijn.",
    voorderailleur: "Voorschakelen onder druk moet feilloos zijn.",
    ketting: "Een sterke ketting houdt explosief vermogen vol.",
    remmen: "Laat en gecontroleerd remmen wint posities in de finale.",
    cockpit: "Een stijf stuur helpt bij sprinten uit het zadel.",
    zadel: "Beperkte rol in de sprint zelf.",
    pedalen: "Maximale stijfheid voor explosieve krachtoverdracht.",
    helm: "In een lange sprint telt aero mee.",
    kleding: "Strakke kleding scheelt luchtweerstand op topsnelheid.",
    schoenen: "Maximale stijfheid voor explosieve krachtoverdracht.",
    onderdeel: "Stijve onderdelen (crank, stuur) helpen bij explosief werk.",
  },
};

// Concreet upgrade-doel uit de kennisbank, met eerlijke richtprijs.
export type UpgradeTarget = {
  brand: string;
  model: string;
  klasse: ComponentClass;
  klasseLabel: string;
  richtprijs: PriceRange | null;
};

export type UpgradeSuggestion = {
  componentId: number;
  category: string;
  current: { brand: string | null; model: string | null; klasse: ComponentClass; klasseLabel: string };
  gain: "groot" | "merkbaar" | "klein";
  gainLabel: string;
  why: string;
  // Concrete doelen uit de kennisbank: eerstvolgende stap + topklasse,
  // elk met indicatieve nieuwprijs. Leeg als de kennisbank geen hoger
  // geprijsd alternatief in deze categorie kent — dan zeggen we dat eerlijk.
  targets: UpgradeTarget[];
  // Beste prijs-winstverhouding binnen dit advies (deterministisch: hoogste
  // score per euro van de goedkoopste eerstvolgende stap).
  besteKoop: boolean;
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
  // Eerlijke duiding van de prijzen, altijd meegeleverd voor de UI.
  prijsToelichting: string;
};

// Kies concrete doelen: het goedkoopste kennisbank-item één klasse hoger, en
// het goedkoopste item op topniveau (pro) als dat een andere stap is. Alleen
// echte items — niets wordt verzonnen.
function pickTargets(category: string, currentKlasse: ComponentClass): UpgradeTarget[] {
  const higher = KNOWLEDGE_BASE.filter(
    (e) => e.category === category && CLASS_RANK[e.klasse] > CLASS_RANK[currentKlasse],
  );
  if (higher.length === 0) return [];
  const byPrice = (a: { richtprijs: PriceRange | null }, b: { richtprijs: PriceRange | null }) => {
    if (a.richtprijs && b.richtprijs) return a.richtprijs.van - b.richtprijs.van;
    if (a.richtprijs) return -1;
    if (b.richtprijs) return 1;
    return 0;
  };
  const toTarget = (e: (typeof higher)[number]): UpgradeTarget => ({
    brand: e.brand,
    model: e.model,
    klasse: e.klasse,
    klasseLabel: CLASS_LABEL[e.klasse],
    richtprijs: e.richtprijs,
  });
  const targets: UpgradeTarget[] = [];
  const nextRank = Math.min(...higher.map((e) => CLASS_RANK[e.klasse]));
  const nextStep = higher.filter((e) => CLASS_RANK[e.klasse] === nextRank).sort(byPrice)[0];
  if (nextStep) targets.push(toTarget(nextStep));
  const top = higher.filter((e) => e.klasse === "pro").sort(byPrice)[0];
  if (top && (!nextStep || top.key !== nextStep.key)) targets.push(toTarget(top));
  return targets;
}

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
      targets: pickTargets(c.category, a.entry.klasse),
      besteKoop: false,
      score,
    });
  }

  suggestions.sort((a, b) => b.score - a.score || a.componentId - b.componentId);

  // Beste koop: hoogste score per euro (van-prijs van de goedkoopste
  // eerstvolgende stap). Alleen gemarkeerd als er echt een prijs bekend is en
  // er iets te kiezen valt (≥2 suggesties met prijs).
  const priced = suggestions.filter(
    (s) => s.targets[0]?.richtprijs && s.targets[0].richtprijs.van > 0,
  );
  if (priced.length >= 2) {
    const best = priced.reduce((acc, s) =>
      s.score / s.targets[0]!.richtprijs!.van > acc.score / acc.targets[0]!.richtprijs!.van
        ? s
        : acc,
    );
    best.besteKoop = true;
  }

  return {
    specialism,
    specialismLabel: SPECIALISM_LABEL[specialism],
    suggestions,
    alreadyTop,
    unknown,
    prijsToelichting:
      "Prijzen zijn indicatieve nieuwprijzen (adviesprijsniveau), geen actuele winkelprijzen. Tweedehands of in de uitverkoop kan het fors minder zijn.",
  };
}
