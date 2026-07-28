import { useState } from "react"
import { Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { HumorLine } from "@/components/sparki/humor-line"
import { queryKeys } from "@/lib/query-keys"
import {
  useFriends,
  useFriendRequests,
  useAthleteSearch,
  useCircleFeed,
  useJointTrainingSuggestion,
  useProposals,
  useTeamIdentity,
  useSendFriendRequest,
  useRespondFriendRequest,
  useSetTrainingBuddy,
  useRemoveFriend,
  useCreateProposal,
  useRespondToProposal,
  useSocialOverview,
  useUnfollowUser,
  useMatchContacts,
  type PersonSummary,
  type FriendSummary,
  type CircleFeedItem,
  type ReceivedProposal,
  type SentProposal,
} from "@/hooks/use-social"
import { useFeedNews, type FeedNewsItem } from "@/hooks/use-feed-news"
import {
  useAnswerFollowUp,
  useDismissFollowUp,
} from "@/hooks/use-context-memory"
import {
  Users,
  UserPlus,
  Search,
  Star,
  X,
  Check,
  Activity,
  Flag,
  Bike,
  Moon,
  CalendarPlus,
  Shield,
  Trash2,
  Sparkles,
  Newspaper,
  Zap,
  Send,
  UserCircle,
  Link2,
  BookUser,
} from "lucide-react"
import { useCreateInvitation } from "@/hooks/use-invitations"

// ── Shared atoms ─────────────────────────────────────────────────────────────
function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  )
}

function Avatar({ name, color }: { name: string; color?: string | null }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 font-sans text-[12px] font-medium text-white/85"
      style={{ background: color ? `${color}22` : "rgba(255,255,255,0.05)" }}
    >
      {initials}
    </span>
  )
}

const WEEKDAY_LABEL: Record<string, string> = {
  mon: "ma",
  tue: "di",
  wed: "wo",
  thu: "do",
  fri: "vr",
  sat: "za",
  sun: "zo",
}

const SPORT_LABEL: Record<string, string> = {
  cycling: "Wielrennen",
  running: "Hardlopen",
  triathlon: "Triatlon",
  mtb: "Mountainbike",
  gravel: "Gravel",
}

function sportLabel(sport?: string | null): string | null {
  if (!sport) return null
  return SPORT_LABEL[sport.toLowerCase()] ?? sport
}

const STATUS_LABEL: Record<string, string> = {
  proposed: "In afwachting",
  accepted: "Geaccepteerd",
  declined: "Afgewezen",
  expired: "Verlopen",
}

