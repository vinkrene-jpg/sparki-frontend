// CLUB_AFRONDING_01 C2 — actieve clubnavigatie-context ("stand").
//
// De rolwisselaar blijft leidend: kiest iemand in het hoofdmenu een
// clubcontext, dan wisselt de onderbalk mee naar de balk van die clubrol;
// kiest iemand weer een accountrol (Sporter/Coach/…), dan verdwijnt de
// clubstand. De stand is puur presentatie (welke onderbalk toont) — rechten
// blijven volledig server-side.
//
// Fail-closed: de stand telt alleen wanneer de server bevestigt dat het
// account die clubrol écht heeft (validatie gebeurt bij de consumenten met
// useMyClubs); een verzonnen localStorage-waarde levert dus nooit een
// clubbalk op.

import { useSyncExternalStore } from "react"

const KEY = "sparki.club-nav-role"
const EVENT = "sparki:club-nav-role"

export type ClubNavStand = { clubId: number; role: string } | null

// C-T6: drie standen — een gekozen clubcontext, een EXPLICIET gekozen
// accountrol ("account"), of nog niets gekozen (null). Alleen bij "nog niets
// gekozen" mag een standaard-clubstand gelden (clubbeheerder zonder keuze).
export type ClubNavKeuze = { clubId: number; role: string } | "account" | null

function read(): ClubNavKeuze {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    if (raw === JSON.stringify("account")) return "account"
    const parsed = JSON.parse(raw) as { clubId?: unknown; role?: unknown }
    if (typeof parsed?.clubId === "number" && typeof parsed?.role === "string") {
      return { clubId: parsed.clubId, role: parsed.role }
    }
    return null
  } catch {
    return null
  }
}

let cache: ClubNavKeuze = null
let cacheRaw: string | null = null

function snapshot(): ClubNavKeuze {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw
    cache = read()
  }
  return cache
}

export function setClubNavStand(stand: ClubNavKeuze): void {
  try {
    if (stand) localStorage.setItem(KEY, JSON.stringify(stand))
    else localStorage.removeItem(KEY)
  } catch {
    /* opslag niet beschikbaar — stand blijft sessieloos */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

/** Ruwe keuze uit opslag (reactief): clubstand, "account" of nog niets. */
export function useClubNavKeuze(): ClubNavKeuze {
  return useSyncExternalStore(subscribe, snapshot, () => null)
}

// Minimale vorm van een useMyClubs-rij die we hier nodig hebben.
type ClubRow = { membership?: { clubId?: number; role?: string } | null } | null

// C-T6: rollen die ZONDER expliciete keuze de clubbalk krijgen. Bewust alleen
// clubbeheer (owner/admin) — andere stafrollen zijn vaak óók sporter en houden
// hun sporterbalk tot ze zelf de clubcontext kiezen (C-T7 blijft werken).
const DEFAULT_STAND_ROLES = ["owner", "admin"]

/**
 * Effectieve clubstand: expliciete keuze wint; "account" = geen clubbalk;
 * nog geen keuze ⇒ standaard de clubbalk voor een clubbeheerder (C-T6).
 * Fail-closed: een gekozen stand telt alleen als de server het lidmaatschap
 * bevestigt; zolang de clublijst nog laadt is er géén stand.
 */
export function effectiveClubStand(
  keuze: ClubNavKeuze,
  myClubs: ClubRow[] | undefined,
): ClubNavStand {
  if (keuze === "account") return null
  if (!Array.isArray(myClubs)) return null
  if (keuze) {
    const echt = myClubs.some(
      (r) => r?.membership?.clubId === keuze.clubId && r?.membership?.role === keuze.role,
    )
    return echt ? keuze : null
  }
  for (const rol of DEFAULT_STAND_ROLES) {
    const rij = myClubs.find((r) => r?.membership?.role === rol)
    const clubId = rij?.membership?.clubId
    if (typeof clubId === "number") return { clubId, role: rol }
  }
  return null
}

/** Actieve clubnavigatie-stand (reactief, incl. C-T6-standaard). */
export function useClubNavStand(myClubs: ClubRow[] | undefined): ClubNavStand {
  const keuze = useSyncExternalStore(subscribe, snapshot, () => null)
  return effectiveClubStand(keuze, myClubs)
}
