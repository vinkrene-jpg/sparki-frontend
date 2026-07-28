import { useVoiceProfile, type VoiceTone } from "@/hooks/use-voice"
import { Skeleton } from "@/components/ui/skeleton"
import { ACCENT } from "@/components/sparki/ui"
import { Lock, MessageCircle, Sparkles, HeartHandshake } from "lucide-react"

const TONE_HINT: Record<VoiceTone, string> = {
  observer: "Nuchter, ziet wat er gebeurt.",
  curious: "Nieuwsgierig, stelt open vragen.",
  dry_humor: "Droge knipoog, nooit flauw.",
  cynical: "Licht spottend, alleen onder maten.",
  supportive: "Warm en steunend, altijd voorop bij tegenslag.",
}

const CARD = "rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.82] backdrop-blur-md"

function TrustMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)))
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: ACCENT }}
      />
    </div>
  )
}

export function SparkiVoiceSection() {
  const { data, isLoading, isError } = useVoiceProfile()

  if (isLoading) {
    return (
      <div className="mt-3 space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="mt-3 text-[12px] leading-relaxed text-white/35">
        Sparki's stem is even niet te laden. Probeer het zo opnieuw.
      </p>
    )
  }

  const { trust, styles, memoryHook, openLoop, empathy } = data

  return (
    <div className="mt-3 space-y-4">
      {/* TRUST */}
      <div className={`${CARD} p-4`}>
        <div className="flex items-baseline justify-between">
          <span className="font-sans text-[15px] tracking-tight text-white/85">
            {trust.tierLabel}
          </span>
          <span className="font-mono text-[11px] tracking-wide text-white/40">
            {Math.round(trust.score * 100)}%
          </span>
        </div>
        <TrustMeter score={trust.score} />
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/45">
          {trust.tierBlurb}
        </p>
      </div>

      {/* STYLES */}
      <div className="space-y-2">
        {styles.map((s) => (
          <div
            key={s.tone}
            className={`${CARD} p-4 ${s.unlocked ? "" : "opacity-50"}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-sans text-[14px] tracking-tight text-white/85">
                {s.label}
              </span>
              {!s.unlocked && (
                <Lock className="h-3 w-3 text-white/30" strokeWidth={2} />
              )}
            </div>
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/30">
              {TONE_HINT[s.tone]}
            </p>
            {s.line && (
              <p className="mt-2.5 text-pretty text-[13px] leading-relaxed text-white/70">
                "{s.line}"
              </p>
            )}
            {!s.unlocked && (
              <p className="mt-2 text-[11px] leading-relaxed text-white/30">
                Deze stijl wordt actief naarmate er meer interactie is.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* RELATIONAL EXAMPLES — only what is real */}
      {(memoryHook || openLoop || empathy) && (
        <div className={`${CARD} divide-y divide-white/[0.05] p-4`}>
          {memoryHook && (
            <div className="flex gap-3 pb-3 first:pt-0">
              <MessageCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-white/40"
                strokeWidth={1.75}
              />
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/30">
                  KOMT EROP TERUG
                </p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-white/70">
                  "{memoryHook}"
                </p>
              </div>
            </div>
          )}
          {openLoop && (
            <div className="flex gap-3 py-3">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-white/40"
                strokeWidth={1.75}
              />
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/30">
                  ZIET EEN PATROON
                </p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-white/70">
                  "{openLoop}"
                </p>
              </div>
            </div>
          )}
          {empathy && (
            <div className="flex gap-3 pt-3 last:pb-0">
              <HeartHandshake
                className="mt-0.5 h-4 w-4 shrink-0 text-white/40"
                strokeWidth={1.75}
              />
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-white/30">
                  EERST JIJ
                </p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-white/70">
                  "{empathy}"
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
