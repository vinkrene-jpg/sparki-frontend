// HERSTEL_EN_AANVULLING_01 F4 (HA-19) — templatebibliotheek op de éne
// generator. Eerste drie rapporttypen, in de opdracht-volgorde:
//   RT-12 dagschema · RT-13 wedstrijdbezetting · RT-14 materiaal- en
//   voertuigenlijst. Alle drie TPL-05 (operationeel dagstuk): geen AI-tekst,
//   versienummer prominent, ontbrekende zaken expliciet benoemd (RCR-05).
//
// Deze module bouwt uitsluitend DocBlok-structuren uit ECHTE rijen — geen
// datafetching en geen rechtenbeslissingen (die blijven in de route, met de
// bestaande CLUB_RECHTEN_01-poorten).

import type { DocBlok, DocKop } from "./generator";

export type PersoonNaam = { clerkId: string; naam: string };

function naamVan(map: Map<string, string>, clerkId: string): string {
  return map.get(clerkId) ?? "Onbekend lid";
}

// ── RT-12 Dagschema ──────────────────────────────────────────────────────────
export type DagschemaInput = {
  event: { name: string; raceDate: string; location: string | null; meetPoint: string | null; meetTime: string | null; notes: string | null };
  /** Per persoon: vertrek/verzamel (club_race_day_schedule). */
  regels: { clerkId: string; departTime: string; meetPoint: string; returnTime: string | null; note: string | null }[];
  selectie: { clerkId: string; role: string }[];
  namen: Map<string, string>;
  /** Contactregel (ploegleider van de dag). */
  contact: string | null;
  versie: number;
  vandaag: string;
  opsteller: string;
  /** Wijzigingen sinds de vorige versie — verplicht blok; eerlijk leeg kan. */
  wijzigingen: string | null;
};

export function bouwDagschema(inp: DagschemaInput): { kop: DocKop; blokken: DocBlok[] } {
  const kop: DocKop = {
    code: "RT-12",
    titel: "Dagschema",
    onderwerp: `${inp.event.name} · ${inp.event.raceDate}${inp.event.location ? ` · ${inp.event.location}` : ""}`,
    datum: inp.vandaag,
    versie: inp.versie,
    classificatie: "intern",
    opgesteldDoor: inp.opsteller,
  };
  const blokken: DocBlok[] = [];

  // Tijdlijn: gezamenlijk verzamelmoment + per-persoon vertrek.
  const rijen: string[][] = [];
  if (inp.event.meetTime || inp.event.meetPoint) {
    rijen.push([
      inp.event.meetTime ?? "—",
      "Verzamelen (iedereen)",
      inp.event.meetPoint ?? "—",
      "",
    ]);
  }
  const opTijd = [...inp.regels].sort((a, b) => a.departTime.localeCompare(b.departTime));
  for (const r of opTijd) {
    rijen.push([
      r.departTime,
      `Vertrek ${naamVan(inp.namen, r.clerkId)}${r.returnTime ? ` (terug ±${r.returnTime})` : ""}`,
      r.meetPoint,
      r.note ?? "",
    ]);
  }
  if (rijen.length === 0) {
    blokken.push({ soort: "ontbreekt", tekst: "er zijn nog geen vertrektijden of een verzamelmoment vastgelegd voor dit evenement." });
  } else {
    blokken.push({
      soort: "tabel",
      tabel: { kop: "Tijdlijn", kolommen: ["Tijd", "Wat", "Locatie", "Opmerking"], rijen, breedtes: [1, 3, 2.2, 2.2] },
    });
  }

  // Wie doet wat: de bezetting in functie-volgorde.
  const rolRijen = inp.selectie
    .map((s) => [rolLabel(s.role), naamVan(inp.namen, s.clerkId)])
    .sort((a, b) => a[0]!.localeCompare(b[0]!));
  if (rolRijen.length > 0) {
    blokken.push({ soort: "tabel", tabel: { kop: "Wie doet wat", kolommen: ["Functie", "Naam"], rijen: rolRijen, breedtes: [1, 2] } });
  } else {
    blokken.push({ soort: "ontbreekt", tekst: "er is nog geen bezetting vastgelegd voor dit evenement." });
  }

  blokken.push(
    inp.contact
      ? { soort: "tekst", kop: "Contact", tekst: inp.contact }
      : { soort: "ontbreekt", tekst: "er is geen contactpersoon voor de dag vastgelegd." },
  );
  if (inp.event.notes) blokken.push({ soort: "tekst", kop: "Opmerkingen", tekst: inp.event.notes });
  // Wijzigingsblok is verplicht (RT-12) — óók als er niets wijzigde.
  blokken.push({
    soort: "tekst",
    kop: "Wijzigingen sinds vorige versie",
    tekst: inp.wijzigingen ?? "Eerste uitgegeven versie — geen eerdere versie om mee te vergelijken.",
  });
  return { kop, blokken };
}

// ── RT-13 Wedstrijdbezetting ────────────────────────────────────────────────
export type BezettingInput = {
  event: { name: string; raceDate: string; location: string | null };
  selectie: { clerkId: string; role: string; availability: string }[];
  namen: Map<string, string>;
  versie: number;
  vandaag: string;
  opsteller: string;
};

