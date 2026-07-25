import { useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// Aandacht-rotatie (client) — niet-kritieke meerijdende berichten (nudges,
// releasekaart, onderhoudssignalen op Vandaag) melden hier dat ze getoond
// zijn; de server pauzeert een item dat een paar dagen genegeerd is zodat een
// ander bericht (of rust) de ruimte krijgt. Alleen presentatie: de
// onderliggende melding blijft bestaan en bereikbaar via haar eigen plek.
//
// Bewust GEEN cache-invalidatie na het melden: een pauze gaat pas bij het
// volgende bezoek in, een kaart verdwijnt nooit midden in beeld.

export type AttentionState = { today: string; suppressed: string[] }

const STATE_KEY = ["attention", "state"] as const

export function useAttentionState() {
  return useQuery({
    queryKey: STATE_KEY,
    queryFn: () => apiFetch<AttentionState>("/api/attention"),
    staleTime: 5 * 60_000,
  })
}

/** Handige set-vorm; leeg zolang de status nog laadt. Fail-open: bij een
 *  fout geldt "niets gepauzeerd" (ready met lege set) — liever een keer te
 *  veel getoond dan een bericht oneerlijk verzwegen. */
export function useSuppressedAttentionKeys(): {
  suppressed: Set<string>
  ready: boolean
} {
  const { data, isSuccess, isError } = useAttentionState()
  return {
    suppressed: new Set(isSuccess ? (data?.suppressed ?? []) : []),
    ready: isSuccess || isError,
  }
}

// Eén melding per sleutel per sessie; de server is daarnaast zelf idempotent
// per Amsterdamse kalenderdag, dus dubbele meldingen kunnen nooit dubbel tellen.
const reportedThisSession = new Set<string>()

export function useReportAttentionSeen(keys: string | string[] | null) {
  const mark = useMutation({
    mutationFn: (toReport: string[]) =>
      apiFetch("/api/attention/seen", {
        method: "POST",
        body: JSON.stringify({ keys: toReport }),
      }),
  })
  const list = keys == null ? [] : Array.isArray(keys) ? keys : [keys]
  const joined = list.join("\u0000")
  const mutate = mark.mutate
  useEffect(() => {
    if (!joined) return
    const fresh = joined
      .split("\u0000")
      .filter((k) => k && !reportedThisSession.has(k))
    if (fresh.length === 0) return
    for (const k of fresh) reportedThisSession.add(k)
    mutate(fresh)
  }, [joined, mutate])
}
