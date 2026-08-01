// MEDIA_UITLEG_01 F1 — centrale motionconfiguratie.
//
// Dit is de ENIGE bron voor animatieduur en easing in de app (architectuur
// F-2/F-3). De waarden zijn bevroren (Object.freeze) en zijn per component
// niet aanpasbaar: componenten gebruiken de CSS-variabelen (--motion-duur-*,
// --motion-easing-*) of deze constanten, nooit eigen getallen.
//
// Categorieën (F-1): verschijnen · drukken · openen · diepte. Meer bestaat
// niet; wat hier niet in past, wordt niet geanimeerd.

export const MOTION = Object.freeze({
  /** Duurklassen in ms (F-2): kort=drukken, normaal=verschijnen/openen,
   *  traag=alleen waar een overgang anders onbegrijpelijk wordt. */
  duur: Object.freeze({ kort: 120, normaal: 240, traag: 400 }),
  /** Eén in-easing en één out-easing voor de hele app (F-3).
   *  Geen stuiter, geen overshoot, geen veereffect. */
  easingIn: "cubic-bezier(0, 0, 0.2, 1)",
  easingUit: "cubic-bezier(0.4, 0, 1, 1)",
  /** Maximaal twee gelijktijdig bewegende elementen in beeld (F-4). */
  maxGelijktijdigBewegend: 2,
} as const);

/**
 * T-2: systeem- en Sparki-instelling werken onafhankelijk; staat één van
 * beide aan, dan is beweging uit (OR — nooit AND).
 */
export function resolveMotionOff(
  systemReducedMotion: boolean,
  sparkiVerminderBeweging: boolean,
): boolean {
  return systemReducedMotion || sparkiVerminderBeweging;
}

/**
 * Zet de centrale uitschakelaar op <html>. CSS in index.css dwingt bij
 * data-motion="off" overal direct de eindtoestand af (T-3): geen snellere
 * animatie, geen andere layout, geen functieverlies.
 */
export function applyMotionAttribute(off: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = off ? "off" : "aan";
}

/**
 * Logging van motionfouten — uitsluitend metadata (foutcode + technisch
 * detail), nooit persoonlijke inhoud (namen, gezondheids- of trainingsdata).
 */
export function logMotionError(code: string, detail?: string): void {
  // Bewust console-niveau: geen netwerkcall, geen persoonlijke context.
  console.warn(`[motion] ${code}${detail ? ` — ${detail}` : ""}`);
}
