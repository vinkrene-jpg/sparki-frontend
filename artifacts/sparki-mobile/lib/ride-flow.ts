// Rit-flow engine: automatische pauze/hervatting en slimme rit-einde-detectie.
//
// Puur en deterministisch — geen React, geen native modules — zodat elk
// scenario (verkeerslicht, koffiestop, GPS-ruis, lopen met de fiets, afdaling,
// sprint, autorit na de finish) als gewone unit-test draait.
//
// Eerlijkheid: beslissingen komen uitsluitend uit ECHTE metingen die de caller
// aanlevert (GPS-snelheid/verplaatsing, richting, en — indien aanwezig —
// cadans/vermogen van gekoppelde sensoren). Eén losse meting is nooit genoeg:
// hervatten en beëindigen vragen allebei meerdere opeenvolgende signalen.

export type RideFlowInput = {
  /** Epoch ms van deze meting (± 1 Hz cadans). */
  t: number;
  /** GPS-snelheid in m/s; null wanneer het toestel er geen levert. */
  speedMps: number | null;
  /** Werkelijke verplaatsing (m) sinds de vorige meting (haversine). */
  movedM: number;
  /** Bewegingsrichting in graden; null wanneer onbekend/stilstand. */
  headingDeg: number | null;
  /** Echte cadans (rpm) van een gekoppelde sensor; null zonder meting. */
  cadence: number | null;
  /** Echt vermogen (W) van een gekoppelde sensor; null zonder meting. */
  watts: number | null;
  /** Afstand (m) tot de geplande finishlocatie; null zonder finish. */
  distToFinishM: number | null;
  /** Index van het laatst vastgelegde trackpunt op dit moment. */
  pointIndex: number;
};

export type RideFlowEvent =
  | { kind: "auto_pause" }
  | { kind: "auto_resume" }
  | {
      kind: "end_suggested";
      confidence: "strong" | "weak";
      /** Laatste waarschijnlijke fietspunt (trackpunt-index). */
      lastBikePointIndex: number;
      /** Epoch ms van dat waarschijnlijke einde. */
      lastBikeTime: number;
      /** Korte, eerlijke redenen (Nederlands) waarop dit oordeel steunt. */
      reasons: string[];
    };

// ---------------------------------------------------------------------------
// Drempels. Bewust géén enkele vaste "autosnelheid"-grens: het einde-oordeel
// combineert duur, acceleratie, sensorstilte, finish-context en afwijking van
// het eigen ritpatroon.
// ---------------------------------------------------------------------------

/** Onder deze snelheid (m/s) geldt een meting als stilstand. */
const STILL_SPEED = 0.8;
/** Verplaatsing (m) per meting die nog als GPS-ruis telt bij stilstand. */
const STILL_MOVE_M = 2.5;
/** Aantal opeenvolgende stilstand-metingen vóór automatische pauze (~5 s). */
const AUTO_PAUSE_TICKS = 5;

/** Ondergrens fietsen (m/s) voor hervatten — boven wandeltempo (~5,4 km/u). */
const RESUME_SPEED = 2.5;
/** Bovengrens plausibel wegfietsen bij hervatten (m/s ≈ 43 km/u): sneller
 * zonder sensoractiviteit lijkt op instappen in een auto, niet op wegfietsen. */
const RESUME_SPEED_MAX = 12;
/** Opeenvolgende fiets-signalen nodig om te hervatten. */
const RESUME_TICKS = 3;
/** Minimale totale verplaatsing (m) over de hervat-reeks. */
const RESUME_MIN_MOVE_M = 12;
/** Cadans (rpm) / vermogen (W) die als echt trapsignaal tellen. */
const SENSOR_CADENCE_MIN = 30;
const SENSOR_WATTS_MIN = 40;

/** Snel (m/s ≈ 40 km/u) — pas verdacht als het lang aanhoudt. */
const FAST_SPEED = 11.1;
/** Zeer snel (m/s ≈ 62 km/u). */
const VERY_FAST_SPEED = 17.2;
/** Extreem (m/s ≈ 87 km/u) — fietsen praktisch uitgesloten. */
const EXTREME_SPEED = 24;
/** Aanhoudend snel: minimale duur (s) vóór het meetelt. Een sprint (<60 s) of
 * korte afdaling valt hier bewust buiten. */
const FAST_SUSTAIN_SEC = 240;
const VERY_FAST_SUSTAIN_SEC = 150;
const EXTREME_SUSTAIN_SEC = 45;
/** Zakt de snelheid hieronder, dan breekt de "auto"-reeks (afdalingen eindigen
 * met remmen/bochten; een auto op de doorgaande weg niet). */
const STREAK_BREAK_SPEED = 7;
/** Binnen deze afstand (m) geldt de finish als gepasseerd. */
const FINISH_NEAR_M = 120;
/** Zo ver (m) voorbij de finish telt "finish duidelijk verlaten". */
const FINISH_LEFT_M = 1000;
/** Score-drempels voor het einde-oordeel. */
const SCORE_STRONG = 5;
const SCORE_WEAK = 3;
/** Herinneringspauze (s) voordat dezelfde suggestie opnieuw mag vuren. */
const SUGGEST_COOLDOWN_SEC = 120;

