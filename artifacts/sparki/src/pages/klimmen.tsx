import { useEffect, useMemo, useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import { InteractiveElevationProfile } from "@/components/sparki/elevation-profile"
import { useClimbSearch, useClimbDetail } from "@/hooks/use-climbs"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import {
  KIND_LABEL,
  SOURCE_LABEL,
  type ClimbHit,
} from "@/lib/climb-types"
import {
  Search,
  ArrowLeft,
  Mountain,
  MapPin,
  ExternalLink,
  Loader2,
} from "lucide-react"

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return v
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message: unknown }).message)
    if (m) return m
  }
  return "Er ging iets mis. Probeer het zo opnieuw."
}

function ClimbRow({
  climb,
  onOpen,
}: {
  climb: ClimbHit
  onOpen: (c: ClimbHit) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(climb)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-white/20"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "rgba(120,210,230,0.10)" }}
      >
        <Mountain className="h-5 w-5" style={{ color: ACCENT }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[14px] text-white/90">
          {climb.name}
        </p>
        <p className="mt-0.5 text-[12px] text-white/45">
          {KIND_LABEL[climb.kind]}
          {climb.elevationM != null && ` · ${climb.elevationM} m hoog`}
        </p>
      </div>
    </button>
  )
}

function DetailView({
  climb,
  onBack,
}: {
  climb: ClimbHit
  onBack: () => void
}) {
  const { data, isLoading, isError, error } = useClimbDetail(climb.osmId)
  // Positie-cursor: hoogteprofiel ↔ kaart synchroon (aanwijzen/slepen/schuif).
  const [positionKm, setPositionKm] = useState<number | null>(null)

  // De echte getraceerde klimlijn (als het profiel afgeleid kon worden) —
  // daarmee tekent de kaart de beklimming zelf, met de top als eindpunt.
  const climbLine = data?.profile?.points ?? null

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 transition hover:text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Terug naar zoeken
      </button>

      <h2 className="mt-4 font-sans text-[20px] text-white/95">{climb.name}</h2>
      <p className="mt-1 text-[12px] text-white/45">
        {KIND_LABEL[climb.kind]}
        {climb.elevationM != null && ` · ${climb.elevationM} m hoog`}
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08]">
        <RouteMap
          geometry={climbLine ?? [[climb.lat, climb.lon]]}
          center={[climb.lat, climb.lon]}
          // De top altijd zichtbaar als verzamelpunt-achtige pin met naam —
          // ook wanneer er (nog) geen klimlijn getraceerd kon worden.
          meetpoints={[
            { name: climb.name, lat: climb.lat, lon: climb.lon, note: null },
          ]}
          positionKm={positionKm}
          onTrackPositionSelect={setPositionKm}
          interactive
          height={220}
        />
      </div>
      {climbLine && (
        <p className="mt-2 text-[11px] text-white/35">
          {data?.profile?.source === "way"
            ? "De lijn op de kaart is de echte weggeometrie van deze klimweg (OpenStreetMap)."
            : "De lijn op de kaart is de afgeleide klimroute naar de top."}
        </p>
      )}

      {isLoading && (
        <div className="mt-4 space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
      )}

      {isError && (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <p className="text-[13px] text-[rgba(255,140,120,0.9)]">
            {errorMessage(error)}
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Afgeleid klimprofiel — alleen als het echt getraceerd kon worden. */}
          {data.profile ? (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <SectionLabel n="01" title="Klimprofiel" />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                  afgeleid
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="Lengte" value={`${data.profile.lengthKm} km`} />
                <Stat
                  label="Gemiddeld"
                  value={`${data.profile.avgGradePct}%`}
                />
                <Stat label="Steilst" value={`${data.profile.maxGradePct}%`} />
                <Stat
                  label="Hoogtemeters"
                  value={`${data.profile.elevationGainM} m`}
                />
                {data.elevationM != null && (
                  <Stat label="Top" value={`${data.elevationM} m`} />
                )}
              </div>
              <InteractiveElevationProfile
                profile={data.profile.profile}
                distanceKm={data.profile.lengthKm}
                positionKm={positionKm}
                onPositionChange={setPositionKm}
                className="mt-1"
              />
              <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                {data.profile.source === "way"
                  ? "Lengte, stijgingspercentages en hoogtemeters zijn afgeleid uit de echte weggeometrie met hoogtedata — geen exacte meting."
                  : "Lengte, stijgingspercentages en hoogtemeters zijn afgeleid uit een echte routelijn naar de top — geen exacte meting."}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
              <SectionLabel n="01" title="Klimprofiel" />
              <p className="mt-2 text-[12px] leading-relaxed text-white/50">
                {data.profileUnavailableReason ??
                  "Het gedetailleerde klimprofiel is niet beschikbaar."}
              </p>
              {climb.elevationM != null && (
                <p className="mt-2 text-[12px] text-white/40">
                  Bekend: hoogte {climb.elevationM} m en locatie op de kaart.
                </p>
              )}
            </div>
          )}

          {/* Omschrijving — echt of eerlijk afwezig. */}
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <SectionLabel n="02" title="Omschrijving" />
            {data.description ? (
              <>
                <p className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {data.description.text}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/35">
                  Bron: {SOURCE_LABEL[data.description.source]}
                  {data.description.sourceUrl && (
                    <a
                      href={data.description.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-white/50 underline decoration-white/20 underline-offset-2 hover:text-white/80"
                    >
                      openen <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                Geen omschrijving beschikbaar voor deze klim.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-0.5 font-sans text-[15px] text-white/90">{value}</p>
    </div>
  )
}

function Explorer() {
  const [area, setArea] = useState("")
  const [name, setName] = useState("")
  const [radiusKm, setRadiusKm] = useState(15)
  const [selected, setSelected] = useState<ClimbHit | null>(null)

  // The query follows the inputs with a debounce, but the visible zoekknop
  // (and Enter) submits IMMEDIATELY — so searching never feels invisible.
  const [query, setQuery] = useState({ area: "", name: "" })
  const debouncedArea = useDebounced(area, 500)
  const debouncedName = useDebounced(name, 500)
  useEffect(() => {
    setQuery({ area: debouncedArea, name: debouncedName })
  }, [debouncedArea, debouncedName])
  const submitNow = () => setQuery({ area, name })

  const { data, isLoading, isError, error, isFetching, refetch } =
    useClimbSearch(query.area, query.name, radiusKm)

  const climbs = useMemo(() => data?.climbs ?? [], [data])

  if (selected) {
    return <DetailView climb={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      <SectionLabel n="01" title="Klimmenverkenner" />
      <p className="mt-2 text-[12px] leading-relaxed text-white/40">
        Zoek beklimmingen, cols en toppen op gebied of streek — met hoogte uit
        OpenStreetMap, een afgeleid klimprofiel en een omschrijving waar die
        bestaat.
      </p>

      <form
        className="mt-4 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          submitNow()
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#070d16]/[0.82] px-3.5 py-3 backdrop-blur-md">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            enterKeyHint="search"
            placeholder="Gebied of plaats (bijv. Limburg, Alpe d'Huez)"
            className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.10] bg-[#070d16]/[0.82] px-3.5 py-3 backdrop-blur-md">
          <Mountain className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="search"
            placeholder="Filter op naam (optioneel)"
            className="min-w-0 flex-1 bg-transparent font-sans text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={area.trim().length < 2 || isLoading || isFetching}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-sans text-[14px] font-semibold transition disabled:opacity-40"
          style={{ background: ACCENT, color: "#040506" }}
        >
          {isLoading || isFetching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              Bezig met zoeken…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" strokeWidth={2.25} />
              Zoek beklimmingen
            </>
          )}
        </button>
      </form>

      {/* Zoekstraal rond de gevonden plaats — instelbaar in km. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          Zoekcirkel
        </span>
        {[5, 10, 15, 25, 40, 60].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRadiusKm(r)}
            aria-pressed={radiusKm === r}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] transition ${
              radiusKm === r
                ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200"
                : "border-white/[0.12] text-white/50 hover:border-white/25 hover:text-white/75"
            }`}
          >
            {r} km
          </button>
        ))}
      </div>

      {data?.area && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-white/45">
          <MapPin className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Resultaten binnen {data.radiusKm} km rond {data.area.label}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {debouncedArea.trim().length < 2 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[12px] leading-relaxed text-white/40">
              Typ een gebied of streek om echte beklimmingen in de buurt te
              vinden.
            </p>
          </div>
        ) : isLoading || isFetching ? (
          <>
            {/* De zoektocht haalt live OpenStreetMap-data op en kan lang duren —
                zeg dat eerlijk, anders lijkt de knop kapot. */}
            <p className="flex items-center gap-2 text-[12px] text-white/50">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                style={{ color: ACCENT }}
              />
              Echte hoogtedata ophalen uit OpenStreetMap — dit kan tot zo'n 15
              seconden duren.
            </p>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] w-full animate-pulse rounded-2xl bg-white/[0.06]"
              />
            ))}
          </>
        ) : isError ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-[rgba(255,140,120,0.9)]">
              {errorMessage(error)}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-xl border border-white/[0.12] px-4 py-2 font-sans text-[12px] text-white/70 transition hover:border-white/25"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : climbs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[12px] leading-relaxed text-white/45">
              Geen benoemde beklimmingen gevonden in dit gebied. Probeer een
              andere streek of laat het naamfilter leeg.
            </p>
          </div>
        ) : (
          climbs.map((c) => (
            <ClimbRow key={c.osmId} climb={c} onOpen={setSelected} />
          ))
        )}
      </div>
    </div>
  )
}

export default function KlimmenPage() {
  const enabled = useFeatureFlag("climb_explorer")
  if (!enabled) {
    return (
      <ScreenShell bg="/atmosphere/routes-weg-droge-heuvels.webp" section="Klimmen">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-[13px] leading-relaxed text-white/50">
            De Klimmenverkenner is nog niet ingeschakeld voor je account.
          </p>
        </div>
      </ScreenShell>
    )
  }
  return (
    <ScreenShell bg="/atmosphere/routes-weg-droge-heuvels.webp" section="Klimmen">
      <Explorer />
    </ScreenShell>
  )
}
