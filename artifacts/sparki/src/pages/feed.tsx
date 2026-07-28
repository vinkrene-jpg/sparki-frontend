import { useEffect, useMemo, useState } from "react"
import { dagSfeer } from "@/lib/sfeer"
import { useUserProfile } from "@/contexts/UserContext"
import { Link } from "wouter"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { ClubChip } from "@/components/sparki/club-chip"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { NewsReader } from "@/components/sparki/news-reader"
import { useAiBrief } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useKnowledge } from "@/hooks/use-knowledge"
import { useFeedNews, type FeedNewsItem } from "@/hooks/use-feed-news"
import { useRaces } from "@/hooks/use-races"
import { useCoachAnalysis } from "@/hooks/use-coach-analysis"
import { useCircleFeed } from "@/hooks/use-social"
import { useDiscoverRoutes } from "@/hooks/use-routes"
import { useGarage } from "@/hooks/use-garage"
import {
  ATMOSPHERE,
  type AtmosphereAsset,
} from "@/lib/atmosphere-library"
import {
  classificeerNieuws,
  bewaardeKernwoorden,
  scoreKaart,
  mengFeed,
  stabieleIndex,
  type FeedKaart,
  type FeedKaartType,
} from "@/lib/ontdekken-feed"
import {
  leesFeedPrefs,
  toggleBewaard,
  minderVan,
  herstelMinder,
  type FeedPrefs,
} from "@/lib/feed-prefs"
import {
  Bike,
  Users,
  Flag,
  Newspaper,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Brain,
  LineChart,
  Mountain,
  Bookmark,
  Share2,
  EyeOff,
  Wrench,
  Route as RouteIcon,
  Lightbulb,
  MapPinned,
} from "lucide-react"

// ── Filters (compact, geen tabbladenwoud) ────────────────────────────────────

type FilterKey = "voorjou" | "vrienden" | "wedstrijd" | "routes" | "materiaal"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "voorjou", label: "Voor jou" },
  { key: "vrienden", label: "Vrienden" },
  { key: "wedstrijd", label: "Wedstrijd" },
  { key: "routes", label: "Routes" },
  { key: "materiaal", label: "Materiaal" },
]

const FILTER_TYPES: Record<FilterKey, FeedKaartType[] | null> = {
  voorjou: null, // alles, gemengd
  vrienden: ["vrienden"],
  wedstrijd: ["wedstrijd", "evenement"],
  routes: ["route", "klim"],
  materiaal: ["materiaal"],
}

// ── Kaarttype-metadata ───────────────────────────────────────────────────────

const TYPE_META: Record<
  FeedKaartType,
  { label: string; icon: typeof Users; kleur: string }
> = {
  nieuws: { label: "Nieuws", icon: Newspaper, kleur: "rgba(170,235,248,0.9)" },
  materiaal: { label: "Materiaal", icon: Wrench, kleur: "rgba(255,200,120,0.95)" },
  trainingstip: { label: "Trainingstip", icon: Lightbulb, kleur: "rgba(180,240,200,0.95)" },
  route: { label: "Route", icon: RouteIcon, kleur: "rgba(160,215,255,0.95)" },
  klim: { label: "Klim", icon: Mountain, kleur: "rgba(160,215,255,0.95)" },
  wedstrijd: { label: "Wedstrijd", icon: Flag, kleur: "rgba(255,180,190,0.95)" },
  vrienden: { label: "Vrienden", icon: Users, kleur: "rgba(170,235,248,0.9)" },
  evenement: { label: "Evenement", icon: Flag, kleur: "rgba(255,200,120,0.95)" },
  inzicht: { label: "Sparki", icon: Brain, kleur: "rgba(120,210,230,1)" },
  video: { label: "Video", icon: Newspaper, kleur: "rgba(170,235,248,0.9)" },
}

