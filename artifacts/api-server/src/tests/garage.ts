// Fietsengarage engine test — pure, deterministic, no DB writes.
//
// Verifies the honesty contract of the component knowledge base (known parts
// get a real klasse, unknown parts stay honestly "onbekend"), the deterministic
// upgrade ranking per specialism, and the pro-team brand matching.
//
// Run: `pnpm --filter @workspace/api-server run test:garage`

import {
  assessComponent,
  matchKnowledgeEntry,
  rankUpgrades,
  matchProTeams,
  KNOWLEDGE_BASE,
  SPECIALISMS,
} from "../engines/garage";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

scenario("kennisbank: bekende groepset wordt herkend met juiste klasse", () => {
  const a = assessComponent("groepset", "Shimano", "Ultegra Di2");
  assert(a.known, "Ultegra moet herkend worden");
  if (a.known) {
    assert(a.entry.klasse === "elite", `verwacht elite, kreeg ${a.entry.klasse}`);
    assert(a.entry.klasseLabel === "Elite", "Dutch label verwacht");
  }
});

scenario("kennisbank: specifiekere match wint (105 Di2 boven 105)", () => {
  const e = matchKnowledgeEntry("groepset", "Shimano", "105 Di2");
  assert(e && e.key === "shimano-105-di2", `verwacht 105 Di2, kreeg ${e?.key}`);
});

scenario("kennisbank: onbekend onderdeel blijft eerlijk onbekend", () => {
  const a = assessComponent("wielen", "Fabrikant XYZ", "HyperWiel 9000");
  assert(!a.known, "onbekend merk mag niet gematcht worden");
  if (!a.known) assert(a.reason.length > 0, "eerlijke reden verwacht");
});

scenario("kennisbank: lege invoer geeft eerlijke vraag om merk/model", () => {
  const a = assessComponent("banden", null, null);
  assert(!a.known, "zonder merk/model geen match");
  if (!a.known) assert(/merk en model/i.test(a.reason), "vraag om merk/model verwacht");
});

scenario("kennisbank: geen substring-vals-positief ('red' in 'Shredder')", () => {
  const e = matchKnowledgeEntry("groepset", "Predator", "Shredder 5");
  assert(e === null, "'Shredder' mag SRAM Red niet matchen");
});

scenario("kennisbank: los merkwoord zonder model matcht niet", () => {
  const e = matchKnowledgeEntry("wielen", "Zipp", "onbekend type");
  assert(e === null, "alleen 'Zipp' zonder modelnummer mag niet matchen");
});

scenario("kennisbank: schrijfwijzen met/zonder spatie in cijfers matchen gelijk", () => {
  const a = matchKnowledgeEntry("banden", "Continental", "GP5000");
  const b = matchKnowledgeEntry("banden", "Continental", "GP 5000");
  assert(a !== null && b !== null && a.key === b.key, "GP5000 en GP 5000 moeten dezelfde match geven");
});

scenario("kennisbank: categorie moet kloppen (helm matcht geen groepset)", () => {
  const e = matchKnowledgeEntry("helm", "Shimano", "Ultegra");
  assert(e === null, "Ultegra mag niet als helm matchen");
});

scenario("upgrade: instapwielen ranken boven elite-groepset bij klimmen", () => {
  const advice = rankUpgrades(
    [
      { id: 1, category: "wielen", brand: "Shimano", model: "RS100" },
      { id: 2, category: "groepset", brand: "Shimano", model: "Ultegra" },
    ],
    "klimmen",
  );
  assert(advice.suggestions.length === 2, "twee suggesties verwacht");
  assert(
    advice.suggestions[0]!.category === "wielen",
    "wielen (instap, gewicht 3) moeten bovenaan staan",
  );
  assert(advice.suggestions[0]!.gain === "groot", "instapwielen = grote winst bij klimmen");
});

scenario("upgrade: toponderdeel komt in alreadyTop, niet in suggesties", () => {
  const advice = rankUpgrades(
    [{ id: 1, category: "groepset", brand: "SRAM", model: "Red AXS" }],
    "duur",
  );
  assert(advice.suggestions.length === 0, "pro-onderdeel geen suggestie");
  assert(advice.alreadyTop.length === 1, "pro-onderdeel in alreadyTop");
});

scenario("upgrade: onbekend onderdeel gaat eerlijk in de unknown-lijst", () => {
  const advice = rankUpgrades(
    [{ id: 7, category: "banden", brand: "Merk?", model: "Onbekend" }],
    "sprint",
  );
  assert(advice.suggestions.length === 0, "geen suggestie zonder kennisbank-match");
  assert(advice.unknown.length === 1 && advice.unknown[0]!.componentId === 7, "unknown verwacht");
});

scenario("upgrade: tijdrit weegt helm zwaarder dan duurwerk", () => {
  const comps = [
    { id: 1, category: "helm", brand: "Giro", model: "Register" },
    { id: 2, category: "banden", brand: "Schwalbe", model: "Lugano" },
  ];
  const tt = rankUpgrades(comps, "tijdrit");
  const duur = rankUpgrades(comps, "duur");
  assert(tt.suggestions[0]!.category === "helm", "tijdrit: helm bovenaan");
  assert(duur.suggestions[0]!.category === "banden", "duur: banden bovenaan");
});

scenario("upgrade: elk specialisme heeft een label en uitleg per suggestie", () => {
  for (const s of SPECIALISMS) {
    const advice = rankUpgrades(
      [{ id: 1, category: "wielen", brand: "Fulcrum", model: "Racing 5" }],
      s,
    );
    assert(advice.specialismLabel.length > 0, `label ontbreekt voor ${s}`);
    assert(advice.suggestions[0]!.why.length > 10, `uitleg ontbreekt voor ${s}`);
    assert(!/\bAI\b/.test(advice.suggestions[0]!.why), "geen 'AI' in copy");
  }
});

scenario("profploegen: SRAM-groepset matcht SRAM-ploegen bovenaan", () => {
  const { teams, season, source } = matchProTeams([
    { category: "groepset", brand: "SRAM", model: "Force AXS" },
  ]);
  assert(season.includes("2025"), "seizoen vermeld");
  assert(source.length > 0, "bronvermelding verplicht");
  assert(teams[0]!.matches.length > 0, "gematchte ploeg bovenaan");
  assert(teams[0]!.groupset.includes("SRAM"), "bovenste ploeg rijdt SRAM");
  const unmatched = teams.filter((t) => t.matches.length === 0);
  assert(unmatched.length > 0, "niet-gematchte ploegen blijven zichtbaar als overzicht");
});

scenario("profploegen: zonder herkende onderdelen geen matches, wel overzicht", () => {
  const { teams } = matchProTeams([]);
  assert(teams.length >= 6, "overzicht blijft beschikbaar");
  assert(teams.every((t) => t.matches.length === 0), "geen verzonnen matches");
});

scenario("kennisbank: geen dubbele keys en alle klassen geldig", () => {
  const keys = new Set<string>();
  for (const e of KNOWLEDGE_BASE) {
    assert(!keys.has(e.key), `dubbele key ${e.key}`);
    keys.add(e.key);
    assert(["instap", "amateur", "elite", "pro"].includes(e.klasse), `klasse ongeldig: ${e.key}`);
    assert(e.match.length > 0, `match-tokens ontbreken: ${e.key}`);
  }
});

let failed = 0;
for (const r of results) {
  const mark = r.status === "pass" ? "✓" : "✗";
  console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  if (r.status === "fail") failed++;
}
console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
process.exit(failed > 0 ? 1 : 0);
