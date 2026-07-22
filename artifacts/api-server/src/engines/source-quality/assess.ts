// Pure assessment of the source-quality register. No DB access, no clock reads
// — everything comes in via SourceQualityInput so this is fully unit-testable.
//
// Honesty rules enforced here:
// - "goed" is only earned by fresh, sufficiently complete, real data.
// - A domain without any real data is "ontbreekt" (never a guessed value).
// - A connector in error state marks its sourced domains "onbetrouwbaar".
// - valid === true only for "goed" or "matig"; analyses must not conclude
//   anything from an invalid source.

import type {
  SensorStatus,
  SourceKey,
  SourceOrigin,
  SourceQuality,
  SourceQualityInput,
  SourceReliability,
} from "./types";

const LABEL: Record<SourceKey, string> = {
  profiel: "Profiel",
  doelen: "Doelen",
  trainingen: "Trainingen & historie",
  wedstrijden: "Wedstrijden",
  vermogen: "Vermogen",
  hartslag: "Hartslag",
  cadans: "Cadans",
  herstel: "Herstel (HRV/rusthartslag)",
  slaap: "Slaap",
  voeding: "Voeding & hydratatie",
  mentaal: "Gevoel & mentaal",
  materiaal: "Materiaal",
  trainer_club: "Trainer & club",
  omstandigheden: "Omstandigheden (weer/locatie)",
};

