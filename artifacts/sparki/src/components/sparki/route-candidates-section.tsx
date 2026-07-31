import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, EyeOff, Loader2, Save, Star, X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { apiFetch } from "@/lib/api"

// Persoonlijke routebibliotheek uit gekoppelde ritgeschiedenis (opdracht
// 31-07-2026): geïmporteerde ritten worden op de achtergrond — nooit bij
// paginalaad — incrementeel geclusterd tot routekandidaten. Deze sectie
// TOONT alleen wat de scan al vond, met:
// - onboarding-samenvatting na de eerste volle sync ("184 activiteiten →
//   23 bruikbare routes");
// - labels (autolabel, door de gebruiker te corrigeren), favorieten,
//   uitsluiten;
// - transparante kwaliteitsscore per kandidaat (uitklapbaar, per factor);
// - "Bewaar als route": loopt server-side ALTIJD door de actuele fail-closed
//   blokkadeverificatie — een eerder gereden route is nooit automatisch
//   veilig, en dat zeggen we er eerlijk bij.

type QualityFactor = {
  factor: string
  score: number
  weight: number
  toelichting: string
}

type Candidate = {
  id: number
  labels: string[]
  autoLabels: string[]
  userLabels: string[] | null
  distanceKm: number | null
  elevationM: number | null
  sport: string
  isLoop: boolean
  rideCount: number
  lastRiddenAt: string | null
  favorite: boolean
  excluded: boolean
  quality: { score: number; factors: QualityFactor[] } | null
  trimmedStartM: number | null
  trimmedEndM: number | null
  savedRouteId: number | null
}

type CandidatesResponse = {
  candidates: Candidate[]
  excludedCount: number
  scan: {
    activitiesSeen: number
    activitiesWithTrack: number
    candidatesFound: number
    lastScanAt: string | null
    onboardingSeenAt: string | null
  } | null
}

const FACTOR_LABEL: Record<string, string> = {
  frequentie: "Frequentie",
  recentheid: "Recentheid",
  gps_volledigheid: "GPS-volledigheid",
  consistentie: "Consistentie",
  profiel_match: "Profielmatch",
  keren_stilstand: "Keren/stilstand",
}