export function bouwBezetting(inp: BezettingInput): { kop: DocKop; blokken: DocBlok[] } {
  const kop: DocKop = {
    code: "RT-13",
    titel: "Wedstrijdbezetting",
    onderwerp: `${inp.event.name} · ${inp.event.raceDate}${inp.event.location ? ` · ${inp.event.location}` : ""}`,
    datum: inp.vandaag,
    versie: inp.versie,
    classificatie: "intern",
    opgesteldDoor: inp.opsteller,
  };
  const blokken: DocBlok[] = [];
  // RCR-24: alleen beschikbaarheidsstatus — nooit een (gezondheids)reden.
  const status = (a: string) =>
    a === "beschikbaar" ? "bevestigd" : a === "niet_beschikbaar" ? "afgemeld" : "nog niet bevestigd";
  const groepen: [string, string[]][] = [
    ["Renners", ["renner"]],
    ["Reserves", ["reserve"]],
    ["Staf en begeleiding", ["begeleider", "ploegleider", "teammanager", "mechanieker", "soigneur", "medical_staff", "chauffeur"]],
  ];
  for (const [kopNaam, rollen] of groepen) {
    const rijen = inp.selectie
      .filter((s) => rollen.includes(s.role))
      .map((s) => [naamVan(inp.namen, s.clerkId), rolLabel(s.role), status(s.availability)])
      .sort((a, b) => a[0]!.localeCompare(b[0]!));
    if (rijen.length > 0) {
      blokken.push({ soort: "tabel", tabel: { kop: kopNaam, kolommen: ["Naam", "Rol", "Status"], rijen, breedtes: [2, 1.4, 1.2] } });
    }
  }
  if (blokken.length === 0) blokken.push({ soort: "ontbreekt", tekst: "er is nog niemand geselecteerd voor dit evenement." });

  const open = inp.selectie.filter((s) => s.availability === "onbekend");
  blokken.push(
    open.length > 0
      ? { soort: "lijst", kop: "Openstaande bevestigingen", items: open.map((s) => `${naamVan(inp.namen, s.clerkId)} (${rolLabel(s.role)})`) }
      : { soort: "tekst", kop: "Openstaande bevestigingen", tekst: "Geen — iedereen heeft gereageerd." },
  );
  return { kop, blokken };
}

// ── RT-14 Materiaal- en voertuigenlijst ─────────────────────────────────────
export type MateriaalInput = {
  event: { name: string; raceDate: string; location: string | null };
  voertuigen: { id: number; name: string; seats: number | null; driverClerkId: string | null }[];
  zitplaatsen: { vehicleId: number; clerkId: string }[];
  materiaal: { riderClerkId: string; item: string; loadedAt: Date | null }[];
  namen: Map<string, string>;
  versie: number;
  vandaag: string;
  opsteller: string;
};

export function bouwMateriaallijst(inp: MateriaalInput): { kop: DocKop; blokken: DocBlok[] } {
  const kop: DocKop = {
    code: "RT-14",
    titel: "Materiaal- en voertuigenlijst",
    onderwerp: `${inp.event.name} · ${inp.event.raceDate}${inp.event.location ? ` · ${inp.event.location}` : ""}`,
    datum: inp.vandaag,
    versie: inp.versie,
    classificatie: "intern",
    opgesteldDoor: inp.opsteller,
  };
  const blokken: DocBlok[] = [];

  if (inp.voertuigen.length > 0) {
    const rijen = inp.voertuigen.map((v) => {
      const inzittenden = inp.zitplaatsen.filter((z) => z.vehicleId === v.id).map((z) => naamVan(inp.namen, z.clerkId));
      return [
        v.name,
        v.driverClerkId ? naamVan(inp.namen, v.driverClerkId) : "geen chauffeur vastgelegd",
        v.seats != null ? `${inzittenden.length}/${v.seats}` : String(inzittenden.length),
        inzittenden.join(", ") || "—",
      ];
    });
    blokken.push({ soort: "tabel", tabel: { kop: "Voertuigen", kolommen: ["Voertuig", "Chauffeur", "Bezetting", "Inzittenden"], rijen, breedtes: [1.2, 1.4, 0.8, 2.6] } });
  } else {
    blokken.push({ soort: "ontbreekt", tekst: "er zijn nog geen voertuigen vastgelegd voor dit evenement." });
  }

  if (inp.materiaal.length > 0) {
    const perRenner = new Map<string, { item: string; loadedAt: Date | null }[]>();
    for (const m of inp.materiaal) {
      const list = perRenner.get(m.riderClerkId) ?? [];
      list.push(m);
      perRenner.set(m.riderClerkId, list);
    }
    const rijen: string[][] = [];
    for (const [rider, items] of [...perRenner.entries()].sort((a, b) => naamVan(inp.namen, a[0]).localeCompare(naamVan(inp.namen, b[0])))) {
      for (const it of items) rijen.push([naamVan(inp.namen, rider), it.item, it.loadedAt ? "✔ ingeladen" : "☐ nog niet ingeladen"]);
    }
    blokken.push({ soort: "tabel", tabel: { kop: "Materiaal per renner", kolommen: ["Renner", "Onderdeel", "Status"], rijen, breedtes: [1.5, 2.2, 1.3] } });

    const ontbrekend = inp.materiaal.filter((m) => m.loadedAt == null);
    blokken.push(
      ontbrekend.length > 0
        ? { soort: "lijst", kop: "Nog niet ingeladen", items: ontbrekend.map((m) => `${naamVan(inp.namen, m.riderClerkId)} — ${m.item}`) }
        : { soort: "tekst", kop: "Nog niet ingeladen", tekst: "Niets — alles is afgevinkt." },
    );
  } else {
    blokken.push({ soort: "ontbreekt", tekst: "er is nog geen materiaallijst vastgelegd voor dit evenement." });
  }
  return { kop, blokken };
}

function rolLabel(role: string): string {
  const labels: Record<string, string> = {
    renner: "Renner",
    reserve: "Reserve",
    begeleider: "Begeleider",
    ploegleider: "Ploegleider",
    teammanager: "Teammanager",
    mechanieker: "Mechanieker",
    soigneur: "Soigneur",
    medical_staff: "Medische staf",
    chauffeur: "Chauffeur",
  };
  return labels[role] ?? role;
}
