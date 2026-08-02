// In-app drill-in reader for one Performance Intelligence card. Opens as a
// top-anchored overlay (never scroll-to-exit) and renders the right body per
// kind: the Myth Buster quiz, a Trend with honest confidence, a no-winner Gear
// comparison table, a tiered Academy masterclass, or a Debate. Honesty holds:
// null gear specs render as "—", confidence is shown plainly, and the myth
// verdict is only revealed after the athlete answers.

import { useEffect, useRef, useState } from "react"
import {
  X,
  Bookmark,
  Clock,
  Sparkles,
  Check,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Star,
  Share2,
  type LucideIcon,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { TieredExplanation } from "@/components/sparki/tiered-explanation"
import { useAnswerMyth, useToggleIntelFlag } from "@/hooks/use-intel"
import {
  CONFIDENCE_LABEL,
  KIND_LABEL,
  MYTH_ANSWER_LABEL,
  TOPIC_LABEL,
  isAcademy,
  isDebate,
  isGear,
  isMyth,
  isTrend,
  type IntelFeedItem,
  type MythAnswer,
} from "@/lib/intel-types"

// A single inline action pill (bewaar / later lezen / boeiend / delen). When
// `fill` is set the icon fills while active, matching the bookmark behaviour.
function ActionPill({
  active,
  fill = false,
  onClick,
  Icon,
  label,
}: {
  active: boolean
  fill?: boolean
  onClick: () => void
  Icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
      style={{
        borderColor: active ? "rgba(120,210,230,0.5)" : "var(--color-border)",
        background: active ? "rgba(120,210,230,0.1)" : "transparent",
        color: active ? ACCENT : "var(--color-muted-foreground)",
      }}
    >
      <Icon className={`h-3.5 w-3.5 ${active && fill ? "fill-current" : ""}`} />
      {label}
    </button>
  )
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 text-pretty text-[14px] font-light leading-relaxed text-foreground/80">
        {children}
      </div>
    </div>
  )
}

