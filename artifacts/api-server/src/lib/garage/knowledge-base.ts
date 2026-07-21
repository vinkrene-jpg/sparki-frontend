// Gecureerde onderdelen-kennisbank voor de Fietsengarage.
//
// HONESTY CONTRACT: elk item hier is een echt, algemeen bekend product met een
// breed gedragen klasse-indeling (instap/amateur/elite/pro) en een indicatieve
// aero-/gewichtsrichting. We geven bewust GEEN verzonnen cijfers (geen watts,
// geen grammen): alleen klasse-labels en richting-indicaties. Prijzen zijn
// bewust een RUIME indicatieve nieuwprijs-range in euro's (adviesprijsniveau,
// geen actuele winkelprijs) of null wanneer we geen betrouwbare range hebben.
// Onderdelen die niet in deze lijst staan krijgen eerlijk "onbekend" — nooit
// een gok.

import type { GarageComponentCategory } from "@workspace/db";

export type ComponentClass = "instap" | "amateur" | "elite" | "pro";
export type Indication = "laag" | "gemiddeld" | "hoog";

// Indicatieve nieuwprijs in euro's (van–tot). Bewust ruim en afgerond;
// de UI benoemt dit altijd als richtprijs, nooit als actuele winkelprijs.
export type PriceRange = { van: number; tot: number };

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
  // Indicatieve nieuwprijs-range (EUR) of null als we die niet eerlijk kennen.
  richtprijs: PriceRange | null;
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
  E({ key: "shimano-claris", category: "groepset", brand: "Shimano", model: "Claris", match: ["claris"], klasse: "instap", aero: null, gewicht: "zwaar", richtprijs: { van: 300, tot: 450 }, note: "Betrouwbare 8-speed instapgroep." }),
  E({ key: "shimano-sora", category: "groepset", brand: "Shimano", model: "Sora", match: ["sora"], klasse: "instap", aero: null, gewicht: "zwaar", richtprijs: { van: 400, tot: 550 }, note: "9-speed instapgroep, degelijk voor recreatief gebruik." }),
  E({ key: "shimano-tiagra", category: "groepset", brand: "Shimano", model: "Tiagra", match: ["tiagra"], klasse: "instap", aero: null, gewicht: "gemiddeld", richtprijs: { van: 550, tot: 750 }, note: "10-speed, de bovenkant van het instapsegment." }),
  E({ key: "shimano-105", category: "groepset", brand: "Shimano", model: "105 (mechanisch)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 700, tot: 950 }, note: "De klassieke prijs-kwaliteitkoning voor wedstrijdrijders." }),
  E({ key: "shimano-105-di2", category: "groepset", brand: "Shimano", model: "105 Di2", match: ["105", "di2"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 1300, tot: 1800 }, note: "Elektronisch schakelen tegen de laagste Shimano-prijs." }),
  E({ key: "shimano-ultegra", category: "groepset", brand: "Shimano", model: "Ultegra (mechanisch)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 900, tot: 1300 }, note: "Bijna Dura-Ace-prestaties, fors lagere prijs." }),
  E({ key: "shimano-ultegra-di2", category: "groepset", brand: "Shimano", model: "Ultegra Di2", match: ["ultegra", "di2"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 2200, tot: 2800 }, note: "12-speed elektronisch — de wedstrijdstandaard onder Dura-Ace." }),
  E({ key: "shimano-dura-ace", category: "groepset", brand: "Shimano", model: "Dura-Ace Di2", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 3800, tot: 4600 }, note: "Shimano's topgroep — dit rijdt het profpeloton." }),
  E({ key: "shimano-grx", category: "groepset", brand: "Shimano", model: "GRX", match: ["grx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 700, tot: 1200 }, note: "Shimano's gravelgroep; hogere series schuiven richting elite." }),
  E({ key: "sram-apex", category: "groepset", brand: "SRAM", model: "Apex", match: ["apex"], klasse: "instap", aero: null, gewicht: "zwaar", richtprijs: { van: 500, tot: 750 }, note: "SRAM's instapgroep, ook populair op gravel." }),
  E({ key: "sram-rival", category: "groepset", brand: "SRAM", model: "Rival AXS", match: ["rival"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 1300, tot: 1800 }, note: "Draadloos elektronisch schakelen in het middensegment." }),
  E({ key: "sram-force", category: "groepset", brand: "SRAM", model: "Force AXS", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 2300, tot: 3000 }, note: "Vrijwel Red-prestaties voor minder geld." }),
  E({ key: "sram-red", category: "groepset", brand: "SRAM", model: "Red AXS", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 4000, tot: 5000 }, note: "SRAM's topgroep — rijdt in de WorldTour." }),
  E({ key: "campa-centaur", category: "groepset", brand: "Campagnolo", model: "Centaur", match: ["centaur"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 700, tot: 950 }, note: "Campagnolo's toegankelijke groep." }),
  E({ key: "campa-chorus", category: "groepset", brand: "Campagnolo", model: "Chorus", match: ["chorus"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 1600, tot: 2100 }, note: "12-speed met het klassieke Campagnolo-gevoel." }),
  E({ key: "campa-record", category: "groepset", brand: "Campagnolo", model: "Record", match: ["record"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 2800, tot: 3600 }, note: "Campagnolo's tweede topgroep, vlak onder Super Record." }),
  E({ key: "campa-super-record", category: "groepset", brand: "Campagnolo", model: "Super Record", match: ["super", "record"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 3800, tot: 5200 }, note: "Campagnolo's topgroep." }),
  // ── Groepsets (MTB) ────────────────────────────────────────────────────────
  E({ key: "shimano-deore", category: "groepset", brand: "Shimano", model: "Deore", match: ["deore"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 500, tot: 700 }, note: "Degelijke MTB-groep voor training en toertochten." }),
  E({ key: "shimano-slx", category: "groepset", brand: "Shimano", model: "SLX", match: ["slx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 700, tot: 950 }, note: "MTB-middensegment, XT-techniek voor minder geld." }),
  E({ key: "shimano-xt", category: "groepset", brand: "Shimano", model: "XT", match: ["xt"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 1000, tot: 1400 }, note: "De wedstrijdstandaard voor ambitieuze MTB'ers." }),
  E({ key: "shimano-xtr", category: "groepset", brand: "Shimano", model: "XTR", match: ["xtr"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 2000, tot: 2700 }, note: "Shimano's MTB-topgroep." }),
  E({ key: "sram-nx", category: "groepset", brand: "SRAM", model: "NX Eagle", match: ["nx"], klasse: "instap", aero: null, gewicht: "zwaar", richtprijs: { van: 350, tot: 500 }, note: "SRAM's MTB-instap met 12-speed bereik." }),
  E({ key: "sram-gx", category: "groepset", brand: "SRAM", model: "GX Eagle", match: ["gx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 550, tot: 800 }, note: "Populair MTB-middensegment." }),
  E({ key: "sram-x01", category: "groepset", brand: "SRAM", model: "X01 Eagle", match: ["x01"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 1300, tot: 1800 }, note: "Wedstrijdgroep, dicht bij XX1." }),
  E({ key: "sram-xx1", category: "groepset", brand: "SRAM", model: "XX1 / XX SL", match: ["xx"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 1900, tot: 2600 }, note: "SRAM's MTB-topgroep." }),
  // ── Achterderailleurs (los) ────────────────────────────────────────────────
  E({ key: "rd-shimano-105-di2", category: "achterderailleur", brand: "Shimano", model: "105 Di2 (RD-R7150)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 250, tot: 350 }, note: "Elektronische 12-speed achterderailleur uit de 105-serie." }),
  E({ key: "rd-shimano-ultegra-di2", category: "achterderailleur", brand: "Shimano", model: "Ultegra Di2 (RD-R8150)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 350, tot: 480 }, note: "Vrijwel Dura-Ace-schakelwerk voor minder geld." }),
  E({ key: "rd-shimano-dura-ace", category: "achterderailleur", brand: "Shimano", model: "Dura-Ace Di2 (RD-R9250)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 700, tot: 900 }, note: "Shimano's topderailleur — het snelste schakelwerk uit het peloton." }),
  E({ key: "rd-sram-rival-axs", category: "achterderailleur", brand: "SRAM", model: "Rival AXS", match: ["rival"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 250, tot: 350 }, note: "Draadloze achterderailleur uit het middensegment." }),
  E({ key: "rd-sram-force-axs", category: "achterderailleur", brand: "SRAM", model: "Force AXS", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 400, tot: 550 }, note: "Draadloos elite-schakelwerk, dicht bij Red." }),
  E({ key: "rd-sram-red-axs", category: "achterderailleur", brand: "SRAM", model: "Red AXS", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 700, tot: 950 }, note: "SRAM's topderailleur uit de WorldTour." }),
  E({ key: "rd-shimano-xt", category: "achterderailleur", brand: "Shimano", model: "XT (RD-M8100)", match: ["xt"], klasse: "elite", aero: null, gewicht: "gemiddeld", richtprijs: { van: 110, tot: 160 }, note: "Betrouwbare MTB-wedstrijdderailleur." }),
  E({ key: "rd-shimano-xtr", category: "achterderailleur", brand: "Shimano", model: "XTR (RD-M9100)", match: ["xtr"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 330 }, note: "Shimano's MTB-topderailleur." }),
  E({ key: "rd-sram-gx-eagle", category: "achterderailleur", brand: "SRAM", model: "GX Eagle", match: ["gx"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 120, tot: 170 }, note: "Degelijke MTB-derailleur uit het middensegment." }),
  E({ key: "rd-sram-x01-eagle", category: "achterderailleur", brand: "SRAM", model: "X01 Eagle", match: ["x01"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 330 }, note: "MTB-wedstrijdderailleur, dicht bij XX1." }),
  // ── Voorderailleurs (los) ──────────────────────────────────────────────────
  E({ key: "fd-shimano-105-di2", category: "voorderailleur", brand: "Shimano", model: "105 Di2 (FD-R7150)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 180, tot: 250 }, note: "Elektronische voorderailleur uit de 105-serie." }),
  E({ key: "fd-shimano-ultegra-di2", category: "voorderailleur", brand: "Shimano", model: "Ultegra Di2 (FD-R8150)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 330 }, note: "Snel en stil voorschakelwerk, vlak onder Dura-Ace." }),
  E({ key: "fd-shimano-dura-ace", category: "voorderailleur", brand: "Shimano", model: "Dura-Ace Di2 (FD-R9250)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 400, tot: 520 }, note: "Shimano's topvoorderailleur." }),
  E({ key: "fd-sram-force-axs", category: "voorderailleur", brand: "SRAM", model: "Force AXS", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 350 }, note: "Draadloze elite-voorderailleur." }),
  E({ key: "fd-sram-red-axs", category: "voorderailleur", brand: "SRAM", model: "Red AXS", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 350, tot: 480 }, note: "SRAM's topvoorderailleur." }),
  // ── Crankstellen (los) ─────────────────────────────────────────────────────
  E({ key: "crank-shimano-105", category: "crankstel", brand: "Shimano", model: "105 (FC-R7100)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 150, tot: 220 }, note: "Stijf en betrouwbaar crankstel uit het middensegment." }),
  E({ key: "crank-shimano-ultegra", category: "crankstel", brand: "Shimano", model: "Ultegra (FC-R8100)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 380 }, note: "Licht wedstrijdcrankstel, vlak onder Dura-Ace." }),
  E({ key: "crank-shimano-dura-ace", category: "crankstel", brand: "Shimano", model: "Dura-Ace (FC-R9200)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 600, tot: 800 }, note: "Shimano's topcrankstel." }),
  E({ key: "crank-sram-force-axs", category: "crankstel", brand: "SRAM", model: "Force AXS", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 350, tot: 500 }, note: "Carbon crankstel uit het elite-segment." }),
  E({ key: "crank-sram-red-axs", category: "crankstel", brand: "SRAM", model: "Red AXS", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 800, tot: 1100 }, note: "Zeer licht carbon topcrankstel." }),
  // ── Cassettes (los) ────────────────────────────────────────────────────────
  E({ key: "cas-shimano-105", category: "cassette", brand: "Shimano", model: "105 (CS-R7100)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 60, tot: 90 }, note: "Degelijke 12-speed cassette." }),
  E({ key: "cas-shimano-ultegra", category: "cassette", brand: "Shimano", model: "Ultegra (CS-R8100)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 90, tot: 140 }, note: "Lichtere cassette met strakke schakelstappen." }),
  E({ key: "cas-shimano-dura-ace", category: "cassette", brand: "Shimano", model: "Dura-Ace (CS-R9200)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 380 }, note: "Titanium tandkransen — de lichtste Shimano-cassette." }),
  E({ key: "cas-sram-force", category: "cassette", brand: "SRAM", model: "Force (XG-1270)", match: ["force"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 200, tot: 280 }, note: "Uit één stuk gefreesde elite-cassette." }),
  E({ key: "cas-sram-red", category: "cassette", brand: "SRAM", model: "Red (XG-1290)", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 350, tot: 480 }, note: "SRAM's topcassette." }),
  E({ key: "cas-shimano-xt", category: "cassette", brand: "Shimano", model: "XT (CS-M8100)", match: ["xt"], klasse: "elite", aero: null, gewicht: "gemiddeld", richtprijs: { van: 90, tot: 140 }, note: "MTB-wedstrijdcassette met groot bereik." }),
  E({ key: "cas-sram-xx1", category: "cassette", brand: "SRAM", model: "XX1 Eagle", match: ["xx"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 350, tot: 480 }, note: "SRAM's MTB-topcassette." }),
  // ── Kettingen (los) ────────────────────────────────────────────────────────
  E({ key: "chain-shimano-105", category: "ketting", brand: "Shimano", model: "105 / SLX (CN-M7100)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 25, tot: 40 }, note: "Betrouwbare 12-speed ketting." }),
  E({ key: "chain-shimano-ultegra", category: "ketting", brand: "Shimano", model: "Ultegra / XT (CN-M8100)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 35, tot: 55 }, note: "Soepel lopende ketting met lichtere behandeling." }),
  E({ key: "chain-shimano-dura-ace", category: "ketting", brand: "Shimano", model: "Dura-Ace (CN-M9100)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 55, tot: 80 }, note: "Shimano's topketting met de gladste coating." }),
  E({ key: "chain-sram-red", category: "ketting", brand: "SRAM", model: "Red (D1)", match: ["red"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 60, tot: 90 }, note: "SRAM's topketting met holle pennen." }),
  // ── Remmen (los) ───────────────────────────────────────────────────────────
  E({ key: "brake-shimano-105", category: "remmen", brand: "Shimano", model: "105 (schijf)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 80, tot: 130 }, note: "Krachtige hydraulische schijfremmen uit het middensegment." }),
  E({ key: "brake-shimano-ultegra", category: "remmen", brand: "Shimano", model: "Ultegra (schijf)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 130, tot: 200 }, note: "Lichtere remklauwen met fijnere dosering." }),
  E({ key: "brake-shimano-dura-ace", category: "remmen", brand: "Shimano", model: "Dura-Ace (schijf)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 250, tot: 380 }, note: "Shimano's topremmen." }),
  // ── Cockpit / sturen (los) ─────────────────────────────────────────────────
  E({ key: "cockpit-zipp-service-course", category: "cockpit", brand: "Zipp", model: "Service Course", match: ["service", "course"], klasse: "amateur", aero: "laag", gewicht: "gemiddeld", richtprijs: { van: 80, tot: 150 }, note: "Degelijk aluminium stuur/stuurpen-programma." }),
  E({ key: "cockpit-vision-metron", category: "cockpit", brand: "Vision", model: "Metron (geïntegreerd)", match: ["metron"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 450, tot: 700 }, note: "Geïntegreerde aero-cockpit, veel gereden in het peloton." }),
  E({ key: "cockpit-enve-aero", category: "cockpit", brand: "ENVE", model: "SES Aero stuur", match: ["enve"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 400, tot: 600 }, note: "Carbon aero-stuur uit het topsegment." }),
  // ── Zadels (los) ───────────────────────────────────────────────────────────
  E({ key: "saddle-selle-italia-x3", category: "zadel", brand: "Selle Italia", model: "X3", match: ["x 3"], klasse: "instap", aero: null, gewicht: "gemiddeld", richtprijs: { van: 40, tot: 70 }, note: "Comfortabel instapzadel." }),
  E({ key: "saddle-fizik-antares", category: "zadel", brand: "Fizik", model: "Antares R3", match: ["antares"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 130, tot: 190 }, note: "Bewezen wedstrijdzadel met carbon-versterkte schaal." }),
  E({ key: "saddle-specialized-power", category: "zadel", brand: "Specialized", model: "Power", match: ["power"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 110, tot: 180 }, note: "Kort krachtzadel, ook populair bij tijdrijders." }),
  E({ key: "saddle-sworks-power", category: "zadel", brand: "Specialized", model: "S-Works Power", match: ["works", "power"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 280, tot: 380 }, note: "Carbon topversie van het Power-zadel." }),
  // ── Pedalen (los) ──────────────────────────────────────────────────────────
  E({ key: "pedal-shimano-rs500", category: "pedalen", brand: "Shimano", model: "PD-RS500", match: ["rs 500"], klasse: "instap", aero: null, gewicht: "gemiddeld", richtprijs: { van: 45, tot: 65 }, note: "Toegankelijk SPD-SL instappedaal." }),
  E({ key: "pedal-shimano-105", category: "pedalen", brand: "Shimano", model: "105 (PD-R7000)", match: ["105"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 90, tot: 130 }, note: "Het meest gereden wedstrijdpedaal in het middensegment." }),
  E({ key: "pedal-shimano-ultegra", category: "pedalen", brand: "Shimano", model: "Ultegra (PD-R8000)", match: ["ultegra"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 150, tot: 200 }, note: "Licht en stijf, vlak onder Dura-Ace." }),
  E({ key: "pedal-shimano-dura-ace", category: "pedalen", brand: "Shimano", model: "Dura-Ace (PD-R9100)", match: ["dura"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 220, tot: 300 }, note: "Shimano's toppedaal." }),
  E({ key: "pedal-look-keo2max", category: "pedalen", brand: "Look", model: "Keo 2 Max", match: ["keo"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 80, tot: 120 }, note: "Populair alternatief voor SPD-SL." }),
  E({ key: "pedal-look-keo-blade", category: "pedalen", brand: "Look", model: "Keo Blade", match: ["keo", "blade"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 180, tot: 260 }, note: "Licht carbon wedstrijdpedaal." }),
  E({ key: "pedal-wahoo-speedplay", category: "pedalen", brand: "Wahoo", model: "Speedplay Zero", match: ["speedplay"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 200, tot: 270 }, note: "Tweezijdig instappen en veel afstelbereik." }),
  E({ key: "pedal-garmin-rally", category: "pedalen", brand: "Garmin", model: "Rally (wattagemeter)", match: ["rally"], klasse: "pro", aero: null, gewicht: "gemiddeld", richtprijs: { van: 700, tot: 1200 }, note: "Pedalen met ingebouwde wattagemeting." }),
  // ── Wielen ─────────────────────────────────────────────────────────────────
  E({ key: "shimano-rs100", category: "wielen", brand: "Shimano", model: "RS100", match: ["rs100"], klasse: "instap", aero: "laag", gewicht: "zwaar", richtprijs: { van: 100, tot: 160 }, note: "Standaard instapwielset, vaak af-fabriek gemonteerd." }),
  E({ key: "fulcrum-racing-5", category: "wielen", brand: "Fulcrum", model: "Racing 5/6", match: ["racing"], klasse: "instap", aero: "laag", gewicht: "gemiddeld", richtprijs: { van: 250, tot: 380 }, note: "Degelijke aluminium trainingswielen." }),
  E({ key: "dt-swiss-p1800", category: "wielen", brand: "DT Swiss", model: "P 1800", match: ["p 1800"], klasse: "amateur", aero: "laag", gewicht: "gemiddeld", richtprijs: { van: 350, tot: 500 }, note: "Betrouwbare aluminium allrounder." }),
  E({ key: "zipp-303", category: "wielen", brand: "Zipp", model: "303", match: ["zipp", "303"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", richtprijs: { van: 1600, tot: 2300 }, note: "Veelzijdige carbonwielset, sterk op klimmen en klassiekers." }),
  E({ key: "zipp-404", category: "wielen", brand: "Zipp", model: "404", match: ["zipp", "404"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", richtprijs: { van: 2400, tot: 3100 }, note: "Aero-referentie voor vlakke koersen en tijdritten." }),
  E({ key: "dt-swiss-arc", category: "wielen", brand: "DT Swiss", model: "ARC 1100", match: ["arc", "1100"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", richtprijs: { van: 2200, tot: 2900 }, note: "Aero-topwielset, veel gereden in tijdritten." }),
  E({ key: "reserve-52", category: "wielen", brand: "Reserve", model: "52/63", match: ["reserve"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 2200, tot: 2900 }, note: "WorldTour-wielset (o.a. Team Visma | Lease a Bike)." }),
  E({ key: "roval-rapide", category: "wielen", brand: "Roval", model: "Rapide CLX", match: ["rapide"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 2500, tot: 3200 }, note: "Specialized' aero-topwielset uit het profpeloton." }),
  E({ key: "roval-alpinist", category: "wielen", brand: "Roval", model: "Alpinist CLX", match: ["alpinist"], klasse: "pro", aero: "gemiddeld", gewicht: "licht", richtprijs: { van: 2500, tot: 3200 }, note: "Zeer lichte klimwielset." }),
  E({ key: "enve-ses", category: "wielen", brand: "ENVE", model: "SES", match: ["enve"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 2800, tot: 3800 }, note: "High-end aero-wielen, gereden in de WorldTour." }),
  E({ key: "vision-sc40", category: "wielen", brand: "Vision", model: "SC 40", match: ["vision", "sc"], klasse: "elite", aero: "gemiddeld", gewicht: "gemiddeld", richtprijs: { van: 1000, tot: 1500 }, note: "Betaalbare carbon allrounder." }),
  E({ key: "bontrager-aeolus", category: "wielen", brand: "Bontrager", model: "Aeolus", match: ["aeolus"], klasse: "elite", aero: "hoog", gewicht: "gemiddeld", richtprijs: { van: 1300, tot: 2500 }, note: "Trek's aero-wielenlijn; topversies rijden WorldTour." }),
  // ── Banden ─────────────────────────────────────────────────────────────────
  E({ key: "conti-ultrasport", category: "banden", brand: "Continental", model: "Ultra Sport", match: ["ultra", "sport"], klasse: "instap", aero: null, gewicht: "gemiddeld", richtprijs: { van: 15, tot: 25 }, note: "Degelijke trainingsband, relatief hoge rolweerstand." }),
  E({ key: "schwalbe-lugano", category: "banden", brand: "Schwalbe", model: "Lugano", match: ["lugano"], klasse: "instap", aero: null, gewicht: "gemiddeld", richtprijs: { van: 15, tot: 25 }, note: "Instapband, vooral op af-fabriek fietsen." }),
  E({ key: "vittoria-rubino", category: "banden", brand: "Vittoria", model: "Rubino", match: ["rubino"], klasse: "amateur", aero: null, gewicht: "gemiddeld", richtprijs: { van: 25, tot: 40 }, note: "Populaire allround trainingsband." }),
  E({ key: "conti-gp5000", category: "banden", brand: "Continental", model: "GP 5000", match: ["5000"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 45, tot: 65 }, note: "De referentie voor lage rolweerstand bij clincher-banden." }),
  E({ key: "conti-gp5000str", category: "banden", brand: "Continental", model: "GP 5000 S TR", match: ["5000", "tr"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 65, tot: 95 }, note: "Tubeless topband, breed gereden in de WorldTour." }),
  E({ key: "vittoria-corsa-pro", category: "banden", brand: "Vittoria", model: "Corsa Pro", match: ["corsa"], klasse: "pro", aero: null, gewicht: "licht", richtprijs: { van: 70, tot: 100 }, note: "Wedstrijdband met katoenen karkas, veel profploegen." }),
  E({ key: "schwalbe-pro-one", category: "banden", brand: "Schwalbe", model: "Pro One", match: ["pro", "one"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 55, tot: 80 }, note: "Snelle tubeless wedstrijdband." }),
  E({ key: "pirelli-pzero", category: "banden", brand: "Pirelli", model: "P Zero Race", match: ["zero"], klasse: "elite", aero: null, gewicht: "licht", richtprijs: { van: 50, tot: 75 }, note: "Snelle wedstrijdband, ook als TLR-versie." }),
  // ── Helmen ─────────────────────────────────────────────────────────────────
  E({ key: "giro-register", category: "helm", brand: "Giro", model: "Register", match: ["register"], klasse: "instap", aero: "laag", gewicht: "gemiddeld", richtprijs: { van: 50, tot: 75 }, note: "Veilige basishelm zonder aero-optimalisatie." }),
  E({ key: "kask-protone", category: "helm", brand: "Kask", model: "Protone", match: ["protone"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", richtprijs: { van: 200, tot: 260 }, note: "Allround wedstrijdhelm met goede ventilatie." }),
  E({ key: "giro-aether", category: "helm", brand: "Giro", model: "Aether", match: ["aether"], klasse: "elite", aero: "gemiddeld", gewicht: "licht", richtprijs: { van: 250, tot: 320 }, note: "Goed geventileerde wedstrijdhelm met MIPS." }),
  E({ key: "abus-gamechanger", category: "helm", brand: "ABUS", model: "GameChanger", match: ["gamechanger"], klasse: "elite", aero: "hoog", gewicht: "gemiddeld", richtprijs: { van: 180, tot: 250 }, note: "Aero-helm, gereden in het profpeloton." }),
  E({ key: "sworks-evade", category: "helm", brand: "Specialized", model: "S-Works Evade", match: ["evade"], klasse: "pro", aero: "hoog", gewicht: "gemiddeld", richtprijs: { van: 300, tot: 360 }, note: "Aero-referentie onder de wegwielrenhelmen." }),
  E({ key: "sworks-prevail", category: "helm", brand: "Specialized", model: "S-Works Prevail", match: ["prevail"], klasse: "pro", aero: "gemiddeld", gewicht: "licht", richtprijs: { van: 300, tot: 360 }, note: "Maximale ventilatie voor klimdagen." }),
  E({ key: "poc-ventral", category: "helm", brand: "POC", model: "Ventral", match: ["ventral"], klasse: "pro", aero: "hoog", gewicht: "licht", richtprijs: { van: 220, tot: 290 }, note: "Aero-helm met sterke ventilatie." }),
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
        richtprijs: PriceRange | null;
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
      richtprijs: entry.richtprijs,
      note: entry.note,
    },
  };
}

// Catalogus voor de invoer-picker in de app: echte, herkenbare producten per
// categorie zodat een renner kan aantikken in plaats van typen. Vrije invoer
// blijft altijd mogelijk — dit is een startpunt, geen beperking.
export function catalogForCategory(category: string) {
  return KNOWLEDGE_BASE.filter((e) => e.category === category)
    .map((e) => ({
      key: e.key,
      brand: e.brand,
      model: e.model,
      klasse: e.klasse,
      klasseLabel: CLASS_LABEL[e.klasse],
      richtprijs: e.richtprijs,
    }))
    .sort((a, b) => CLASS_RANK[a.klasse] - CLASS_RANK[b.klasse] || a.brand.localeCompare(b.brand));
}
