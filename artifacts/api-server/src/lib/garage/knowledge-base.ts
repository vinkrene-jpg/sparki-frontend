// Gecureerde onderdelen-kennisbank voor de Fietsengarage.
//
// HONESTY CONTRACT: elk item hier is een echt, algemeen bekend product met een
// breed gedragen klasse-indeling (instap/amateur/elite/pro) en een indicatieve
// aero-/gewichtsrichting. We geven bewust GEEN verzonnen cijfers (geen watts,
// geen grammen): alleen klasse-labels en richting-indicaties. Onderdelen die
// niet in deze lijst staan krijgen eerlijk "onbekend" — nooit een gok.

import type { GarageComponentCategory } from "@workspace/db";

export type ComponentClass = "instap" | "amateur" | "elite" | "pro";
export type Indication = "laag" | "gemiddeld" | "hoog";

export type KnowledgeEntry = {
  key: string;
  category: GarageComponentCategory;
  brand: string;
  model: string;
  // Lowercase substrings that must ALL appear in the normalized "brand model"
  // string for a match. Keeps matching deterministic and explainable.
  match: string[];
  klasse: ComponentClass;
  // Indicatieve richting, geen metingen. Null = niet zinvol voor deze categorie.
  aero: Indication | null;
  gewicht: "licht" | "gemiddeld" | "zwaar" | null;
  note: string;
};

export const CLASS_RANK: Record<ComponentClass, number> = {
  instap: 0,
  amateur: 1,
  elite: 2,
  pro: 3,
};

export const CLASS_LABEL: Record<ComponentClass, string> = {
  instap: "Instap",
  amateur: "Amateur",
  elite: "Elite",
  pro: "Pro",
};

