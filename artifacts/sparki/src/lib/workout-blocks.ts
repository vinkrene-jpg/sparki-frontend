// Werken met gestructureerde trainingen (tijdblokken × zone/vermogen).
// - Tijdlijn: platgeslagen blokken met start/eind in seconden, zodat de
//   navigatie live kan tonen in welk blok je zit en hoe lang nog.
// - Doelvermogen: vertaald vanuit %FTP (of de zone-band) naar echte watts —
//   alleen wanneer een echte FTP bekend is, anders eerlijk alleen de zone.
// - Bibliotheek: een vaste set bekende trainingen (duur + intervallen) met
//   warming-up en cooling-down, die een canonieke WorkoutStructure opleveren.
import type { WorkoutBlock, WorkoutStructure } from "@/lib/athlete-types"

export type TimelineSegment = {
  block: WorkoutBlock
  index: number
  startSec: number
  endSec: number
}

export function buildTimeline(structure: WorkoutStructure): TimelineSegment[] {
  const segs: TimelineSegment[] = []
  let t = 0
  structure.blocks.forEach((block, index) => {
    const dur = Math.max(0, Math.round(block.durationMin * 60))
    segs.push({ block, index, startSec: t, endSec: t + dur })
    t += dur
  })
  return segs
}

export function timelineTotalSec(segs: TimelineSegment[]): number {
  return segs.length > 0 ? segs[segs.length - 1]!.endSec : 0
}

export function segmentAt(
  segs: TimelineSegment[],
  elapsedSec: number,
): TimelineSegment | null {
  for (const s of segs) if (elapsedSec < s.endSec) return s
  return null
}

// Standaard Coggan-zonebanden als fractie van FTP — alleen voor vertaling
// naar een eerlijke wattband wanneer een blok geen expliciet %FTP heeft.
const ZONE_BAND: Record<number, [number, number]> = {
  1: [0.4, 0.55],
  2: [0.56, 0.75],
  3: [0.76, 0.9],
  4: [0.91, 1.05],
  5: [1.06, 1.2],
  6: [1.21, 1.5],
}

