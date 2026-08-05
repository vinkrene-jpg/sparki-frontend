// Workoutbouwer (585) — gestructureerde stappen op een coachtraining, plus
// export naar .zwo (Zwift) en .fit (Garmin/Wahoo-workoutbestand).
//
// Eerlijkheidsregels:
// - Vermogensdoelen zijn ALTIJD %FTP-bereiken — we verzinnen nooit watts voor
//   een sporter zonder (bekende) FTP; het hoofdrekenwerk gebeurt op het device
//   van de sporter met diens eigen FTP-instelling.
// - Stappen zonder vermogensdoel (RPE of vrij) worden in .zwo een FreeRide en
//   in .fit een open-doel-stap — nooit een verzonnen vermogensband.
// - Export is een DOWNLOAD; we claimen nergens automatische Garmin-push.
//
// De .fit-generator is afhankelijkheidsvrij (zelfde stijl als fit-parse.ts) en
// schrijft het gedocumenteerde workout-protocol: header → file_id → workout →
// workout_step-berichten → CRC-16.

export type BuilderStep = {
  /** warmup | werk | herstel | cooldown | vrij */
  soort: "warmup" | "werk" | "herstel" | "cooldown" | "vrij";
  naam?: string | null;
  duurMin: number;
  /** Vermogensdoel als %FTP-bereik (beide of geen van beide). */
  ftpLowPct?: number | null;
  ftpHighPct?: number | null;
  /** Gevoelsdoel 1–10 wanneer er géén vermogensdoel is. */
  rpe?: number | null;
  /** Alleen op "werk": herhaal dit blok n× met rust ertussen. */
  herhaal?: number | null;
  rustMin?: number | null;
  rustFtpPct?: number | null;
};

const SOORTEN = new Set(["warmup", "werk", "herstel", "cooldown", "vrij"]);

export function parseBuilderSteps(
  raw: unknown,
): { ok: true; steps: BuilderStep[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, steps: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Stappen moeten een lijst zijn" };
  if (raw.length > 30) return { ok: false, error: "Maximaal 30 stappen" };
  const steps: BuilderStep[] = [];
  let totalMin = 0;
  for (const item of raw) {
    if (typeof item !== "object" || item == null)
      return { ok: false, error: "Ongeldige stap" };
    const s = item as Record<string, unknown>;
    const soort = String(s.soort ?? "");
    if (!SOORTEN.has(soort)) return { ok: false, error: "Onbekende stapsoort" };
    const duurMin = Number(s.duurMin);
    if (!Number.isFinite(duurMin) || duurMin < 0.5 || duurMin > 480)
      return { ok: false, error: "Stapduur moet tussen 0,5 en 480 minuten liggen" };
    const low = s.ftpLowPct == null ? null : Number(s.ftpLowPct);
    const high = s.ftpHighPct == null ? null : Number(s.ftpHighPct);
    if ((low == null) !== (high == null))
      return { ok: false, error: "Vermogensdoel vergt onder- én bovengrens (%FTP)" };
    if (low != null && high != null) {
      if (!Number.isFinite(low) || !Number.isFinite(high) || low < 20 || high > 250 || low > high)
        return { ok: false, error: "Vermogensdoel moet 20–250 %FTP zijn, onder ≤ boven" };
    }
    const rpe = s.rpe == null ? null : Number(s.rpe);
    if (rpe != null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10))
      return { ok: false, error: "RPE moet 1–10 zijn" };
    if (rpe != null && low != null)
      return { ok: false, error: "Kies per stap óf een vermogensdoel óf RPE" };
    const herhaal = s.herhaal == null ? null : Number(s.herhaal);
    let rustMin: number | null = null;
    let rustFtpPct: number | null = null;
    if (herhaal != null) {
      if (soort !== "werk") return { ok: false, error: "Herhalen kan alleen op een werkstap" };
      if (!Number.isInteger(herhaal) || herhaal < 2 || herhaal > 30)
        return { ok: false, error: "Herhalingen moeten 2–30 zijn" };
      rustMin = Number(s.rustMin);
      if (!Number.isFinite(rustMin) || rustMin < 0.5 || rustMin > 60)
        return { ok: false, error: "Rustduur per herhaling moet 0,5–60 minuten zijn" };
      rustFtpPct = s.rustFtpPct == null ? null : Number(s.rustFtpPct);
      if (rustFtpPct != null && (!Number.isFinite(rustFtpPct) || rustFtpPct < 20 || rustFtpPct > 100))
        return { ok: false, error: "Rustintensiteit moet 20–100 %FTP zijn" };
    }
    totalMin += duurMin * (herhaal ?? 1) + (rustMin ?? 0) * (herhaal ?? 1);
    steps.push({
      soort: soort as BuilderStep["soort"],
      naam: typeof s.naam === "string" ? s.naam.trim().slice(0, 80) || null : null,
      duurMin,
      ftpLowPct: low,
      ftpHighPct: high,
      rpe,
      herhaal,
      rustMin,
      rustFtpPct,
    });
  }
  if (totalMin > 1440) return { ok: false, error: "Totale duur boven 24 uur" };
  return { ok: true, steps };
}

