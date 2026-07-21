import { ScreenShell } from "@/components/sparki/screen-shell"
import { MaterialCoach } from "@/components/sparki/material-coach"

// Hoofdstuk Mechanieker — bundelt de materiaalcoach: materiaalcheck, onderhoud
// en foto-gedreven advies over je fiets en uitrusting.
export default function MechaniekerPage() {
  return (
    <ScreenShell section="mechanieker">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Mechanieker
        </h1>
        <p className="text-sm text-white/55">
          Je fiets en materiaal in topconditie. Laat Sparki meekijken met een
          foto en krijg eerlijk onderhoudsadvies.
        </p>
      </div>

      <section className="mt-8">
        <MaterialCoach n="" />
      </section>
    </ScreenShell>
  )
}