export type PauseState = "riding" | "auto_paused" | "manual_paused";

export type RideFlowState = {
  pause: PauseState;
  // Reeksen (aantal opeenvolgende metingen).
  stillTicks: number;
  resumeTicks: number;
  resumeMoveM: number;
  resumeHeading: number | null;
  // Autorit-reeks.
  fastSince: number | null; // epoch ms waarop de aanhoudend-snelle reeks begon
  fastStartPointIndex: number;
  fastStartTime: number;
  fastMax: number; // hoogste snelheid binnen de reeks
  fastSensorActive: boolean; // trapsignaal gezien binnen de reeks
  fastPrevSpeed: number | null; // voor acceleratiedetectie
  fastAccel: boolean; // snelle acceleratie naar hoge snelheid gezien
  // Ritpatroon: gemiddelde fietsnelheid tot nu toe (alleen band 1–14 m/s).
  rideSpeedSum: number;
  rideSpeedCount: number;
  // Sensorcontext: is er deze rit ooit een echt trapsignaal geweest?
  sensorSeenInRide: boolean;
  // Finishcontext.
  finishPassed: boolean;
  finishLeft: boolean;
  // Anti-spam voor suggesties.
  lastSuggestAt: number | null;
  lastSuggestConfidence: "strong" | "weak" | null;
};

export function createRideFlowState(): RideFlowState {
  return {
    pause: "riding",
    stillTicks: 0,
    resumeTicks: 0,
    resumeMoveM: 0,
    resumeHeading: null,
    fastSince: null,
    fastStartPointIndex: 0,
    fastStartTime: 0,
    fastMax: 0,
    fastSensorActive: false,
    fastPrevSpeed: null,
    fastAccel: false,
    rideSpeedSum: 0,
    rideSpeedCount: 0,
    sensorSeenInRide: false,
    finishPassed: false,
    finishLeft: false,
    lastSuggestAt: null,
    lastSuggestConfidence: null,
  };
}

/** Handmatige pauze (knop). Reset de hervat-reeks zodat hervatten opnieuw
 * meerdere echte fiets-signalen vraagt. */
export function manualPause(s: RideFlowState): RideFlowState {
  return { ...s, pause: "manual_paused", resumeTicks: 0, resumeMoveM: 0, resumeHeading: null };
}

/** Handmatig hervatten (knop). */
export function manualResume(s: RideFlowState): RideFlowState {
  return { ...s, pause: "riding", stillTicks: 0, resumeTicks: 0, resumeMoveM: 0, resumeHeading: null };
}

function hasPedalSignal(input: RideFlowInput): boolean {
  return (
    (input.cadence != null && input.cadence >= SENSOR_CADENCE_MIN) ||
    (input.watts != null && input.watts >= SENSOR_WATTS_MIN)
  );
}

function headingConsistent(prev: number | null, cur: number | null): boolean {
  // Zonder richtingdata is richting geen tegenargument (nooit fabriceren).
  if (prev == null || cur == null) return true;
  const d = Math.abs(((cur - prev + 540) % 360) - 180);
  return d <= 75;
}

/**
 * Verwerk één meting. Retourneert de nieuwe state plus eventuele gebeurtenissen
 * (automatische pauze, automatische hervatting, einde-suggestie).
 */
