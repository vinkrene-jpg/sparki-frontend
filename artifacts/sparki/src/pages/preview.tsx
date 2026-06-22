import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { User, Activity, Bike, Zap, Scale, ChevronRight } from "lucide-react"

const PREVIEW_SCORE = 84
const PREVIEW_STATE = "PEAK"
const PREVIEW_ADVICE = "Maintain full session — conditions are ideal"

const PREVIEW_BIO_AXES = [
  { key: "fitness", label: "Fitness", level: 0.72 },
  { key: "feel", label: "Feel", level: 0.78 },
  { key: "form", label: "Form", level: 0.60 },
  { key: "power", label: "Power", level: 0.65 },
  { key: "recovery", label: "Recovery", level: 0.80 },
  { key: "consistency", label: "Consistency", level: 0.50 },
]

const PREVIEW_FEEL_HISTORY = [3, 4, 3, 5, 4, 4, 5, 4]

const PREVIEW_ARTICLES = [
  {
    id: 1,
    question: "How should I approach tomorrow's threshold block?",
    answer:
      "Your form is positive at +8 TSB — great timing for quality work. Aim for 2×20 min at 95–100% FTP. Keep warm-up easy, RPE 6 max, and target power over feel.",
  },
  {
    id: 2,
    question: "My legs felt heavy this morning — should I still train?",
    answer:
      "With a feel score of 4/5 and sleep 4/5, your fatigue signal is manageable. A reduced-intensity version of the planned session is a good call — drop target power by 10% and reassess at the 30-min mark.",
  },
]

const PREVIEW_ZONES = [
  { zone: 1, label: "Active Recovery", min: 0, max: 171 },
  { zone: 2, label: "Endurance", min: 172, max: 228 },
  { zone: 3, label: "Tempo", min: 229, max: 270 },
  { zone: 4, label: "Threshold", min: 271, max: 313 },
  { zone: 5, label: "VO2 Max", min: 314, max: 370 },
  { zone: 6, label: "Anaerobic", min: 371, max: 999 },
]

const PREVIEW_PROFILE = [
  { icon: User, label: "Name", value: "Alex Chen" },
  { icon: Activity, label: "Role", value: "Athlete" },
  { icon: Bike, label: "Discipline", value: "Road" },
  { icon: Zap, label: "FTP", value: "285W" },
  { icon: Scale, label: "Weight", value: "72kg" },
] as const

