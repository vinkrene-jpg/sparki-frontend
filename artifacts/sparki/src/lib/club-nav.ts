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

function read(): ClubNavStand {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { clubId?: unknown; role?: unknown }
    if (typeof parsed?.clubId === "number" && typeof parsed?.role === "string") {
      return { clubId: parsed.clubId, role: parsed.role }
    }
    return null
  } catch {
    return null
  }
}

let cache: ClubNavStand = null
let cacheRaw: string | null = null

function snapshot(): ClubNavStand {
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

export function setClubNavStand(stand: ClubNavStand): void {
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

/** Actieve clubnavigatie-stand (reactief). */
export function useClubNavStand(): ClubNavStand {
  return useSyncExternalStore(subscribe, snapshot, () => null)
}
