import { useState } from "react"
import { Apple, ClipboardCheck, ChevronRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { VoedingScreen } from "@/components/sparki/voeding-screen"
import { HealthFlowSection } from "@/components/sparki/health-flow-section"
import { CheckinSheet } from "@/components/sparki/checkin-sheet"
import { MentalResilienceCard } from "@/components/sparki/mental-resilience-card"

// Hoofdstuk Lichaam — bundelt de bestaande lichaamssurfaces onder één dak:
// voeding & hydratatie, gezondheid/herstel (ziek/geblesseerd) en een
// gereserveerde plek voor Mentaal (toekomstig werk — geen nep-functionaliteit).
export default function LichaamPage() {
  const [voedingOpen, setVoedingOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)

  return (
    <ScreenShell bg={null} section="lichaam">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lichaam
        </h1>
        <p className="text-sm text-muted-foreground">
          Alles wat je lichaam draaiende houdt — voeding, herstel en gezondheid
          op één plek.
        </p>
      </div>

      <section className="mt-8">
        <SectionLabel title="Voeding" />
        <button
          type="button"
          onClick={() => setVoedingOpen(true)}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <Apple className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-foreground/90">
              Voeding &amp; hydratatie
            </span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Log je voeding en bekijk je fueling-advies
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </section>

      <section className="mt-8">
        <SectionLabel title="Gezondheid & herstel" />
        <HealthFlowSection />
        <button
          type="button"
          onClick={() => setCheckinOpen(true)}
          className="mt-3 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <ClipboardCheck className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-foreground/90">
              Check-in
            </span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Geef door hoe je je voelt — alleen wat vandaag nog ontbreekt
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </section>

      <div className="mt-8">
        <MentalResilienceCard />
      </div>

      <VoedingScreen open={voedingOpen} onOpenChange={setVoedingOpen} />
      <CheckinSheet open={checkinOpen} onClose={() => setCheckinOpen(false)} />
    </ScreenShell>
  )
}