function PreviewBanner() {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5"
      style={{
        background: "rgba(255,180,0,0.12)",
        borderBottom: "1px solid rgba(255,180,0,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "rgba(255,180,0,0.9)" }}
      />
      <span
        className="font-mono text-[10px] tracking-[0.28em]"
        style={{ color: "rgba(255,180,0,0.9)" }}
      >
        VISUAL VERIFICATION MODE · DEV ONLY · NO REAL DATA
      </span>
    </div>
  )
}

function ScreenLabel({ label }: { label: string }) {
  return (
    <div
      className="mx-auto flex max-w-md items-center gap-3 px-6 py-4"
    >
      <span
        className="h-px flex-1"
        style={{ background: "rgba(255,180,0,0.2)" }}
      />
      <span
        className="font-mono text-[9px] tracking-[0.35em]"
        style={{ color: "rgba(255,180,0,0.6)" }}
      >
        {label}
      </span>
      <span
        className="h-px flex-1"
        style={{ background: "rgba(255,180,0,0.2)" }}
      />
    </div>
  )
}

export default function PreviewPage() {
  return (
    <div className="min-h-dvh bg-[#040506] text-white">
      <PreviewBanner />

      {/* ── HOME ── */}
      <ScreenLabel label="HOME · READINESS REACTOR" />
      <section className="mx-auto flex max-w-md flex-col gap-6 px-6 pb-10">
        <SectionLabel n="02" title="Readiness" />
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center py-2">
            <SparkiCore
              size={240}
              accent={ACCENT}
              readiness={PREVIEW_SCORE / 100}
              variant="reactor"
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
                READINESS
              </span>
              <span
                className="font-sans text-7xl font-extralight leading-none tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
              >
                {PREVIEW_SCORE}
              </span>
              <span className="mt-1 font-mono text-[11px] tracking-[0.25em] text-white/50">
                {PREVIEW_STATE}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 backdrop-blur-sm">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
            />
            <span className="text-sm font-medium leading-tight tracking-tight text-white/90">
              {PREVIEW_ADVICE}
            </span>
          </div>
        </div>
      </section>

      {/* ── TRAIN / TODAY ── */}
      <ScreenLabel label="TRAIN / TODAY · ZONE 4 CENTREPIECE" />
      <section className="mx-auto flex max-w-md flex-col gap-4 px-6 pb-10">
        <SectionLabel title="Power zones" />
        <div className="mt-4 mb-5 flex items-end gap-6">
          <div>
            <span
              className="font-mono text-[10px] tracking-[0.2em]"
              style={{ color: "rgba(120,210,230,0.8)" }}
            >
              TARGET · ZONE 4
            </span>
            <p
              className="mt-1 font-sans text-3xl font-extralight tabular-nums"
              style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {PREVIEW_ZONES[3].min}–{PREVIEW_ZONES[3].max}W
            </p>
          </div>
          <div className="mb-1 flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">FTP</span>
            <span
              className="font-sans text-[15px] font-light tabular-nums"
              style={{ color: ACCENT, fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              285W
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          {PREVIEW_ZONES.map((z) => {
            const colors = [
              "rgba(120,210,230,0.25)",
              "rgba(120,210,230,0.35)",
              "rgba(255,220,100,0.5)",
              "rgba(120,210,230,0.95)",
              "rgba(255,140,80,0.8)",
              "rgba(255,80,80,0.75)",
            ]
            const color = colors[z.zone - 1] ?? ACCENT
            const active = z.zone === 4
            return (
              <div
                key={z.zone}
                className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
                style={{ opacity: active ? 1 : 0.45 }}
              >
                <span
                  className="h-3 w-1 rounded-full"
                  style={{
                    background: color,
                    boxShadow: active ? `0 0 8px ${color}` : "none",
                  }}
                />
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
                  Z{z.zone}
                </span>
                <span className="flex-1 text-[13px] font-medium tracking-tight text-white/85">
                  {z.label}
                </span>
                <span
                  className="font-sans text-[12px] tabular-nums text-white/50"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {z.zone < 6 ? `${z.min}–${z.max}W` : `${z.min}W+`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── LAB / PROGRESS ── */}
      <ScreenLabel label="LAB / PROGRESS · BIOLRADAR + FEEL HISTORY" />
      <section className="mx-auto flex max-w-md flex-col gap-8 px-6 pb-10">
        <div className="flex flex-col items-center">
          <div className="flex w-full items-center justify-between">
            <SectionLabel n="02" title="Performance Radar" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
              6 SIGNALS
            </span>
          </div>
          <BioRadar size={260} accent={ACCENT} axes={PREVIEW_BIO_AXES} />
          <p className="mt-1 max-w-[18rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
            Composite of fitness, feel, form, power, recovery &amp; consistency.
          </p>
        </div>

        <div>
          <SectionLabel n="04" title="Feel history" />
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
              RECENT SESSIONS
            </span>
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: ACCENT }}
            >
              {PREVIEW_FEEL_HISTORY[PREVIEW_FEEL_HISTORY.length - 1]}/5
            </span>
          </div>
          <div className="mt-3 w-full">
            <Sparkline
              data={PREVIEW_FEEL_HISTORY}
              width={340}
              height={48}
              stroke={ACCENT}
              fill="rgba(120,210,230,0.07)"
              className="w-full"
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/35">
            Perceived effort quality across sessions · 1 (rough) → 5 (great)
          </p>
        </div>
      </section>

      {/* ── FEED / SPARKI ── */}
      <ScreenLabel label="FEED / SPARKI · ARTICLE STREAM" />
      <section className="mx-auto flex max-w-md flex-col gap-4 px-6 pb-10">
        <SectionLabel n="02" title="Ask Sparki" />
        <div className="flex flex-col">
          {PREVIEW_ARTICLES.map((qa) => (
            <article
              key={qa.id}
              className="relative flex gap-4 border-b border-white/[0.06] py-5 last:border-0"
            >
              <span
                className="absolute left-0 top-5 h-8 w-px"
                style={{
                  background: ACCENT,
                  boxShadow: `0 0 8px ${ACCENT}`,
                }}
              />
              <div className="pl-4 shrink-0 pt-0.5">
                <SparkiCore
                  size={34}
                  accent={ACCENT}
                  readiness={0.9}
                  variant="orb"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="font-mono text-[10px] tracking-[0.18em]"
                  style={{ color: ACCENT }}
                >
                  SPARKI AI
                </span>
                <h3 className="mt-1.5 font-sans text-[15px] font-light leading-snug text-white/90">
                  {qa.question}
                </h3>
                <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
                  {qa.answer}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── YOU ── */}
      <ScreenLabel label="YOU · PROFILE SECTION 04" />
      <section className="mx-auto flex max-w-md flex-col gap-4 px-6 pb-20">
        <SectionLabel n="04" title="Profile" />
        <div className="flex flex-col">
          {PREVIEW_PROFILE.map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.label}
                className="flex items-center gap-4 border-b border-white/[0.05] py-3.5 last:border-0"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[14px] tracking-tight text-white/85">
                  {row.label}
                </span>
                <span className="font-mono text-[11px] tracking-wide text-white/40">
                  {row.value}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-white/20" strokeWidth={1.75} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