function statusColor(status: string): string {
  if (status === "accepted") return ACCENT
  if (status === "declined") return "rgba(255,140,120,0.85)"
  if (status === "expired") return "rgba(255,255,255,0.35)"
  return "rgba(255,255,255,0.55)"
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const FEED_ICON: Record<CircleFeedItem["type"] | "news", typeof Activity> = {
  follow_up: Sparkles,
  my_race: Flag,
  friend_training: Activity,
  friend_race: Flag,
  friend_buddy: Bike,
  friend_rest: Moon,
  sprint: Zap,
  news: Newspaper,
}

// ── Friend requests ──────────────────────────────────────────────────────────
function FriendRequests() {
  const { data } = useFriendRequests()
  const respond = useRespondFriendRequest()
  const requests = data?.requests ?? []
  if (requests.length === 0) return null

  return (
    <section>
      <SectionLabel title="Verzoeken" />
      <div className="mt-3 flex flex-col gap-2">
        {requests.map((r) => (
          <GlassCard key={r.id}>
            <div className="flex items-center gap-3">
              <Avatar name={r.displayName} />
              <div className="flex-1">
                <p className="text-[14px] text-white/90">{r.displayName}</p>
                <p className="font-mono text-[10px] tracking-wide text-white/40">
                  {r.direction === "incoming"
                    ? "wil je toevoegen"
                    : "verzoek verstuurd"}
                </p>
              </div>
              {r.direction === "incoming" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Accepteren"
                    onClick={() =>
                      respond.mutate({ id: r.id, accept: true })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: ACCENT }}
                  >
                    <Check
                      className="h-4 w-4"
                      style={{ color: "#040506" }}
                      strokeWidth={2.5}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Afwijzen"
                    onClick={() =>
                      respond.mutate({ id: r.id, accept: false })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/50"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <span className="font-mono text-[10px] tracking-wide text-white/30">
                  In afwachting
                </span>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}

// ── Add friend ───────────────────────────────────────────────────────────────
function AddFriend() {
  const [query, setQuery] = useState("")
  const { data, isFetching } = useAthleteSearch(query)
  const send = useSendFriendRequest()
  const results = data?.results ?? []

  return (
    <section>
      <SectionLabel title="Sporter zoeken" />
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5">
        <Search className="h-4 w-4 text-white/35" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Naam van een sporter…"
          className="w-full bg-transparent font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:outline-none"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="mt-2 flex flex-col gap-2">
          {isFetching && results.length === 0 ? (
            <p className="px-1 font-mono text-[11px] text-white/30">Zoeken…</p>
          ) : results.length === 0 ? (
            <p className="px-1 font-mono text-[11px] text-white/30">
              Geen sporters gevonden
            </p>
          ) : (
            results.map((r) => (
              <GlassCard key={r.clerkId}>
                <div className="flex items-center gap-3">
                  <Avatar name={r.displayName} />
                  <div className="flex-1">
                    <p className="text-[14px] text-white/90">
                      {r.displayName}
                    </p>
                    <p className="font-mono text-[10px] tracking-wide text-white/40">
                      {[sportLabel(r.sport), r.club].filter(Boolean).join(" · ") || "Sporter"}
                    </p>
                  </div>
                  {r.relation === "friends" ? (
                    <span className="font-mono text-[10px] tracking-wide text-white/35">
                      Verbonden
                    </span>
                  ) : r.relation === "pending" ? (
                    <span className="font-mono text-[10px] tracking-wide text-white/35">
                      In afwachting
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send.mutate(r.clerkId)}
                      disabled={send.isPending}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold disabled:opacity-40"
                      style={{ background: ACCENT, color: "#040506" }}
                    >
                      <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                      Toevoegen
                    </button>
                  )}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}
    </section>
  )
}

// ── Netwerkoverzicht: vrienden / volgers / gevolgd ───────────────────────────
function PersonRow({
  person,
  action,
}: {
  person: PersonSummary
  action?: React.ReactNode
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-3">
        <Avatar name={person.displayName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] text-white/90">
            {person.displayName}
          </p>
          <p className="truncate font-mono text-[10px] tracking-wide text-white/40">
            {[sportLabel(person.sport), person.club].filter(Boolean).join(" · ") ||
              "Sporter"}
          </p>
        </div>
        <Link
          href={`/profiel/${person.clerkId}`}
          aria-label="Profiel bekijken"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/40 transition-colors hover:text-white/80"
        >
          <UserCircle className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        {action}
      </div>
    </GlassCard>
  )
}

function NetwerkOverzicht() {
  const { data, isLoading } = useSocialOverview()
  const unfollow = useUnfollowUser()
  const [tab, setTab] = useState<"volgers" | "gevolgd" | null>(null)
  const counts = data?.counts

  const TABS = [
    { key: "vrienden" as const, label: "Mijn vrienden", n: counts?.vrienden },
    { key: "volgers" as const, label: "Volgers", n: counts?.volgers },
    { key: "gevolgd" as const, label: "Gevolgd", n: counts?.gevolgd },
  ]

  return (
    <section>
      <SectionLabel n="02" title="Jouw netwerk" />
      {isLoading ? (
        <div className="mt-3 h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() =>
                  t.key === "vrienden"
                    ? document
                        .getElementById("mijn-vrienden")
                        ?.scrollIntoView({ behavior: "smooth" })
                    : setTab(tab === t.key ? null : t.key)
                }
                className="rounded-2xl border p-3 text-center transition-colors"
                style={{
                  borderColor:
                    tab === t.key
                      ? "rgba(120,210,230,0.4)"
                      : "rgba(255,255,255,0.08)",
                  background:
                    tab === t.key
                      ? "rgba(120,210,230,0.07)"
                      : "rgba(7,13,22,0.82)",
                }}
              >
                <p className="text-[20px] font-light text-white">{t.n ?? 0}</p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45">
                  {t.label}
                </p>
              </button>
            ))}
          </div>
          {tab === "volgers" && (
            <div className="mt-2 flex flex-col gap-2">
              {(data?.volgers ?? []).length === 0 ? (
                <p className="px-1 text-[12px] text-white/40">
                  Nog niemand volgt je.
                </p>
              ) : (
                data!.volgers.map((p) => <PersonRow key={p.clerkId} person={p} />)
              )}
            </div>
          )}
          {tab === "gevolgd" && (
            <div className="mt-2 flex flex-col gap-2">
              {(data?.gevolgd ?? []).length === 0 ? (
                <p className="px-1 text-[12px] text-white/40">
                  Je volgt nog niemand. Open een profiel en kies "Volgen".
                </p>
              ) : (
                data!.gevolgd.map((p) => (
                  <PersonRow
                    key={p.clerkId}
                    person={p}
                    action={
                      <button
                        type="button"
                        disabled={unfollow.isPending}
                        onClick={() => unfollow.mutate(p.clerkId)}
                        className="rounded-full border border-white/12 px-3 py-1.5 font-sans text-[11px] text-white/50 disabled:opacity-40"
                      >
                        Ontvolgen
                      </button>
                    }
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ── Mensen vinden: contacten (met toestemming) + uitnodigingslink ────────────
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  )
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function MensenVinden() {
  const match = useMatchContacts()
  const send = useSendFriendRequest()
  const createInvite = useCreateInvitation()
  const [contactState, setContactState] = useState<
    "idle" | "unsupported" | "busy" | "done"
  >("idle")
  const [matches, setMatches] = useState<PersonSummary[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const pickContacts = async () => {
    // Contact Picker API: de gebruiker kiest ZELF welke contacten hij deelt.
    // Alleen sha256-hashes van e-mailadressen gaan naar de server; er wordt
    // niets opgeslagen en geen adresboek geüpload.
    const nav = navigator as Navigator & {
      contacts?: { select: (p: string[], o?: { multiple?: boolean }) => Promise<{ email?: string[] }[]> }
    }
    if (!nav.contacts?.select) {
      setContactState("unsupported")
      return
    }
    try {
      setContactState("busy")
      const picked = await nav.contacts.select(["email"], { multiple: true })
      const emails = picked
        .flatMap((c) => c.email ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
      if (emails.length === 0) {
        setContactState("done")
        setMatches([])
        return
      }
      const hashes = await Promise.all(emails.map(sha256Hex))
      const result = await match.mutateAsync(hashes)
      setMatches(result.matches ?? [])
      setContactState("done")
    } catch {
      setContactState("idle")
    }
  }

  const makeInviteLink = () => {
    createInvite.mutate(
      { relationship: "friend_athlete" } as never,
      {
        onSuccess: (inv: { token?: string }) => {
          if (inv?.token)
            setInviteUrl(`${window.location.origin}/uitnodiging/${inv.token}`)
        },
      },
    )
  }

  return (
    <section>
      <SectionLabel title="Mensen vinden" />
      <div className="mt-3 flex flex-col gap-2">
        <GlassCard>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10">
              <BookUser className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] text-white/85">Zoek via je contacten</p>
              <p className="mt-0.5 text-pretty text-[12px] leading-relaxed text-white/45">
                Jij kiest zelf welke contacten je deelt. Alleen versleutelde
                controlegetallen van e-mailadressen worden vergeleken — je
                adresboek wordt nooit geüpload of bewaard.
              </p>
              {contactState === "unsupported" ? (
                <p className="mt-2 text-[12px] text-white/40">
                  Contacten kiezen wordt door deze browser niet ondersteund.
                  Gebruik de zoekfunctie of een uitnodigingslink.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={contactState === "busy"}
                  onClick={pickContacts}
                  className="mt-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-3.5 py-1.5 font-sans text-[12px] font-medium disabled:opacity-40"
                  style={{ color: ACCENT }}
                >
                  {contactState === "busy" ? "Vergelijken…" : "Contacten kiezen"}
                </button>
              )}
              {contactState === "done" && (
                <div className="mt-2 flex flex-col gap-2">
                  {matches.length === 0 ? (
                    <p className="text-[12px] text-white/40">
                      Geen van je gekozen contacten is op Sparki gevonden.
                    </p>
                  ) : (
                    matches.map((m) => (
                      <PersonRow
                        key={m.clerkId}
                        person={m}
                        action={
                          <button
                            type="button"
                            disabled={send.isPending}
                            onClick={() => send.mutate(m.clerkId)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold disabled:opacity-40"
                            style={{ background: ACCENT, color: "#040506" }}
                          >
                            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                            Toevoegen
                          </button>
                        }
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10">
              <Link2 className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] text-white/85">Nodig uit via een link</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
                Deel een persoonlijke link. Wie accepteert, wordt direct je
                vriend op Sparki.
              </p>
              {inviteUrl ? (
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/70">
                    {inviteUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(inviteUrl)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="shrink-0 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold"
                    style={{ background: ACCENT, color: "#040506" }}
                  >
                    {copied ? "Gekopieerd" : "Kopieer"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={createInvite.isPending}
                  onClick={makeInviteLink}
                  className="mt-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-3.5 py-1.5 font-sans text-[12px] font-medium disabled:opacity-40"
                  style={{ color: ACCENT }}
                >
                  {createInvite.isPending ? "Bezig…" : "Maak uitnodigingslink"}
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}

// ── Circle (friends list) ────────────────────────────────────────────────────
function Circle() {
  const { data, isLoading } = useFriends()
  const setBuddy = useSetTrainingBuddy()
  const removeFriend = useRemoveFriend()
  const friends = data?.friends ?? []

  return (
    <section id="mijn-vrienden">
      <SectionLabel n="01" title="Mijn vrienden" />
      {isLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : friends.length === 0 ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-pretty text-[13px] leading-relaxed text-white/40">
            Je hebt nog geen vrienden. Zoek hierboven een sporter om
            samen te trainen.
          </p>
          <HumorLine context="empty_social" />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {friends.map((f: FriendSummary) => (
            <GlassCard key={f.clerkId}>
              <div className="flex items-center gap-3">
                <Avatar name={f.displayName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-white/90">
                    {f.displayName}
                  </p>
                  <p className="truncate font-mono text-[10px] tracking-wide text-white/40">
                    {[sportLabel(f.sport), f.club].filter(Boolean).join(" · ") || "Sporter"}
                    {f.availableDays.length > 0
                      ? ` · ${f.availableDays
                          .map((d) => WEEKDAY_LABEL[d] ?? d)
                          .join(" ")}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/profiel/${f.clerkId}`}
                  aria-label="Profiel bekijken"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/40 transition-colors hover:text-white/80"
                >
                  <UserCircle className="h-4 w-4" strokeWidth={1.75} />
                </Link>
                <button
                  type="button"
                  aria-label={
                    f.isTrainingBuddy
                      ? "Trainingsmaatje verwijderen"
                      : "Als trainingsmaatje markeren"
                  }
                  onClick={() =>
                    setBuddy.mutate({
                      clerkId: f.clerkId,
                      selected: !f.isTrainingBuddy,
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
                  style={{
                    borderColor: f.isTrainingBuddy
                      ? "rgba(120,210,230,0.45)"
                      : "rgba(255,255,255,0.12)",
                    background: f.isTrainingBuddy
                      ? "rgba(120,210,230,0.12)"
                      : "transparent",
                  }}
                >
                  <Star
                    className="h-4 w-4"
                    style={{
                      color: f.isTrainingBuddy ? ACCENT : "rgba(255,255,255,0.4)",
                    }}
                    fill={f.isTrainingBuddy ? ACCENT : "none"}
                    strokeWidth={1.75}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Vriend verwijderen"
                  onClick={() => removeFriend.mutate(f.clerkId)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/35 transition-colors hover:text-[rgba(255,140,120,0.85)]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Circle feed (unified stream) ─────────────────────────────────────────────
// One calm stream: Sparki's follow-up questions, your own race info, friend
// activity and relevant sport news — never an algorithmic timeline.
type StreamItem =
  | { source: "circle"; sortAt: number; data: CircleFeedItem }
  | { source: "news"; sortAt: number; data: FeedNewsItem }

function FollowUpCard({ item }: { item: CircleFeedItem }) {
  const qc = useQueryClient()
  const answer = useAnswerFollowUp()
  const dismiss = useDismissFollowUp()
  const [text, setText] = useState("")
  const busy = answer.isPending || dismiss.isPending

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.social.circleFeed() })
  }

  return (
    <GlassCard className="border-cyan-300/20 bg-cyan-300/[0.05]">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/30"
          style={{ background: "rgba(120,210,230,0.10)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/70">
            Sparki vraagt
          </p>
          <p className="mt-1 text-pretty text-[14px] leading-relaxed text-white/90">
            {item.prompt ?? item.detail}
          </p>
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Vertel Sparki kort hoe het ging…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={busy || text.trim().length === 0}
                onClick={() =>
                  answer.mutate(
                    { id: item.memoryId!, response: text.trim() },
                    { onSuccess: invalidate },
                  )
                }
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT, color: "#040506" }}
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                Beantwoorden
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  dismiss.mutate(item.memoryId!, { onSuccess: invalidate })
                }
                className="rounded-full border border-white/12 px-3.5 py-1.5 font-sans text-[12px] text-white/55 disabled:opacity-40"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function CircleItemCard({ item }: { item: CircleFeedItem }) {
  const Icon = FEED_ICON[item.type]
  const isMine = item.type === "my_race"
  return (
    <GlassCard className={isMine ? "border-cyan-300/15" : ""}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <Icon className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          {isMine ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/70">
              Jouw wedstrijd
            </p>
          ) : null}
          <p className="text-[13.5px] leading-snug text-white/85">{item.title}</p>
          {item.detail ? (
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/40">
              {item.detail}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[9.5px] tracking-wide text-white/30">
          {formatDateTime(item.at)}
        </span>
      </div>
    </GlassCard>
  )
}

function NewsCard({ item }: { item: FeedNewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <GlassCard className="transition-colors hover:border-white/20">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <Newspaper className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              {item.source ?? "Sparki nieuws"}
            </p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-white/85">
              {item.title}
            </p>
            {item.summary ? (
              <p className="mt-1 line-clamp-2 text-pretty text-[12px] leading-relaxed text-white/45">
                {item.summary}
              </p>
            ) : null}
          </div>
        </div>
      </GlassCard>
    </a>
  )
}

function CircleFeed() {
  const { data, isLoading, isError } = useCircleFeed()
  const { data: newsData, isError: newsError } = useFeedNews(6)
  const circle = data?.items ?? []
  const news = newsData?.items ?? []

  const followUps = circle.filter((i) => i.type === "follow_up")
  const rest: StreamItem[] = [
    ...circle
      .filter((i) => i.type !== "follow_up")
      .map((i) => ({
        source: "circle" as const,
        sortAt: new Date(i.at).getTime(),
        data: i,
      })),
    ...news.map((n) => ({
      source: "news" as const,
      sortAt: n.publishedAt ? new Date(n.publishedAt).getTime() : 0,
      data: n,
    })),
  ].sort((a, b) => b.sortAt - a.sortAt)

  const isEmpty = followUps.length === 0 && rest.length === 0

  return (
    <section>
      <SectionLabel n="05" title="Jouw overzicht" />
      {isLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : isError ? (
        <p className="mt-3 text-pretty text-[13px] leading-relaxed text-rose-300/80">
          Je overzicht kon niet geladen worden. Probeer het zo opnieuw.
        </p>
      ) : isEmpty ? (
        <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/40">
          Nog niets te zien. Zodra je vrienden hun activiteit delen, je een
          wedstrijd plant of Sparki iets wil weten, verschijnt het hier.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {followUps.map((item) => (
            <FollowUpCard key={item.id} item={item} />
          ))}
          {rest.map((s) =>
            s.source === "circle" ? (
              <CircleItemCard key={s.data.id} item={s.data} />
            ) : (
              <NewsCard key={`news-${s.data.id}`} item={s.data} />
            ),
          )}
          {newsError && (
            <p className="text-pretty text-[12px] leading-relaxed text-rose-300/70">
              Het laatste nieuws kon even niet geladen worden.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ── Joint-training suggestion + create proposal ──────────────────────────────
function TrainTogether() {
  const { data } = useJointTrainingSuggestion()
  const { data: friendsData } = useFriends()
  const suggestion = data?.suggestion
  const buddies = (friendsData?.friends ?? []).filter((f) => f.isTrainingBuddy)
  const [composing, setComposing] = useState(false)

  return (
    <section>
      <SectionLabel n="04" title="Samen trainen" />
      <div className="mt-3">
        {suggestion?.available ? (
          <GlassCard className="border-cyan-300/20 bg-cyan-300/[0.04]">
            <p className="text-pretty text-[14px] leading-relaxed text-white/85">
              {suggestion.message}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300/90">
                {suggestion.dayLabel} · {suggestion.suggestedDurationMin} min
              </span>
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-semibold"
                style={{ background: ACCENT, color: "#040506" }}
              >
                <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
                Maak voorstel
              </button>
            </div>
          </GlassCard>
        ) : (
          <GlassCard>
            <p className="text-pretty text-[13px] leading-relaxed text-white/50">
              {suggestion?.available === false
                ? suggestion.reason
                : "Sparki zoekt naar momenten om samen te trainen."}
            </p>
            {buddies.length > 0 && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-semibold"
                style={{ background: ACCENT, color: "#040506" }}
              >
                <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2} />
                Maak voorstel
              </button>
            )}
          </GlassCard>
        )}
      </div>

      {composing && (
        <ProposalComposer
          buddies={buddies}
          defaultType={
            suggestion?.available ? suggestion.suggestedType : "Duurrit samen"
          }
          defaultDuration={
            suggestion?.available ? suggestion.suggestedDurationMin : 90
          }
          onClose={() => setComposing(false)}
        />
      )}
    </section>
  )
}

function ProposalComposer({
  buddies,
  defaultType,
  defaultDuration,
  onClose,
}: {
  buddies: FriendSummary[]
  defaultType: string
  defaultDuration: number
  onClose: () => void
}) {
  const create = useCreateProposal()
  const [selected, setSelected] = useState<string[]>(
    buddies.map((b) => b.clerkId),
  )
  const [trainingType, setTrainingType] = useState(defaultType)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [duration, setDuration] = useState(String(defaultDuration))
  const [area, setArea] = useState("")
  const [intensity, setIntensity] = useState("rustig")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    )

  const submit = () => {
    setError(null)
    if (selected.length === 0) {
      setError("Kies minstens één maatje.")
      return
    }
    if (!date) {
      setError("Kies een datum.")
      return
    }
    const scheduledAt = new Date(`${date}T${time || "09:00"}:00`)
    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Ongeldige datum of tijd.")
      return
    }
    create.mutate(
      {
        scheduledAt: scheduledAt.toISOString(),
        trainingType: trainingType.trim() || "Samen trainen",
        durationMin: duration ? Number(duration) : null,
        area: area || null,
        intensity: intensity || null,
        note: note || null,
        inviteeClerkIds: selected,
      },
      {
        onSuccess: onClose,
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Versturen mislukt."),
      },
    )
  }

  const fieldClass =
    "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#070d16] p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-light tracking-tight text-white">
            Nieuw voorstel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Sluiten
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              MAATJES
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {buddies.map((b) => {
                const on = selected.includes(b.clerkId)
                return (
                  <button
                    key={b.clerkId}
                    type="button"
                    onClick={() => toggle(b.clerkId)}
                    className="rounded-full border px-3 py-1.5 font-sans text-[12px] transition-colors"
                    style={{
                      borderColor: on
                        ? "rgba(120,210,230,0.45)"
                        : "rgba(255,255,255,0.12)",
                      background: on ? "rgba(120,210,230,0.12)" : "transparent",
                      color: on ? ACCENT : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {b.displayName}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              TYPE
            </label>
            <input
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value)}
              placeholder="bijv. Duurrit samen"
              className={`mt-2 ${fieldClass}`}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                DATUM
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-2 ${fieldClass}`}
              />
            </div>
            <div className="w-28">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                TIJD
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`mt-2 ${fieldClass}`}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-32">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                DUUR (MIN)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={15}
                max={400}
                className={`mt-2 ${fieldClass}`}
              />
            </div>
            <div className="flex-1">
              <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                INTENSITEIT
              </label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className={`mt-2 ${fieldClass}`}
              >
                <option value="rustig">rustig</option>
                <option value="gemiddeld">gemiddeld</option>
                <option value="pittig">pittig</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              GEBIED (OPTIONEEL)
            </label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="bijv. Posbank"
              className={`mt-2 ${fieldClass}`}
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              NOTITIE (OPTIONEEL)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="bijv. Rustig tempo, koffiestop halverwege"
              className={`mt-2 resize-none ${fieldClass}`}
            />
          </div>

          {error ? (
            <p className="font-mono text-[11px] text-[rgba(255,140,120,0.9)]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-40"
            style={{ background: ACCENT, color: "#040506" }}
          >
            {create.isPending ? "Versturen…" : "Voorstel versturen"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Proposals (received + sent) ──────────────────────────────────────────────
function ReceivedProposalCard({ p }: { p: ReceivedProposal }) {
  const respond = useRespondToProposal()
  const pending = p.myStatus === "proposed"
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <Avatar name={p.proposerName} />
        <div className="flex-1">
          <p className="text-[14px] text-white/90">
            {p.proposerName} · {p.trainingType}
          </p>
          <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/40">
            {formatDateTime(p.scheduledAt)}
            {p.durationMin ? ` · ${p.durationMin} min` : ""}
            {p.area ? ` · ${p.area}` : ""}
          </p>
          {p.note ? (
            <p className="mt-1.5 text-pretty text-[12.5px] leading-relaxed text-white/55">
              {p.note}
            </p>
          ) : null}
        </div>
      </div>
      {pending ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => respond.mutate({ id: p.id, accept: true })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-sans text-[13px] font-semibold"
            style={{ background: ACCENT, color: "#040506" }}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Doe mee
          </button>
          <button
            type="button"
            onClick={() => respond.mutate({ id: p.id, accept: false })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/12 py-2.5 font-sans text-[13px] text-white/55"
          >
            <X className="h-4 w-4" strokeWidth={2} />
            Niet deze keer
          </button>
        </div>
      ) : (
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: statusColor(p.myStatus) }}
        >
          {STATUS_LABEL[p.myStatus] ?? p.myStatus}
        </p>
      )}
    </GlassCard>
  )
}

function SentProposalCard({ p }: { p: SentProposal }) {
  return (
    <GlassCard>
      <p className="text-[14px] text-white/90">{p.trainingType}</p>
      <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/40">
        {formatDateTime(p.scheduledAt)}
        {p.durationMin ? ` · ${p.durationMin} min` : ""}
        {p.area ? ` · ${p.area}` : ""}
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {p.invitees.map((i) => (
          <div key={i.clerkId} className="flex items-center justify-between">
            <span className="text-[13px] text-white/70">{i.displayName}</span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: statusColor(i.status) }}
            >
              {STATUS_LABEL[i.status] ?? i.status}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function Proposals() {
  const { data, isLoading } = useProposals()
  const received = data?.received ?? []
  const sent = data?.sent ?? []

  if (isLoading) {
    return (
      <section>
        <SectionLabel n="03" title="Voorstellen" />
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      </section>
    )
  }

  return (
    <section>
      <SectionLabel n="03" title="Voorstellen" />
      {received.length === 0 && sent.length === 0 ? (
        <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/40">
          Nog geen voorstellen. Maak er een via "Samen trainen" hieronder.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {received.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/35">
                ONTVANGEN
              </span>
              {received.map((p) => (
                <ReceivedProposalCard key={p.id} p={p} />
              ))}
            </div>
          )}
          {sent.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/35">
                VERSTUURD
              </span>
              {sent.map((p) => (
                <SentProposalCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Club banner ──────────────────────────────────────────────────────────────
function ClubBanner() {
  const { data } = useTeamIdentity()
  const team = data?.team
  if (!team || !team.clubName) return null
  return (
    <GlassCard
      className="border-0"
      // subtle club-coloured wash
    >
      <div
        className="flex items-center gap-3 rounded-xl p-1"
        style={{
          background: team.primaryColor
            ? `linear-gradient(90deg, ${team.primaryColor}1f, transparent)`
            : undefined,
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border"
          style={{
            borderColor: team.primaryColor
              ? `${team.primaryColor}66`
              : "rgba(255,255,255,0.15)",
            background: team.primaryColor ? `${team.primaryColor}22` : undefined,
          }}
        >
          {team.logoUrl ? (
            <img
              src={team.logoUrl}
              alt={team.clubName ?? "Clublogo"}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <Shield
              className="h-5 w-5"
              style={{ color: team.primaryColor ?? ACCENT }}
              strokeWidth={1.75}
            />
          )}
        </span>
        <div>
          <p className="text-[14px] font-medium text-white/90">
            {team.clubName}
          </p>
          <p className="font-mono text-[10px] tracking-wide text-white/40">
            {[team.teamName, team.category].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

export default function SamenPage() {
  return (
    <ScreenShell bg="/atmosphere/samen-koffiestop-stad.webp" section="samen">
      <section className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <Users className="h-5 w-5" style={{ color: ACCENT }} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-sans text-2xl font-extralight tracking-tight text-white">
            Samen
          </h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/40">
            JOUW VRIENDEN & TEAM
          </p>
        </div>
      </section>

      {/* Mensen vinden, uitnodigen en je vrienden staan bewust bovenaan —
          dat is waar je op Samen het eerst naar zoekt. */}
      <MensenVinden />
      <AddFriend />
      <Circle />
      <NetwerkOverzicht />
      <FriendRequests />
      <Proposals />
      <TrainTogether />
      <ClubBanner />
      <CircleFeed />
    </ScreenShell>
  )
}