/** Totale duur in minuten van een stappenlijst (incl. herhalingen en rust). */
export function stepsTotalMin(steps: BuilderStep[]): number {
  return Math.round(
    steps.reduce(
      (sum, s) => sum + s.duurMin * (s.herhaal ?? 1) + (s.rustMin ?? 0) * (s.herhaal ?? 1),
      0,
    ),
  );
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * .zwo-export (Zwift workout XML). Vermogens als FTP-fractie; stappen zonder
 * vermogensdoel worden FreeRide (eerlijk vrij, geen verzonnen band).
 */
export function buildZwo(title: string, description: string | null, steps: BuilderStep[]): string {
  const parts: string[] = [];
  for (const s of steps) {
    const dur = Math.round(s.duurMin * 60);
    const hasPower = s.ftpLowPct != null && s.ftpHighPct != null;
    const low = hasPower ? (s.ftpLowPct! / 100).toFixed(2) : null;
    const high = hasPower ? (s.ftpHighPct! / 100).toFixed(2) : null;
    const mid = hasPower ? ((s.ftpLowPct! + s.ftpHighPct!) / 200).toFixed(2) : null;
    if (s.soort === "werk" && s.herhaal != null && hasPower) {
      const rust = Math.round((s.rustMin ?? 1) * 60);
      const off = ((s.rustFtpPct ?? 50) / 100).toFixed(2);
      parts.push(
        `    <IntervalsT Repeat="${s.herhaal}" OnDuration="${dur}" OffDuration="${rust}" OnPower="${mid}" OffPower="${off}"/>`,
      );
    } else if (!hasPower) {
      const reps = s.herhaal ?? 1;
      for (let i = 0; i < reps; i++) {
        parts.push(`    <FreeRide Duration="${dur}"/>`);
        if (s.rustMin != null && i < reps - 1)
          parts.push(`    <FreeRide Duration="${Math.round(s.rustMin * 60)}"/>`);
      }
    } else if (s.soort === "warmup") {
      parts.push(`    <Warmup Duration="${dur}" PowerLow="${low}" PowerHigh="${high}"/>`);
    } else if (s.soort === "cooldown") {
      parts.push(`    <Cooldown Duration="${dur}" PowerLow="${high}" PowerHigh="${low}"/>`);
    } else {
      parts.push(`    <SteadyState Duration="${dur}" Power="${mid}"/>`);
    }
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<workout_file>`,
    `  <author>Coach-cockpit</author>`,
    `  <name>${xmlEscape(title)}</name>`,
    `  <description>${xmlEscape(description ?? "")}</description>`,
    `  <sportType>bike</sportType>`,
    `  <workout>`,
    ...parts,
    `  </workout>`,
    `</workout_file>`,
    ``,
  ].join("\n");
}

// ── .fit workout-encoder (afhankelijkheidsvrij) ─────────────────────────────

/** FIT CRC-16 (gedocumenteerd algoritme). */
function fitCrc(bytes: Uint8Array, start = 0, end = bytes.length): number {
  const table = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
    0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
  ];
  let crc = 0;
  for (let i = start; i < end; i++) {
    const byte = bytes[i]!;
    let tmp = table[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[byte & 0xf]!;
    tmp = table[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[(byte >> 4) & 0xf]!;
  }
  return crc;
}

class FitWriter {
  private buf: number[] = [];
  u8(v: number) {
    this.buf.push(v & 0xff);
  }
  u16(v: number) {
    this.u8(v);
    this.u8(v >> 8);
  }
  u32(v: number) {
    this.u16(v);
    this.u16(Math.floor(v / 65536));
  }
  str(s: string, len: number) {
    const enc = new TextEncoder().encode(s);
    for (let i = 0; i < len; i++) this.u8(i < enc.length && i < len - 1 ? enc[i]! : 0);
  }
  bytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}

type FitField = { num: number; size: number; baseType: number };

function writeDefinition(w: FitWriter, localType: number, globalNum: number, fields: FitField[]) {
  w.u8(0x40 | localType); // definition record header
  w.u8(0); // reserved
  w.u8(0); // little-endian
  w.u16(globalNum);
  w.u8(fields.length);
  for (const f of fields) {
    w.u8(f.num);
    w.u8(f.size);
    w.u8(f.baseType);
  }
}

const BT = { enum: 0x00, u8: 0x02, u16: 0x84, u32: 0x86, str: 0x07 };

/**
 * Bouw een geldig .fit-workoutbestand. Vermogensdoelen als %FTP (FIT-conventie:
 * waarden 0–1000 = %FTP; ≥1001 = watts+1000 — wij schrijven bewust NOOIT watts).
 * Stappen zonder vermogensdoel krijgen een open doel.
 */
export function buildFitWorkout(title: string, steps: BuilderStep[]): Uint8Array {
  // Vlakke uitrol: herhalingen worden losse stappen (werk/rust n×) — eenvoudig
  // en door elk device begrepen (geen repeat-controlestappen nodig).
  const flat: { naam: string; ms: number; low: number | null; high: number | null; intensity: number }[] = [];
  for (const s of steps) {
    const intensity = s.soort === "warmup" ? 2 : s.soort === "cooldown" ? 3 : s.soort === "herstel" ? 1 : 0;
    const reps = s.herhaal ?? 1;
    for (let i = 0; i < reps; i++) {
      flat.push({
        naam: s.naam ?? s.soort,
        ms: Math.round(s.duurMin * 60 * 1000),
        low: s.ftpLowPct ?? null,
        high: s.ftpHighPct ?? null,
        intensity,
      });
      if (s.herhaal != null && s.rustMin != null && i < reps - 1) {
        flat.push({
          naam: "rust",
          ms: Math.round(s.rustMin * 60 * 1000),
          low: s.rustFtpPct != null ? Math.max(20, s.rustFtpPct - 5) : null,
          high: s.rustFtpPct != null ? Math.min(100, s.rustFtpPct + 5) : null,
          intensity: 1,
        });
      }
    }
  }

  const body = new FitWriter();

  // file_id (global 0): type=5 workout, manufacturer=255 (development).
  writeDefinition(body, 0, 0, [
    { num: 0, size: 1, baseType: BT.enum }, // type
    { num: 1, size: 2, baseType: BT.u16 }, // manufacturer
    { num: 2, size: 2, baseType: BT.u16 }, // product
    { num: 3, size: 4, baseType: 0x8c }, // serial_number (uint32z)
  ]);
  body.u8(0x00);
  body.u8(5);
  body.u16(255);
  body.u16(0);
  body.u32(0);

  // workout (global 26): wkt_name(8 str32), sport(4)=2, num_valid_steps(6).
  writeDefinition(body, 1, 26, [
    { num: 8, size: 32, baseType: BT.str },
    { num: 4, size: 1, baseType: BT.enum },
    { num: 6, size: 2, baseType: BT.u16 },
  ]);
  body.u8(0x01);
  body.str(title, 32);
  body.u8(2); // cycling
  body.u16(flat.length);

  // workout_step (global 27).
  writeDefinition(body, 2, 27, [
    { num: 254, size: 2, baseType: BT.u16 }, // message_index
    { num: 0, size: 16, baseType: BT.str }, // wkt_step_name
    { num: 1, size: 1, baseType: BT.enum }, // duration_type (0=time)
    { num: 2, size: 4, baseType: BT.u32 }, // duration_value (ms)
    { num: 3, size: 1, baseType: BT.enum }, // target_type (4=power, 2=open)
    { num: 4, size: 4, baseType: BT.u32 }, // target_value (0=custom)
    { num: 5, size: 4, baseType: BT.u32 }, // custom_target_value_low
    { num: 6, size: 4, baseType: BT.u32 }, // custom_target_value_high
    { num: 7, size: 1, baseType: BT.enum }, // intensity
  ]);
  flat.forEach((st, i) => {
    body.u8(0x02);
    body.u16(i);
    body.str(st.naam, 16);
    body.u8(0); // time
    body.u32(st.ms);
    if (st.low != null && st.high != null) {
      body.u8(4); // power
      body.u32(0); // custom
      body.u32(Math.round(st.low)); // 0–1000 ⇒ %FTP
      body.u32(Math.round(st.high));
    } else {
      body.u8(2); // open
      body.u32(0);
      body.u32(0xffffffff);
      body.u32(0xffffffff);
    }
    body.u8(st.intensity);
  });

  const data = body.bytes();

  // Header (14 bytes) + data + CRC.
  const header = new FitWriter();
  header.u8(14);
  header.u8(0x10); // protocol 1.0
  header.u16(2140); // profile version
  header.u32(data.length);
  header.str(".FIT", 4);
  const headerBytes = header.bytes().slice(0, 12);
  // .str schreef een nul-terminator over de 4e letter heen — herstel ".FIT".
  headerBytes[8] = 0x2e;
  headerBytes[9] = 0x46;
  headerBytes[10] = 0x49;
  headerBytes[11] = 0x54;
  const headerCrc = fitCrc(headerBytes);

  const out = new Uint8Array(14 + data.length + 2);
  out.set(headerBytes, 0);
  out[12] = headerCrc & 0xff;
  out[13] = (headerCrc >> 8) & 0xff;
  out.set(data, 14);
  const fileCrc = fitCrc(out, 0, 14 + data.length);
  out[14 + data.length] = fileCrc & 0xff;
  out[15 + data.length] = (fileCrc >> 8) & 0xff;
  return out;
}
