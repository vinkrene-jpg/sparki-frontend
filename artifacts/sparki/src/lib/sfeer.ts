// Dagelijkse sfeerfoto-rotatie voor de hoofdtabbladen (CommercialShell `sfeer`).
//
// Elke tab heeft een eigen poule met bestaande atmosphere-assets. De keuze is
// deterministisch per LOKALE kalenderdag (nooit toISOString — dat geeft de
// UTC-dag): iedereen ziet dezelfde foto de hele dag, en morgen automatisch de
// volgende. Nieuwe foto's toevoegen = het bestand in public/atmosphere/ zetten
// en hier aan de juiste poule toevoegen — meer is het niet.
//
// Analyse heeft bewust GEEN poule: dat is de witte datapagina zonder foto.

const POOLS = {
  plan: [
    "/atmosphere/training-renster-bos.webp",
    "/atmosphere/training-renster-bocht.webp",
    "/atmosphere/training-renster-heide.webp",
    "/atmosphere/routes-weg-ochtend-mist.webp",
  ],
  rijden: [
    "/atmosphere/routes-weg-zonsondergang.webp",
    "/atmosphere/routes-weg-droge-heuvels.webp",
    "/atmosphere/routes-weg-heuvels-mist.webp",
    "/atmosphere/routes-weg-ochtend-mist.webp",
  ],
  activiteiten: [
    "/atmosphere/training-renner-mistig-bos.webp",
    "/atmosphere/wedstrijd-renner-landschap.webp",
    "/atmosphere/wedstrijd-renster-bergen.webp",
    "/atmosphere/training-renster-heide.webp",
  ],
  ontdekken: [
    "/atmosphere/samen-fietsen-cafe-avond.webp",
    "/atmosphere/samen-fietsen-terras.webp",
    "/atmosphere/samen-groepsrit-peloton.webp",
    "/atmosphere/samen-fietsen-keitjes.webp",
    "/atmosphere/samen-groepsrit-zee.webp",
  ],
  meer: [
    "/atmosphere/samen-koffiestop-zon.webp",
    "/atmosphere/samen-koffiestop-stad.webp",
    "/atmosphere/samen-koffiestop-close.webp",
    "/atmosphere/samen-renner-rust.webp",
  ],
} as const;

export type SfeerTab = keyof typeof POOLS;

// Dagen sinds epoch op basis van de LOKALE kalenderdag.
function localDayNumber(now: Date): number {
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() /
      86_400_000,
  );
}

// Kleine vaste offset per tab zodat niet alle tabs op dezelfde dag "tegelijk
// doorklikken" naar hun eerste foto.
const TAB_OFFSET: Record<SfeerTab, number> = {
  plan: 0,
  rijden: 1,
  activiteiten: 2,
  ontdekken: 3,
  meer: 4,
};

/** De sfeerfoto van vandaag voor dit tabblad. */
export function dagSfeer(tab: SfeerTab, now: Date = new Date()): string {
  const pool = POOLS[tab];
  const idx = (localDayNumber(now) + TAB_OFFSET[tab]) % pool.length;
  return pool[idx]!;
}