const E = (e: KnowledgeEntry) => e;

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── Groepsets (weg) ────────────────────────────────────────────────────────
  E({ key: "shimano-claris", category: "groepset", brand: "Shimano", model: "Claris", match: ["claris"], klasse: "instap", aero: null, gewicht: "zwaar", note: "Betrouwbare 8-speed instapgroep." }),
  E({ key: "shimano-sora", category: "groepset", brand: "Shimano", model: "Sora", match: ["sora"], klasse: "instap", aero: null, gewicht: "zwaar", note: "9-speed instapgroep, degelijk voor recreatief gebruik." }),
  E({ key: "shimano-tiagra", category: "groepset", brand: "Shimano", model: "Tiagra", match: ["tiagra"], klasse: "instap", aero: null, gewicht: "gemiddeld", note: "10-speed, de bovenkant van het instapsegment." }),
  E({ key: "shimano-105", category: "groepset", brand: "Shimano", model: "105", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "De klassieke prijs-kwaliteitkoning voor wedstrijdrijders." }),
  E({ key: "shimano-105-di2", category: "groepset", brand: "Shimano", model: "105 Di2", match: ["105", "di2"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Elektronisch schakelen tegen de laagste Shimano-prijs." }),
  E({ key: "shimano-ultegra", category: "groepset", brand: "Shimano", model: "Ultegra", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", note: "Bijna Dura-Ace-prestaties, fors lagere prijs." }),
  E({ key: "shimano-dura-ace", category: "groepset", brand: "Shimano", model: "Dura-Ace Di2", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", note: "Shimano's topgroep — dit rijdt het profpeloton." }),
  E({ key: "sram-apex", category: "groepset", brand: "SRAM", model: "Apex", match: ["apex"], klasse: "instap", aero: null, gewicht: "zwaar", note: "SRAM's instapgroep, ook populair op gravel." }),
  E({ key: "sram-rival", category: "groepset", brand: "SRAM", model: "Rival (AXS)", match: ["rival"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Draadloos elektronisch schakelen in het middensegment." }),
  E({ key: "sram-force", category: "groepset", brand: "SRAM", model: "Force AXS", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", note: "Vrijwel Red-prestaties voor minder geld." }),
  E({ key: "sram-red", category: "groepset", brand: "SRAM", model: "Red AXS", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", note: "SRAM's topgroep — rijdt in de WorldTour." }),
  E({ key: "campa-centaur", category: "groepset", brand: "Campagnolo", model: "Centaur", match: ["centaur"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Campagnolo's toegankelijke groep." }),
  E({ key: "campa-chorus", category: "groepset", brand: "Campagnolo", model: "Chorus", match: ["chorus"], klasse: "elite", aero: null, gewicht: "licht", note: "12-speed met het klassieke Campagnolo-gevoel." }),
  E({ key: "campa-super-record", category: "groepset", brand: "Campagnolo", model: "Super Record", match: ["super", "record"], klasse: "pro", aero: null, gewicht: "licht", note: "Campagnolo's topgroep." }),
  // ── Groepsets (MTB) ────────────────────────────────────────────────────────
  E({ key: "shimano-deore", category: "groepset", brand: "Shimano", model: "Deore", match: ["deore"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Degelijke MTB-groep voor training en toertochten." }),
  E({ key: "shimano-slx", category: "groepset", brand: "Shimano", model: "SLX", match: ["slx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "MTB-middensegment, XT-techniek voor minder geld." }),
  E({ key: "shimano-xt", category: "groepset", brand: "Shimano", model: "XT", match: ["xt"], klasse: "elite", aero: null, gewicht: "licht", note: "De wedstrijdstandaard voor ambitieuze MTB'ers." }),
  E({ key: "shimano-xtr", category: "groepset", brand: "Shimano", model: "XTR", match: ["xtr"], klasse: "pro", aero: null, gewicht: "licht", note: "Shimano's MTB-topgroep." }),
  E({ key: "sram-nx", category: "groepset", brand: "SRAM", model: "NX Eagle", match: ["nx"], klasse: "instap", aero: null, gewicht: "zwaar", note: "SRAM's MTB-instap met 12-speed bereik." }),
  E({ key: "sram-gx", category: "groepset", brand: "SRAM", model: "GX Eagle", match: ["gx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Populair MTB-middensegment." }),
  E({ key: "sram-x01", category: "groepset", brand: "SRAM", model: "X01 Eagle", match: ["x01"], klasse: "elite", aero: null, gewicht: "licht", note: "Wedstrijdgroep, dicht bij XX1." }),
  E({ key: "sram-xx1", category: "groepset", brand: "SRAM", model: "XX1 / XX SL", match: ["xx"], klasse: "pro", aero: null, gewicht: "licht", note: "SRAM's MTB-topgroep." }),
  // ── Wielen ─────────────────────────────────────────────────────────────────
  E({ key: "shimano-rs100", category: "wielen", brand: "Shimano", model: "RS100", match: ["rs100"], klasse: "instap", aero: "laag", gewicht: "zwaar", note: "Standaard instapwielset, vaak af-fabriek gemonteerd." }),
  E({ key: "fulcrum-racing-5", category: "wielen", brand: "Fulcrum", model: "Racing 5/6", match: ["racing"], klasse: "instap", aero: "laag", gewicht: "gemiddeld", note: "Degelijke aluminium trainingswielen." }),
  E({ key: "dt-swiss-p1800", category: "wielen", brand: "DT Swiss", model: "P 1800", match: ["p 1800"], klasse: "amateur", aero: "laag", gewicht: "gemiddeld", note: "Betrouwbare aluminium allrounder." }),
  E({ key: "zipp-303", category: "wielen", brand: "Zipp", model: "303", match: ["zipp", "303"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", note: "Veelzijdige carbonwielset, sterk op klimmen en klassiekers." }),
  E({ key: "zipp-404", category: "wielen", brand: "Zipp", model: "404", match: ["zipp", "404"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", note: "Aero-referentie voor vlakke koersen en tijdritten." }),
  E({ key: "dt-swiss-arc", category: "wielen", brand: "DT Swiss", model: "ARC 1100", match: ["arc", "1100"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", note: "Aero-topwielset, veel gereden in tijdritten." }),
  E({ key: "reserve-52", category: "wielen", brand: "Reserve", model: "52/63", match: ["reserve"], klasse: "pro", aero: "hoog", gewicht: "licht", note: "WorldTour-wielset (o.a. Team Visma | Lease a Bike)." }),
  E({ key: "roval-rapide", category: "wielen", brand: "Roval", model: "Rapide CLX", match: ["rapide"], klasse: "pro", aero: "hoog", gewicht: "licht", note: "Specialized' aero-topwielset uit het profpeloton." }),
  E({ key: "roval-alpinist", category: "wielen", brand: "Roval", model: "Alpinist CLX", match: ["alpinist"], klasse: "pro", aero: "gemiddeld", gewicht: "licht", note: "Zeer lichte klimwielset." }),
  E({ key: "enve-ses", category: "wielen", brand: "ENVE", model: "SES", match: ["enve"], klasse: "pro", aero: "hoog", gewicht: "licht", note: "High-end aero-wielen, gereden in de WorldTour." }),
  E({ key: "vision-sc40", category: "wielen", brand: "Vision", model: "SC 40", match: ["vision", "sc"], klasse: "elite", aero: "gemiddeld", gewicht: "gemiddeld", note: "Betaalbare carbon allrounder." }),
  E({ key: "bontrager-aeolus", category: "wielen", brand: "Bontrager", model: "Aeolus", match: ["aeolus"], klasse: "elite", aero: "hoog", gewicht: "gemiddeld", note: "Trek's aero-wielenlijn; topversies rijden WorldTour." }),
  // ── Banden ─────────────────────────────────────────────────────────────────
  E({ key: "conti-ultrasport", category: "banden", brand: "Continental", model: "Ultra Sport", match: ["ultra", "sport"], klasse: "instap", aero: null, gewicht: "gemiddeld", note: "Degelijke trainingsband, relatief hoge rolweerstand." }),
  E({ key: "schwalbe-lugano", category: "banden", brand: "Schwalbe", model: "Lugano", match: ["lugano"], klasse: "instap", aero: null, gewicht: "gemiddeld", note: "Instapband, vooral op af-fabriek fietsen." }),
  E({ key: "vittoria-rubino", category: "banden", brand: "Vittoria", model: "Rubino", match: ["rubino"], klasse: "amateur", aero: null, gewicht: "gemiddeld", note: "Populaire allround trainingsband." }),
  E({ key: "conti-gp5000", category: "banden", brand: "Continental", model: "GP 5000", match: ["5000"], klasse: "elite", aero: null, gewicht: "licht", note: "De referentie voor lage rolweerstand bij clincher-banden." }),
  E({ key: "conti-gp5000str", category: "banden", brand: "Continental", model: "GP 5000 S TR", match: ["5000", "tr"], klasse: "pro", aero: null, gewicht: "licht", note: "Tubeless topband, breed gereden in de WorldTour." }),
  E({ key: "vittoria-corsa-pro", category: "banden", brand: "Vittoria", model: "Corsa Pro", match: ["corsa"], klasse: "pro", aero: null, gewicht: "licht", note: "Wedstrijdband met katoenen karkas, veel profploegen." }),
  E({ key: "schwalbe-pro-one", category: "banden", brand: "Schwalbe", model: "Pro One", match: ["pro", "one"], klasse: "elite", aero: null, gewicht: "licht", note: "Snelle tubeless wedstrijdband." }),
  E({ key: "pirelli-pzero", category: "banden", brand: "Pirelli", model: "P Zero Race", match: ["zero"], klasse: "elite", aero: null, gewicht: "licht", note: "Snelle wedstrijdband, ook als TLR-versie." }),
  // ── Helmen ─────────────────────────────────────────────────────────────────
  E({ key: "giro-register", category: "helm", brand: "Giro", model: "Register", match: ["register"], klasse: "instap", aero: "laag", gewicht: "gemiddeld", note: "Veilige basishelm zonder aero-optimalisatie." }),
  E({ key: "kask-protone", category: "helm", brand: "Kask", model: "Protone", match: ["protone"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", note: "Allround wedstrijdhelm met goede ventilatie." }),
  E({ key: "giro-aether", category: "helm", brand: "Giro", model: "Aether", match: ["aether"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", note: "Goed geventileerde wedstrijdhelm met MIPS." }),
  E({ key: "abus-gamechanger", category: "helm", brand: "ABUS", model: "GameChanger", match: ["gamechanger"], klasse: "elite", aero: "hoog", gewicht: "gemiddeld", note: "Aero-helm, gereden in het profpeloton." }),
  E({ key: "sworks-evade", category: "helm", brand: "Specialized", model: "S-Works Evade", match: ["evade"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", note: "Aero-referentie onder de wegwielrenhelmen." }),
  E({ key: "sworks-prevail", category: "helm", brand: "Specialized", model: "S-Works Prevail", match: ["prevail"], klasse: "pro", aero: "gemiddeld", gewicht: "licht", note: "Maximale ventilatie voor klimdagen." }),
  E({ key: "poc-ventral", category: "helm", brand: "POC", model: "Ventral", match: ["ventral"], klasse: "pro", aero: "hoog", gewicht: "licht", note: "Aero-helm met sterke ventilatie." }),
];

export type ComponentAssessment =
  | {
      known: true;
      entry: {
        key: string;
        brand: string;
        model: string;
        klasse: ComponentClass;
        klasseLabel: string;
        aero: Indication | null;
        gewicht: "licht" | "gemiddeld" | "zwaar" | null;
        note: string;
      };
    }
  | {
      known: false;
      reason: string;
    };

// Normalize to lowercase words, splitting letter↔digit boundaries so "GP5000",
// "GP 5000" and "gp-5000" all normalize to the same word sequence.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .trim();
}

// Deterministic match with strict word boundaries: every match-token (itself
// normalized) must appear as a whole-word phrase in the normalized
// "brand model" text, and the category must agree. NO substring fallback —
// "red" must never match inside "shredder", or unknown parts would get a fake
// klasse. When multiple entries match (e.g. "105" also inside "105 di2"), the
// most specific one (most tokens, then longest tokens) wins.
export function matchKnowledgeEntry(
  category: string,
  brand: string | null,
  model: string | null,
): KnowledgeEntry | null {
  const norm = normalize(`${brand ?? ""} ${model ?? ""}`);
  if (!norm) return null;
  const hay = ` ${norm} `;
  const candidates = KNOWLEDGE_BASE.filter(
    (e) =>
      e.category === category &&
      e.match.every((tok) => hay.includes(` ${normalize(tok)} `)),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.match.length !== a.match.length) return b.match.length - a.match.length;
    const la = a.match.join(" ").length;
    const lb = b.match.join(" ").length;
    return lb - la;
  });
  return candidates[0]!;
}

export function assessComponent(
  category: string,
  brand: string | null,
  model: string | null,
): ComponentAssessment {
  const entry = matchKnowledgeEntry(category, brand, model);
  if (!entry) {
    return {
      known: false,
      reason:
        brand || model
          ? "Nog niet in de kennisbank. Klopt merk en model? Anders helpt een foto."
          : "Merk en model ontbreken nog — vul ze in, dan kan Sparki dit onderdeel beoordelen.",
    };
  }
  return {
    known: true,
    entry: {
      key: entry.key,
      brand: entry.brand,
      model: entry.model,
      klasse: entry.klasse,
      klasseLabel: CLASS_LABEL[entry.klasse],
      aero: entry.aero,
      gewicht: entry.gewicht,
      note: entry.note,
    },
  };
}
