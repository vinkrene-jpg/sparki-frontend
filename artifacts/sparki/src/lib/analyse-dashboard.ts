// Analyse-dashboard engine — pure, deterministische reeks- en overlay-bouwers
// voor de /analyse-pagina. Bewust los van React zodat de /you-profielweergave
// (kerngrafieken, summary-modus) exact dezelfde databron-laag hergebruikt en
// er nooit een tweede implementatie ontstaat.
//
// Regels:
// - Alleen echte data in, geen schattingen of mockwaarden. Wat niet berekend
//   kan worden is null of een lege reeks — de UI toont dan een eerlijke lege
//   toestand.
// - Datums zijn "YYYY-MM-DD"-strings; weekindeling gebeurt op lokale dagen
//   (nooit via toISOString — UTC-off-by-one-trap).

// ── Invoertypes (structureel, geen hook-afhankelijkheid) ─────────────────────

export type SessieInput = {
  id: number
  sessionDate: string // YYYY-MM-DD
  durationMin?: number | null
  tss?: number | null
  /** Hartslagbelasting (SPOOR_H) — aparte maat, nooit optellen bij tss. */
  hrLoad?: number | null
}

export type MetricInput = {
  metricDate: string // YYYY-MM-DD
  // Decimal-kolommen komen als string uit de API — beide vormen zijn geldig.
  weightKg?: number | string | null
  sleepHours?: number | string | null
  hrv?: number | string | null
}

