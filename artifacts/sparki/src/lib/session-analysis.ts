// Pure, deterministic read of a single executed training. Everything here
// derives from REAL session data (power/IF/TSS/feel/duration) combined with the
// athlete's FTP and their other rides — nothing is fabricated. When a value
// can't be known the analysis stays honestly silent and `missing` explains what
// would unlock a deeper read. Neutral voice: it states the conclusion, never
// "Sparki ziet…".
import type { TrainingSession, AthleteProfile } from "@/lib/athlete-types"

export type InsightTone = "neutral" | "positive" | "caution"

export type SessionInsight = {
  tone: InsightTone
  label: string
  text: string
}

export type SessionAnalysis = {
  insights: SessionInsight[]
  /** Plain-Dutch note on what would unlock a deeper read, or null. */
  missing: string | null
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function durLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return m > 0 ? `${h} u ${m} min` : `${h} u`
  return `${m} min`
}

// Intensity Factor for the ride: prefer the stored value, else derive it from
// normalized/average power against the athlete's FTP. Null when unknowable.
function computeIF(s: TrainingSession, ftp: number | null): number | null {
  const stored = toNum(s.intensityFactor)
  if (stored != null && stored > 0 && stored < 2) return stored
  if (ftp && ftp > 0) {
    const p = s.normalizedPower ?? s.avgPower
    if (p != null && p > 0) return p / ftp
  }
  return null
}

const IF_BANDS = [
  { max: 0.55, zone: "herstel", desc: "rustig en bewust licht — ruimte om te herstellen" },
  { max: 0.75, zone: "duur", desc: "je aerobe duurzone — de basis waarop je conditie groeit" },
  { max: 0.85, zone: "tempo", desc: "stevig tempo, net onder je drempel — goed voor je duurvermogen" },
  { max: 0.95, zone: "drempel", desc: "rond je drempel — dit tilt je FTP en je vermogen om lang stevig door te rijden" },
  { max: 1.05, zone: "VO2max", desc: "rond en boven je drempel — hier groeit je topvermogen" },
  { max: 99, zone: "explosief", desc: "ver boven je drempel — kort en explosief, veel anaerobe belasting" },
] as const

function ifBand(ifv: number) {
  return IF_BANDS.find((b) => ifv <= b.max) ?? IF_BANDS[IF_BANDS.length - 1]
}

/**
 * Analyse one executed session. `peers` are the athlete's other recent rides,
 * used only to put this ride's load in context (median TSS). Pure + honest.
 */
export function analyzeSession(
  session: TrainingSession,
  profile: AthleteProfile | null | undefined,
  peers: TrainingSession[] = [],
): SessionAnalysis {
  const insights: SessionInsight[] = []
  const ftp = profile?.ftp ?? null
  const ifv = computeIF(session, ftp)

  // 1. Zwaarte / trainingszone of the ride.
  if (ifv != null) {
    const band = ifBand(ifv)
    insights.push({
      tone: "neutral",
      label: "Zwaarte",
      text: `Intensiteit (IF) ${ifv.toFixed(2)} — ${band.desc}.`,
    })
  }

  // 2. Belasting (TSS) against the athlete's own typical ride. The comparison
  // is only honest with enough comparable history; below that we say so plainly
  // instead of fabricating a reference (`loadNeedsHistory`).
  let loadNeedsHistory = false
  const tss = session.tss
  if (tss != null) {
    const peerTss = peers
      .filter((p) => p.id !== session.id && p.tss != null)
      .map((p) => p.tss as number)
    const med = median(peerTss)
    if (med != null && med > 0 && peerTss.length >= 3) {
      const ratio = tss / med
      const ref = Math.round(med)
      if (ratio >= 1.25) {
        insights.push({
          tone: "neutral",
          label: "Belasting",
          text: `Met ${tss} TSS was dit een zwaardere rit dan je doorsnee (±${ref} TSS).`,
        })
      } else if (ratio <= 0.75) {
        insights.push({
          tone: "neutral",
          label: "Belasting",
          text: `Met ${tss} TSS was dit lichter dan je doorsnee rit (±${ref} TSS).`,
        })
      } else {
        insights.push({
          tone: "neutral",
          label: "Belasting",
          text: `Met ${tss} TSS lag deze rit rond je gebruikelijke belasting (±${ref} TSS).`,
        })
      }
    } else {
      // Not enough comparable rides yet — be honest, never fabricate a reference.
      loadNeedsHistory = true
    }
  }

  // 3. Lange duurrit?
  const dur = session.durationMin
  if (dur != null && dur >= 150) {
    insights.push({
      tone: "neutral",
      label: "Duur",
      text: `Met ${durLabel(dur)} in het zadel was dit een lange duurrit — goed voor je uithoudingsvermogen en vetverbranding.`,
    })
  }

  // 4. Gevoel tegenover de inspanning.
  const feel = session.feelScore
  if (feel != null) {
    if (ifv != null) {
      if (feel <= 2 && ifv < 0.7) {
        insights.push({
          tone: "caution",
          label: "Gevoel",
          text: "Het voelde zwaar terwijl de inspanning licht was — dat kan op vermoeidheid of onvoldoende herstel wijzen.",
        })
      } else if (feel >= 4 && ifv >= 0.9) {
        insights.push({
          tone: "positive",
          label: "Gevoel",
          text: "Een zware inspanning die toch goed voelde — een teken van sterke vorm.",
        })
      } else if (feel <= 2 && ifv >= 0.9) {
        insights.push({
          tone: "neutral",
          label: "Gevoel",
          text: "Het voelde zwaar, passend bij de hoge intensiteit van deze rit.",
        })
      }
    } else if (feel <= 2) {
      insights.push({
        tone: "caution",
        label: "Gevoel",
        text: "Deze rit voelde zwaar. Let de komende dagen op je herstel.",
      })
    } else if (feel >= 4) {
      insights.push({
        tone: "positive",
        label: "Gevoel",
        text: "Deze rit voelde goed — je vorm zit lekker.",
      })
    }
  }

  // Honest gap: what would unlock a deeper read. The trainingszone gap (no
  // intensity/FTP) is the most fundamental, so it takes priority; once the zone
  // is readable, the next honest gap is too little history to compare load.
  let missing: string | null = null
  if (ifv == null) {
    missing = ftp
      ? "Zonder vermogens- of intensiteitsdata kan de trainingszone van deze rit niet bepaald worden."
      : "Vul je FTP in en koppel een vermogensmeter, dan worden de zwaarte en trainingszone van je ritten leesbaar."
  } else if (loadNeedsHistory) {
    missing =
      "Er zijn nog te weinig vergelijkbare ritten om de belasting van deze rit tegen je gemiddelde af te zetten. Log een paar ritten meer, dan wordt die vergelijking zichtbaar."
  }

  return { insights, missing }
}