export function rideFlowTick(
  s: RideFlowState,
  input: RideFlowInput,
): { state: RideFlowState; events: RideFlowEvent[] } {
  const events: RideFlowEvent[] = [];
  const st: RideFlowState = { ...s };
  const speed = input.speedMps;
  const pedal = hasPedalSignal(input);
  if (pedal) st.sensorSeenInRide = true;

  // Ritpatroon bijhouden (alleen plausibele fietsband, nooit stilstand/auto).
  if (speed != null && speed >= 1 && speed <= 14 && st.pause === "riding") {
    st.rideSpeedSum += speed;
    st.rideSpeedCount += 1;
  }

  // Finishcontext.
  if (input.distToFinishM != null) {
    if (input.distToFinishM <= FINISH_NEAR_M) {
      st.finishPassed = true;
      st.finishLeft = false;
    } else if (st.finishPassed && input.distToFinishM >= FINISH_LEFT_M) {
      st.finishLeft = true;
    }
  }

  const isStill =
    (speed == null || speed < STILL_SPEED) && input.movedM < STILL_MOVE_M && !pedal;

  if (st.pause === "riding") {
    // --- Automatische pauze ---
    st.stillTicks = isStill ? st.stillTicks + 1 : 0;
    if (st.stillTicks >= AUTO_PAUSE_TICKS) {
      st.pause = "auto_paused";
      st.stillTicks = 0;
      st.resumeTicks = 0;
      st.resumeMoveM = 0;
      st.resumeHeading = null;
      // Een pauze breekt elke lopende autorit-reeks.
      st.fastSince = null;
      st.fastSensorActive = false;
      st.fastAccel = false;
      st.fastPrevSpeed = null;
      events.push({ kind: "auto_pause" });
      return { state: st, events };
    }
  } else {
    // --- Automatische hervatting (na automatische én handmatige pauze) ---
    const speedOk =
      speed != null && speed >= RESUME_SPEED && speed <= RESUME_SPEED_MAX;
    const cyclingSignal = (speedOk && input.movedM >= STILL_MOVE_M) || pedal;
    if (cyclingSignal && headingConsistent(st.resumeHeading, input.headingDeg)) {
      st.resumeTicks += 1;
      st.resumeMoveM += input.movedM;
      if (input.headingDeg != null) st.resumeHeading = input.headingDeg;
    } else {
      st.resumeTicks = 0;
      st.resumeMoveM = 0;
      st.resumeHeading = null;
    }
    if (
      st.resumeTicks >= RESUME_TICKS &&
      (st.resumeMoveM >= RESUME_MIN_MOVE_M || pedal)
    ) {
      st.pause = "riding";
      st.stillTicks = 0;
      st.resumeTicks = 0;
      st.resumeMoveM = 0;
      st.resumeHeading = null;
      events.push({ kind: "auto_resume" });
    }
  }

  // --- Autorit / rit-einde-detectie ---
  // Loopt ook door tijdens pauze: wie na de finish stopt en dan instapt,
  // beweegt daarna snel zónder trapsignaal — dat mag nooit "hervatten" worden
  // (de hervat-band hierboven sluit >43 km/u zonder sensor al uit) en moet
  // juist een einde-suggestie opleveren.
  if (speed != null) {
    const inFastBand = speed >= FAST_SPEED && !pedal;
    if (inFastBand) {
      if (st.fastSince == null) {
        st.fastSince = input.t;
        st.fastStartPointIndex = Math.max(0, input.pointIndex);
        st.fastStartTime = input.t;
        st.fastMax = speed;
        st.fastSensorActive = false;
        st.fastAccel = false;
      }
      st.fastMax = Math.max(st.fastMax, speed);
      if (
        st.fastPrevSpeed != null &&
        speed - st.fastPrevSpeed >= 3 &&
        speed >= VERY_FAST_SPEED
      ) {
        // Snelle acceleratie náár hoge snelheid — past bij een motorvoertuig.
        st.fastAccel = true;
      }
      if (pedal) st.fastSensorActive = true;
    } else if (speed < STREAK_BREAK_SPEED || pedal) {
      // Afremmen/bocht of echt trapsignaal: geen doorgaande autorit.
      st.fastSince = null;
      st.fastAccel = false;
    }
    st.fastPrevSpeed = speed;

    if (st.fastSince != null) {
      const sustainSec = (input.t - st.fastSince) / 1000;
      const reasons: string[] = [];
      let score = 0;
      if (st.fastMax >= EXTREME_SPEED && sustainSec >= EXTREME_SUSTAIN_SEC) {
        score += 4;
        reasons.push("snelheid die bij een motorvoertuig past");
      }
      if (st.fastMax >= VERY_FAST_SPEED && sustainSec >= VERY_FAST_SUSTAIN_SEC) {
        score += 3;
        reasons.push("langdurig zeer hoge snelheid");
      } else if (sustainSec >= FAST_SUSTAIN_SEC) {
        score += 2;
        reasons.push("langdurig aanhoudende hoge snelheid");
      }
      if (st.fastAccel) {
        score += 1;
        reasons.push("snelle acceleratie naar hoge snelheid");
      }
      if (st.sensorSeenInRide && !st.fastSensorActive && sustainSec >= 60) {
        score += 2;
        reasons.push("geen trapsignaal van je sensoren meer");
      }
      if (st.finishPassed && st.finishLeft) {
        score += 2;
        reasons.push("finishlocatie gepasseerd en duidelijk verlaten");
      }
      const rideAvg =
        st.rideSpeedCount >= 60 ? st.rideSpeedSum / st.rideSpeedCount : null;
      if (rideAvg != null && st.fastMax >= rideAvg * 2 && sustainSec >= 120) {
        score += 1;
        reasons.push("bewegingspatroon wijkt sterk af van je rit");
      }

      const confidence: "strong" | "weak" | null =
        score >= SCORE_STRONG ? "strong" : score >= SCORE_WEAK ? "weak" : null;
      if (confidence) {
        const cooledDown =
          st.lastSuggestAt == null ||
          (input.t - st.lastSuggestAt) / 1000 >= SUGGEST_COOLDOWN_SEC ||
          (confidence === "strong" && st.lastSuggestConfidence !== "strong");
        if (cooledDown) {
          st.lastSuggestAt = input.t;
          st.lastSuggestConfidence = confidence;
          events.push({
            kind: "end_suggested",
            confidence,
            lastBikePointIndex: st.fastStartPointIndex,
            lastBikeTime: st.fastStartTime,
            reasons,
          });
        }
      }
    }
  }

  return { state: st, events };
}
