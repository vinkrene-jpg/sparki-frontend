/**
 * Ontdekken-feed engine (puur, testbaar)
 * ──────────────────────────────────────
 * Bouwt van échte databronnen één visuele, persoonlijke feed:
 *  - classificatie van nieuws in nieuws / materiaal / trainingstip
 *    (deterministische woordgrens-regels, geen AI);
 *  - personalisatie-score per kaart (recentheid, type-gewicht, wedstrijd-
 *    nabijheid, vrienden-recentheid, bewaard-onderwerp-boost, "minder
 *    hiervan"-demping);
 *  - afwisseling: nooit drie kaarten van hetzelfde type achter elkaar
 *    als er ander materiaal beschikbaar is;
 *  - deterministische sfeerbeeld-toewijzing per kaart (stabiel per item).
 *
 * Alleen echte data: de engine verzint niets — lege bronnen leveren gewoon
 * minder kaarttypen op.
 */

export type FeedKaartType =
  | "nieuws"
  | "materiaal"
  | "trainingstip"
  | "route"
  | "klim"
  | "wedstrijd"
  | "vrienden"
  | "evenement"
  | "inzicht"
  | "video"

export type FeedKaart = {
  key: string
  type: FeedKaartType
  titel: string
  samenvatting: string | null
  bron: string | null
  tijdIso: string | null // publicatie/gebeurtenis-moment (voor weergave)
  /** interne route (begint met /) of externe url */
  link: string | null
  extern: boolean
  /** payload-verwijzing zodat de UI de juiste opener kiest */
  ref?: { nieuwsId?: number; routeId?: number; raceId?: number }
  score: number
}

// ── nieuws-classificatie ─────────────────────────────────────────────────────
// Woordgrens-regexes (substring-trap: "sport" in "transport").
const MATERIAAL_RE =
  /\b(fiets(en)?|frame(s)?|wiel(en|set)?|band(en)?|tubeless|groepset|schakel\w*|cassette|ketting|zadel(s)?|stuur|cranks?|naven|naaf|helm(en)?|schoen(en)?|pedal(en|es)?|powermeter|verzet|carbon|aero\w*|tenue|kleding|shirt|component(en)?|sram|shimano|campagnolo|specialized|colnago|canyon|trek|giant|pinarello|cervelo|bianchi|vittoria|continental|zipp|garmin|wahoo)\b/i
const TRAININGSTIP_RE =
  /\b(training(en|s\w*)?|interval\w*|herstel\w*|slaap|voeding\w*|eiwit\w*|koolhydra\w*|hydrat\w*|blessure\w*|kramp|ftp|zone \d|duurtraining|krachttraining|periodiser\w*|overtraining|vermoeidheid|warming-?up|cooling-?down)\b/i

export function classificeerNieuws(titel: string, samenvatting?: string | null): FeedKaartType {
  const tekst = `${titel} ${samenvatting ?? ""}`
  if (MATERIAAL_RE.test(tekst)) return "materiaal"
  if (TRAININGSTIP_RE.test(tekst)) return "trainingstip"
  return "nieuws"
}

// ── scoring ──────────────────────────────────────────────────────────────────

export type PersonalisatieContext = {
  todayIso: string // YYYY-MM-DD (lokale dag)
  minderCategorie: string[]
  minderBron: string[]
  /** titels van bewaarde items — woorden hieruit boosten verwante kaarten */
  bewaardeTitels: string[]
}

const TYPE_GEWICHT: Record<FeedKaartType, number> = {
  inzicht: 90, // Sparki's eigen duiding eerst
  vrienden: 80,
  wedstrijd: 75,
  nieuws: 55,
  materiaal: 50,
  trainingstip: 50,
  route: 45,
  klim: 40,
  evenement: 45,
  video: 55,
}

function dagenTussen(aIso: string, bIso: string): number {
  const a = new Date(`${aIso.slice(0, 10)}T12:00:00`)
  const b = new Date(`${bIso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 999
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Significante woorden (≥5 tekens) uit bewaarde titels, voor onderwerp-boost. */
export function bewaardeKernwoorden(titels: string[]): Set<string> {
  const set = new Set<string>()
  for (const t of titels) {
    for (const w of t.toLowerCase().split(/[^a-zà-ÿ0-9]+/i)) {
      if (w.length >= 5) set.add(w)
    }
  }
  return set
}

export function scoreKaart(
  kaart: Omit<FeedKaart, "score">,
  ctx: PersonalisatieContext,
  kernwoorden: Set<string>,
): number {
  let s = TYPE_GEWICHT[kaart.type] ?? 40

  // Recentheid: nieuws/vrienden vervallen; wedstrijden juist dichterbij = hoger.
  if (kaart.tijdIso) {
    const d = dagenTussen(kaart.tijdIso, ctx.todayIso)
    if (kaart.type === "wedstrijd" || kaart.type === "evenement") {
      // toekomstig: d negatief (tijd > vandaag ⇒ dagenTussen(tijd, vandaag) < 0)
      const totRace = -d
      if (totRace >= 0) s += Math.max(0, 30 - totRace) // dichterbij = urgenter
    } else {
      s -= Math.min(40, Math.max(0, d) * 4) // ouder = lager
    }
  }

  // "Minder hiervan"
  if (ctx.minderCategorie.includes(kaart.type)) s -= 60
  if (kaart.bron && ctx.minderBron.includes(kaart.bron)) s -= 60

  // Bewaard-onderwerp-boost: overlap van significante woorden.
  if (kernwoorden.size > 0) {
    const woorden = kaart.titel.toLowerCase().split(/[^a-zà-ÿ0-9]+/i)
    const hit = woorden.some((w) => w.length >= 5 && kernwoorden.has(w))
    if (hit) s += 15
  }

  return s
}

/**
 * Sorteer op score en wissel af: max 2 kaarten van hetzelfde type direct na
 * elkaar zolang er ander materiaal in de wachtrij staat.
 */
export function mengFeed(kaarten: FeedKaart[]): FeedKaart[] {
  const rest = [...kaarten].sort((a, b) => b.score - a.score)
  const uit: FeedKaart[] = []
  while (rest.length > 0) {
    const laatste = uit.slice(-2)
    const geblokkeerd =
      laatste.length === 2 && laatste[0].type === laatste[1].type ? laatste[0].type : null
    const idx = geblokkeerd ? rest.findIndex((k) => k.type !== geblokkeerd) : 0
    const gekozen = rest.splice(idx === -1 ? 0 : idx, 1)[0]
    uit.push(gekozen)
  }
  return uit
}

// ── sfeerbeeld-toewijzing ────────────────────────────────────────────────────

/** Stabiele kleine hash zodat elk item altijd hetzelfde sfeerbeeld krijgt. */
export function stabieleIndex(key: string, lengte: number): number {
  if (lengte <= 0) return 0
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return Math.abs(h) % lengte
}