// Sfeerbeeld-pools per kaarttype — centrale atmosphere-bibliotheek, licht en
// warm, deterministisch per item. Beelden zijn sfeer (eigen bibliotheek),
// nooit gepresenteerd als foto van het artikel zelf.
const BEELD_POOL: Partial<Record<FeedKaartType, AtmosphereAsset[]>> = {
  nieuws: ATMOSPHERE.filter((a) => a.categorie.includes("wedstrijd")),
  wedstrijd: ATMOSPHERE.filter((a) => a.categorie.includes("wedstrijd")),
  evenement: ATMOSPHERE.filter((a) => a.categorie.includes("samen")),
  materiaal: ATMOSPHERE.filter((a) => a.id.startsWith("samen-fietsen")),
  trainingstip: ATMOSPHERE.filter((a) => a.categorie.includes("training")),
  route: ATMOSPHERE.filter((a) => a.categorie.includes("routes")),
  klim: ATMOSPHERE.filter((a) => a.categorie.includes("routes")),
}

function beeldVoor(kaart: FeedKaart): AtmosphereAsset | null {
  const pool = BEELD_POOL[kaart.type]
  if (!pool || pool.length === 0) return null
  return pool[stabieleIndex(kaart.key, pool.length)]
}

// ── Tijd-helpers ─────────────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} d`
  if (days < 30) return `${Math.floor(days / 7)} w`
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

function ymdToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function raceWhen(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Morgen"
  if (days < 14) return `over ${days} d`
  if (days < 60) return `over ${Math.round(days / 7)} w`
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
}

// ── Kaart-acties ─────────────────────────────────────────────────────────────

async function deelKaart(kaart: FeedKaart): Promise<"gedeeld" | "gekopieerd" | "mislukt"> {
  const url = kaart.extern
    ? kaart.link ?? ""
    : kaart.link
      ? `${window.location.origin}${kaart.link}`
      : window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: kaart.titel, url })
      return "gedeeld"
    }
  } catch {
    /* geannuleerd — val terug op kopiëren */
  }
  try {
    await navigator.clipboard.writeText(`${kaart.titel} — ${url}`)
    return "gekopieerd"
  } catch {
    return "mislukt"
  }
}

// ── Feedkaart-component ──────────────────────────────────────────────────────

