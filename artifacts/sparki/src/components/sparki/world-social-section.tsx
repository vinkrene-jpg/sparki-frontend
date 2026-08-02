import { useState } from "react"
import {
  Share2,
  Heart,
  MessageCircle,
  ShieldAlert,
  Ban,
  Bell,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useWorldFeed,
  useWorldMine,
  useWorldShare,
  useWorldWithdraw,
  useWorldReact,
  useWorldBlocks,
  useWorldBlock,
  useWorldUnblock,
  useWorldReport,
  useWorldPrefs,
  useSaveWorldPrefs,
  type WorldFeedItem,
  type WorldVisibility,
} from "@/hooks/use-world-social"

// Sparki World — veilige sociale laag op de Samen-pagina. Alles wat hier
// staat is bewust gedeeld; zichtbaarheid en blokkades worden op de server
// afgedwongen, dit is alleen de weergave.

function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 backdrop-blur-md ${className}`}>
      {children}
    </div>
  )
}

const VISIBILITY_LABEL: Record<WorldVisibility, string> = {
  prive: "Alleen ik",
  coach_ouders: "Coach & ouders",
  club: "Mijn club",
  team: "Mijn team",
  volgers: "Vrienden",
  openbaar: "Iedereen",
}

const VISIBILITY_ORDER: WorldVisibility[] = [
  "prive",
  "coach_ouders",
  "club",
  "team",
  "volgers",
  "openbaar",
]

function VisibilityPicker({
  value,
  onChange,
}: {
  value: WorldVisibility
  onChange: (v: WorldVisibility) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VISIBILITY_ORDER.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
            value === v
              ? "border-accent-cyan/50 text-foreground"
              : "border-border text-muted-foreground hover:border-border"
          }`}
          style={value === v ? { background: "rgba(120,210,230,0.10)" } : undefined}
        >
          {VISIBILITY_LABEL[v]}
        </button>
      ))}
    </div>
  )
}

