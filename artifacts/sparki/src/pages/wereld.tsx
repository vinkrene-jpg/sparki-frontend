import { useState } from "react"
import {
  Heart,
  MessageCircle,
  ChevronLeft,
  UserPlus,
  UserCheck,
  Star,
  Send,
  Globe,
  Sparkles,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import {
  useWorldFeed,
  useWorldAthlete,
  useWorldComments,
  useSetFollow,
  useToggleLike,
  useAddComment,
} from "@/hooks/use-world"
import type { WorldAthlete, WorldPost } from "@/lib/world-types"

// Plain-Dutch labels for internal discipline/kind keys.
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

function Avatar({ athlete, size = 44 }: { athlete: WorldAthlete; size?: number }) {
  if (athlete.avatarUrl) {
    return (
      <img
        src={athlete.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-cyan-300/10 font-mono text-[11px] uppercase tracking-wider text-cyan-200/80"
      style={{ width: size, height: size }}
    >
      {initials(athlete.name)}
    </span>
  )
}

// The unmissable, honest marker: this whole surface is a simulation.
function WorldBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-3">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/80" strokeWidth={1.75} />
      <div>
        <p className="text-[13px] font-medium text-cyan-100/90">
          Sparki World — gesimuleerd
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
          Alle sporters hier zijn Virtual Athletes: verzonnen personages. Niets
          hiervan telt mee voor jouw eigen prestaties of analyse.
        </p>
      </div>
    </div>
  )
}

function VirtualTag() {
  return (
    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-200/70">
      Virtual Athlete
    </span>
  )
}

function FollowButton({
  athlete,
  isFollowing,
  isFavorite,
}: {
  athlete: WorldAthlete
  isFollowing: boolean
  isFavorite: boolean
}) {
  const setFollow = useSetFollow()
  const toggleFollow = () =>
    setFollow.mutate({ athleteId: athlete.id, following: !isFollowing })
  const toggleFavorite = () =>
    setFollow.mutate({
      athleteId: athlete.id,
      following: true,
      favorite: !isFavorite,
    })

  return (
    <div className="flex items-center gap-1.5">
      {isFollowing && (
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={setFollow.isPending}
          aria-label={isFavorite ? "Favoriet verwijderen" : "Markeer als favoriet"}
          title={isFavorite ? "Favoriet verwijderen" : "Markeer als favoriet"}
          className="rounded-full border border-white/12 p-1.5 transition-colors hover:border-cyan-300/40"
        >
          <Star
            className="h-3.5 w-3.5"
            strokeWidth={1.75}
            style={{
              color: isFavorite ? "var(--accent-cyan)" : "rgba(255,255,255,0.45)",
              fill: isFavorite ? "var(--accent-cyan)" : "transparent",
            }}
          />
        </button>
      )}
      <button
        type="button"
        onClick={toggleFollow}
        disabled={setFollow.isPending}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
        style={
          isFollowing
            ? { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
            : { borderColor: "rgba(120,210,230,0.4)", color: "var(--accent-cyan)" }
        }
      >
        {isFollowing ? (
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
  )
}

function Comments({ postId }: { postId: number }) {
  const { data, isLoading } = useWorldComments(postId)
  const addComment = useAddComment()
  const [draft, setDraft] = useState("")

  const submit = () => {
    const body = draft.trim()
    if (body.length < 1) return
    addComment.mutate(
      { postId, body },
      { onSuccess: () => setDraft("") },
    )
  }

  return (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      {isLoading ? (
        <p className="text-[12px] text-white/40">Reacties laden…</p>
      ) : data && data.comments.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {data.comments.map((c) => (
            <li key={c.id} className="text-[13px] leading-relaxed">
              <span
                className="font-medium"
                style={{ color: c.byMe ? "var(--accent-cyan)" : "rgba(255,255,255,0.85)" }}
              >
                {c.authorName}
              </span>{" "}
              <span className="text-white/70">{c.body}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-white/40">Nog geen reacties. Wees de eerste.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
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
  )
}

function PostCard({
  post,
  onOpenAthlete,
}: {
  post: WorldPost
  onOpenAthlete: (slug: string) => void
}) {
  const toggleLike = useToggleLike()
  const [showComments, setShowComments] = useState(false)

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenAthlete(post.athlete.slug)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <Avatar athlete={post.athlete} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold text-white">
                {post.athlete.name}
              </span>
              <VirtualTag />
            </div>
            <p className="truncate text-[11px] text-white/45">
              {[post.athlete.archetype, post.athlete.discipline]
                .filter(Boolean)
                .join(" · ") || "Virtual Athlete"}
            </p>
          </div>
        </button>
        <FollowButton
          athlete={post.athlete}
          isFollowing={post.isFollowing}
          isFavorite={post.isFavorite}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/50">
          {KIND_LABEL[post.kind] ?? post.kind}
        </span>
        <span className="text-[11px] text-white/35">{relativeDay(post.publishedAt)}</span>
      </div>

      {post.mediaUrl && (
        <img
          src={post.mediaUrl}
          alt=""
          className="mt-3 w-full rounded-xl border border-white/[0.06] object-cover"
        />
      )}

      <p className="mt-3 text-[14px] leading-relaxed text-white/85">{post.caption}</p>

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => toggleLike.mutate(post.id)}
          disabled={toggleLike.isPending}
          className="flex items-center gap-1.5 text-[13px] transition-colors"
          style={{ color: post.likedByMe ? "var(--accent-cyan)" : "rgba(255,255,255,0.55)" }}
          aria-label={post.likedByMe ? "Like verwijderen" : "Like"}
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={1.75}
            style={{ fill: post.likedByMe ? "var(--accent-cyan)" : "transparent" }}
          />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white/80"
          aria-label="Reacties"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>
      </div>

      {showComments && <Comments postId={post.id} />}
    </article>
  )
}

const REL_LABEL: Record<string, string> = {
  friend: "Vriend",
  rival: "Rivaal",
  teammate: "Ploeggenoot",
  coach: "Coach",
  family: "Familie",
}

function AthleteProfile({
  slug,
  onBack,
  onOpenAthlete,
}: {
  slug: string
  onBack: () => void
  onOpenAthlete: (slug: string) => void
}) {
  const { data, isLoading, error } = useWorldAthlete(slug)

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
      >
        <ChevronLeft className="h-4 w-4" /> Terug naar de wereld
      </button>

      {isLoading ? (
        <p className="text-[13px] text-white/45">Profiel laden…</p>
      ) : error || !data ? (
        <p className="text-[13px] text-amber-200/70">
          Dit profiel kon niet worden geladen.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <Avatar athlete={data.athlete} size={64} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-[18px] font-semibold text-white">
                      {data.athlete.name}
                    </h1>
                    <VirtualTag />
                  </div>
                  <p className="mt-0.5 text-[12px] text-white/50">
                    {[
                      data.athlete.archetype,
                      data.athlete.discipline,
                      data.athlete.level,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/40">
                    {[
                      data.athlete.city,
                      data.athlete.nationality,
                      data.athlete.age ? `${data.athlete.age} jaar` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <FollowButton
                athlete={data.athlete}
                isFollowing={data.isFollowing}
                isFavorite={data.isFavorite}
              />
            </div>

            {data.athlete.bio && (
              <p className="mt-4 text-[14px] leading-relaxed text-white/80">
                {data.athlete.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {data.athlete.team && (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60">
                  {data.athlete.team}
                </span>
              )}
              {data.athlete.ftp != null && (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60">
                  FTP {data.athlete.ftp} W
                </span>
              )}
            </div>

            {data.relationships.length > 0 && (
              <div className="mt-4 border-t border-white/[0.07] pt-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
                  Connecties
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.relationships.map((r) => (
                    <button
                      key={`${r.kind}-${r.slug}`}
                      type="button"
                      onClick={() => onOpenAthlete(r.slug)}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/65 transition-colors hover:border-cyan-300/40 hover:text-cyan-200"
                    >
                      <span className="text-white/40">{REL_LABEL[r.kind] ?? r.kind}: </span>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {data.posts.length === 0 ? (
              <p className="text-[13px] text-white/45">
                Nog geen berichten van deze sporter.
              </p>
            ) : (
              data.posts.map((p) => (
                <PostCard key={p.id} post={p} onOpenAthlete={onOpenAthlete} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function WereldPage() {
  const { data, isLoading, error } = useWorldFeed()
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  return (
    <ScreenShell section="wereld">
      {openSlug ? (
        <AthleteProfile
          slug={openSlug}
          onBack={() => setOpenSlug(null)}
          onOpenAthlete={setOpenSlug}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-300/80" strokeWidth={1.75} />
            <h1 className="text-[20px] font-semibold text-white">Sparki World</h1>
          </div>

          <WorldBanner />

          {isLoading ? (
            <p className="text-[13px] text-white/45">De wereld wordt geladen…</p>
          ) : error ? (
            <p className="text-[13px] text-amber-200/70">
              De wereld kon niet worden geladen. Probeer het later opnieuw.
            </p>
          ) : !data || data.items.length === 0 ? (
            <p className="text-[13px] text-white/45">
              Er zijn nog geen berichten in Sparki World.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.items.map((post) => (
                <PostCard key={post.id} post={post} onOpenAthlete={setOpenSlug} />
              ))}
            </div>
          )}
        </div>
      )}
    </ScreenShell>
  )
}
