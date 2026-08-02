import type { ReactNode } from "react"
import { Brain, Sparkles, HeartPulse, Camera, FileText } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import {
  usePrivacySettings,
  useUpdatePrivacySettings,
  type PrivacySettings,
} from "@/hooks/use-privacy"

// Toestemmingenpagina voor de volwassen sporter — hier geef je per doeleinde
// zelf toestemming voor AI-gebruik. Zonder toestemming blijft de betreffende
// functie server-side uit (fail-closed); intrekken werkt per direct. Deze
// pagina is bewust apart en goed vindbaar, los van de kleine privacysectie in
// het profiel.

function Toggle({
  on,
  onClick,
  disabled,
  label,
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{
        background: on ? ACCENT : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-[#05070e] transition-all"
        style={{ left: on ? "calc(100% - 1.625rem)" : "0.125rem" }}
      />
    </button>
  )
}

function PurposeCard({
  icon: Icon,
  title,
  wat,
  data,
  sensitive = false,
  on,
  busy,
  onToggle,
}: {
  icon: React.ElementType
  title: string
  wat: string
  data: string
  sensitive?: boolean
  on: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <section
      className="rounded-2xl border bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
      style={{
        borderColor: sensitive
          ? "rgba(255,180,120,0.22)"
          : "rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <Icon className="h-5 w-5 text-white/60" strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium tracking-tight text-white/90">
              {title}
            </h2>
            {sensitive && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
                style={{
                  color: "rgb(255,190,140)",
                  background: "rgba(255,180,120,0.1)",
                  border: "1px solid rgba(255,180,120,0.28)",
                }}
              >
                Gevoelig
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <Toggle
            on={on}
            disabled={busy}
            onClick={onToggle}
            label={`${title} ${on ? "uitzetten" : "aanzetten"}`}
          />
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-white/60">
        <p>{wat}</p>
        <p className="text-white/45">
          <span className="text-white/55">Met je gegevens: </span>
          {data}
        </p>
      </div>
    </section>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    </div>
  )
}

function Intro({ children }: { children: ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-white/55">{children}</p>
  )
}

export default function AiToestemmingPage() {
  const { data, isLoading } = usePrivacySettings()
  const update = useUpdatePrivacySettings()
  const p = data?.privacy
  const busy = update.isPending

  const set = (patch: Partial<PrivacySettings>) => update.mutate(patch)

  return (
    <ScreenShell bg={null} section="you">
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-white/95">
            AI-toestemming
          </h1>
          <Intro>
            Hier bepaal je zelf waarvoor je slimme, op AI gebaseerde functies
            aanzet. Elke functie staat standaard uit: je krijgt hem pas als je
            hem hieronder aanzet. Zet je iets uit, dan stopt dat gebruik meteen
            — je hoeft niets extra's te doen.
          </Intro>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-[12px] leading-relaxed text-white/50">
              Je keuzes worden bijgehouden in een toestemmingslogboek. Zolang
              een functie uit staat, verwerken we daarvoor geen gegevens met
              AI.
            </p>
          </div>
        </header>

        {isLoading || !p ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="space-y-3">
            <PurposeCard
              icon={Sparkles}
              title="AI-coaching"
              wat="Adviezen en uitleg worden voor jou persoonlijk verwoord in gewone taal — bijvoorbeeld waarom een training past en waar je op kunt letten. Staat dit uit, dan krijg je alleen de vaste, feitelijke weergave zonder persoonlijke tekst."
              data="Je trainings- en prestatiegegevens worden gebruikt om de uitleg te schrijven. Er wordt niets openbaar gemaakt of gedeeld."
              on={p.aiCoachingEnabled}
              busy={busy}
              onToggle={() => set({ aiCoachingEnabled: !p.aiCoachingEnabled })}
            />

            <PurposeCard
              icon={Brain}
              title="Onthouden van observaties"
              wat="Belangrijke observaties over jouw training mogen worden onthouden en meegenomen in latere adviezen, zodat je niet steeds opnieuw hetzelfde hoeft uit te leggen. Staat dit uit, dan wordt elk advies los van eerdere momenten gemaakt."
              data="Korte observaties (bijvoorbeeld voorkeuren of terugkerende patronen) worden bij jouw account bewaard. Je kunt dit op elk moment weer uitzetten."
              on={p.aiMemoryEnabled}
              busy={busy}
              onToggle={() => set({ aiMemoryEnabled: !p.aiMemoryEnabled })}
            />

            <PurposeCard
              icon={HeartPulse}
              title="Gezondheidsanalyse"
              sensitive
              wat="Gezondheids- en mentale signalen — zoals vermoeidheid, stemming, slaap en voeding — mogen worden meegewogen in de analyse en adviezen. Dit gaat over gevoelige gegevens over jou. Staat dit uit, dan blijven deze onderwerpen volledig buiten de analyse en kijken we alleen naar prestatiedata."
              data="Gevoelige gezondheids- en welzijnsgegevens worden verwerkt om de analyse persoonlijker en veiliger te maken. Ze worden niet gebruikt voor andere doeleinden."
              on={p.aiHealthAnalysisEnabled}
              busy={busy}
              onToggle={() =>
                set({ aiHealthAnalysisEnabled: !p.aiHealthAnalysisEnabled })
              }
            />

            <PurposeCard
              icon={Camera}
              title="Foto-analyse"
              wat="Foto's die jij zelf uploadt — bijvoorbeeld een materiaal- of fietsscan of een opname in het Foto-lab — mogen worden bekeken en geanalyseerd. Staat dit uit, dan werken deze fotofuncties niet."
              data="Alleen foto's die jij zelf uploadt worden geanalyseerd. Er wordt niets gedeeld en de analyse gebeurt voor jouw eigen gebruik."
              on={p.aiVisionEnabled}
              busy={busy}
              onToggle={() => set({ aiVisionEnabled: !p.aiVisionEnabled })}
            />

            <PurposeCard
              icon={FileText}
              title="Documentanalyse"
              wat="Documenten die jij uploadt — zoals wedstrijdgidsen of technische documenten — mogen worden gelezen en samengevat, zodat je snel de kern eruit haalt. Staat dit uit, dan worden geüploade documenten niet gelezen."
              data="Alleen documenten die jij zelf uploadt worden gelezen om er een samenvatting van te maken. Ze worden niet voor andere doeleinden gebruikt."
              on={p.aiDocumentAnalysisEnabled}
              busy={busy}
              onToggle={() =>
                set({ aiDocumentAnalysisEnabled: !p.aiDocumentAnalysisEnabled })
              }
            />
          </div>
        )}

        <p className="px-1 text-[12px] leading-relaxed text-white/40">
          Intrekken werkt per direct: zodra je een functie uitzet, verwerken we
          daarvoor geen gegevens meer met AI. De volledige voorwaarden, een
          export van je gegevens en het verwijderen van je account vind je in je
          profiel bij Privacy en account.
        </p>
      </div>
    </ScreenShell>
  )
}