function daysBetween(a: string, b: string): number {
  return Math.round(
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function make(
  source: SourceKey,
  fields: {
    origin: SourceOrigin;
    lastMeasuredAt: string | null;
    completeness: number;
    reliability: SourceReliability;
    sensorStatus: SensorStatus;
    reason: string | null;
  },
): SourceQuality {
  const valid =
    fields.reliability === "goed" || fields.reliability === "matig";
  return {
    source,
    label: LABEL[source],
    origin: fields.origin,
    lastMeasuredAt: fields.lastMeasuredAt,
    completeness: clamp01(fields.completeness),
    reliability: fields.reliability,
    sensorStatus: fields.sensorStatus,
    valid,
    reason: valid ? fields.reason : (fields.reason ?? "geen gegevens"),
  };
}

// Shared helper for the three ride-sensor channels (vermogen/hartslag/cadans):
// data quality is judged on sessions that actually carry the channel, sensor
// status on real pairings/connections — never on intentions.
function sensorChannel(
  source: SourceKey,
  input: SourceQualityInput,
  opts: {
    has: (s: SourceQualityInput["sessions"][number]) => boolean;
    sensorPaired: boolean;
    noDataReason: string;
  },
): SourceQuality {
  const withChannel = input.sessions.filter(opts.has);
  const connectorError = input.connectors.some((c) => c.status === "error");
  // Honesty: "actief" requires real proof — a genuinely paired sensor or
  // actual channel data in recent rides. A merely-connected platform proves
  // nothing about this specific sensor and must NOT read as active.
  const sensorStatus: SensorStatus = opts.sensorPaired
    ? "actief"
    : connectorError
      ? "storing"
      : withChannel.length > 0
        ? "actief"
        : "niet_gekoppeld";

  if (withChannel.length === 0) {
    return make(source, {
      origin: null,
      lastMeasuredAt: null,
      completeness: 0,
      reliability: "ontbreekt",
      sensorStatus,
      reason: opts.noDataReason,
    });
  }
  const newest = withChannel[0]!.date;
  const age = daysBetween(newest, input.today);
  const completeness = withChannel.length / Math.max(1, input.sessions.length);
  const reliability: SourceReliability = connectorError
    ? "onbetrouwbaar"
    : age > 14
      ? "matig"
      : completeness >= 0.5 && withChannel.length >= 3
        ? "goed"
        : "matig";
  return make(source, {
    origin: "meting",
    lastMeasuredAt: newest,
    completeness,
    reliability,
    sensorStatus,
    reason:
      reliability === "onbetrouwbaar"
        ? "een gekoppeld platform meldt een storing; metingen zijn nu niet te vertrouwen"
        : reliability === "matig"
          ? age > 14
            ? `laatste meting is ${age} dagen oud`
            : "nog weinig ritten met deze meting"
          : null,
  });
}

// Daily-metric channels (herstel/slaap/mentaal): completeness over the window,
// freshness decides goed vs matig.
function dailyChannel(
  source: SourceKey,
  input: SourceQualityInput,
  opts: {
    value: (m: SourceQualityInput["metrics"][number]) => number | null;
    origin: SourceOrigin;
    noDataReason: string;
    minPoints?: number;
  },
): SourceQuality {
  const rows = input.metrics.filter((m) => opts.value(m) != null);
  if (rows.length === 0) {
    return make(source, {
      origin: null,
      lastMeasuredAt: null,
      completeness: 0,
      reliability: "ontbreekt",
      sensorStatus: "nvt",
      reason: opts.noDataReason,
    });
  }
  const newest = rows[0]!.date;
  const age = daysBetween(newest, input.today);
  const completeness = rows.length / Math.max(1, input.windowDays);
  const minPoints = opts.minPoints ?? 3;
  const reliability: SourceReliability =
    age > 7
      ? "matig"
      : rows.length >= minPoints
        ? "goed"
        : "matig";
  return make(source, {
    origin: opts.origin,
    lastMeasuredAt: newest,
    completeness,
    reliability,
    sensorStatus: "nvt",
    reason:
      reliability === "matig"
        ? age > 7
          ? `laatste waarde is ${age} dagen oud`
          : "te weinig dagen om een betrouwbaar beeld te vormen"
        : null,
  });
}

/** Assess every source. Deterministic and side-effect free. */
export function assessSources(input: SourceQualityInput): SourceQuality[] {
  const out: SourceQuality[] = [];
  const p = input.profile;

  // Profiel — completeness over the fields analyses genuinely lean on.
  {
    const fields = [p.ftp, p.weightKg, p.birthDate, p.weeklyHours, p.sport];
    const present = fields.filter((f) => f != null).length;
    if (!p.exists) {
      out.push(
        make("profiel", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "geen profiel aangemaakt",
        }),
      );
    } else {
      const completeness = present / fields.length;
      out.push(
        make("profiel", {
          origin: "invoer",
          lastMeasuredAt: p.updatedAt,
          completeness,
          reliability: completeness >= 0.8 ? "goed" : "matig",
          sensorStatus: "nvt",
          reason:
            completeness >= 0.8
              ? null
              : "profiel is niet volledig ingevuld",
        }),
      );
    }
  }

  // Doelen — a development goal and/or planned races.
  {
    const hasGoal = !!p.developmentGoal;
    const hasRaces = input.upcomingRaceCount > 0;
    if (!hasGoal && !hasRaces) {
      out.push(
        make("doelen", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "geen doel of aankomende wedstrijd vastgelegd",
        }),
      );
    } else {
      out.push(
        make("doelen", {
          origin: "invoer",
          lastMeasuredAt: null,
          completeness: hasGoal && hasRaces ? 1 : 0.5,
          reliability: hasGoal ? "goed" : "matig",
          sensorStatus: "nvt",
          reason: hasGoal ? null : "alleen wedstrijden bekend, geen doel",
        }),
      );
    }
  }

  // Trainingen & historie.
  {
    if (input.sessions.length === 0) {
      out.push(
        make("trainingen", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "nog geen ritten vastgelegd",
        }),
      );
    } else {
      const newest = input.sessions[0]!.date;
      const age = daysBetween(newest, input.today);
      const withTss = input.sessions.filter((s) => s.hasTss).length;
      const completeness = withTss / input.sessions.length;
      out.push(
        make("trainingen", {
          origin: input.sessions.some((s) => s.source && s.source !== "manual")
            ? "koppeling"
            : "invoer",
          lastMeasuredAt: newest,
          completeness,
          reliability:
            age > 14 ? "matig" : input.sessions.length >= 3 ? "goed" : "matig",
          sensorStatus: "nvt",
          reason:
            age > 14
              ? `laatste rit is ${age} dagen geleden`
              : input.sessions.length < 3
                ? "nog weinig ritten in het venster"
                : null,
        }),
      );
    }
  }

  // Wedstrijden.
  out.push(
    input.upcomingRaceCount > 0
      ? make("wedstrijden", {
          origin: "invoer",
          lastMeasuredAt: null,
          completeness: 1,
          reliability: "goed",
          sensorStatus: "nvt",
          reason: null,
        })
      : make("wedstrijden", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "geen aankomende wedstrijden ingepland",
        }),
  );

  // Ride-sensor channels.
  out.push(
    sensorChannel("vermogen", input, {
      has: (s) => s.hasPower,
      sensorPaired: input.sensors.power,
      noDataReason: "geen vermogensmeting aanwezig (geen meter of invoer)",
    }),
  );
  out.push(
    sensorChannel("hartslag", input, {
      has: (s) => s.hasHeartRate,
      sensorPaired: input.sensors.heartRate,
      noDataReason: "geen hartslagmeting aanwezig (geen band of invoer)",
    }),
  );
  out.push(
    sensorChannel("cadans", input, {
      has: (s) => s.hasCadence,
      sensorPaired: input.sensors.cadence,
      noDataReason: "geen cadansmeting aanwezig (geen sensor of invoer)",
    }),
  );

  // Herstel = HRV / rusthartslag readings.
  out.push(
    dailyChannel("herstel", input, {
      value: (m) => m.hrv ?? m.restingHR,
      origin: "meting",
      noDataReason: "geen HRV- of rusthartslagmetingen vastgelegd",
    }),
  );

  // Slaap.
  out.push(
    dailyChannel("slaap", input, {
      value: (m) => m.sleepHours,
      origin: "invoer",
      noDataReason: "geen slaap vastgelegd",
    }),
  );

  // Voeding.
  {
    const dates = [...input.nutritionLogDates].sort().reverse();
    if (dates.length === 0) {
      out.push(
        make("voeding", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "geen voeding of hydratatie vastgelegd",
        }),
      );
    } else {
      const age = daysBetween(dates[0]!, input.today);
      out.push(
        make("voeding", {
          origin: "invoer",
          lastMeasuredAt: dates[0]!,
          completeness: dates.length / Math.max(1, input.windowDays),
          reliability: age > 7 ? "matig" : dates.length >= 3 ? "goed" : "matig",
          sensorStatus: "nvt",
          reason:
            age > 7
              ? `laatste log is ${age} dagen oud`
              : dates.length < 3
                ? "te weinig logs voor een patroon"
                : null,
        }),
      );
    }
  }

  // Mentaal = subjective feel/fatigue plus workout feedback.
  {
    const subj = input.metrics.filter(
      (m) => m.feelScore != null || m.fatigueScore != null,
    );
    const total = subj.length + input.feedbackCount;
    if (total === 0) {
      out.push(
        make("mentaal", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "nvt",
          reason: "geen gevoel, vermoeidheid of trainingsreacties vastgelegd",
        }),
      );
    } else {
      const newest = subj[0]?.date ?? null;
      const age = newest ? daysBetween(newest, input.today) : null;
      out.push(
        make("mentaal", {
          origin: "invoer",
          lastMeasuredAt: newest,
          completeness: Math.min(1, total / Math.max(1, input.windowDays)),
          reliability:
            age != null && age <= 7 && total >= 3 ? "goed" : "matig",
          sensorStatus: "nvt",
          reason:
            age != null && age <= 7 && total >= 3
              ? null
              : "weinig of verouderde signalen over gevoel",
        }),
      );
    }
  }

  // Materiaal.
  out.push(
    input.garageBikeCount > 0
      ? make("materiaal", {
          origin: "invoer",
          lastMeasuredAt: null,
          completeness: 1,
          reliability: "goed",
          sensorStatus:
            input.sensors.power || input.sensors.heartRate || input.sensors.cadence
              ? "actief"
              : "nvt",
          reason: null,
        })
      : make("materiaal", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "niet_gekoppeld",
          reason: "geen fiets of materiaal vastgelegd",
        }),
  );

  // Trainer & club.
  out.push(
    input.hasActiveCoachLink
      ? make("trainer_club", {
          origin: "koppeling",
          lastMeasuredAt: null,
          completeness: 1,
          reliability: "goed",
          sensorStatus: "actief",
          reason: null,
        })
      : make("trainer_club", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "niet_gekoppeld",
          reason: "geen trainer of club gekoppeld",
        }),
  );

  // Omstandigheden — real weather needs a saved home location.
  out.push(
    p.homeLat != null && p.homeLon != null
      ? make("omstandigheden", {
          origin: "koppeling",
          lastMeasuredAt: input.today,
          completeness: 1,
          reliability: "goed",
          sensorStatus: "actief",
          reason: null,
        })
      : make("omstandigheden", {
          origin: null,
          lastMeasuredAt: null,
          completeness: 0,
          reliability: "ontbreekt",
          sensorStatus: "niet_gekoppeld",
          reason: "geen thuislocatie ingesteld; weer kan niet worden opgehaald",
        }),
  );

  return out;
}
