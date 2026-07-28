/**
 * Ontdekken-affiniteit — leert van wat je écht opent en bewaart.
 * ──────────────────────────────────────────────────────────────
 * Interacties (open/bewaar) worden op dit apparaat gelogd (localStorage,
 * net als feed-prefs) en gebundeld tot een affiniteitsmodel per categorie
 * en per bron. De feed-engine gebruikt dat als bescheiden boost bovenop de
 * bestaande scoring.
 *
 * Eerlijkheidsregels:
 *  - open-events zijn dwell-gated (~1.4s, zelfde regel als de Renners-reel):
 *    een open die meteen weer dichtklapt telt niet als interesse;
 *  - bewaar-events tellen pas als het item na ~1.4s nóg bewaard is
 *    (per ongeluk tikken + direct ongedaan maken vervuilt het model niet);
 *  - onder MIN_INTERACTIES is het model niet actief (honest default):
 *    dan verandert er niets aan de sortering en zegt de UI dat ook niet.
 */

export type FeedInteractieSoort = "open" | "bewaar"

export type FeedInteractie = {
  soort: FeedInteractieSoort
  categorie: string // FeedKaartType
  bron: string | null
  opIso: string
}

/** Dwell-drempel (ms) voordat een open/bewaar-event als echt telt. */
export const DWELL_MS = 1400

/** Minimum aantal interacties voordat affiniteit de sortering mag sturen. */
export const MIN_INTERACTIES = 5

const MAX_INTERACTIES = 300

/** Per gebruiker gescheiden (zelfde A-03-regel als feed-prefs): sleutel op clerkId. */
export function interactiesKey(userId: string): string {
  return `sparki.ontdekken.interacties.v1.${userId}`
}

// ── opslag (dit apparaat, per gebruiker) ─────────────────────────────────────

export function leesInteracties(userId: string | null | undefined): FeedInteractie[] {
  if (!userId) return []
  try {
    const raw = window.localStorage.getItem(interactiesKey(userId))
    if (!raw) return []
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p.filter(
      (i): i is FeedInteractie =>
        i != null &&
        (i.soort === "open" || i.soort === "bewaar") &&
        typeof i.categorie === "string",
    )
  } catch {
    return []
  }
}

export function registreerInteractie(
  userId: string | null | undefined,
  soort: FeedInteractieSoort,
  categorie: string,
  bron?: string | null,
): FeedInteractie[] {
  if (!userId) return [] // geen user-id ⇒ nooit (globaal) wegschrijven
  const lijst = [
    { soort, categorie, bron: bron?.trim() || null, opIso: new Date().toISOString() },
    ...leesInteracties(userId),
  ].slice(0, MAX_INTERACTIES)
  try {
    window.localStorage.setItem(interactiesKey(userId), JSON.stringify(lijst))
  } catch {
    /* opslag vol/geblokkeerd — dan leert alleen deze sessie mee */
  }
  return lijst
}

// ── affiniteitsmodel (puur, testbaar) ────────────────────────────────────────

export type Affiniteit = {
  /** false zolang er te weinig interacties zijn — dan géén boost (eerlijk). */
  actief: boolean
  aantal: number
  /** boost-punten per categorie (0..CATEGORIE_MAX) */
  categorie: Record<string, number>
  /** boost-punten per bron (0..BRON_MAX) */
  bron: Record<string, number>
}

const GEWICHT: Record<FeedInteractieSoort, number> = { open: 1, bewaar: 2 }
const CATEGORIE_MAX = 20
const BRON_MAX = 12

export const LEGE_AFFINITEIT: Affiniteit = { actief: false, aantal: 0, categorie: {}, bron: {} }

/**
 * Bouw het affiniteitsmodel uit echte interacties. Deterministisch:
 * boost per categorie/bron is evenredig met het aandeel van die
 * categorie/bron in het totale interactiegewicht, begrensd zodat
 * affiniteit de basissignalen (recentheid, wedstrijdnabijheid, demping)
 * nooit overstemt.
 */
export function berekenAffiniteit(interacties: FeedInteractie[]): Affiniteit {
  if (interacties.length < MIN_INTERACTIES) {
    return { ...LEGE_AFFINITEIT, aantal: interacties.length }
  }
  const catGewicht: Record<string, number> = {}
  const bronGewicht: Record<string, number> = {}
  let totaal = 0
  for (const i of interacties) {
    const w = GEWICHT[i.soort] ?? 1
    totaal += w
    catGewicht[i.categorie] = (catGewicht[i.categorie] ?? 0) + w
    if (i.bron) bronGewicht[i.bron] = (bronGewicht[i.bron] ?? 0) + w
  }
  if (totaal <= 0) return { ...LEGE_AFFINITEIT, aantal: interacties.length }

  const categorie: Record<string, number> = {}
  for (const [c, w] of Object.entries(catGewicht)) {
    categorie[c] = Math.round(CATEGORIE_MAX * (w / totaal))
  }
  const bron: Record<string, number> = {}
  for (const [b, w] of Object.entries(bronGewicht)) {
    bron[b] = Math.round(BRON_MAX * (w / totaal))
  }
  return { actief: true, aantal: interacties.length, categorie, bron }
}