export function targetWattsFor(
  block: WorkoutBlock,
  ftp: number | null,
): { low: number; high: number } | null {
  if (!ftp || ftp <= 0) return null
  if (block.targetPctFtp != null) {
    const mid = (block.targetPctFtp / 100) * ftp
    return { low: Math.round(mid * 0.95), high: Math.round(mid * 1.05) }
  }
  const band = ZONE_BAND[block.zone]
  if (!band) return null
  return { low: Math.round(band[0] * ftp), high: Math.round(band[1] * ftp) }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

export const BLOCK_COLORS: Record<WorkoutBlock["kind"], string> = {
  warmup: "#38bdf8",
  interval: "#f97316",
  recovery: "#4ade80",
  steady: "#22d3ee",
  cooldown: "#818cf8",
}

// ── Trainingen zelf samenstellen ─────────────────────────────────────────────

function block(
  kind: WorkoutBlock["kind"],
  label: string,
  durationMin: number,
  zone: number,
  targetPctFtp: number | null = null,
  reps?: number,
): WorkoutBlock {
  return {
    kind,
    label,
    durationMin,
    zone,
    targetPctFtp,
    ...(reps != null ? { reps } : {}),
  }
}

function rationale(
  whyToday: string,
  whatToFeel: string,
): WorkoutStructure["rationale"] {
  return {
    whyToday,
    supportsGoal: "Zelf gekozen training — Sparki bewaakt de belasting mee.",
    whatToFeel,
    tooHardSigns: "Vermogen zakt per herhaling, ademhaling loopt vast, benen verzuren vroeg.",
    tooLightSigns: "Hartslag en ademhaling blijven laag, de blokken voelen als niets.",
    safeAdjust: "Kort de blokken in of laat de laatste herhaling vallen — nooit doortrappen op karakter.",
  }
}

export type WorkoutTemplate = {
  id: string
  title: string
  subtitle: string
  totalMin: number
  structure: WorkoutStructure
}

function totalMin(blocks: WorkoutBlock[]): number {
  return Math.round(blocks.reduce((s, b) => s + b.durationMin, 0))
}

function makeTemplate(
  id: string,
  title: string,
  subtitle: string,
  intensity: string,
  primaryZone: number,
  blocks: WorkoutBlock[],
  why: string,
  feel: string,
): WorkoutTemplate {
  return {
    id,
    title,
    subtitle,
    totalMin: totalMin(blocks),
    structure: {
      phase: "build",
      week: 1,
      intensity,
      primaryZone,
      routeNeed: "outdoor",
      equipment: [],
      blocks,
      recoveryAdvice:
        "Eet binnen een uur na afloop en houd de rest van de dag rustig aan.",
      rationale: rationale(why, feel),
    },
  }
}

function intervalSet(
  reps: number,
  repMin: number,
  recMin: number,
  label: string,
  zone: number,
  pct: number,
): WorkoutBlock[] {
  const out: WorkoutBlock[] = []
  for (let i = 0; i < reps; i++) {
    out.push(block("interval", `${label} ${i + 1}`, repMin, zone, pct, reps))
    if (i < reps - 1) out.push(block("recovery", "Herstel", recMin, 1, null))
  }
  return out
}

// Vaste bibliotheek van bekende intervaltrainingen — altijd met warming-up en
// cooling-down; de totale duur staat erbij zodat de keuze eerlijk en snel is.
export const INTERVAL_TEMPLATES: WorkoutTemplate[] = [
  makeTemplate(
    "vo2_5x3",
    "VO2max 5×3′",
    "5 blokken van 3 min hard (Z5), 3 min rust ertussen",
    "VO2max",
    5,
    [
      block("warmup", "Inrijden", 15, 2, 65),
      ...intervalSet(5, 3, 3, "VO2", 5, 112),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "Korte harde blokken vergroten je maximale zuurstofopname.",
    "De laatste minuut van elk blok is zwaar; ademhaling diep maar controleerbaar.",
  ),
  makeTemplate(
    "drempel_3x10",
    "Drempel 3×10′",
    "3 blokken van 10 min rond je omslagpunt (Z4)",
    "Drempel",
    4,
    [
      block("warmup", "Inrijden", 15, 2, 65),
      ...intervalSet(3, 10, 5, "Drempel", 4, 98),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "Blokken rond je omslagpunt maken je duurvermogen op wedstrijdtempo groter.",
    "Stevig maar vol te houden; praten lukt alleen in korte zinnen.",
  ),
  makeTemplate(
    "drempel_2x20",
    "Drempel 2×20′",
    "2 lange blokken van 20 min net onder je omslagpunt",
    "Drempel",
    4,
    [
      block("warmup", "Inrijden", 15, 2, 65),
      ...intervalSet(2, 20, 8, "Drempel", 4, 95),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "De klassieker voor het opbouwen van drempelvermogen.",
    "Gelijkmatig en geconcentreerd; de tweede helft van elk blok vraagt focus.",
  ),
  makeTemplate(
    "sweetspot_3x12",
    "Sweet spot 3×12′",
    "3 blokken van 12 min stevig tempo (hoog Z3)",
    "Sweet spot",
    3,
    [
      block("warmup", "Inrijden", 12, 2, 65),
      ...intervalSet(3, 12, 5, "Sweet spot", 3, 88),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "Veel trainingseffect voor relatief weinig vermoeidheid.",
    "Stevig maar beheerst; je kunt nog net hele zinnen praten.",
  ),
  makeTemplate(
    "dertig_dertig",
    "30/30 — 2×10 herhalingen",
    "2 series van 10× 30 sec hard / 30 sec rust",
    "VO2max kort",
    5,
    [
      block("warmup", "Inrijden", 15, 2, 65),
      ...intervalSet(10, 0.5, 0.5, "30/30 serie 1", 5, 115),
      block("recovery", "Seriepauze", 5, 1, null),
      ...intervalSet(10, 0.5, 0.5, "30/30 serie 2", 5, 115),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "Korte prikkels stapelen hoog vermogen zonder dat één blok te lang wordt.",
    "Elke 30 sec voluit maar gecontroleerd; de rust is nét genoeg.",
  ),
  makeTemplate(
    "sprints_6x30",
    "Sprints 6×30″",
    "6 sprints van 30 sec met ruime rust",
    "Sprint",
    6,
    [
      block("warmup", "Inrijden", 15, 2, 65),
      ...intervalSet(6, 0.5, 4.5, "Sprint", 6, 150),
      block("cooldown", "Cooling-down", 10, 1, null),
    ],
    "Maximale sprints scherpen je explosiviteit en versnelling aan.",
    "Voluit vanaf de eerste seconde; volledig herstellen tussen de sprints.",
  ),
]

// Duurtraining: één rustige-tempoblok in de gekozen zone, met in- en uitrijden.
export function buildEnduranceTemplate(
  zone: 1 | 2 | 3,
  durationMin: number,
): WorkoutTemplate {
  // Totale bloktijd moet exact gelijk zijn aan de gekozen duur — de renner
  // plant "X minuten" en krijgt X minuten (inrijden + kern + uitrijden).
  const wu = durationMin >= 90 ? 15 : 10
  const cd = 10
  const mid = Math.max(10, durationMin - wu - cd)
  const pct = zone === 1 ? 50 : zone === 2 ? 68 : 82
  const label = zone === 1 ? "Herstelrit" : zone === 2 ? "Duurrit Z2" : "Tempo Z3"
  return makeTemplate(
    `duur_z${zone}_${durationMin}`,
    `${label} · ${Math.round(durationMin / 60 * 10) / 10} u`,
    `${durationMin} min rustig opgebouwd in zone ${zone}`,
    label,
    zone,
    [
      block("warmup", "Inrijden", wu, Math.min(zone, 2) as number, null),
      block("steady", label, mid, zone, pct),
      block("cooldown", "Uitrijden", cd, 1, null),
    ],
    zone === 3
      ? "Tempowerk bouwt je duurvermogen op zonder diepe vermoeidheid."
      : "Rustige duurtraining is de basis onder alles — hier word je zuiniger en sterker.",
    zone === 3
      ? "Stevig doortrappen, maar de ademhaling blijft onder controle."
      : "Comfortabel tempo; je kunt de hele rit een gesprek voeren.",
  )
}
