// Navigatielay-out: verdeel het scherm tussen routekaart en klimkaart.
//
// Wanneer tijdens navigatie een klimkaart (klimprofiel) verschijnt, krimpt de
// routekaart tot exact de resterende ruimte: geen overlap, geen afsnijding,
// geen elementen buiten het scherm. Sluit de klimkaart, dan krijgt de kaart
// de volledige ruimte terug. Alles responsive: geen toestelafhankelijke vaste
// hoogtes — de klimkaart meet zijn eigen hoogte (onLayout) en deze functie
// begrenst die tegen schermformaat, oriëntatie en safe areas.

export type NavLayoutInput = {
  screenWidth: number;
  screenHeight: number;
  topInset: number;
  bottomInset: number;
  /** Gemeten (gewenste) hoogte van de klimkaart; 0 of null = geen klimkaart. */
  climbPanelHeight: number | null;
};

export type NavLayout = {
  landscape: boolean;
  /** Maximale hoogte die de klimkaart mag innemen. */
  climbPanelMaxHeight: number;
  /** Werkelijke hoogte van de klimkaart na begrenzing (0 = niet zichtbaar). */
  climbPanelHeight: number;
  /** Onderrand-offset voor de kaartcontainer: kaart eindigt boven de klimkaart. */
  mapBottomOffset: number;
  /** Hoogte die voor de kaart overblijft (altijd ≥ MIN_MAP_HEIGHT bij een geldig scherm). */
  mapHeight: number;
};

// De kaart moet altijd bruikbaar blijven: positie + eerstvolgende afslag.
export const MIN_MAP_HEIGHT = 160;
// Fractie van de bruikbare hoogte die de klimkaart maximaal mag innemen.
const PANEL_MAX_FRACTION_PORTRAIT = 0.42;
const PANEL_MAX_FRACTION_LANDSCAPE = 0.5;

export function computeNavLayout(i: NavLayoutInput): NavLayout {
  const w = Number.isFinite(i.screenWidth) ? Math.max(0, i.screenWidth) : 0;
  const h = Number.isFinite(i.screenHeight) ? Math.max(0, i.screenHeight) : 0;
  const top = Math.max(0, i.topInset || 0);
  const bottom = Math.max(0, i.bottomInset || 0);
  const landscape = w > h;
  const usable = Math.max(0, h - top - bottom);

  const fraction = landscape
    ? PANEL_MAX_FRACTION_LANDSCAPE
    : PANEL_MAX_FRACTION_PORTRAIT;
  // Dubbele begrenzing: nooit meer dan de fractie én nooit zo groot dat de
  // kaart onder zijn minimum zakt.
  const byFraction = usable * fraction;
  const byMinMap = Math.max(0, usable - MIN_MAP_HEIGHT);
  const climbPanelMaxHeight = Math.floor(Math.max(0, Math.min(byFraction, byMinMap)));

  const wanted =
    i.climbPanelHeight != null && Number.isFinite(i.climbPanelHeight)
      ? Math.max(0, i.climbPanelHeight)
      : 0;
  const climbPanelHeight = Math.min(wanted, climbPanelMaxHeight);

  // De klimkaart staat onderaan, boven de safe area; de kaartcontainer stopt
  // erboven zodat er nooit overlap is.
  const mapBottomOffset = climbPanelHeight > 0 ? climbPanelHeight + bottom : 0;
  const mapHeight = Math.max(0, h - mapBottomOffset);

  return {
    landscape,
    climbPanelMaxHeight,
    climbPanelHeight,
    mapBottomOffset,
    mapHeight,
  };
}
