import { ShieldCheck, Brain, Users, UserCog } from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  usePrivacySettings,
  useUpdatePrivacySettings,
  type PrivacySettings,
} from "@/hooks/use-privacy"

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{
        background: on ? ACCENT : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-[#05070e] transition-all"
        style={{ left: on ? "calc(100% - 1.375rem)" : "0.125rem" }}
      />
    </button>
  )
}

function Row({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <div className="text-[14px] tracking-tight text-white/85">{title}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-white/40">{desc}</div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-white/10 bg-[#070d16] px-2.5 py-1.5 font-sans text-[12px] text-white/75 outline-none disabled:opacity-40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#070d16]">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function PrivacySettingsSection() {
  const { data, isLoading } = usePrivacySettings()
  const update = useUpdatePrivacySettings()
  const p = data?.privacy
  const busy = update.isPending

  const set = (patch: Partial<PrivacySettings>) => update.mutate(patch)

  return (
    <section className="pt-2">
      <SectionLabel n="07" title="Privacy & toestemming" />
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        {isLoading || !p ? (
          <div className="space-y-3 py-6">
            <div className="h-10 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-10 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            <Row
              icon={Brain}
              title="Sparki-geheugen"
              desc="Sta Sparki toe om observaties over jouw training te onthouden en te gebruiken in toekomstige adviezen."
            >
              <Toggle
                on={p.aiMemoryEnabled}
                disabled={busy}
                onClick={() => set({ aiMemoryEnabled: !p.aiMemoryEnabled })}
              />
            </Row>

            <Row
              icon={ShieldCheck}
              title="Gevoelige analyse"
              desc="Vermoeidheid, stemming en gezondheid meewegen in de analyse. Uit = alleen prestatiedata."
            >
              <Toggle
                on={p.aiSensitiveAnalysisEnabled}
                disabled={busy}
                onClick={() =>
                  set({ aiSensitiveAnalysisEnabled: !p.aiSensitiveAnalysisEnabled })
                }
              />
            </Row>

            <Row
              icon={ShieldCheck}
              title="Gezondheid & mentaal"
              desc="Sta analyse van gezondheids- en mentale signalen toe (voeding, vermoeidheid, stemming). Uit = deze onderwerpen blijven buiten de analyse."
            >
              <Toggle
                on={p.aiHealthAnalysisEnabled}
                disabled={busy}
                onClick={() =>
                  set({ aiHealthAnalysisEnabled: !p.aiHealthAnalysisEnabled })
                }
              />
            </Row>

            <Row
              icon={ShieldCheck}
              title="Foto-analyse"
              desc="Sta toe dat foto's die jij uploadt (materiaal, voeding, Foto-lab) worden geanalyseerd. Uit = fotofuncties staan uit."
            >
              <Toggle
                on={p.aiVisionEnabled}
                disabled={busy}
                onClick={() => set({ aiVisionEnabled: !p.aiVisionEnabled })}
              />
            </Row>

            <Row
              icon={ShieldCheck}
              title="Documentanalyse"
              desc="Sta toe dat documenten die jij uploadt (wedstrijdgidsen, technische documenten) worden gelezen en samengevat."
            >
              <Toggle
                on={p.aiDocumentAnalysisEnabled}
                disabled={busy}
                onClick={() =>
                  set({ aiDocumentAnalysisEnabled: !p.aiDocumentAnalysisEnabled })
                }
              />
            </Row>

            <Row
              icon={Brain}
              title="Persoonlijke coaching"
              desc="Sta toe dat adviezen en uitleg persoonlijk voor jou worden verwoord. Uit = je krijgt alleen de vaste, feitelijke weergave."
            >
              <Toggle
                on={p.aiCoachingEnabled}
                disabled={busy}
                onClick={() => set({ aiCoachingEnabled: !p.aiCoachingEnabled })}
              />
            </Row>

            <Row
              icon={Users}
              title="Delen met coach"
              desc="Bepaal hoeveel van jouw data jouw gekoppelde coach ziet."
            >
              <Select
                value={p.dataSharingCoach}
                disabled={busy}
                onChange={(v) => set({ dataSharingCoach: v })}
                options={[
                  { value: "none", label: "Niets" },
                  { value: "summary", label: "Samenvatting" },
                  { value: "full", label: "Volledig" },
                ]}
              />
            </Row>

            <Row
              icon={UserCog}
              title="Delen met ouder"
              desc="Bepaal hoeveel van jouw data een gekoppelde ouder ziet."
            >
              <Select
                value={p.dataSharingParent}
                disabled={busy}
                onChange={(v) => set({ dataSharingParent: v })}
                options={[
                  { value: "none", label: "Niets" },
                  { value: "safety_only", label: "Alleen veiligheid" },
                  { value: "summary", label: "Samenvatting" },
                ]}
              />
            </Row>
          </div>
        )}
      </div>
      <p className="mt-2 px-1 text-[11px] leading-snug text-white/30">
        Je keuzes worden bijgehouden in een toestemmingslogboek. De volledige
        voorwaarden, export en accountverwijdering vind je hieronder bij
        Privacy en account.
      </p>
    </section>
  )
}