function KaartActies({
  kaart,
  bewaard,
  onBewaar,
  onMinder,
}: {
  kaart: FeedKaart
  bewaard: boolean
  onBewaar: () => void
  onMinder: () => void
}) {
  const [deelStatus, setDeelStatus] = useState<string | null>(null)
  return (
    <div className="relative z-[2] mt-3 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onBewaar}
        aria-pressed={bewaard}
        aria-label={bewaard ? "Verwijder uit bewaard" : "Bewaar dit item"}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
          bewaard
            ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-200"
            : "border-white/10 text-white/40 hover:text-white/80"
        }`}
      >
        <Bookmark className="h-3.5 w-3.5" fill={bewaard ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={() => {
          void deelKaart(kaart).then((r) => {
            setDeelStatus(r === "gekopieerd" ? "Link gekopieerd" : r === "mislukt" ? "Delen lukte niet" : null)
            if (r !== "gedeeld") window.setTimeout(() => setDeelStatus(null), 2500)
          })
        }}
        aria-label="Deel dit item"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:text-white/80"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onMinder}
        aria-label="Minder hiervan tonen"
        title="Minder hiervan"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:text-white/80"
      >
        <EyeOff className="h-3.5 w-3.5" />
      </button>
      {deelStatus && (
        <span className="ml-1 font-mono text-[10px] tracking-wide text-white/45" role="status">
          {deelStatus}
        </span>
      )}
    </div>
  )
}

function FeedKaartView({
  kaart,
  toonBeeld,
  prefs,
  onPrefs,
  onOpenNieuws,
  userId,
}: {
  kaart: FeedKaart
  toonBeeld: boolean
  prefs: FeedPrefs
  onPrefs: (p: FeedPrefs) => void
  onOpenNieuws: (id: number) => void
  userId: string | null
}) {
  const meta = TYPE_META[kaart.type]
  // Artikelkaarten (met nieuwsId) tonen uitsluitend de échte foto uit het
  // artikel zelf; heeft het artikel er geen, dan géén foto — nooit een los
  // sfeerbeeld dat een relatie met het artikel suggereert.
  const isArtikel = kaart.ref?.nieuwsId != null
  const artikelBeeld = isArtikel && toonBeeld ? (kaart.beeldUrl ?? null) : null
  const beeld = toonBeeld && !isArtikel ? beeldVoor(kaart) : null
  const bewaard = prefs.bewaard.some((b) => b.key === kaart.key)
  const isInzicht = kaart.type === "inzicht"

  const open = () => {
    if (kaart.ref?.nieuwsId != null) onOpenNieuws(kaart.ref.nieuwsId)
    else if (kaart.link && kaart.extern) window.open(kaart.link, "_blank", "noopener,noreferrer")
    // interne links worden als <Link> gerenderd op de knop zelf
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
      {(artikelBeeld || beeld) && (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img
            src={artikelBeeld ?? beeld!.webp}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            style={artikelBeeld ? undefined : { objectPosition: beeld!.cropPositie }}
            onError={(e) => {
              // Externe artikelfoto laadt niet (verwijderd/hotlink-blokkade):
              // verberg het beeldvak — geen vervangend sfeerbeeld.
              const vak = e.currentTarget.parentElement
              if (vak) vak.style.display = "none"
            }}
          />
          {/* Alleen een compacte chip op rustig beeldgebied — geen tekst over drukke fotodelen, geen zware overlay */}
          <span
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm"
          >
            <meta.icon className="h-3 w-3" style={{ color: meta.kleur }} />
            {meta.label}
          </span>
          {/* A-04: generieke atmosphere-beelden expliciet markeren als sfeerbeeld,
              zodat niemand denkt dat dit de echte bronfoto/locatie is. Alleen
              wanneer het beeld uit de atmosphere-bibliotheek komt (beeld), nooit
              bij een echte artikelfoto (artikelBeeld). Subtiel, klein, onderin. */}
          {!artikelBeeld && beeld && (
            <span className="absolute bottom-2 right-3 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-sm">
              Sfeerbeeld
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[10px] tracking-[0.16em]" style={{ color: meta.kleur }}>
            {!beeld &&
              (isInzicht ? (
                <SparkiCore size={16} accent={ACCENT} readiness={0.9} variant="orb" />
              ) : (
                <meta.icon className="h-3 w-3" />
              ))}
            {/* Categorielabel alleen als er geen beeld-chip is (nooit dubbel) */}
            {!beeld && meta.label.toUpperCase()}
            {kaart.bron ? (
              <span className={`truncate ${beeld ? "" : "text-white/40"}`}>
                {beeld ? kaart.bron : ` · ${kaart.bron}`}
              </span>
            ) : null}
          </span>
          {kaart.tijdIso && (
            <span className="shrink-0 font-mono text-[10px] tracking-wide text-white/30">
              {kaart.type === "wedstrijd" || kaart.type === "evenement"
                ? raceWhen(kaart.tijdIso.slice(0, 10))
                : relTime(kaart.tijdIso)}
            </span>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 text-pretty font-sans text-[16px] font-light leading-snug text-white/92">
          {kaart.titel}
        </h3>

        {kaart.samenvatting && kaart.samenvatting.trim() !== kaart.titel.trim() && (
          <p className={`mt-1.5 line-clamp-3 text-pretty text-[12.5px] leading-relaxed ${isInzicht ? "text-white/65" : "text-white/50"}`}>
            {kaart.samenvatting}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {/* Eén duidelijke primaire actie */}
          {kaart.link && !kaart.extern ? (
            <Link
              href={kaart.link}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-300/15"
            >
              Openen <ArrowRight className="h-3 w-3" />
            </Link>
          ) : kaart.ref?.nieuwsId != null || (kaart.link && kaart.extern) ? (
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-300/15"
            >
              Openen
              {kaart.ref?.nieuwsId == null && kaart.extern ? (
                <ExternalLink className="h-3 w-3" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span />
          )}

          <KaartActies
            kaart={kaart}
            bewaard={bewaard}
            onBewaar={() =>
              onPrefs(
                toggleBewaard(userId, {
                  key: kaart.key,
                  titel: kaart.titel,
                  categorie: kaart.type,
                  url: kaart.link ?? undefined,
                  bron: kaart.bron ?? undefined,
                  bewaardOp: new Date().toISOString(),
                }),
              )
            }
            onMinder={() => onPrefs(minderVan(userId, kaart.type, kaart.bron))}
          />
        </div>
      </div>
    </article>
  )
}

// ── Zijbalk (desktop) ────────────────────────────────────────────────────────

function ZijbalkBlok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{titel}</p>
      <div className="mt-2.5 space-y-2">{children}</div>
    </div>
  )
}

// ── Meer ontdekken (bestaande secties, compact achter één ingang) ────────────

function MeerOntdekken() {
  const kennis = useFeatureFlag("knowledge_base")
  const klimmen = useFeatureFlag("climb_explorer")
  const items: { href: string; label: string; icon: typeof Brain }[] = [
    { href: "/lab", label: "Trends & patronen", icon: LineChart },
    ...(kennis ? [{ href: "/kennis", label: "Kennisbank", icon: BookOpen }] : []),
    ...(kennis ? [{ href: "/kennis?topic=mentaal", label: "Sterker in je hoofd", icon: Brain }] : []),
    ...(klimmen ? [{ href: "/klimmen", label: "Klimmenverkenner", icon: Mountain }] : []),
  ]
  return (
    <section>
      <SectionLabel title="Meer ontdekken" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition-colors hover:border-cyan-300/30"
          >
            <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
              <it.icon className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
              <span className="truncate">{it.label}</span>
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-white/30" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-white/[0.06] ${className}`} />
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { data: briefData, isLoading: briefLoading } = useAiBrief(true)
  const { data: newsData, isLoading: newsLoading } = useFeedNews()
  const { data: racesData, isLoading: raceLoading } = useRaces()
  const { data: coachData } = useCoachAnalysis()
  const { data: circleData, isLoading: teamLoading } = useCircleFeed()
  const { data: routesData } = useDiscoverRoutes()
  const kennisEnabled = useFeatureFlag("knowledge_base")
  const { data: knowledgeData } = useKnowledge({ type: "research", limit: 4, enabled: kennisEnabled })

  const [actief, setActief] = useState<FilterKey>("voorjou")
  const [readerItem, setReaderItem] = useState<FeedNewsItem | null>(null)
  // Voorkeuren zijn per gebruiker gescheiden (A-03): sleutel op clerkId.
  // Bij accountwissel zonder herladen laadt de effect hieronder direct de
  // voorkeuren van de nieuwe gebruiker — nooit oude state laten staan.
  const { profile } = useUserProfile()
  const userId = profile?.clerkId ?? null
  const [prefs, setPrefs] = useState<FeedPrefs>(() => leesFeedPrefs(userId))
  useEffect(() => {
    setPrefs(leesFeedPrefs(userId))
  }, [userId])

  const todayYmd = ymdToday()

  // ── Kaarten uit échte bronnen ──────────────────────────────────────────────
  const kaarten = useMemo<FeedKaart[]>(() => {
    const ctx = {
      todayIso: todayYmd,
      minderCategorie: prefs.minderCategorie,
      minderBron: prefs.minderBron,
      bewaardeTitels: prefs.bewaard.map((b) => b.titel),
    }
    const kernwoorden = bewaardeKernwoorden(ctx.bewaardeTitels)
    const ruw: Omit<FeedKaart, "score">[] = []

    // Sparki-inzicht: dagelijkse briefing (+ coach-kop als aparte compacte kaart)
    if (briefData?.brief) {
      ruw.push({
        key: "inzicht-brief",
        type: "inzicht",
        titel: "Sparki's briefing van vandaag",
        samenvatting: briefData.brief,
        bron: "Sparki",
        tijdIso: new Date().toISOString(),
        link: null,
        extern: false,
      })
    }
    if (coachData?.advice?.headline) {
      ruw.push({
        key: "inzicht-coach",
        type: "inzicht",
        titel: coachData.advice.headline,
        samenvatting: coachData.adviesVandaag ?? null,
        bron: "Sparki-coach",
        tijdIso: coachData.date ?? null,
        link: "/vandaag",
        extern: false,
      })
    }

    // Nieuws — deterministisch geclassificeerd in nieuws / materiaal / trainingstip
    for (const n of newsData?.items ?? []) {
      ruw.push({
        key: `news-${n.id}`,
        type: classificeerNieuws(n.titleNl ?? n.title, n.summary),
        titel: n.titleNl ?? n.title,
        samenvatting: n.summary ?? n.abstract ?? null,
        bron: n.source,
        tijdIso: n.publishedAt,
        link: n.url,
        extern: true,
        ref: { nieuwsId: n.id },
        beeldUrl: n.imageUrl ?? null,
      })
    }

    // Trainingstips uit de kennisbank (onderzoek, flag-gated)
    for (const k of knowledgeData?.items ?? []) {
      ruw.push({
        key: `kennis-${k.id}`,
        type: "trainingstip",
        titel: k.title,
        samenvatting: k.summary ?? null,
        bron: k.source ?? "Onderzoek",
        tijdIso: k.publishedAt,
        link: k.url,
        extern: true,
      })
    }

    // Eigen aankomende wedstrijden
    for (const r of racesData ?? []) {
      if (r.raceDate < todayYmd) continue
      ruw.push({
        key: `race-${r.id}`,
        type: "wedstrijd",
        titel: r.name,
        samenvatting: [r.location, r.priority ? `${r.priority}-wedstrijd` : null]
          .filter(Boolean)
          .join(" · ") || null,
        bron: null,
        tijdIso: `${r.raceDate}T00:00:00`,
        link: `/races/${r.id}`,
        extern: false,
        ref: { raceId: r.id },
      })
    }

    // Vrienden / team (Circle)
    for (const it of circleData?.items ?? []) {
      if (!it.type.startsWith("friend_") && it.type !== "sprint") continue
      ruw.push({
        key: `circle-${it.id}`,
        type: "vrienden",
        titel: it.title,
        samenvatting: it.detail,
        bron: it.displayName,
        tijdIso: it.at,
        link: "/samen",
        extern: false,
      })
    }

    // Routes uit de omgeving (gedeeld door anderen)
    for (const rt of (routesData?.routes ?? []).slice(0, 6)) {
      ruw.push({
        key: `route-${rt.id}`,
        type: "route",
        titel: rt.name,
        samenvatting:
          [
            rt.distanceKm != null ? `${Math.round(rt.distanceKm)} km` : null,
            rt.elevationGainM != null ? `${Math.round(rt.elevationGainM)} hm` : null,
            rt.surface || null,
            rt.eigenaarNaam ? `door ${rt.eigenaarNaam}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        bron: null,
        tijdIso: rt.createdAt,
        link: `/routes/${rt.id}`,
        extern: false,
        ref: { routeId: rt.id },
      })
    }

    const met = ruw.map((k) => ({ ...k, score: scoreKaart(k, ctx, kernwoorden) }))
    return mengFeed(met)
  }, [briefData, coachData, newsData, knowledgeData, racesData, circleData, routesData, prefs, todayYmd])

  const zichtbaar = useMemo(() => {
    const types = FILTER_TYPES[actief]
    return types ? kaarten.filter((k) => types.includes(k.type)) : kaarten
  }, [kaarten, actief])

  const loading = newsLoading || briefLoading || raceLoading || teamLoading
  const heeftDemping = prefs.minderCategorie.length > 0 || prefs.minderBron.length > 0

  const openNieuws = (id: number) => {
    const n = (newsData?.items ?? []).find((x) => x.id === id)
    if (n) setReaderItem(n)
  }

  // Zijbalkdata — alles afgeleid van dezelfde echte bronnen
  const trending = kaarten.filter((k) => ["nieuws", "materiaal", "trainingstip"].includes(k.type)).slice(0, 4)
  const komende = (racesData ?? [])
    .filter((r) => r.raceDate >= todayYmd)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 3)
  const routesNabij = (routesData?.routes ?? []).slice(0, 3)

  return (
    <CommercialShell actief="/feed" sfeer={dagSfeer("ontdekken")}>
      <div className="mx-auto w-full max-w-md px-6 pb-8 pt-12 lg:max-w-5xl lg:pt-8">
        {/* INTRO */}
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">RONDOM JOU</p>
          <ClubChip />
        </div>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Ontdekken
        </h1>

        {/* FILTERS */}
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = actief === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActief(f.key)}
                aria-pressed={on}
                className="rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors"
                style={{
                  borderColor: on ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
                  background: on ? "rgba(120,210,230,0.1)" : "transparent",
                  color: on ? ACCENT : "rgba(255,255,255,0.45)",
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {heeftDemping && (
          <div className="mt-3 flex items-center gap-2 font-mono text-[10px] tracking-wide text-white/40">
            <EyeOff className="h-3 w-3" />
            Sommige onderwerpen zijn gedempt (op dit apparaat).
            <button
              type="button"
              onClick={() => setPrefs(herstelMinder(userId))}
              className="text-cyan-200/80 underline-offset-2 hover:underline"
            >
              Herstel
            </button>
          </div>
        )}

        {/* FEED + ZIJBALK */}
        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          {/* Feedkolom */}
          <div className="flex flex-col gap-5">
            {actief === "materiaal" && <JouwMateriaalBlok />}

            {loading && zichtbaar.length === 0 && (
              <>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-white/[0.06]">
                    <Skeleton className="aspect-[16/9] w-full rounded-none" />
                    <div className="space-y-2 p-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </>
            )}

            {!loading && zichtbaar.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.1] py-10 text-center">
                <p className="mx-auto max-w-xs text-pretty text-[12px] leading-relaxed text-white/40">
                  {actief === "vrienden"
                    ? "Je volgt nog niemand. Voeg vrienden of teamgenoten toe om hun ritten hier te zien."
                    : actief === "wedstrijd"
                      ? "Nog geen aankomende wedstrijden. Voeg er een toe om ze hier te volgen."
                      : actief === "routes"
                        ? "Nog geen routes uit je omgeving gevonden."
                        : actief === "materiaal"
                          ? "Nog geen materiaalnieuws beschikbaar."
                          : "Nog niets te tonen — Sparki vult dit zodra er echte inhoud voor je is."}
                </p>
                {(actief === "vrienden" || actief === "wedstrijd") && (
                  <Link
                    href={actief === "vrienden" ? "/samen" : "/races"}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:bg-cyan-300/15"
                  >
                    {actief === "vrienden" ? "Naar je Circle" : "Wedstrijd toevoegen"}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}

            {zichtbaar.map((kaart, i) => (
              <FeedKaartView
                key={kaart.key}
                kaart={kaart}
                userId={userId}
                // Afwisseling: vrienden/inzicht compact; verder krijgt niet elke
                // opeenvolgende kaart een beeld zodat de feed rustig blijft.
                toonBeeld={kaart.type !== "vrienden" && kaart.type !== "inzicht" && i % 3 !== 2}
                prefs={prefs}
                onPrefs={setPrefs}
                onOpenNieuws={openNieuws}
              />
            ))}

            <div className="lg:hidden">
              <MeerOntdekken />
            </div>
          </div>

          {/* Zijbalk — alleen desktop */}
          <aside className="hidden lg:flex lg:flex-col lg:gap-4">
            {trending.length > 0 && (
              <ZijbalkBlok titel="Trending">
                {trending.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      if (t.ref?.nieuwsId != null) openNieuws(t.ref.nieuwsId)
                      else if (t.link && t.extern) window.open(t.link, "_blank", "noopener,noreferrer")
                    }}
                    className="block w-full text-left text-[12px] font-light leading-snug text-white/70 transition-colors hover:text-cyan-100"
                  >
                    <span className="line-clamp-2">{t.titel}</span>
                    {t.bron && <span className="mt-0.5 block font-mono text-[9px] tracking-wide text-white/30">{t.bron}</span>}
                  </button>
                ))}
              </ZijbalkBlok>
            )}
            {komende.length > 0 && (
              <ZijbalkBlok titel="Komende wedstrijden">
                {komende.map((r) => (
                  <Link key={r.id} href={`/races/${r.id}`} className="block text-[12px] font-light leading-snug text-white/70 transition-colors hover:text-cyan-100">
                    <span className="line-clamp-1">{r.name}</span>
                    <span className="mt-0.5 block font-mono text-[9px] tracking-wide text-white/30">{raceWhen(r.raceDate)}</span>
                  </Link>
                ))}
              </ZijbalkBlok>
            )}
            {routesNabij.length > 0 && (
              <ZijbalkBlok titel="Routes uit je omgeving">
                {routesNabij.map((rt) => (
                  <Link key={rt.id} href={`/routes/${rt.id}`} className="flex items-start gap-2 text-[12px] font-light leading-snug text-white/70 transition-colors hover:text-cyan-100">
                    <MapPinned className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
                    <span>
                      <span className="line-clamp-1">{rt.name}</span>
                      <span className="mt-0.5 block font-mono text-[9px] tracking-wide text-white/30">
                        {[rt.distanceKm != null ? `${Math.round(rt.distanceKm)} km` : null, rt.eigenaarNaam ? `door ${rt.eigenaarNaam}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                ))}
              </ZijbalkBlok>
            )}
            {prefs.bewaard.length > 0 && (
              <ZijbalkBlok titel="Bewaard (dit apparaat)">
                {prefs.bewaard.slice(0, 5).map((b) =>
                  b.url && b.url.startsWith("/") ? (
                    <Link key={b.key} href={b.url} className="block text-[12px] font-light leading-snug text-white/70 transition-colors hover:text-cyan-100">
                      <span className="line-clamp-2">{b.titel}</span>
                    </Link>
                  ) : (
                    <a key={b.key} href={b.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-light leading-snug text-white/70 transition-colors hover:text-cyan-100">
                      <span className="line-clamp-2">{b.titel}</span>
                    </a>
                  ),
                )}
              </ZijbalkBlok>
            )}
            <MeerOntdekken />
          </aside>
        </div>
      </div>

      {readerItem && <NewsReader item={readerItem} onClose={() => setReaderItem(null)} />}
    </CommercialShell>
  )
}