function Composer() {
  const share = useWorldShare()
  const [text, setText] = useState("")
  const [visibility, setVisibility] = useState<WorldVisibility>("volgers")
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [confirmPublic, setConfirmPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!text.trim()) return
    setError(null)
    share.mutate(
      {
        sourceType: "bericht",
        message: text.trim(),
        visibility,
        confirmPublic: visibility === "openbaar" ? confirmPublic : undefined,
      },
      {
        onSuccess: () => {
          setText("")
          setNeedsConfirm(false)
          setConfirmPublic(false)
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Delen is niet gelukt"
          if (msg.includes("bevestiging")) setNeedsConfirm(true)
          setError(msg)
        },
      },
    )
  }

  return (
    <Glass>
      <p className="mb-2 text-[13px] font-medium text-foreground/85">Deel iets met je kring</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Schrijf een bericht…"
        className="w-full resize-none rounded-xl border border-border bg-muted p-3 text-[13px] text-foreground/85 placeholder:text-muted-foreground outline-none focus:border-accent-cyan/40"
      />
      <div className="mt-2 flex flex-col gap-2">
        <VisibilityPicker value={visibility} onChange={(v) => { setVisibility(v); setNeedsConfirm(false); }} />
        {visibility === "openbaar" && (
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <input
              type="checkbox"
              checked={confirmPublic}
              onChange={(e) => setConfirmPublic(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent-cyan)]"
            />
            Ik begrijp dat iedereen dit kan zien en wil dit openbaar delen.
          </label>
        )}
        {error && <p className="text-[12px] text-[color:var(--color-negative)]">{error}</p>}
        {needsConfirm && !confirmPublic && (
          <p className="text-[12px] text-muted-foreground">Vink de bevestiging aan om openbaar te delen.</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={share.isPending || !text.trim()}
          className="self-end rounded-full border border-accent-cyan/40 px-4 py-1.5 text-[12px] text-foreground/90 transition-colors hover:border-accent-cyan/70 disabled:opacity-40"
          style={{ background: "rgba(120,210,230,0.10)" }}
        >
          {share.isPending ? "Delen…" : "Delen"}
        </button>
      </div>
    </Glass>
  )
}

function presentLine(item: WorldFeedItem): string | null {
  const p = item.presentatie
  const parts: string[] = []
  if (typeof p["titel"] === "string" && p["titel"]) parts.push(p["titel"] as string)
  if (p["afstandKm"] != null) parts.push(`${p["afstandKm"]} km`)
  if (p["duurMin"] != null) parts.push(`${p["duurMin"]} min`)
  if (p["hoogtemeters"] != null) parts.push(`${p["hoogtemeters"]} hm`)
  if (p["gemSnelheidKph"] != null) parts.push(`${p["gemSnelheidKph"]} km/u`)
  if (p["gemVermogenW"] != null) parts.push(`${p["gemVermogenW"]} W`)
  if (p["gemHartslag"] != null) parts.push(`${p["gemHartslag"]} spm`)
  if (p["uitslag"] != null) parts.push(`Uitslag: ${p["uitslag"]}`)
  return parts.length ? parts.join(" · ") : null
}

function FeedCard({ item }: { item: WorldFeedItem }) {
  const react = useWorldReact()
  const report = useWorldReport()
  const block = useWorldBlock()
  const withdraw = useWorldWithdraw()
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const line = presentLine(item)

  return (
    <Glass>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground/85">
            {item.eigenaar.isZelf ? "Jij" : item.eigenaar.naam}
            <span className="ml-2 font-mono text-[10px] tracking-wide text-muted-foreground">
              {VISIBILITY_LABEL[item.visibility] ?? item.visibility}
            </span>
          </p>
          {item.message && <p className="mt-1 text-[13px] text-foreground/75">{item.message}</p>}
          {line && <p className="mt-1 text-[12px] text-muted-foreground">{line}</p>}
          {item.caption && <p className="mt-1 text-[12px] italic text-muted-foreground">{item.caption}</p>}
        </div>
        {!item.eigenaar.isZelf && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-muted-foreground"
            aria-label="Meer opties"
          >
            {menuOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {menuOpen && !item.eigenaar.isZelf && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={reported || report.isPending}
            onClick={() =>
              report.mutate(
                { targetType: "item", targetId: String(item.id), reason: "Melding vanuit de feed" },
                { onSuccess: () => setReported(true) },
              )
            }
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-orange-300/40 disabled:opacity-40"
          >
            <ShieldAlert className="h-3 w-3" /> {reported ? "Gemeld" : "Melden"}
          </button>
          <button
            type="button"
            disabled={block.isPending}
            onClick={() => block.mutate(item.eigenaar.clerkId)}
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-red-300/40"
          >
            <Ban className="h-3 w-3" /> Blokkeren
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => react.mutate({ itemId: item.id, kind: "waardering" })}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground/85"
        >
          <Heart className="h-3.5 w-3.5" style={{ color: ACCENT }} /> {item.waarderingen}
        </button>
        <button
          type="button"
          onClick={() => setReplyOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground/85"
        >
          <MessageCircle className="h-3.5 w-3.5" /> {item.reacties}
        </button>
        {item.eigenaar.isZelf && (
          <button
            type="button"
            onClick={() => withdraw.mutate(item.id)}
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[color:var(--color-negative)]"
          >
            <Trash2 className="h-3 w-3" /> Intrekken
          </button>
        )}
      </div>

      {replyOpen && (
        <div className="mt-2 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reageer…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-[12px] text-foreground/85 placeholder:text-muted-foreground outline-none focus:border-accent-cyan/40"
          />
          <button
            type="button"
            disabled={!reply.trim() || react.isPending}
            onClick={() =>
              react.mutate(
                { itemId: item.id, kind: "reactie", body: reply.trim() },
                { onSuccess: () => { setReply(""); setReplyOpen(false); } },
              )
            }
            className="rounded-full border border-accent-cyan/40 px-3 py-1 text-[12px] text-foreground/85 disabled:opacity-40"
          >
            Plaats
          </button>
        </div>
      )}
    </Glass>
  )
}

function PrefsPanel() {
  const { data: prefs } = useWorldPrefs()
  const save = useSaveWorldPrefs()
  if (!prefs) return null
  const rows: { key: keyof typeof prefs; label: string }[] = [
    { key: "notifyReactions", label: "Reacties en waarderingen" },
    { key: "notifyRequests", label: "Vriendschapsverzoeken" },
    { key: "notifyClubMessages", label: "Clubberichten" },
    { key: "notifyModeration", label: "Berichten over meldingen" },
    { key: "muteDuringRide", label: "Stil tijdens het fietsen" },
  ]
  return (
    <Glass>
      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground/85">
        <Bell className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Meldingen
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <label key={r.key} className="flex items-center justify-between text-[12px] text-muted-foreground">
            {r.label}
            <input
              type="checkbox"
              checked={Boolean(prefs[r.key])}
              onChange={(e) => save.mutate({ ...prefs, [r.key]: e.target.checked })}
              className="h-3.5 w-3.5 accent-[var(--accent-cyan)]"
            />
          </label>
        ))}
      </div>
    </Glass>
  )
}

function BlocksPanel() {
  const { data: blocks } = useWorldBlocks()
  const unblock = useWorldUnblock()
  if (!blocks || blocks.length === 0) return null
  return (
    <Glass>
      <p className="mb-2 text-[13px] font-medium text-foreground/85">Geblokkeerd</p>
      <div className="flex flex-col gap-2">
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-[12px] text-muted-foreground">
            {b.naam}
            <button
              type="button"
              onClick={() => unblock.mutate(b.clerkId)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-border"
            >
              Deblokkeren
            </button>
          </div>
        ))}
      </div>
    </Glass>
  )
}

export function WorldSocialSection() {
  const { data, isLoading, isError } = useWorldFeed()
  const { data: mine } = useWorldMine()
  const [showSettings, setShowSettings] = useState(false)
  const hidden = (mine ?? []).filter((m) => m.status === "verborgen")

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel title="Gedeeld met jou" />
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-muted-foreground"
        >
          {showSettings ? "Verberg instellingen" : "Instellingen"}
        </button>
      </div>

      <Composer />

      {hidden.length > 0 && (
        <Glass className="border-orange-300/20">
          <p className="text-[12px] text-[color:var(--color-warning)]">
            {hidden.length === 1
              ? "Eén van je gedeelde items is verborgen na een melding."
              : `${hidden.length} van je gedeelde items zijn verborgen na een melding.`}
            {hidden[0]?.hiddenReason ? ` Reden: ${hidden[0].hiddenReason}` : ""}
          </p>
        </Glass>
      )}

      {showSettings && (
        <>
          <PrefsPanel />
          <BlocksPanel />
        </>
      )}

      {isLoading && <p className="text-[12px] text-muted-foreground">Feed laden…</p>}
      {isError && (
        <p className="text-[12px] text-muted-foreground">De gedeelde items konden niet geladen worden. Probeer het later opnieuw.</p>
      )}
      {data && data.items.length === 0 && (
        <Glass>
          <p className="text-[13px] text-muted-foreground">Er is nog niets met je gedeeld.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Zodra vrienden, club- of teamgenoten iets delen, zie je het hier. Deel zelf iets hierboven om te beginnen.
          </p>
        </Glass>
      )}
      {data?.items.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </section>
  )
}
