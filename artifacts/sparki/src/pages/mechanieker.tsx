import { useState } from "react"
import { Camera, Scale, BarChart3 } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { HoofdstukTabs } from "@/components/sparki/hoofdstuk-tabs"
import { BeheerSheet } from "@/components/sparki/beheer-popup"
import { MaterialCoach } from "@/components/sparki/material-coach"
import { BikeGarage } from "@/components/sparki/bike-garage"
import { ModelSchattingPanel, RitVergelijkingPanel } from "@/components/sparki/material-test"
import { Bike3DWerkblad } from "@/components/sparki/bike-3d-werkblad"
import { MaintenanceSignalsPanel } from "@/components/sparki/maintenance-signals"
import { UitlegDot } from "@/components/viz/uitleg"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"

// Hoofdstuk Mechanieker — bundelt de materiaalcoach: onderhoud, je fiets in de
// garage, vergelijkingstesten en foto-gedreven advies. Heringedeeld (F9): één
// primaire actie, 2-4 tabs, toevoeg-/testflows als stappenvenster.
type MechTab = "onderhoud" | "garage" | "testen" | "advies"

// Welk stappenvenster staat open — sheets over het scherm heen, met een eigen
// terug/sluiten via de Sheet-primitief. Nooit een lang scrolscherm.
type MechSheet = "modelschatting" | "ritvergelijking" | null

export default function MechaniekerPage() {
  const [tab, setTab] = useState<MechTab>("onderhoud")
  const [sheet, setSheet] = useState<MechSheet>(null)
  const closeSheet = () => setSheet(null)

  const TABS: { id: MechTab; label: string }[] = [
    { id: "onderhoud", label: "Onderhoud" },
    { id: "garage", label: "Garage" },
    { id: "testen", label: "Testen" },
    { id: "advies", label: "Advies" },
  ]

  return (
    <ScreenShell bg="/atmosphere/samen-fietsen-bakstenen.webp" section="mechanieker">
      <div className="flex flex-col gap-5">
        {/* Kop + hoofdhandeling in beeld bij openen (TUX-24/26). Eén primaire
            actie: een materiaalfoto laten beoordelen. Alle andere acties zijn
            secundair (tabs/sheets). */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Mechanieker
          </h1>
          <p className="text-sm text-muted-foreground">
            Je fiets en materiaal in topconditie — onderhoud, garage en advies op
            onderdeel-niveau.
          </p>
        </header>

        <button
          type="button"
          onClick={() => setTab("advies")}
          className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-medium text-[color:var(--color-on-accent)]"
          style={{ background: ACCENT }}
        >
          <Camera className="h-4 w-4" strokeWidth={2} /> Materiaalfoto beoordelen
        </button>

        <HoofdstukTabs<MechTab>
          tabs={TABS}
          actief={tab}
          onKies={(id) => setTab(id)}
          ariaLabel="Mechanieker-onderdelen"
        />

        {/* ── Onderhoud: signalen + je eigen fiets in beeld. ──────────────── */}
        {tab === "onderhoud" && (
          <div className="flex flex-col gap-8">
            <section aria-label="Onderhoudssignalen">
              <span className="inline-flex items-center gap-1">
                <SectionLabel n="" title="Onderhoudssignalen" />
                <UitlegDot uitlegKey="materiaalstatus" label="Onderhoudssignalen" />
              </span>
              <div className="mt-3">
                <MaintenanceSignalsPanel context="garage" />
              </div>
            </section>

            <section aria-label="Jouw fiets">
              <Bike3DWerkblad />
            </section>
          </div>
        )}

        {/* ── Garage: fietsen, uitrusting, sensoren. ──────────────────────── */}
        {tab === "garage" && (
          <div className="flex flex-col gap-8">
            <BikeGarage n="" />
          </div>
        )}

        {/* ── Testen: vergelijkingstest + modelschatting als stappenvensters. */}
        {tab === "testen" && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Vergelijkingstest</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Test een upgrade: twee ritten op dezelfde route — één met je
                huidige opstelling, één met de nieuwe. Of vraag vooraf een
                modelschatting op klasse-niveau.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheet("modelschatting")}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-[13px] text-foreground/80 backdrop-blur-md transition-colors hover:border-accent-cyan/35"
            >
              <Scale className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
              <span>
                <span className="block font-medium text-foreground/90">Modelschatting vooraf</span>
                <span className="text-[12px] text-muted-foreground">
                  Van plan iets te kopen? Vergelijk de klasse — geen meting.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSheet("ritvergelijking")}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-[13px] text-foreground/80 backdrop-blur-md transition-colors hover:border-accent-cyan/35"
            >
              <BarChart3 className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
              <span>
                <span className="block font-medium text-foreground/90">Twee ritten vergelijken</span>
                <span className="text-[12px] text-muted-foreground">
                  Zet de metingen van rit A en B naast elkaar.
                </span>
              </span>
            </button>
          </div>
        )}

        {/* ── Advies: foto-gedreven materiaaladvies. ──────────────────────── */}
        {tab === "advies" && (
          <div className="flex flex-col gap-8">
            <MaterialCoach n="" />
          </div>
        )}
      </div>

      {/* ── Stappenvensters (TUX-27..30): sheets over het scherm, met terug/
          sluiten via de Sheet-primitief. ────────────────────────────────── */}
      <BeheerSheet
        open={sheet === "modelschatting"}
        onOpenChange={(o) => !o && closeSheet()}
        titel="Modelschatting vooraf"
      >
        {sheet === "modelschatting" && <ModelSchattingPanel />}
      </BeheerSheet>
      <BeheerSheet
        open={sheet === "ritvergelijking"}
        onOpenChange={(o) => !o && closeSheet()}
        titel="Twee ritten vergelijken"
        breed
      >
        {sheet === "ritvergelijking" && <RitVergelijkingPanel />}
      </BeheerSheet>
    </ScreenShell>
  )
}
