import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  UserPlus,
  UserCheck,
  Send,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Hand,
} from "lucide-react"
import {
  useToggleLike,
  useToggleSave,
  useRecordShare,
  useRecordView,
  useSetFollow,
  useWorldComments,
  useAddComment,
} from "@/hooks/use-world"
import type { WorldPost } from "@/lib/world-types"

// Plain-Dutch labels for internal kind keys (shared shape with wereld.tsx).
const KIND_LABEL: Record<string, string> = {
  training_log: "Training",
  photo: "Foto",
  story: "Verhaal",
  poll: "Poll",
  review: "Review",
  nutrition: "Voeding",
  humor: "Luchtig",
  observation: "Observatie",
  reel: "Clip",
  lifestyle: "Leven",
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function relativeDay(iso: string | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "vandaag"
  if (days === 1) return "gisteren"
  if (days < 7) return `${days} dagen geleden`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? "1 week geleden" : `${weeks} weken geleden`
}

function formatCount(n: number): string {
  if (n < 1000) return `${n}`
  const k = n / 1000
  return `${k.toFixed(k < 10 ? 1 : 0).replace(".", ",")}k`
}

function ReelAvatar({
  athlete,
  size = 40,
}: {
  athlete: { avatarUrl: string | null; name: string }
  size?: number
}) {
  if (athlete.avatarUrl) {
    return (
      <img
        src={athlete.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-accent-cyan/15 font-mono text-[11px] uppercase tracking-wider text-cyan-100"
      style={{ width: size, height: size }}
    >
      {initials(athlete.name)}
    </span>
  )
}

// A deterministic, calm gradient for text-only posts — never a fabricated image.
// Derived from the post id so the same post always reads the same.
// LICHT_THEMA_01-uitzondering (vertaalgids uitzondering 1): dit verloop is de
// media-vervanger bínnen de foto-kaart wanneer een post geen afbeelding heeft.
// De witte kaarttekst ligt eróp, dus het verloop blijft bewust donker voor
// leesbaarheid — dit is een leesbaarheidsmaatregel, geen thema-kleur.
function textGradient(seed: number): string {
  const hue = ((seed * 47) % 60) + 190 // cyan-leaning band, stays on-brand
  return `linear-gradient(160deg, oklch(0.30 0.07 ${hue}) 0%, #070d16 60%, #04060c 100%)`
}

// Comments as a bottom sheet overlay — never pushes the slide layout. Portals to
// body and sits above the bottom nav so its controls are always tappable.
function CommentsSheet({
  postId,
  onClose,
}: {
  postId: number
  onClose: () => void
}) {
  const { data, isLoading } = useWorldComments(postId)
  const addComment = useAddComment()
  const [draft, setDraft] = useState("")

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  const submit = () => {
    const body = draft.trim()
    if (body.length < 1) return
    addComment.mutate({ postId, body }, { onSuccess: () => setDraft("") })
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reacties"
        className="relative mx-auto flex max-h-[72dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-border bg-card backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[14px] font-semibold text-foreground">Reacties</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          {isLoading ? (
            <p className="text-[12px] text-muted-foreground">Reacties laden…</p>
          ) : data && data.comments.length > 0 ? (
            <ul className="flex flex-col gap-3 pb-2">
              {data.comments.map((c) => (
                <li key={c.id} className="text-[13px] leading-relaxed">
                  <span
                    className="font-medium"
                    style={{
                      color: c.byMe ? "var(--accent-cyan)" : "var(--color-foreground)",
                    }}
                  >
                    {c.authorName}
                  </span>{" "}
                  <span className="text-muted-foreground">{c.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Nog geen reacties. Wees de eerste.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
            maxLength={500}
            placeholder="Schrijf een reactie…"
            className="min-w-0 flex-1 rounded-full border border-border bg-muted px-3.5 py-2 text-[13px] text-foreground placeholder-muted-foreground outline-none focus:border-accent-cyan"
          />
          <button
            type="button"
            onClick={submit}
            disabled={addComment.isPending || draft.trim().length < 1}
            aria-label="Reactie plaatsen"
            className="rounded-full border border-accent-cyan p-2 text-accent-cyan transition-colors hover:bg-accent-cyan/10 disabled:opacity-40"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// One action in the TikTok-style right rail: stacked icon + count.
function RailAction({
  icon,
  label,
  count,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex flex-col items-center gap-1 disabled:opacity-50"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted backdrop-blur-sm transition-colors"
        style={{
          borderColor: active ? "var(--accent-cyan)" : "var(--color-border)",
          color: active ? "var(--accent-cyan)" : "var(--color-foreground)",
        }}
      >
        {icon}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] font-medium text-foreground/80">
          {formatCount(count)}
        </span>
      )}
    </button>
  )
}

function ReelSlide({
  post,
  index,
  initialSaved,
  onVisible,
  onOpenAthlete,
  onOpenComments,
}: {
  post: WorldPost
  index: number
  // Known-saved when this slide is rendered inside the "Bewaard" tab; the feed
  // response carries no per-post saved flag, so it defaults to false elsewhere.
  initialSaved: boolean
  // Reports this slide's current viewport coverage so the PARENT can pick the
  // single most-centered card. Centralising it there means the dwell-gated view
  // is recorded once for the active card only — small peeking neighbours can no
  // longer each fire their own "view" and pollute the learned-affinity model.
  onVisible: (index: number, ratio: number) => void
  onOpenAthlete: (slug: string) => void
  onOpenComments: (postId: number) => void
}) {
  const toggleLike = useToggleLike()
  const toggleSave = useToggleSave()
  const recordShare = useRecordShare()
  const setFollow = useSetFollow()
  const [saved, setSaved] = useState(initialSaved)
  const [shared, setShared] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  // Report coverage to the parent on every step; the parent owns "which card is
  // active" and the dwell timer. Multiple cards are visible at once now (the
  // carousel is horizontal with peeking neighbours), so per-slide recording was
  // wrong — only the centered card should count.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          onVisible(index, e.isIntersecting ? e.intersectionRatio : 0)
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    obs.observe(el)
    return () => {
      onVisible(index, 0)
      obs.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, index])

  const hasMedia = Boolean(post.mediaUrl)
  const captionLong = post.caption.length > 90

  return (
    // dir is reset to ltr so a left-handed (rtl) carousel never mirrors the
    // card's own Dutch text or layout — only the scroll direction flips.
    <section
      ref={ref}
      dir="ltr"
      className="w-[74vw] max-w-[290px] shrink-0 snap-start"
    >
      {/* The photo card — deliberately compact (4:5), not full-screen.
          LICHT_THEMA_01-uitzondering: alles binnen deze kaart ligt ÓP een foto
          (<img>). De donkere kaartbodem (bg-black), de leesbaarheids-scrims
          (from-black gradients), de badge-pills (bg-black/40..45) en de witte
          tekst/randen blijven bewust donker/wit — dit is een leesbaarheids-
          maatregel over de afbeelding, geen thema-kleur (zie vertaalgids
          uitzondering 1). */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Media layer — photo, or a calm gradient text slide when the post has
            no image (honest: nothing fabricated). */}
        {hasMedia ? (
          <img
            src={post.mediaUrl as string}
            alt=""
            loading={index < 3 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index < 3 ? "high" : "auto"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: textGradient(post.id) }}
          />
        )}

        {/* Legibility scrims — top + bottom, never opaque boxes. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/65 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Honesty marker — present on every slide. */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full border border-cyan-300/25 bg-black/40 px-2 py-0.5 backdrop-blur-sm">
          <Sparkles className="h-2.5 w-2.5 text-cyan-300/90" strokeWidth={1.75} />
          <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-cyan-100/90">
            Virtual Athlete · gesimuleerd
          </span>
        </div>

        {/* Kind + day, top-right. */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
            {KIND_LABEL[post.kind] ?? post.kind}
          </span>
        </div>

        {/* For text-only posts the caption is the hero, centred. */}
        {!hasMedia && (
          <div className="absolute inset-0 flex items-center justify-center px-5">
            <p className="max-h-[60%] overflow-hidden text-center text-[15px] font-medium leading-relaxed text-white/95 drop-shadow">
              {post.caption}
            </p>
          </div>
        )}

        {/* Athlete + follow, overlaid on the bottom of the photo. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2.5">
          <button
            type="button"
            onClick={() => onOpenAthlete(post.athlete.slug)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ReelAvatar athlete={post.athlete} size={30} />
            <div className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-white drop-shadow">
                {post.athlete.name}
              </span>
              <span className="block truncate text-[10px] text-white/70 drop-shadow">
                {[post.athlete.archetype, post.athlete.discipline]
                  .filter(Boolean)
                  .join(" · ") || "Virtual Athlete"}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              setFollow.mutate({
                athleteId: post.athlete.id,
                following: !post.isFollowing,
              })
            }
            disabled={setFollow.isPending}
            aria-label={post.isFollowing ? "Niet meer volgen" : "Volgen"}
            aria-pressed={post.isFollowing}
            className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm transition-colors"
            style={
              post.isFollowing
                ? { borderColor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }
                : { borderColor: "rgba(120,210,230,0.5)", color: "var(--accent-cyan)", background: "rgba(120,210,230,0.08)" }
            }
          >
            {post.isFollowing ? (
              <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Below the card: actions row + caption + day. */}
      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-4">
          <RailAction
            icon={
              <Heart
                className="h-4 w-4"
                strokeWidth={1.75}
                style={{ fill: post.likedByMe ? "var(--accent-cyan)" : "transparent" }}
              />
            }
            label={post.likedByMe ? "Like verwijderen" : "Like"}
            count={post.likeCount}
            active={post.likedByMe}
            onClick={() => toggleLike.mutate(post.id)}
            disabled={toggleLike.isPending}
          />
          <RailAction
            icon={<MessageCircle className="h-4 w-4" strokeWidth={1.75} />}
            label="Reacties"
            count={post.commentCount}
            onClick={() => onOpenComments(post.id)}
          />
          <RailAction
            icon={
              <Bookmark
                className="h-4 w-4"
                strokeWidth={1.75}
                style={{ fill: saved ? "var(--accent-cyan)" : "transparent" }}
              />
            }
            label={saved ? "Uit bewaard halen" : "Bewaren"}
            active={saved}
            onClick={() =>
              toggleSave.mutate(post.id, { onSuccess: (r) => setSaved(r.saved) })
            }
            disabled={toggleSave.isPending}
          />
          <RailAction
            icon={<Share2 className="h-4 w-4" strokeWidth={1.75} />}
            label="Delen"
            active={shared}
            onClick={() =>
              recordShare.mutate(post.id, { onSuccess: () => setShared(true) })
            }
            disabled={recordShare.isPending}
          />
          <span className="ml-auto text-[10px] text-muted-foreground">
            {relativeDay(post.publishedAt)}
          </span>
        </div>

        {/* On media posts the caption sits below; text posts already show it as
            the hero, so we skip the duplicate here. */}
        {hasMedia && (
          <div>
            <p
              className={`text-[12px] leading-relaxed text-foreground/85 ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {post.caption}
            </p>
            {captionLong && (
              <button
                type="button"
                onClick={() => setExpanded((s) => !s)}
                className="mt-0.5 text-[11px] font-medium text-accent-cyan"
              >
                {expanded ? "Minder" : "Meer"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// The full-screen, finger-swipeable media reel. Vertical scroll-snap so each post
// fills the viewport and the next one snaps into place — Instagram/TikTok style.
export function WorldReel({
  posts,
  onOpenAthlete,
  initialSaved = false,
}: {
  posts: WorldPost[]
  onOpenAthlete: (slug: string) => void
  // True when the reel renders the "Bewaard" tab — every post there is saved.
  initialSaved?: boolean
}) {
  const [commentsFor, setCommentsFor] = useState<number | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const recordView = useRecordView()
  // One authoritative "active card": each slide reports its viewport coverage,
  // the parent picks the most-covered one. This is what makes the dwell-gated
  // view honest now that several small cards are visible at once.
  const ratios = useRef<number[]>([])
  const seen = useRef<Set<number>>(new Set())
  const dwell = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleVisible = useCallback((index: number, ratio: number) => {
    ratios.current[index] = ratio
    let best = -1
    let bestRatio = 0
    for (let i = 0; i < ratios.current.length; i++) {
      const r = ratios.current[i] ?? 0
      if (r > bestRatio) {
        bestRatio = r
        best = i
      }
    }
    // Only treat a card as active once it's genuinely the dominant one in view.
    if (best >= 0 && bestRatio >= 0.6) setActiveIndex(best)
  }, [])

  // Dwell-gate the learning signal on the single active card: record a "view"
  // only after it has lingered ~1.4s. Fast swipes never pollute affinity, and a
  // peeking neighbour can never record itself — only the centered card counts.
  useEffect(() => {
    if (dwell.current !== undefined) clearTimeout(dwell.current)
    const post = posts[activeIndex]
    if (!post || seen.current.has(post.id)) return
    dwell.current = setTimeout(() => {
      seen.current.add(post.id)
      recordView.mutate(post.id)
    }, 1400)
    return () => {
      if (dwell.current !== undefined) clearTimeout(dwell.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, posts])
  // Handedness is a pure interaction preference (which way the thumb sweeps),
  // not athlete data — so it lives in localStorage, defaulting to right-handed.
  // Right-handed → swipe right-to-left (LTR); left-handed → the mirror (RTL).
  const [leftHanded, setLeftHanded] = useState(false)

  useEffect(() => {
    try {
      setLeftHanded(localStorage.getItem("sparki:reel-handedness") === "left")
    } catch {
      /* localStorage unavailable — keep the right-handed default */
    }
  }, [])

  const toggleHand = () => {
    setLeftHanded((v) => {
      const next = !v
      try {
        localStorage.setItem("sparki:reel-handedness", next ? "left" : "right")
      } catch {
        /* ignore — preference simply won't persist this session */
      }
      return next
    })
  }

  // Fade the swipe hint after a moment — it's a first-glance affordance only.
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3500)
    return () => clearTimeout(t)
  }, [])

  // Warm the next two photos into the browser cache the moment a slide becomes
  // active, so swiping forward shows the image instantly instead of a flash of
  // black while it downloads.
  useEffect(() => {
    for (let i = activeIndex + 1; i <= activeIndex + 2 && i < posts.length; i++) {
      const url = posts[i]?.mediaUrl
      if (url) {
        const img = new Image()
        img.decoding = "async"
        img.src = url
      }
    }
  }, [activeIndex, posts])

  return (
    <div className="relative -mx-6 px-6">
      {/* Handedness toggle — flips the swipe direction for left-handed riders. */}
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleHand}
          aria-label="Wissel veegrichting voor links- of rechtshandig"
          className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
        >
          <Hand
            className="h-3.5 w-3.5"
            strokeWidth={1.75}
            style={leftHanded ? { transform: "scaleX(-1)" } : undefined}
          />
          {leftHanded ? "Linkshandig" : "Rechtshandig"}
        </button>
      </div>

      {/* Horizontal card carousel. dir controls the sweep: LTR = swipe
          right-to-left (right-handed); RTL mirrors it for left-handed riders. */}
      <div
        dir={leftHanded ? "rtl" : "ltr"}
        onScroll={() => showHint && setShowHint(false)}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-contain scroll-smooth scroll-px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, i) => (
          <ReelSlide
            key={post.id}
            post={post}
            index={i}
            initialSaved={initialSaved}
            onVisible={handleVisible}
            onOpenAthlete={onOpenAthlete}
            onOpenComments={setCommentsFor}
          />
        ))}
      </div>

      {/* Swipe affordance — disappears on first scroll or after a few seconds.
          The arrow points the way the thumb should sweep for this handedness. */}
      {showHint && posts.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] text-foreground/85 shadow-card backdrop-blur-sm">
            {leftHanded ? (
              <ChevronRight className="h-3.5 w-3.5 animate-pulse" strokeWidth={2} />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 animate-pulse" strokeWidth={2} />
            )}
            Veeg voor meer
          </span>
        </div>
      )}

      {commentsFor != null && (
        <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
      )}
    </div>
  )
}
