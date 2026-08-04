// TRAININGSVORMEN_01 — gedeelde plaatsingslogica (F3 plaatsen + F4 voorschouw).
//
// Eén implementatie voor: parametervalidatie tegen de vormbereiken (TRV-39),
// plekstatus/afwijkingen tegen de plek-bandbreedte (TRV-40/41) en de
// rekenbare belasting (TRV-62: alleen pct_ftp + duur is écht rekenbaar,
// anders null — nooit 0, nooit een schatting).

import type {
  planSlotsTable,
  trainingFormParametersTable,
  trainingFormsTable,
} from "@workspace/db";

type Slot = typeof planSlotsTable.$inferSelect;
type Form = typeof trainingFormsTable.$inferSelect;
type Params = typeof trainingFormParametersTable.$inferSelect | undefined;

/** Buiten het PARAMETERBEREIK van de vorm = ongeldige keuze (400), geen afwijking. */
export function valideerVormParameters(
  params: Params,
  duur: number,
  intensiteit: number | null,
): string | null {
  if (params?.duurMinuten != null && duur < params.duurMinuten) {
    return `Duur onder het bereik van de vorm (min ${params.duurMinuten} min)`;
  }
  if (params?.duurMaxMinuten != null && duur > params.duurMaxMinuten) {
    return `Duur boven het bereik van de vorm (max ${params.duurMaxMinuten} min)`;
  }
  if (intensiteit != null) {
    if (params?.intensiteitMin != null && intensiteit < params.intensiteitMin) {
      return "Intensiteit onder het bereik van de vorm";
    }
    if (params?.intensiteitMax != null && intensiteit > params.intensiteitMax) {
      return "Intensiteit boven het bereik van de vorm";
    }
  }
  return null;
}

/** Plekstatus (TRV-40/41): lege lijst = vervuld, anders afgeweken mét wat er is losgelaten. */
export function bepaalAfwijkingen(
  slot: Slot,
  form: Form,
  params: Params,
  duur: number,
  intensiteit: number | null,
): string[] {
  const afwijkingen: string[] = [];
  if (slot.duurMinMinuten != null && duur < slot.duurMinMinuten) {
    afwijkingen.push(`duur ${duur} min onder de plek-bandbreedte (min ${slot.duurMinMinuten})`);
  }
  if (slot.duurMaxMinuten != null && duur > slot.duurMaxMinuten) {
    afwijkingen.push(`duur ${duur} min boven de plek-bandbreedte (max ${slot.duurMaxMinuten})`);
  }
  if (
    intensiteit != null &&
    slot.intensiteitsmaat != null &&
    (params?.intensiteitsmaat ?? null) === slot.intensiteitsmaat
  ) {
    if (slot.intensiteitMin != null && intensiteit < slot.intensiteitMin) {
      afwijkingen.push(`intensiteit ${intensiteit} onder de plek-bandbreedte (min ${slot.intensiteitMin})`);
    }
    if (slot.intensiteitMax != null && intensiteit > slot.intensiteitMax) {
      afwijkingen.push(`intensiteit ${intensiteit} boven de plek-bandbreedte (max ${slot.intensiteitMax})`);
    }
  }
  if (slot.vervangcategorie && form.categorie !== slot.vervangcategorie) {
    afwijkingen.push(`vorm uit categorie "${form.categorie}" i.p.v. "${slot.vervangcategorie}"`);
  } else if (!slot.vervangcategorie && slot.belastingssoort && form.belastingssoort !== slot.belastingssoort) {
    afwijkingen.push(`belastingssoort "${form.belastingssoort}" i.p.v. "${slot.belastingssoort}"`);
  }
  return afwijkingen;
}

/** Belasting alleen als hij écht rekenbaar is (TRV-62): pct_ftp + duur. */
export function rekenbareBelasting(
  maat: string | null,
  intensiteit: number | null,
  duur: number,
): number | null {
  if (maat !== "pct_ftp" || intensiteit == null) return null;
  return Math.round((duur / 60) * Math.pow(intensiteit / 100, 2) * 100);
}

/**
 * Belastingsmodel-projectie voor de voorschouw (TRV-36): zelfde EWMA-constanten
 * als lib/recovery-load (CTL 42d, ATL 7d), maar verankerd op een DOELDATUM en
 * met een optionele extra sessie op die datum. Puur en deterministisch: de
 * aanroeper levert de echte belastinghistorie (geen fabricatie).
 */
export function projecteerBalans(
  tssByDate: Map<string, number>,
  doelDatum: string, // YYYY-MM-DD — dag van de voorgenomen sessie
  extraTssOpDoeldatum: number,
): { morgen: string; zonder: { ctl: number; tsb: number }; met: { ctl: number; tsb: number } } {
  const base = Date.UTC(
    Number(doelDatum.slice(0, 4)),
    Number(doelDatum.slice(5, 7)) - 1,
    Number(doelDatum.slice(8, 10)),
  );
  const dag = (offset: number) => new Date(base + offset * 86400000).toISOString().slice(0, 10);
  const morgen = dag(1);

  const run = (extra: number) => {
    let ctl = 0;
    let atl = 0;
    // 90 dagen aanloop vóór de doeldatum, dan doeldatum en morgen.
    for (let i = -90; i <= 1; i++) {
      const d = dag(i);
      let tss = tssByDate.get(d) ?? 0;
      if (i === 0) tss += extra;
      ctl = ctl + (tss - ctl) / 42;
      atl = atl + (tss - atl) / 7;
    }
    return { ctl: Math.round(ctl), tsb: Math.round(ctl - atl) };
  };

  return { morgen, zonder: run(0), met: run(extraTssOpDoeldatum) };
}