// Jouw materiaal — bij het Materiaal-filter hoort niet alleen nieuws, maar ook
// je eigen garage: je fiets(en) en de fietsscan. Alles komt uit echte
// garagedata; zonder fiets een directe actie in plaats van een lege staat.
function JouwMateriaalBlok() {
  const { data: garage, isLoading } = useGarage()
  if (isLoading) return null
  const bikes = (garage?.bikes ?? []).filter((b) => b.status === "actief")

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Jouw materiaal</p>
      {bikes.length === 0 ? (
        <>
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/55">
            Er staat nog geen fiets in je garage. Zet ’m erin, dan zie je hier je eigen materiaal
            naast het materiaalnieuws.
          </p>
          <Link
            href="/mechanieker"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:bg-cyan-300/15"
          >
            Fiets toevoegen
            <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {bikes.slice(0, 3).map((b) => (
            <Link
              key={b.id}
              href="/mechanieker"
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] px-3 py-2.5 transition-colors hover:border-white/[0.14]"
            >
              <Bike className="h-4 w-4 shrink-0 text-white/50" strokeWidth={1.5} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-white/85">{b.name}</span>
                <span className="block truncate font-mono text-[9px] uppercase tracking-wide text-white/35">
                  {[b.brand, b.model].filter(Boolean).join(" ") || b.bikeType}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/30" />
            </Link>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/mechanieker"
          className="rounded-full border border-white/[0.12] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60 transition-colors hover:border-white/25 hover:text-white/85"
        >
          Mechanieker
        </Link>
        {bikes.length > 0 && (
          <Link
            href="/mechanieker"
            className="rounded-full border border-white/[0.12] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60 transition-colors hover:border-white/25 hover:text-white/85"
          >
            Fietsscan
          </Link>
        )}
      </div>
    </div>
  )
}