/** Coerceer een API-decimal (string of number) naar number, anders null. */
export function alsGetal(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export type FtpTestInput = { ftpWatts: number; measuredAt: string }

export type DoelInput = {
  status: string
  measure: string | null
  targetValue: string | null
  targetDate: string | null
  title: string
}

export type RaceInput = { name: string; raceDate: string; status?: string | null }

export type ConnectorSyncInput = {
  displayName: string
  status: string
  lastSyncAt: string | null
}

// ── Lokale datumhulpen ───────────────────────────────────────────────────────

function lokaleDatum(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`)
}

function isoVan(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dag = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${dag}`
}

/** Maandag van de week waarin `iso` valt (lokale kalender). */
export function weekStartVan(iso: string): string {
  const d = lokaleDatum(iso)
  const dow = (d.getDay() + 6) % 7 // ma=0
  d.setDate(d.getDate() - dow)
  return isoVan(d)
}

// ── Trainingsvolume per week ─────────────────────────────────────────────────

export type WeekVolume = {
  weekStart: string // maandag, YYYY-MM-DD
  label: string // "dd/mm"
  /** Uren; null als geen enkele sessie in de week een duur heeft. */
  uren: number | null
  tss: number | null
  sessies: number
}

/**
 * Volume per week over de laatste `weken` volledige+lopende weken.
 * Weken zonder sessies staan er wél in (uren 0) — een gat is informatie.
 */
export function weekVolumeReeks(
  sessies: SessieInput[],
  todayIso: string,
  weken = 12,
): WeekVolume[] {
  if (weken < 1) return []
  const eindWeek = weekStartVan(todayIso)
  const start = lokaleDatum(eindWeek)
  start.setDate(start.getDate() - 7 * (weken - 1))

  const perWeek = new Map<string, { min: number; minBekend: boolean; tss: number; tssBekend: boolean; n: number }>()
  for (const s of sessies) {
    const ws = weekStartVan(s.sessionDate)
    const rij = perWeek.get(ws) ?? { min: 0, minBekend: false, tss: 0, tssBekend: false, n: 0 }
    rij.n += 1
    if (s.durationMin != null && s.durationMin > 0) {
      rij.min += s.durationMin
      rij.minBekend = true
    }
    if (s.tss != null && s.tss > 0) {
      rij.tss += s.tss
      rij.tssBekend = true
    }
    perWeek.set(ws, rij)
  }

  const uit: WeekVolume[] = []
  const cursor = new Date(start)
  for (let i = 0; i < weken; i++) {
    const ws = isoVan(cursor)
    const rij = perWeek.get(ws)
    uit.push({
      weekStart: ws,
      label: `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      uren: rij ? (rij.minBekend ? Math.round((rij.min / 60) * 10) / 10 : rij.n > 0 ? null : 0) : 0,
      tss: rij?.tssBekend ? Math.round(rij.tss) : null,
      sessies: rij?.n ?? 0,
    })
    cursor.setDate(cursor.getDate() + 7)
  }
  return uit
}

// ── Intensiteitsverdeling ────────────────────────────────────────────────────
// Afgeleid uit werkelijke TSS + duur per sessie (IF = √(TSS / (uur × 100))).
// Deterministisch, geen schatting van ontbrekende sessies: zonder TSS of duur
// telt een sessie als "onbekend".

export type IntensiteitsBucket = {
  key: "rustig" | "stevig" | "hard" | "onbekend"
  label: string
  minuten: number
  aandeel: number // 0..1 van bekende+onbekende minuten? — van totale minuten
}

export function intensiteitsVerdeling(sessies: SessieInput[]): {
  buckets: IntensiteitsBucket[]
  totaalMin: number
  bekendMin: number
} {
  let rustig = 0
  let stevig = 0
  let hard = 0
  let onbekend = 0
  for (const s of sessies) {
    const dur = s.durationMin != null && s.durationMin > 0 ? s.durationMin : null
    if (dur == null) continue // zonder duur geen minuten om te verdelen
    // SPOOR_H: sessies zonder vermogensscore maar mét hartslagbelasting
    // (hrLoad, apart gedefinieerd op dezelfde 0..1-intensiteitsschaal) krijgen
    // hun intensiteit uit die maat — per sessie geldt precies één basis,
    // scores worden nooit vermengd of opgeteld.
    const score = s.tss != null && s.tss > 0 ? s.tss : s.hrLoad != null && s.hrLoad > 0 ? s.hrLoad : null
    if (score == null) {
      onbekend += dur
      continue
    }
    const ifWaarde = Math.sqrt(score / ((dur / 60) * 100))
    if (ifWaarde < 0.75) rustig += dur
    else if (ifWaarde < 0.88) stevig += dur
    else hard += dur
  }
  const totaal = rustig + stevig + hard + onbekend
  const mk = (key: IntensiteitsBucket["key"], label: string, minuten: number): IntensiteitsBucket => ({
    key,
    label,
    minuten,
    aandeel: totaal > 0 ? minuten / totaal : 0,
  })
  return {
    buckets: [
      mk("rustig", "Rustig", rustig),
      mk("stevig", "Stevig", stevig),
      mk("hard", "Hard", hard),
      mk("onbekend", "Onbekend", onbekend),
    ],
    totaalMin: totaal,
    bekendMin: rustig + stevig + hard,
  }
}

// ── Gewicht & W/kg ───────────────────────────────────────────────────────────

export type GewichtPunt = { date: string; kg: number; wkg: number | null }

/**
 * Gewichtsreeks uit dagmetrics; W/kg per punt op basis van de laatst bekende
 * FTP-test op of vóór die datum (anders de profiel-FTP, anders null).
 */
export function gewichtWkgReeks(
  metrics: MetricInput[],
  ftpTests: FtpTestInput[],
  profielFtp: number | null,
): GewichtPunt[] {
  const tests = [...ftpTests].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const punten = metrics
    .map((m) => ({ metricDate: m.metricDate, kg: alsGetal(m.weightKg) }))
    .filter((m): m is { metricDate: string; kg: number } => m.kg != null && m.kg > 0)
    .sort((a, b) => a.metricDate.localeCompare(b.metricDate))
  return punten.map((m) => {
    let ftp: number | null = null
    for (const t of tests) {
      if (t.measuredAt.slice(0, 10) <= m.metricDate) ftp = t.ftpWatts
      else break
    }
    if (ftp == null) ftp = profielFtp
    const kg = m.kg
    return {
      date: m.metricDate,
      kg,
      wkg: ftp != null && ftp > 0 ? Math.round((ftp / kg) * 100) / 100 : null,
    }
  })
}

// ── Doel-overlays ────────────────────────────────────────────────────────────
// Alleen tonen wat de gebruiker echt heeft ingesteld. Parsen gebeurt strikt:
// een doel telt pas als meetlat + numerieke streefwaarde binnen een plausibele
// range herkenbaar zijn; anders géén overlay (kale grafiek).

export type DoelOverlays = {
  streefFtp: number | null
  streefWkg: number | null
  streefGewichtKg: number | null
  raceMarkers: Array<{ date: string; name: string }>
}

function parseNumeriek(v: string | null): number | null {
  if (!v) return null
  const m = v.replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

export function doelOverlays(input: {
  goals: DoelInput[]
  seasonGoalTargetKg: number | null
  races: RaceInput[]
  todayIso: string
}): DoelOverlays {
  let streefFtp: number | null = null
  let streefWkg: number | null = null
  let streefGewichtKg: number | null = null

  for (const g of input.goals) {
    if (g.status !== "active") continue
    const tekst = `${g.measure ?? ""} ${g.title}`.toLowerCase()
    const waarde = parseNumeriek(g.targetValue)
    if (waarde == null) continue
    if (streefWkg == null && /w\s*\/\s*kg|wkg/.test(tekst) && waarde >= 1 && waarde <= 8) {
      streefWkg = waarde
    } else if (streefFtp == null && /\bftp\b|drempelvermogen/.test(tekst) && waarde >= 100 && waarde <= 600) {
      streefFtp = waarde
    } else if (streefGewichtKg == null && /gewicht|\bkg\b/.test(tekst) && waarde >= 30 && waarde <= 150) {
      streefGewichtKg = waarde
    }
  }

  // Streefgewicht uit het voedings-seizoensdoel als er geen expliciet doel is.
  if (streefGewichtKg == null && input.seasonGoalTargetKg != null
      && input.seasonGoalTargetKg >= 30 && input.seasonGoalTargetKg <= 150) {
    streefGewichtKg = input.seasonGoalTargetKg
  }

  const raceMarkers = input.races
    .filter((r) => r.status !== "geannuleerd" && r.raceDate >= input.todayIso)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 3)
    .map((r) => ({ date: r.raceDate, name: r.name }))

  return { streefFtp, streefWkg, streefGewichtKg, raceMarkers }
}

// ── Periodevergelijking ──────────────────────────────────────────────────────

export type VergelijkPunt = { date: string; ctl: number; vorigCtl: number | null }

/**
 * Legt de CTL van de vorige periode van gelijke lengte over de huidige heen
 * (uitgelijnd op index). Vorige reeks null wanneer er onvoldoende historie is.
 */
export function vergelijkReeks(
  chartData: Array<{ date: string; ctl: number }>,
  dagen: number,
): VergelijkPunt[] {
  const huidig = chartData.slice(-dagen)
  const vorig = chartData.slice(-2 * dagen, -dagen)
  return huidig.map((p, i) => ({
    date: p.date,
    ctl: p.ctl,
    vorigCtl: vorig.length === huidig.length ? vorig[i]?.ctl ?? null : null,
  }))
}

// ── Databetrouwbaarheid & laatste synchronisatie ─────────────────────────────

export type Betrouwbaarheid = {
  label: "hoog" | "beperkt" | "laag" | "geen"
  reden: string
}

/** Deterministisch oordeel over de datakwaliteit in het venster. */
export function dataBetrouwbaarheid(
  sessies: SessieInput[],
  todayIso: string,
  dagen = 28,
): Betrouwbaarheid {
  const grens = lokaleDatum(todayIso)
  grens.setDate(grens.getDate() - dagen)
  const grensIso = isoVan(grens)
  const recent = sessies.filter((s) => s.sessionDate >= grensIso && s.sessionDate <= todayIso)
  if (recent.length === 0) {
    return { label: "geen", reden: `Geen sessies in de laatste ${dagen} dagen.` }
  }
  // SPOOR_H basisbewust: één gekozen reeks, nooit mengen — dezelfde regel als
  // het belastingsmodel. Staat er vermogen (tss) in het venster, dan telt
  // alleen vermogen; anders beoordeelt de betrouwbaarheid de hartslagreeks
  // (hrLoad), zodat een HR-only renner niet onterecht "laag" ziet terwijl de
  // belastingsgrafiek diezelfde sessies wél als geldige score gebruikt.
  const metTss = recent.filter((s) => s.tss != null && s.tss > 0).length
  const metHr = recent.filter((s) => s.hrLoad != null && s.hrLoad > 0).length
  const basisHr = metTss === 0 && metHr > 0
  const metScore = basisHr ? metHr : metTss
  const scoreLabel = basisHr ? "belastingsscore op hartslag" : "belastingsscore"
  const dekking = metScore / recent.length
  if (recent.length >= 8 && dekking >= 0.8) {
    return { label: "hoog", reden: `${recent.length} sessies, ${metScore} met ${scoreLabel}.` }
  }
  if (dekking >= 0.5) {
    return { label: "beperkt", reden: `${metScore} van ${recent.length} sessies met ${scoreLabel}.` }
  }
  return { label: "laag", reden: `Slechts ${metScore} van ${recent.length} sessies met ${scoreLabel}.` }
}

export type SyncInfo = { moment: string; bron: string } | null

/** Laatste synchronisatie over alle gekoppelde platformen; null = nooit. */
export function laatsteSync(connectors: ConnectorSyncInput[]): SyncInfo {
  let best: SyncInfo = null
  for (const c of connectors) {
    if (!c.lastSyncAt) continue
    if (!best || c.lastSyncAt > best.moment) best = { moment: c.lastSyncAt, bron: c.displayName }
  }
  return best
}

// ── Doelscenario-projectie (verwachtingsband) ────────────────────────────────
// Deterministische vooruitberekening met hetzelfde CTL/ATL-model (42d/7d) als
// de belastingsgrafiek. Basis = werkelijke gemiddelde dagbelasting (TSS) van de
// afgelopen 28 dagen; zonder echte belastingsscores is er GEEN projectie
// (eerlijk null, nooit een verzonnen basis). De band (±15% rond het scenario)
// maakt expliciet dat dit een verwachting is, geen zekerheid.

export type ProjectiePunt = {
  date: string
  projCtl: number
  projBand: [number, number]
}

export type BelastingProjectie = {
  punten: ProjectiePunt[]
  ctlNu: number
  /** Verwachte fitheid aan het einde: [onderwaarde, bovenwaarde]. */
  ctlEind: [number, number]
  /** Laagste verwachte vorm (TSB) onderweg in het middenscenario. */
  tsbDip: number
  /** Werkelijke basis: gemiddelde belasting per dag over de laatste 28 dagen. */
  basisTssPerDag: number
  dagen: number
}

export function belastingProjectie(input: {
  chartData: Array<{ date: string; ctl: number; atl: number }>
  sessies: Array<{ sessionDate: string; tss?: number | string | null; hrLoad?: number | string | null }>
  /** Volumeverandering in procenten, bv. 20 voor "20% meer". */
  pctVolume: number
  dagen?: number
}): BelastingProjectie | null {
  const dagen = input.dagen ?? 42
  const laatstePunt = input.chartData[input.chartData.length - 1]
  if (!laatstePunt) return null

  // Echte basisbelasting: som van belastingsscores in de 28 dagen t/m de
  // laatste grafiekdag, gedeeld door 28. Geen scores ⇒ geen projectie.
  const eind = laatstePunt.date
  const start = new Date(`${eind}T12:00:00`)
  start.setDate(start.getDate() - 27)
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
  // SPOOR_H basisbewust: exact dezelfde reekskeuze als het belastingsmodel —
  // vermogen (tss) zodra aanwezig in het venster, anders de hartslagreeks
  // (hrLoad). Nooit mengen; anders wijkt de projectie af van de grafiek
  // waarop hij voortbouwt.
  const inVenster = input.sessies.filter((s) => {
    const datum = s.sessionDate.slice(0, 10)
    return datum >= startIso && datum <= eind
  })
  const heeftTss = inVenster.some((s) => (alsGetal(s.tss) ?? 0) > 0)
  let somTss = 0
  let metScore = 0
  for (const s of inVenster) {
    const score = heeftTss ? alsGetal(s.tss) : alsGetal(s.hrLoad)
    if (score == null || score <= 0) continue
    somTss += score
    metScore++
  }
  if (metScore === 0 || somTss <= 0) return null
  const basisTssPerDag = somTss / 28

  const factor = 1 + input.pctVolume / 100
  if (factor < 0) return null

  // Drie simulaties: onder- (–15%), midden- en bovenscenario (+15%).
  const sim = (f: number) => {
    let ctl = laatstePunt.ctl
    let atl = laatstePunt.atl
    const reeks: Array<{ ctl: number; atl: number }> = []
    const dagTss = basisTssPerDag * f
    for (let i = 0; i < dagen; i++) {
      ctl = ctl + (dagTss - ctl) / 42
      atl = atl + (dagTss - atl) / 7
      reeks.push({ ctl, atl })
    }
    return reeks
  }
  const midden = sim(factor)
  const onder = sim(factor * 0.85)
  const boven = sim(factor * 1.15)

  const punten: ProjectiePunt[] = [
    // Startpunt op de laatste echte dag zodat band en lijn aansluiten.
    { date: eind, projCtl: r1(laatstePunt.ctl), projBand: [r1(laatstePunt.ctl), r1(laatstePunt.ctl)] },
  ]
  const cursor = new Date(`${eind}T12:00:00`)
  for (let i = 0; i < dagen; i++) {
    cursor.setDate(cursor.getDate() + 1)
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
    punten.push({
      date: iso,
      projCtl: r1(midden[i].ctl),
      projBand: [r1(Math.min(onder[i].ctl, boven[i].ctl)), r1(Math.max(onder[i].ctl, boven[i].ctl))],
    })
  }

  const tsbDip = Math.min(...midden.map((p) => p.ctl - p.atl))
  return {
    punten,
    ctlNu: Math.round(laatstePunt.ctl),
    ctlEind: [
      Math.round(Math.min(onder[dagen - 1].ctl, boven[dagen - 1].ctl)),
      Math.round(Math.max(onder[dagen - 1].ctl, boven[dagen - 1].ctl)),
    ],
    tsbDip: Math.round(tsbDip),
    basisTssPerDag: Math.round(basisTssPerDag),
    dagen,
  }
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Samenvatting (summary-modus voor /you) ───────────────────────────────────

// ── §7.3 Oordeelregel + aandachtspunten (ANALYSE_UITBREIDING_EN_ZANDBAK_01) ──
// Beide zijn PURE afleidingen over de reeks die de grafiek zelf al toont
// (computeLoadSeries server-side) — géén tweede berekening van belasting of
// vorm, alleen een uitspraak over dezelfde getallen.

export type LoadPunt = { date: string; ctl: number; atl: number; tsb: number }

export type Oordeel = {
  /** De uitspraak — geen getal, wel een zin. */
  zin: string
  /** Klein erbij: waar dat op gebaseerd is (zelfde model als de grafiek). */
  basis: string
}

/** CTL per 7 dagen terug (0, 7, 14, 21 dagen geleden), nieuwste eerst. */
function weekCtls(chartData: LoadPunt[]): number[] {
  const uit: number[] = []
  for (let w = 0; w < 4; w++) {
    const idx = chartData.length - 1 - w * 7
    if (idx < 0) break
    uit.push(chartData[idx]!.ctl)
  }
  return uit
}

/** Aantal opeenvolgende weken (max 3) waarin CTL per week ≥1 punt zakt. */
function dalendeWeken(chartData: LoadPunt[]): number {
  const wk = weekCtls(chartData)
  let n = 0
  for (let i = 0; i + 1 < wk.length; i++) {
    if (wk[i]! <= wk[i + 1]! - 1) n++
    else break
  }
  return n
}

/** Aantal opeenvolgende weken (max 3) waarin CTL per week ≥1 punt stijgt. */
function stijgendeWeken(chartData: LoadPunt[]): number {
  const wk = weekCtls(chartData)
  let n = 0
  for (let i = 0; i + 1 < wk.length; i++) {
    if (wk[i]! >= wk[i + 1]! + 1) n++
    else break
  }
  return n
}

const WEEKWOORD = ["", "een week", "twee weken", "drie weken"] as const

/**
 * Eén oordeelregel bovenaan Overzicht — uit hetzelfde belastingsmodel als de
 * grafiek eronder. Bij te weinig reeks (<14 dagen) eerlijk null: geen oordeel
 * zonder basis.
 */
export function overzichtOordeel(load: {
  chartData: LoadPunt[]
  tsb: number
  ctl: number
  basis?: "vermogen" | "hartslag"
}): Oordeel | null {
  const reeks = load.chartData
  if (reeks.length < 14) return null

  const tsb = load.tsb
  const vorm =
    tsb >= 5 ? "je bent uitgerust" : tsb <= -15 ? "je draagt flinke vermoeidheid mee" : "je vorm is neutraal"

  const dal = dalendeWeken(reeks)
  const stijg = stijgendeWeken(reeks)
  const wk = weekCtls(reeks)
  let fit: string
  if (dal >= 2) fit = `je fitheid zakt al ${WEEKWOORD[Math.min(dal, 3)]}`
  else if (stijg >= 2) fit = `je fitheid bouwt al ${WEEKWOORD[Math.min(stijg, 3)]} op`
  else fit = "je fitheid is stabiel"

  const koppel = (tsb >= 5 && dal >= 2) || (tsb <= -15 && stijg >= 2) ? "maar" : "en"
  const zin = `${vorm[0]!.toUpperCase()}${vorm.slice(1)}, ${koppel} ${fit}.`

  const span = Math.min(wk.length - 1, 3)
  const basisReeks = load.basis === "hartslag" ? "hartslagbelasting" : "vermogensbelasting"
  const basis =
    `Op basis van vorm ${tsb >= 0 ? "+" : ""}${Math.round(tsb)} en fitheid ` +
    `${Math.round(wk[span] ?? load.ctl)} → ${Math.round(load.ctl)} over ${span} ${span === 1 ? "week" : "weken"} — ` +
    `hetzelfde model (${basisReeks}) als de grafiek hieronder.`
  return { zin, basis }
}

export type Aandachtspunt = {
  id: string
  tekst: string
  /** Naam van de kaart waar dit vandaan komt. */
  kaart: string
  /** Tabblad waarop die kaart staat — voor de doorklik. */
  tab: "overzicht" | "belasting" | "progressie" | "doelen" | "sessies"
}

/**
 * Maximaal drie punten die vandaag aandacht vragen, elk met verwijzing naar de
 * kaart waar het vandaan komt. Géén punten ⇒ lege lijst; de UI toont dan dat
 * er niets bijzonders is (nooit lege ruimte, nooit een verzonnen punt).
 * Deterministisch: vaste ernst-volgorde, zelfde invoer ⇒ zelfde uitkomst.
 */
export function aandachtspunten(input: {
  load: { chartData: LoadPunt[]; tsb: number; ctl: number } | null
  sessies: SessieInput[]
  metrics: MetricInput[]
  todayIso: string
}): Aandachtspunt[] {
  const uit: Aandachtspunt[] = []
  const load = input.load

  if (load && load.chartData.length >= 14) {
    // 1. Diep negatieve vorm — herstel gaat vóór extra belasting.
    if (load.tsb <= -20) {
      uit.push({
        id: "tsb-diep",
        tekst: `Je vorm staat diep negatief (${Math.round(load.tsb)}) — herstel is nu belangrijker dan extra belasting.`,
        kaart: "Belastingsverloop",
        tab: "overzicht",
      })
    }
    // 2. Snelle opbouw — CTL ≥6 punten omhoog in 7 dagen.
    const c7 = load.chartData[load.chartData.length - 8]?.ctl
    if (c7 != null && load.ctl - c7 >= 6) {
      uit.push({
        id: "opbouw-snel",
        tekst: `Je fitheid stijgt snel (+${Math.round(load.ctl - c7)} in een week) — sneller opbouwen dan je gewend bent vergroot de kans op overbelasting.`,
        kaart: "Belastingsverloop",
        tab: "overzicht",
      })
    }
    // 3. Fitheid zakt al ≥2 weken.
    const dal = dalendeWeken(load.chartData)
    if (dal >= 2) {
      const wk = weekCtls(load.chartData)
      uit.push({
        id: "ctl-daalt",
        tekst: `Je fitheid zakt al ${WEEKWOORD[Math.min(dal, 3)]} (${Math.round(wk[Math.min(dal, wk.length - 1)] ?? 0)} → ${Math.round(load.ctl)}).`,
        kaart: "Belastingsverloop",
        tab: "overzicht",
      })
    }
  }

  // 4. Korte nachten afgelopen week (alleen bij ≥3 echte metingen).
  const grens = new Date(`${input.todayIso}T12:00:00`)
  grens.setDate(grens.getDate() - 7)
  const grensIso = `${grens.getFullYear()}-${String(grens.getMonth() + 1).padStart(2, "0")}-${String(grens.getDate()).padStart(2, "0")}`
  const nachten = input.metrics
    .filter((m) => m.metricDate >= grensIso && m.metricDate <= input.todayIso)
    .map((m) => alsGetal(m.sleepHours))
    .filter((v): v is number => v != null && v > 0)
  if (nachten.length >= 3) {
    const gem = nachten.reduce((a, b) => a + b, 0) / nachten.length
    if (gem < 6.5) {
      uit.push({
        id: "slaap-kort",
        tekst: `Je sliep afgelopen week gemiddeld ${gem.toFixed(1).replace(".", ",")} uur — aan de korte kant om trainingen goed te verwerken.`,
        kaart: "Slaap",
        tab: "belasting",
      })
    }
  }

  // 5. Geen enkele training in de afgelopen 7 dagen.
  const recente = input.sessies.filter(
    (s) => s.sessionDate >= grensIso && s.sessionDate <= input.todayIso,
  )
  if (input.sessies.length > 0 && recente.length === 0) {
    uit.push({
      id: "geen-training",
      tekst: "Geen trainingen geregistreerd in de afgelopen zeven dagen.",
      kaart: "Sessies",
      tab: "sessies",
    })
  }

  return uit.slice(0, 3)
}

// ── §2 Opbouwsnelheid — weekstijging van CTL uit de BESTAANDE reeks ─────────
// Geen tweede berekening: dit leest alleen de serie die computeLoadSeries al
// leverde en zet er de week-op-week-verandering naast.

export type OpbouwPunt = {
  /** Maandag van de week (YYYY-MM-DD). */
  weekStart: string
  /** CTL aan het einde van die week. */
  ctl: number
  /** Verandering t.o.v. een week eerder; null voor de eerste week. */
  stijging: number | null
}

export function opbouwsnelheid(chartData: LoadPunt[]): OpbouwPunt[] {
  if (chartData.length < 8) return []
  const perWeek = new Map<string, number>()
  for (const p of chartData) {
    perWeek.set(weekStartVan(p.date), p.ctl) // laatste punt van de week wint
  }
  const weken = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return weken.map(([weekStart, ctl], i) => ({
    weekStart,
    ctl: Math.round(ctl * 10) / 10,
    stijging: i === 0 ? null : Math.round((ctl - weken[i - 1]![1]) * 10) / 10,
  }))
}

export type AnalyseSamenvatting = {
  ctl: number | null
  atl: number | null
  tsb: number | null
  vormLabel: string | null
  ftp: number | null
  ftpDelta: number | null // t.o.v. vorige test
  wkg: number | null
  laatsteGewichtKg: number | null
}

/**
 * Compacte kern voor de profielweergave (/you) — zelfde bronnen, zelfde
 * berekeningen, alleen de laatste stand in plaats van volledige reeksen.
 */
export function analyseSamenvatting(input: {
  load: { ctl: number; atl: number; tsb: number } | null
  ftpTests: FtpTestInput[]
  profielFtp: number | null
  metrics: MetricInput[]
}): AnalyseSamenvatting {
  const tsb = input.load?.tsb ?? null
  const tests = [...input.ftpTests].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const laatste = tests[tests.length - 1] ?? null
  const voorlaatste = tests[tests.length - 2] ?? null
  const ftp = laatste?.ftpWatts ?? input.profielFtp ?? null
  const gewichtReeks = input.metrics
    .map((m) => ({ metricDate: m.metricDate, kg: alsGetal(m.weightKg) }))
    .filter((m): m is { metricDate: string; kg: number } => m.kg != null && m.kg > 0)
    .sort((a, b) => a.metricDate.localeCompare(b.metricDate))
  const kg = gewichtReeks[gewichtReeks.length - 1]?.kg ?? null
  return {
    ctl: input.load ? Math.round(input.load.ctl) : null,
    atl: input.load ? Math.round(input.load.atl) : null,
    tsb: tsb != null ? Math.round(tsb) : null,
    vormLabel: tsb == null ? null : tsb >= 5 ? "Uitgerust" : tsb <= -15 ? "Vermoeid" : "Neutraal",
    ftp,
    ftpDelta: laatste && voorlaatste ? laatste.ftpWatts - voorlaatste.ftpWatts : null,
    wkg: ftp != null && kg != null && kg > 0 ? Math.round((ftp / kg) * 100) / 100 : null,
    laatsteGewichtKg: kg,
  }
}
