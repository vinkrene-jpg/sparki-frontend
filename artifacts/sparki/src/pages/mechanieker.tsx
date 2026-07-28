import { ScreenShell } from "@/components/sparki/screen-shell"
import { MaterialCoach } from "@/components/sparki/material-coach"
import { BikeGarage } from "@/components/sparki/bike-garage"
import { MaterialTest } from "@/components/sparki/material-test"
import { Bike3DWerkblad } from "@/components/sparki/bike-3d-werkblad"
import { MaintenanceSignalsPanel } from "@/components/sparki/maintenance-signals"
import { UitlegDot } from "@/components/viz/uitleg"
import { SectionLabel } from "@/components/sparki/ui"

// Hoofdstuk Mechanieker — bundelt de materiaalcoach: materiaalcheck, onderhoud
// en foto-gedreven advies over je fiets en uitrusting.
export default function MechaniekerPage() {
  return (
    <ScreenShell bg="/atmosphere/samen-fietsen-bakstenen.webp" section="mechanieker">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Mechanieker
        </h1>
        <p className="text-sm text-white/55">
          Je fiets en materiaal in topconditie. Upload een foto voor eerlijk
          onderhoudsadvies op onderdeel-niveau.
        </p>
      </div>

      <section className="mt-8">
        <span className="inline-flex items-center gap-1">
          <SectionLabel n="" title="Onderhoudssignalen" />
          <UitlegDot uitlegKey="materiaalstatus" label="Onderhoudssignalen" />
        </span>
        <div className="mt-3">
          <MaintenanceSignalsPanel context="garage" />
        </div>
      </section>

      <section className="mt-8">
        <Bike3DWerkblad />
      </section>

      <section className="mt-8">
        <BikeGarage n="" />
      </section>

      <section className="mt-10">
        <MaterialTest />
      </section>

      <section className="mt-10">
        <MaterialCoach n="" />
      </section>
    </ScreenShell>
  )
}