export function RouteCandidatesSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState<number | null>(null)
  const [labelDraft, setLabelDraft] = useState<string>("")
  const [labelEditId, setLabelEditId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ["route-candidates"],
    queryFn: () => apiFetch<CandidatesResponse>("api/route-candidates"),
  })

  const patch = useMutation({
    mutationFn: (args: {
      id: number
      body: { userLabels?: string[]; favorite?: boolean; excluded?: boolean }
    }) =>
      apiFetch(`api/route-candidates/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify(args.body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-candidates"] }),
  })

  const onboardingSeen = useMutation({
    mutationFn: () =>
      apiFetch("api/route-candidates/onboarding-seen", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-candidates"] }),
  })

  const save = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`api/route-candidates/${id}/save`, { method: "POST" }),
    onSuccess: () => {
      setSaveError(null)
      qc.invalidateQueries({ queryKey: ["route-candidates"] })
      qc.invalidateQueries({ queryKey: ["routes"] })
    },
    onError: (err) =>
      setSaveError(err instanceof Error ? err.message : "Bewaren mislukt"),
  })

  const data = query.data
  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Routekandidaten laden…
      </div>
    )
  }
  if (!data || (data.candidates.length === 0 && !data.scan)) return null

  const scan = data.scan
  const showOnboarding =
    scan != null && scan.onboardingSeenAt == null && scan.candidatesFound > 0

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-white/85">
        Uit jouw ritten
      </h2>
      <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
        Routes die Sparki herkende in je geïmporteerde ritgeschiedenis. Bewaren
        of starten gaat altijd door de actuele blokkadecontrole — een eerder
        gereden route is niet automatisch nog veilig.
      </p>

      {showOnboarding && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
          <p className="text-[13px] leading-relaxed text-white/75">
            Uit je ritgeschiedenis hebben we{" "}
            <span className="font-semibold text-white">
              {scan.activitiesSeen} activiteiten
            </span>{" "}
            bekeken. Daaruit lijken{" "}
            <span className="font-semibold" style={{ color: ACCENT }}>
              {scan.candidatesFound} bruikbare routes
            </span>{" "}
            te ontstaan. Bekijk ze hieronder: labels corrigeren, favorieten
            kiezen of routes uitsluiten kan per route.
          </p>
          <button
            type="button"
            aria-label="Samenvatting sluiten"
            onClick={() => onboardingSeen.mutate()}
            className="shrink-0 rounded-full p-1 text-white/40 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {saveError && (
        <p className="mt-2 text-[12px] text-red-300/90">{saveError}</p>
      )}

      {data.candidates.length === 0 ? (
        <p className="mt-3 text-[12px] text-white/40">
          Nog geen bruikbare routekandidaten gevonden in je geïmporteerde
          ritten.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.candidates.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-white/[0.06] bg-map-panel/[0.55] p-3 backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.labels.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/70"
                      >
                        {l}
                      </span>
                    ))}
                    {c.userLabels && c.userLabels.length > 0 && (
                      <span className="text-[10px] text-white/35">
                        (door jou aangepast)
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-white/55">
                    {c.distanceKm != null ? `${c.distanceKm} km` : "afstand onbekend"}
                    {c.elevationM != null ? ` · ${Math.round(c.elevationM)} hm` : ""}
                    {` · ${c.rideCount}× gereden`}
                    {c.lastRiddenAt
                      ? ` · laatst ${new Date(c.lastRiddenAt).toLocaleDateString("nl-NL")}`
                      : ""}
                  </p>
                  {(c.trimmedStartM ?? 0) + (c.trimmedEndM ?? 0) > 0 && (
                    <p className="mt-0.5 text-[11px] text-amber-200/70">
                      Mogelijk vervoer vóór/na de rit is niet meegenomen (
                      {Math.round(
                        ((c.trimmedStartM ?? 0) + (c.trimmedEndM ?? 0)) / 100,
                      ) / 10}{" "}
                      km weggelaten).
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={c.favorite ? "Favoriet verwijderen" : "Favoriet maken"}
                    onClick={() =>
                      patch.mutate({ id: c.id, body: { favorite: !c.favorite } })
                    }
                    className="rounded-full p-1.5 hover:bg-white/[0.06]"
                  >
                    <Star
                      className="h-4 w-4"
                      style={{ color: c.favorite ? ACCENT : "rgba(255,255,255,0.3)" }}
                      fill={c.favorite ? ACCENT : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Route uitsluiten"
                    title="Uitsluiten (niet meer tonen of voorstellen)"
                    onClick={() =>
                      patch.mutate({ id: c.id, body: { excluded: true } })
                    }
                    className="rounded-full p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/60"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.quality && (
                  <button
                    type="button"
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/[0.08]"
                  >
                    Kwaliteit {c.quality.score}/100
                    {open === c.id ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLabelEditId(labelEditId === c.id ? null : c.id)
                    setLabelDraft((c.userLabels ?? c.autoLabels).join(", "))
                  }}
                  className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/[0.08]"
                >
                  Labels aanpassen
                </button>
                {c.savedRouteId == null ? (
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={() => save.mutate(c.id)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}
                  >
                    {save.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Bewaar als route
                  </button>
                ) : (
                  <span className="text-[11px] text-white/40">
                    Bewaard in je bibliotheek
                  </span>
                )}
              </div>

              {open === c.id && c.quality && (
                <ul className="mt-2 space-y-1 rounded-xl bg-white/[0.03] p-2.5">
                  {c.quality.factors.map((f) => (
                    <li
                      key={f.factor}
                      className="flex items-baseline justify-between gap-3 text-[11px]"
                    >
                      <span className="text-white/55">
                        {FACTOR_LABEL[f.factor] ?? f.factor}
                        <span className="ml-1 text-white/35">
                          — {f.toelichting}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-white/70">
                        {f.score}
                      </span>
                    </li>
                  ))}
                  <li className="pt-1 text-[10px] leading-relaxed text-white/35">
                    Deze score zegt niets over actuele veiligheid; bij bewaren
                    of starten wordt de route opnieuw gecontroleerd op
                    blokkades.
                  </li>
                </ul>
              )}

              {labelEditId === c.id && (
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const labels = labelDraft
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                    patch.mutate({ id: c.id, body: { userLabels: labels } })
                    setLabelEditId(null)
                  }}
                >
                  <input
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    placeholder="bijv. favoriet trainingsrondje, klimroute"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/80 placeholder:text-white/25"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                    style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}
                  >
                    Opslaan
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {data.excludedCount > 0 && (
        <p className="mt-2 text-[11px] text-white/30">
          {data.excludedCount} uitgesloten kandidaat
          {data.excludedCount === 1 ? "" : "en"} verborgen.
        </p>
      )}
    </section>
  )
}
