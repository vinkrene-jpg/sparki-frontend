import { useEffect, useRef, useState } from "react"
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
  ChevronUp,
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
        className="shrink-0 rounded-full border border-white/30 object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-white/30 bg-cyan-300/15 font-mono text-[11px] uppercase tracking-wider text-cyan-100"
      style={{ width: size, height: size }}
    >
      {initials(athlete.name)}
    </span>
  )
}

// A deterministic, calm gradient for text-only posts — never a fabricated image.
// Derived from the post id so the same post always reads the same.
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
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reacties"
        className="relative mx-auto flex max-h-[72dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-white/10 bg-[#070d16]/95 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[14px] font-semibold text-white">Reacties</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-full border border-white/15 p-1.5 text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          {isLoading ? (
            <p className="text-[12px] text-white/40">Reacties laden…</p>
          ) : data && data.comments.length > 0 ? (
            <ul className="flex flex-col gap-3 pb-2">
              {data.comments.map((c) => (
                <li key={c.id} className="text-[13px] leading-relaxed">
                  <span
                    className="font-medium"
                    style={{
                      color: c.byMe ? "var(--accent-cyan)" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {c.authorName}
                  </span>{" "}
                  <span className="text-white/70">{c.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-white/40">
              Nog geen reacties. Wees de eerste.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
            maxLength={500}
            placeholder="Schrijf een reactie…"
            className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[13px] text-white placeholder-white/30 outline-none focus:border-cyan-300/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={addComment.isPending || draft.trim().length < 1}
            aria-label="Reactie plaatsen"
            className="rounded-full border border-cyan-300/30 p-2 text-cyan-300 transition-colors hover:bg-cyan-300/10 disabled:opacity-40"
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
        className="flex h-11 w-11 items-center justify-center rounded-full border bg-black/35 backdrop-blur-sm transition-colors"
        style={{
          borderColor: active ? "rgba(120,210,230,0.6)" : "rgba(255,255,255,0.18)",
          color: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.92)",
        }}
      >
        {icon}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[11px] font-medium text-white drop-shadow">
          {formatCount(count)}
        </span>
      )}
    </button>
  )
}

function ReelSlide({
  post,
  initialSaved,
  onOpenAthlete,
  onOpenComments,
}: {
  post: WorldPost
  // Known-saved when this slide is rendered inside the "Bewaard" tab; the feed
  // response carries no per-post saved flag, so it defaults to false elsewhere.
  initialSaved: boolean
  onOpenAthlete: (slug: string) => void
  onOpenComments: (postId: number) => void
}) {
  const toggleLike = useToggleLike()
  const toggleSave = useToggleSave()
  const recordShare = useRecordShare()
  const recordView = useRecordView()
  const setFollow = useSetFollow()
  const [saved, setSaved] = useState(initialSaved)
  const [shared, setShared] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLElement | null>(null)
  const seen = useRef(false)

  // Fire a single "view" when this slide is the one in view.
  useEffect(() => {
    const el = ref.current
    if (!el || seen.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6 && !seen.current) {
            seen.current = true
            recordView.mutate(post.id)
            obs.disconnect()
          }
        }
      },
      { threshold: [0.6] },
    )
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  const hasMedia = Boolean(post.mediaUrl)
  const captionLong = post.caption.length > 120

  return (
    <section
      ref={ref}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
    >
      {/* Media layer — full-bleed photo, or a calm gradient text slide when the
          post has no image (honest: nothing fabricated). */}
      {hasMedia ? (
        <img
          src={post.mediaUrl as string}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: textGradient(post.id) }}
        />
      )}

      {/* Legibility scrims — top + bottom, never opaque boxes. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {/* Honesty marker — present on every slide. */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-black/35 px-2.5 py-1 backdrop-blur-sm">
        <Sparkles className="h-3 w-3 text-cyan-300/90" strokeWidth={1.75} />
        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/90">
          Virtual Athlete · gesimuleerd
        </span>
      </div>

      {/* For text-only posts the caption is the hero, centred. */}
      {!hasMedia && (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p className="max-h-[55%] overflow-hidden text-center text-[20px] font-medium leading-relaxed text-white/95 drop-shadow">
            {post.caption}
          </p>
        </div>
      )}

      {/* Right action rail — TikTok layout. Lifted clear of the fixed bottom nav. */}
      <div className="absolute bottom-32 right-3 flex flex-col items-center gap-4">
        <RailAction
          icon={
            <Heart
              className="h-5 w-5"
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
          icon={<MessageCircle className="h-5 w-5" strokeWidth={1.75} />}
          label="Reacties"
          count={post.commentCount}
          onClick={() => onOpenComments(post.id)}
        />
        <RailAction
          icon={
            <Bookmark
              className="h-5 w-5"
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
          icon={<Share2 className="h-5 w-5" strokeWidth={1.75} />}
          label="Delen"
          active={shared}
          onClick={() =>
            recordShare.mutate(post.id, { onSuccess: () => setShared(true) })
          }
          disabled={recordShare.isPending}
        />
      </div>

      {/* Bottom-left meta — athlete, follow, caption. Padded clear of the nav. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-4 pb-28 pr-20">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenAthlete(post.athlete.slug)}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <ReelAvatar athlete={post.athlete} />
            <div className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-white drop-shadow">
                {post.athlete.name}
              </span>
              <span className="block truncate text-[11px] text-white/70 drop-shadow">
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
            className="ml-1 flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm transition-colors"
            style={
              post.isFollowing
                ? { borderColor: "rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }
                : { borderColor: "rgba(120,210,230,0.5)", color: "var(--accent-cyan)", background: "rgba(120,210,230,0.08)" }
            }
          >
            {post.isFollowing ? (
              <>
                <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> Volgend
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} /> Volgen
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
            {KIND_LABEL[post.kind] ?? post.kind}
          </span>
          <span className="text-[11px] text-white/60 drop-shadow">
            {relativeDay(post.publishedAt)}
          </span>
        </div>

        {/* On media posts the caption sits at the bottom; text posts already show
            it as the hero, so we skip the duplicate here. */}
        {hasMedia && (
          <div>
            <p
              className={`text-[14px] leading-relaxed text-white/90 drop-shadow ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {post.caption}
            </p>
            {captionLong && (
              <button
                type="button"
                onClick={() => setExpanded((s) => !s)}
                className="mt-0.5 text-[12px] font-medium text-cyan-200/90"
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

  // Fade the swipe hint after a moment — it's a first-glance affordance only.
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative -mx-6">
      <div
        onScroll={() => showHint && setShowHint(false)}
        className="h-[calc(100dvh-11rem)] min-h-[460px] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth rounded-2xl border border-white/[0.06] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => (
          <ReelSlide
            key={post.id}
            post={post}
            initialSaved={initialSaved}
            onOpenAthlete={onOpenAthlete}
            onOpenComments={setCommentsFor}
          />
        ))}
      </div>

      {/* Swipe affordance — disappears on first scroll or after a few seconds. */}
      {showHint && posts.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-sm">
            <ChevronUp className="h-3.5 w-3.5 animate-bounce" strokeWidth={2} />
            Swipe voor meer
          </span>
        </div>
      )}

      {commentsFor != null && (
        <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
      )}
    </div>
  )
}
