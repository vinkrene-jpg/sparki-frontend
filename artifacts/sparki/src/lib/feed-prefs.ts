/**
 * Ontdekken-feedvoorkeuren — bewaard op dit apparaat (localStorage).
 * ──────────────────────────────────────────────────────────────────
 * Twee soorten voorkeuren, beide écht (persistent, geen mock):
 *  - bewaard:  items die de atleet bewaart (kaart-key + titel + url/route);
 *  - minder:   feedback "minder hiervan" per categorie of bron — dempt de
 *              betreffende kaarten in de personalisatie-sortering.
 *
 * Bewust lokaal: dit is presentatie-voorkeur van dít apparaat. De copy in de
 * UI zegt "op dit apparaat" — nooit doen alsof dit account-breed synct.
 */

export type SavedFeedItem = {
  key: string // stabiele kaart-key, bv. "news-123"
  titel: string
  categorie: string
  url?: string // interne route (/routes/5) of externe link
  bron?: string
  bewaardOp: string // ISO
}

export type FeedPrefs = {
  bewaard: SavedFeedItem[]
  minderCategorie: string[] // gedempte categorieën
  minderBron: string[] // gedempte bronnen (bv. een nieuwssite)
}

const KEY = "sparki.ontdekken.prefs.v1"
const LEEG: FeedPrefs = { bewaard: [], minderCategorie: [], minderBron: [] }

export function leesFeedPrefs(): FeedPrefs {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return LEEG
    const p = JSON.parse(raw) as Partial<FeedPrefs>
    return {
      bewaard: Array.isArray(p.bewaard) ? p.bewaard.slice(0, 200) : [],
      minderCategorie: Array.isArray(p.minderCategorie) ? p.minderCategorie : [],
      minderBron: Array.isArray(p.minderBron) ? p.minderBron : [],
    }
  } catch {
    return LEEG
  }
}

function schrijf(p: FeedPrefs): FeedPrefs {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* opslag vol/geblokkeerd — voorkeur geldt dan alleen deze sessie */
  }
  return p
}

export function toggleBewaard(item: SavedFeedItem): FeedPrefs {
  const p = leesFeedPrefs()
  const bestaat = p.bewaard.some((b) => b.key === item.key)
  return schrijf({
    ...p,
    bewaard: bestaat
      ? p.bewaard.filter((b) => b.key !== item.key)
      : [item, ...p.bewaard].slice(0, 200),
  })
}

export function minderVan(categorie: string, bron?: string | null): FeedPrefs {
  const p = leesFeedPrefs()
  // Met een bron dempen we specifiek die bron; anders de hele categorie.
  if (bron && bron.trim()) {
    return schrijf({
      ...p,
      minderBron: p.minderBron.includes(bron) ? p.minderBron : [...p.minderBron, bron],
    })
  }
  return schrijf({
    ...p,
    minderCategorie: p.minderCategorie.includes(categorie)
      ? p.minderCategorie
      : [...p.minderCategorie, categorie],
  })
}

export function herstelMinder(): FeedPrefs {
  const p = leesFeedPrefs()
  return schrijf({ ...p, minderCategorie: [], minderBron: [] })
}
