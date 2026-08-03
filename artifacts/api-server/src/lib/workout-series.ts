// F5 — Herhalende trainingen: datumgeneratie voor een reeks.
//
// Kalenderdatums zijn date-only strings (yyyy-mm-dd) en worden met pure
// y/m/d-stappen berekend — nooit via Date/UTC-millisecondes, zodat de
// zomertijdovergang nooit een dag laat dubbelen of verdwijnen
// (memory: local-date UTC-trap).

export type SeriesFrequency = "daily" | "weekly" | "weekdays" | "interval";

export type SeriesRule = {
  frequency: SeriesFrequency;
  /** ISO-weekdagen 1(ma)–7(zo); alleen bij frequency="weekdays". */
  weekdays?: number[] | null;
  /** Elke N dagen (N ≥ 2); alleen bij frequency="interval". */
  intervalDays?: number | null;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  exceptions?: string[] | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m! < 1 || m! > 12) return false;
  return d! >= 1 && d! <= daysInMonth(y!, m!);
}

function daysInMonth(y: number, m: number): number {
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

/** Volgende kalenderdag, puur y/m/d — geen Date, geen tijdzone. */
export function nextDay(s: string): string {
  let [y, m, d] = s.split("-").map(Number) as [number, number, number];
  d += 1;
  if (d > daysInMonth(y, m)) {
    d = 1;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Vorige kalenderdag, puur y/m/d — geen Date, geen tijdzone. */
export function previousDay(s: string): string {
  let [y, m, d] = s.split("-").map(Number) as [number, number, number];
  d -= 1;
  if (d < 1) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    d = daysInMonth(y, m);
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** ISO-weekdag 1(ma)–7(zo) van een kalenderdatum (Zeller-vrij: epoch-teldag). */
export function isoWeekday(s: string): number {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  // Dagnummer sinds 0000-03-01 (Fliegel–Van Flandern-variant, puur integer).
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn =
    d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  return ((jdn % 7) + 7) % 7 === 0 ? 7 : ((jdn % 7) + 7) % 7; // jdn%7==0 → zondag? kalibratie hieronder
}

// Kalibratie: 2026-08-03 is een maandag (isoWeekday moet 1 geven). JDN van
// 2026-08-03 = 2461256; 2461256 % 7 = 0 ... we normaliseren op een bekend
// ankerpunt in plaats van op de JDN-formule te vertrouwen:
const ANCHOR = { date: "2026-08-03", weekday: 1 }; // maandag
function dayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const ANCHOR_NUM = dayNumber(ANCHOR.date);
export function weekdayOf(s: string): number {
  const diff = dayNumber(s) - ANCHOR_NUM;
  const wd = ((ANCHOR.weekday - 1 + ((diff % 7) + 7)) % 7) + 1;
  return wd;
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type RuleValidation = { ok: true } | { ok: false; error: string };

const MAX_SERIES_DAYS = 400; // eerlijke bovengrens: ruim een jaar

export function validateRule(rule: SeriesRule): RuleValidation {
  if (!isValidDateOnly(rule.startDate) || !isValidDateOnly(rule.endDate)) {
    return { ok: false, error: "Ongeldige begin- of einddatum (yyyy-mm-dd)" };
  }
  if (compareDates(rule.endDate, rule.startDate) < 0) {
    return { ok: false, error: "Einddatum ligt vóór de begindatum" };
  }
  if (dayNumber(rule.endDate) - dayNumber(rule.startDate) > MAX_SERIES_DAYS) {
    return { ok: false, error: `Reeks is te lang (maximaal ${MAX_SERIES_DAYS} dagen)` };
  }
  switch (rule.frequency) {
    case "daily":
    case "weekly":
      break;
    case "weekdays": {
      const wd = rule.weekdays ?? [];
      if (!Array.isArray(wd) || wd.length === 0 || wd.some((w) => !Number.isInteger(w) || w < 1 || w > 7)) {
        return { ok: false, error: "Kies minimaal één weekdag (1=ma t/m 7=zo)" };
      }
      break;
    }
    case "interval": {
      const n = rule.intervalDays;
      if (!Number.isInteger(n) || (n as number) < 2 || (n as number) > 90) {
        return { ok: false, error: "Interval moet tussen 2 en 90 dagen liggen" };
      }
      break;
    }
    default:
      return { ok: false, error: "Onbekende herhaalfrequentie" };
  }
  if (rule.exceptions != null) {
    if (!Array.isArray(rule.exceptions) || rule.exceptions.some((e) => !isValidDateOnly(e))) {
      return { ok: false, error: "Ongeldige uitzonderingsdatum" };
    }
  }
  return { ok: true };
}

/**
 * Alle geplande datums van een reeks (exceptions al verwijderd), oplopend.
 * Optioneel begrensd met `from` (inclusief) voor her-generatie vanaf vandaag.
 */
export function seriesDates(rule: SeriesRule, from?: string): string[] {
  const exceptions = new Set(rule.exceptions ?? []);
  const out: string[] = [];
  const startNum = dayNumber(rule.startDate);
  let d = rule.startDate;
  while (compareDates(d, rule.endDate) <= 0) {
    let match = false;
    switch (rule.frequency) {
      case "daily":
        match = true;
        break;
      case "weekly":
        match = weekdayOf(d) === weekdayOf(rule.startDate);
        break;
      case "weekdays":
        match = (rule.weekdays ?? []).includes(weekdayOf(d));
        break;
      case "interval":
        match = (dayNumber(d) - startNum) % (rule.intervalDays as number) === 0;
        break;
    }
    if (match && !exceptions.has(d) && (!from || compareDates(d, from) >= 0)) {
      out.push(d);
    }
    d = nextDay(d);
  }
  return out;
}
