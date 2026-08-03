// TRAINEN_DOELEN_SEIZOEN_01 F7 — seizoenslaag (doelvorm Seizoen).
//
// Tweede resolutie boven de 21-daagse dagmotor: vormblokken over de hele
// seizoenslengte plus een weekdoel (uren) per week. Alles hier is
// deterministisch afgeleid uit het hoofddoel, tussendoelen en de
// wedstrijdkalender — er wordt niets verzonnen en niets opgeslagen.
//
// Kernregels (bouwpakket F7 / TD-08):
//  - Vormperiode per anker; binnen een vormperiode wordt niet per wedstrijd
//    getaperd (de dagmotor telt af naar het blok-anker).
//  - Tussen twee dichte pieken (< ONDERHOUD_GAP_DAYS dagen tussenruimte) komt
//    een dip op "onderhoud": vorm vasthouden, geen terugval naar base.
//  - De sporter begint nooit op een lege tijdlijn: zonder ankers is er geen
//    seizoenslaag (doelvorm Ritme dekt dat), met ankers is de tijdlijn vol.

export type SeasonAnchor = {
  date: string; // yyyy-mm-dd
  title: string;
  kind: "hoofddoel" | "tussendoel" | "wedstrijd";
};

export type SeasonBlock = {
  startDate: string;
  endDate: string;
  phase: "base" | "build" | "vorm" | "onderhoud";
  label: string;
  anchorDate: string | null;
  anchorTitle: string | null;
};

export type SeasonWeekTarget = {
  weekStart: string; // maandag? nee: 7-daagse blokken vanaf `from`
  phase: SeasonBlock["phase"];
  targetHours: number;
};

/** Vormperiode-lengte vóór het anker (incl. de ankerdag zelf). */
export const VORM_DAYS = 28;
/** Kortere tussenruimte dan dit ⇒ onderhoud (dip), geen terugval naar base. */
export const ONDERHOUD_GAP_DAYS = 49;
/** Opbouwlengte vóór een vormperiode wanneer er ruimte is. */
export const BUILD_DAYS = 42;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * Bouw de vormblokken van vandaag tot en met het laatste anker.
 * Ankers zonder toekomstige datum worden genegeerd; zonder ankers → [].
 */
export function buildSeasonBlocks(today: string, anchorsIn: SeasonAnchor[]): SeasonBlock[] {
  const anchors = anchorsIn
    .filter((a) => daysBetween(today, a.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (anchors.length === 0) return [];

  const blocks: SeasonBlock[] = [];
  let cursor = today;

  anchors.forEach((anchor, i) => {
    const vormStart = addDays(anchor.date, -(VORM_DAYS - 1));
    const gapStart = cursor;
    const gapDays = daysBetween(gapStart, vormStart);

    if (gapDays > 0) {
      if (i === 0) {
        // Aanloop naar de eerste piek: base (indien ruim) + build.
        const buildStart = daysBetween(gapStart, vormStart) > BUILD_DAYS
          ? addDays(vormStart, -BUILD_DAYS)
          : gapStart;
        if (buildStart > gapStart) {
          blocks.push({
            startDate: gapStart,
            endDate: addDays(buildStart, -1),
            phase: "base",
            label: "Basis — rustig opbouwen",
            anchorDate: null,
            anchorTitle: null,
          });
        }
        blocks.push({
          startDate: buildStart,
          endDate: addDays(vormStart, -1),
          phase: "build",
          label: "Opbouw — gericht zwaarder",
          anchorDate: anchor.date,
          anchorTitle: anchor.title,
        });
      } else if (gapDays < ONDERHOUD_GAP_DAYS) {
        // Dip tussen twee dichte pieken: vorm vasthouden, nooit terug naar base.
        blocks.push({
          startDate: gapStart,
          endDate: addDays(vormStart, -1),
          phase: "onderhoud",
          label: "Onderhoud — vorm vasthouden",
          anchorDate: anchor.date,
          anchorTitle: anchor.title,
        });
      } else {
        // Ruime tussenruimte: eerst onderhoud (uitademen), dan opnieuw opbouwen.
        const buildStart = addDays(vormStart, -BUILD_DAYS);
        blocks.push({
          startDate: gapStart,
          endDate: addDays(buildStart, -1),
          phase: "onderhoud",
          label: "Onderhoud — vorm vasthouden",
          anchorDate: null,
          anchorTitle: null,
        });
        blocks.push({
          startDate: buildStart,
          endDate: addDays(vormStart, -1),
          phase: "build",
          label: "Opbouw — gericht zwaarder",
          anchorDate: anchor.date,
          anchorTitle: anchor.title,
        });
      }
    }

    // De vormperiode zelf. Binnen dit blok telt de dagmotor af naar het
    // blok-anker (peak/taper) — er wordt niet per losse wedstrijd getaperd.
    blocks.push({
      startDate: vormStart < cursor ? cursor : vormStart,
      endDate: anchor.date,
      phase: "vorm",
      label: `Vormperiode — ${anchor.title}`,
      anchorDate: anchor.date,
      anchorTitle: anchor.title,
    });
    cursor = addDays(anchor.date, 1);
  });

  return blocks;
}

const PHASE_HOUR_FACTOR: Record<SeasonBlock["phase"], number> = {
  base: 0.9,
  build: 1.0,
  vorm: 0.95,
  onderhoud: 0.8,
};

/**
 * Weekdoelen (uren) over de hele bloklengte — loopt bewust door tot voorbij
 * de 21-daagse dagmotor-horizon.
 */
export function buildSeasonWeekTargets(
  blocks: SeasonBlock[],
  weeklyHourTarget: number,
): SeasonWeekTarget[] {
  if (blocks.length === 0 || weeklyHourTarget <= 0) return [];
  const from = blocks[0]!.startDate;
  const to = blocks[blocks.length - 1]!.endDate;
  const out: SeasonWeekTarget[] = [];
  for (let ws = from; ws <= to; ws = addDays(ws, 7)) {
    const block =
      blocks.find((b) => b.startDate <= ws && ws <= b.endDate) ?? blocks[blocks.length - 1]!;
    out.push({
      weekStart: ws,
      phase: block.phase,
      targetHours: Math.round(weeklyHourTarget * PHASE_HOUR_FACTOR[block.phase] * 10) / 10,
    });
  }
  return out;
}

/** Vind het blok waar een datum in valt (of null). */
export function blockForDate(blocks: SeasonBlock[], date: string): SeasonBlock | null {
  return blocks.find((b) => b.startDate <= date && date <= b.endDate) ?? null;
}
