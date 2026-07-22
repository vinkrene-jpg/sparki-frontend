// Val-detectie — pure toestandsmachine, los van React zodat hij testbaar is.
//
// Zelfde eerlijke regels als in de Sparki-webnavigatie:
// - eerst ≥ 20 km/u gereden,
// - daarna binnen 30 s abrupt < 3 km/u,
// - en dat 15 s lang stil → vraag "Alles oké?".
// De 30 s-toets geldt alleen op het MOMENT dat de stilstand begint; daarna
// telt de stilstand gewoon door (anders mist hij een val die net na de
// laatste snelle meting begon). Na "Ik ben oké" volgt 5 minuten rust.

export const FAST_KMH = 20;
export const STILL_KMH = 3;
export const FAST_WINDOW_MS = 30_000;
export const STILL_TRIGGER_MS = 15_000;
export const SNOOZE_MS = 5 * 60 * 1000;
export const COUNTDOWN_SECONDS = 30;

export type FallDetectorState = {
  lastFastAt: number | null;
  stillSince: number | null;
  snoozeUntil: number;
};

export function initialFallState(): FallDetectorState {
  return { lastFastAt: null, stillSince: null, snoozeUntil: 0 };
}

/**
 * Verwerk één snelheidsmeting. Geeft de nieuwe toestand terug plus of het
 * "Alles oké?"-scherm nu moet verschijnen. `alertActive` voorkomt een tweede
 * trigger terwijl de vraag al open staat.
 */
export function feedSpeed(
  state: FallDetectorState,
  speedKmh: number,
  now: number,
  alertActive: boolean,
): { state: FallDetectorState; trigger: boolean } {
  if (speedKmh >= FAST_KMH) {
    return {
      state: { ...state, lastFastAt: now, stillSince: null },
      trigger: false,
    };
  }
  if (speedKmh < STILL_KMH) {
    if (state.stillSince == null) {
      const wasFast =
        state.lastFastAt != null && now - state.lastFastAt < FAST_WINDOW_MS;
      return {
        state: wasFast ? { ...state, stillSince: now } : state,
        trigger: false,
      };
    }
    const trigger =
      now - state.stillSince >= STILL_TRIGGER_MS &&
      !alertActive &&
      now > state.snoozeUntil;
    return { state, trigger };
  }
  // Gewoon (langzaam) rijden: stilstand-teller resetten.
  return { state: { ...state, stillSince: null }, trigger: false };
}

/** "Ik ben oké": 5 minuten geen nieuwe vraag, tellers gereset. */
export function dismissFall(
  state: FallDetectorState,
  now: number,
): FallDetectorState {
  return { lastFastAt: null, stillSince: null, snoozeUntil: now + SNOOZE_MS };
}
