// WP-R1 — gekozen kind van de ouder (kindkiezer-state).
//
// Eén bron voor "welk kind staat centraal" over alle oudertabbladen (Vandaag,
// Toestemmingen). Bewust simpel: localStorage per ouderaccount + een
// browser-event zodat elke consumer live meebeweegt. Geen serverstate — de
// keuze is presentatie, nooit een recht: elke datavraag loopt server-side
// alsnog door de koppel- en toestemmingslaag.
import { useCallback, useSyncExternalStore } from "react"

const EVENT = "sparki:parent-selected-child"

function keyFor(parentClerkId: string | null | undefined): string {
  return `sparki.parent.selectedChild.${parentClerkId ?? "onbekend"}`
}

function read(parentClerkId: string | null | undefined): string | null {
  try {
    return localStorage.getItem(keyFor(parentClerkId))
  } catch {
    return null
  }
}

export function useSelectedChild(parentClerkId: string | null | undefined) {
  const subscribe = useCallback((cb: () => void) => {
    const handler = () => cb()
    window.addEventListener(EVENT, handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener(EVENT, handler)
      window.removeEventListener("storage", handler)
    }
  }, [])
  const selected = useSyncExternalStore(
    subscribe,
    () => read(parentClerkId),
    () => null,
  )
  const setSelected = useCallback(
    (athleteClerkId: string | null) => {
      try {
        if (athleteClerkId) localStorage.setItem(keyFor(parentClerkId), athleteClerkId)
        else localStorage.removeItem(keyFor(parentClerkId))
      } catch {
        // localStorage kan geblokkeerd zijn (privémodus) — de kiezer valt dan
        // stil terug op "eerste kind"; nooit een crash.
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [parentClerkId],
  )
  return { selected, setSelected }
}

// Helper: bepaal het effectieve kind — de opgeslagen keuze als die nog bij een
// gekoppeld kind hoort, anders het eerste kind (of null zonder kinderen).
export function effectiveChildId(
  selected: string | null,
  childIds: string[],
): string | null {
  if (selected && childIds.includes(selected)) return selected
  return childIds[0] ?? null
}