function ProsConsList({
  items,
  tone,
}: {
  items: string[]
  tone: "pro" | "con"
}) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground/75">
          {tone === "pro" ? (
            <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
          ) : (
            <ThumbsDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function MythBody({ item }: { item: IntelFeedItem }) {
  const answerMyth = useAnswerMyth()
  const [picked, setPicked] = useState<MythAnswer | null>(
    item.interaction.mythAnswer,
  )
  const card = item.card
  if (!isMyth(card)) return null
  const c = card.content
  const answered = picked != null
  const correct =
    answered && (item.interaction.mythCorrect ?? answerMyth.data?.correct)

  const choose = (a: MythAnswer) => {
    if (answered || answerMyth.isPending) return
    setPicked(a)
    answerMyth.mutate({ id: card.id, answer: a })
  }

  const options: MythAnswer[] = ["waar", "niet_waar", "hangt_ervan_af"]

  return (
    <>
      <FieldBlock label="De stelling">
        <p className="text-[16px] font-light text-foreground/90">{c.statement}</p>
      </FieldBlock>

      {/* Quiz */}
      <div className="mt-5 flex flex-col gap-2">
        {options.map((a) => {
          const isPicked = picked === a
          const isVerdict = answered && a === c.answer
          return (
            <button
              key={a}
              type="button"
              disabled={answered || answerMyth.isPending}
              onClick={() => choose(a)}
              className="flex items-center justify-between rounded-xl border px-4 py-3 text-left font-sans text-[14px] transition-colors disabled:cursor-default"
              style={{
                borderColor: isVerdict
                  ? "rgba(120,210,230,0.5)"
                  : isPicked
                    ? "var(--color-border)"
                    : "var(--color-border)",
                background: isVerdict
                  ? "rgba(120,210,230,0.12)"
                  : "var(--color-muted)",
                color: isVerdict ? ACCENT : "var(--color-foreground)",
              }}
            >
              {MYTH_ANSWER_LABEL[a]}
              {isVerdict && <Check className="h-4 w-4" />}
            </button>
          )
        })}
      </div>

      {!answered && (
        <p className="mt-3 font-mono text-[10px] tracking-wide text-muted-foreground">
          Kies een antwoord om te zien wat hierover bekend is.
        </p>
      )}

      {answered && (
        <>
          <div className="mt-5 rounded-xl border border-border bg-muted p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {correct ? "Goed gezien" : "Verrassend genoeg"}
            </p>
            <p className="mt-1.5 text-[15px] font-light text-foreground/90">
              Het antwoord is{" "}
              <span style={{ color: ACCENT }}>
                {MYTH_ANSWER_LABEL[c.answer].toLowerCase()}
              </span>
              .
            </p>
            <p className="mt-2 text-pretty text-[14px] font-light leading-relaxed text-foreground/75">
              {c.explanation}
            </p>
          </div>

          <FieldBlock label="De wetenschap erachter">{c.science}</FieldBlock>
          <FieldBlock label="Zo pas je het toe">{c.application}</FieldBlock>
          <FieldBlock label="Waarom dit telt">{c.relevance}</FieldBlock>
        </>
      )}
    </>
  )
}

function TrendBody({ item }: { item: IntelFeedItem }) {
  const card = item.card
  if (!isTrend(card)) return null
  const c = card.content
  return (
    <>
      <FieldBlock label="Wat er verandert">{c.whatChanges}</FieldBlock>
      <FieldBlock label="Waarom">{c.why}</FieldBlock>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Voordelen
          </p>
          <ProsConsList items={c.pros} tone="pro" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Kanttekeningen
          </p>
          <ProsConsList items={c.cons} tone="con" />
        </div>
      </div>

      {/* Honest confidence — never fake precision. */}
      <div className="mt-6 rounded-xl border border-border bg-muted p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Hoe zeker is Sparki?
        </p>
        <p className="mt-1.5 text-[14px] font-light text-foreground/85">
          <span style={{ color: ACCENT }}>
            {CONFIDENCE_LABEL[c.confidence]}
          </span>{" "}
          — {c.confidenceNote}
        </p>
      </div>
    </>
  )
}

function GearBody({ item }: { item: IntelFeedItem }) {
  const card = item.card
  if (!isGear(card)) return null
  const c = card.content
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted p-3 text-center">
          <p className="text-[13px] font-light text-foreground/90">{c.productA}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-3 text-center">
          <p className="text-[13px] font-light text-foreground/90">{c.productB}</p>
        </div>
      </div>

      {/* Comparison table — null specs render as "—", never guessed. */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        {c.attributes.map((attr, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr] border-b border-border last:border-b-0"
          >
            <div className="col-span-2 bg-muted px-3 pt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {attr.label}
              {attr.unit ? ` (${attr.unit})` : ""}
            </div>
            <div className="border-r border-border px-3 py-2 text-[13px] font-light text-foreground/80">
              {attr.a ?? "—"}
            </div>
            <div className="px-3 py-2 text-[13px] font-light text-foreground/80">
              {attr.b ?? "—"}
            </div>
            {attr.note && (
              <p className="col-span-2 px-3 pb-2 text-[11px] leading-relaxed text-muted-foreground">
                {attr.note}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Sterk aan {c.productA}
          </p>
          <ProsConsList items={c.strengthsA} tone="pro" />
          {c.weaknessesA.length > 0 && <ProsConsList items={c.weaknessesA} tone="con" />}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Sterk aan {c.productB}
          </p>
          <ProsConsList items={c.strengthsB} tone="pro" />
          {c.weaknessesB.length > 0 && <ProsConsList items={c.weaknessesB} tone="con" />}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Geen winnaar — wat past bij jou?
        </p>
        <p className="mt-1.5 text-pretty text-[14px] font-light leading-relaxed text-foreground/85">
          {c.verdict}
        </p>
      </div>
    </>
  )
}

function AcademyBody({ item }: { item: IntelFeedItem }) {
  const card = item.card
  if (!isAcademy(card)) return null
  const c = card.content
  return (
    <>
      <div className="mt-5 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground">
        <Clock className="h-3 w-3" />
        {c.readMinutes} min lezen
      </div>

      {/* Tiered: short version always visible, depth on demand. */}
      <div className="mt-4">
        <TieredExplanation
          short={<p className="text-[15px] font-light leading-relaxed text-foreground/85">{c.simple}</p>}
          extended={
            <p className="text-[14px] font-light leading-relaxed text-foreground/75">{c.deep}</p>
          }
          moreLabel="Verdieping"
          lessLabel="Inklappen"
        />
      </div>

      <FieldBlock label="Een voorbeeld">{c.example}</FieldBlock>
      <FieldBlock label="Kort samengevat">{c.conclusion}</FieldBlock>
    </>
  )
}

function DebateBody({ item }: { item: IntelFeedItem }) {
  const card = item.card
  if (!isDebate(card)) return null
  const c = card.content
  return (
    <>
      <FieldBlock label="De stelling">
        <p className="text-[16px] font-light text-foreground/90">{c.proposition}</p>
      </FieldBlock>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
            Vóór
          </p>
          <p className="mt-2 text-[13px] font-light leading-relaxed text-foreground/80">
            {c.argumentFor}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Tegen
          </p>
          <p className="mt-2 text-[13px] font-light leading-relaxed text-foreground/80">
            {c.argumentAgainst}
          </p>
        </div>
      </div>

      <FieldBlock label="Wat de wetenschap zegt">{c.science}</FieldBlock>
      <FieldBlock label="In het profpeloton">{c.proTeams}</FieldBlock>

      <div className="mt-6 rounded-xl border border-border bg-muted p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {c.hasConsensus ? "Er is een duidelijke richting" : "Nog geen consensus"}
        </p>
        <p className="mt-1.5 text-pretty text-[14px] font-light leading-relaxed text-foreground/85">
          {c.conclusion}
        </p>
      </div>
    </>
  )
}

export function IntelReader({
  item,
  onClose,
}: {
  item: IntelFeedItem
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const toggleFlag = useToggleIntelFlag()
  const [saved, setSaved] = useState(item.interaction.saved)
  const [readLater, setReadLater] = useState(item.interaction.readLater)
  const [interesting, setInteresting] = useState(item.interaction.interesting)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
      opener?.focus?.()
    }
  }, [onClose])

  const card = item.card

  const toggleSave = () => {
    const next = !saved
    setSaved(next)
    toggleFlag.mutate({ id: card.id, field: "saved", value: next })
  }

  const toggleReadLater = () => {
    const next = !readLater
    setReadLater(next)
    toggleFlag.mutate({ id: card.id, field: "readLater", value: next })
  }

  const toggleInteresting = () => {
    const next = !interesting
    setInteresting(next)
    toggleFlag.mutate({ id: card.id, field: "interesting", value: next })
  }

  // Share the card honestly: the native share sheet when available, otherwise
  // copy the title + real source link to the clipboard. There is no fabricated
  // public card URL — we share what genuinely exists.
  const onShare = async () => {
    const text = `${card.title} — via Sparki`
    const url = card.sourceUrl ?? undefined
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: card.title, text, url })
      } catch {
        // The athlete dismissed the share sheet — nothing to do.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text)
      setShared(true)
      window.setTimeout(() => setShared(false), 2000)
    } catch {
      // Clipboard unavailable — silently ignore rather than fake success.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto"
      style={{
        background:
          "var(--color-background)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
    >
      {/* Top-anchored bar — always reachable, never scroll-to-exit. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-cyan">
          {KIND_LABEL[card.kind]}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/60 transition-colors hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
          Sluiten
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{
              background: "rgba(120,210,230,0.1)",
              color: ACCENT,
              border: "1px solid rgba(120,210,230,0.3)",
            }}
          >
            {TOPIC_LABEL[card.topic]}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <ActionPill
              active={saved}
              fill
              onClick={toggleSave}
              Icon={Bookmark}
              label={saved ? "Opgeslagen" : "Bewaar"}
            />
            <ActionPill
              active={readLater}
              fill
              onClick={toggleReadLater}
              Icon={Clock}
              label={readLater ? "Voor later" : "Later lezen"}
            />
            <ActionPill
              active={interesting}
              fill
              onClick={toggleInteresting}
              Icon={Star}
              label="Boeiend"
            />
            <ActionPill
              active={shared}
              onClick={onShare}
              Icon={Share2}
              label={shared ? "Gekopieerd" : "Delen"}
            />
          </div>
        </div>

        <h1 className="mt-5 text-balance font-sans text-2xl font-light leading-tight tracking-tight text-foreground/95">
          {card.title}
        </h1>

        {/* Honest "voor jou" reason. */}
        {item.personalised && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-accent-cyan">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
            {item.reason}
          </p>
        )}

        {card.kind === "myth_buster" && <MythBody item={item} />}
        {card.kind === "trend" && <TrendBody item={item} />}
        {card.kind === "gear_compare" && <GearBody item={item} />}
        {card.kind === "academy" && <AcademyBody item={item} />}
        {card.kind === "debate" && <DebateBody item={item} />}

        {/* Provenance — every factual card states where its content comes from. */}
        <div className="mt-8 flex items-start gap-2 border-t border-border pt-4">
          <Minus className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            Bron: {card.sourceLabel}
            {card.sourceUrl ? (
              <>
                {" · "}
                <a
                  href={card.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition-colors hover:text-accent-cyan"
                >
                  lees meer
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}
