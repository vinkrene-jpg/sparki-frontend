/**
 * Ontdekken-feedvoorkeuren — bewaard op dit apparaat (localStorage), PER GEBRUIKER.
 * ──────────────────────────────────────────────────────────────────────────────
 * Twee soorten voorkeuren, beide écht (persistent, geen mock):
 *  - bewaard:  items die de atleet bewaart (kaart-key + titel + url/route);
 *  - minder:   feedback "minder hiervan" per categorie of bron — dempt de
 *              betreffende kaarten in de personalisatie-sortering.
 *
 * Bewust lokaal: dit is presentatie-voorkeur van dít apparaat. De copy in de
 * UI zegt "op dit apparaat" — nooit doen alsof dit account-breed synct.
 *
 * Per gebruiker gescheiden (defect A-03): de sleutel bevat de stabiele
 * clerkId van de ingelogde gebruiker, zodat op een gedeeld apparaat de
 * voorkeuren van gebruiker A nooit zichtbaar zijn voor gebruiker B.
 * Zonder user-id wordt er bewust NIETS in localStorage geschreven of gelezen
 * (geen onveilige globale opslag): voorkeuren gelden dan alleen in geheugen
 * van de openstaande pagina.
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

// Oude, globale sleutel (pre-A-03). Wordt éénmalig veilig gemigreerd.
const LEGACY_KEY = "sparki.ontdekken.prefs.v1"
// Migratiemarkering: de oude sleutel is al één keer toegekend (of opgeruimd).
const MIGRATED_KEY = "sparki.ontdekken.prefs.migrated.v1"

const LEEG: FeedPrefs = { bewaard: [], minderCategorie: [], minderBron: [] }

/** Gebruikersgebonden opslagsleutel. Alleen met een echte user-id. */
export function feedPrefsKey(userId: string): string {
  return `sparki.ontdekken.prefs.v1.${userId}`
}

function normaliseer(raw: string | null): FeedPrefs {
  if (!raw) return LEEG
  try {
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

/**
 * Eénmalige, veilige migratie van de oude globale sleutel:
 *  - alleen wanneer deze gebruiker nog GEEN eigen sleutel heeft;
 *  - alleen wanneer er nog niet eerder gemigreerd is (markering);
 *  - daarna wordt de oude globale sleutel altijd verwijderd, zodat hij nooit
 *    aan een tweede account kan worden toegekend.
 */
function migreerLegacy(userId: string): void {
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy == null) return
    const alGemigreerd = window.localStorage.getItem(MIGRATED_KEY) != null
    const heeftEigen = window.localStorage.getItem(feedPrefsKey(userId)) != null
    if (!alGemigreerd && !heeftEigen) {
      // Alleen geldige JSON overnemen; corrupt = weggooien, niet doorgeven.
      const p = normaliseer(legacy)
      window.localStorage.setItem(feedPrefsKey(userId), JSON.stringify(p))
    }
    window.localStorage.setItem(MIGRATED_KEY, userId)
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* opslag geblokkeerd — dan ook geen migratie nodig */
  }
}

/** Lees de voorkeuren van déze gebruiker. Zonder user-id: altijd leeg. */
export function leesFeedPrefs(userId: string | null | undefined): FeedPrefs {
  if (!userId) return LEEG
  try {
    migreerLegacy(userId)
    return normaliseer(window.localStorage.getItem(feedPrefsKey(userId)))
  } catch {
    return LEEG
  }
}

function schrijf(userId: string | null | undefined, p: FeedPrefs): FeedPrefs {
  if (!userId) return p // geen user-id ⇒ nooit (globaal) wegschrijven
  try {
    window.localStorage.setItem(feedPrefsKey(userId), JSON.stringify(p))
  } catch {
    /* opslag vol/geblokkeerd — voorkeur geldt dan alleen deze sessie */
  }
  return p
}

export function toggleBewaard(userId: string | null | undefined, item: SavedFeedItem): FeedPrefs {
  const p = leesFeedPrefs(userId)
  const bestaat = p.bewaard.some((b) => b.key === item.key)
  return schrijf(userId, {
    ...p,
    bewaard: bestaat
      ? p.bewaard.filter((b) => b.key !== item.key)
      : [item, ...p.bewaard].slice(0, 200),
  })
}

export function minderVan(
  userId: string | null | undefined,
  categorie: string,
  bron?: string | null,
): FeedPrefs {
  const p = leesFeedPrefs(userId)
  // Met een bron dempen we specifiek die bron; anders de hele categorie.
  if (bron && bron.trim()) {
    return schrijf(userId, {
      ...p,
      minderBron: p.minderBron.includes(bron) ? p.minderBron : [...p.minderBron, bron],
    })
  }
  return schrijf(userId, {
    ...p,
    minderCategorie: p.minderCategorie.includes(categorie)
      ? p.minderCategorie
      : [...p.minderCategorie, categorie],
  })
}

export function herstelMinder(userId: string | null | undefined): FeedPrefs {
  const p = leesFeedPrefs(userId)
  return schrijf(userId, { ...p, minderCategorie: [], minderBron: [] })
}
