import { useEffect, useRef } from "react"
import { ArrowLeft, FileUp } from "lucide-react"
import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ConnectionsSection } from "@/components/sparki/connections-section"
import { ActivityImportPanel } from "@/components/sparki/activity-import-panel"

// Sparki Connect — het centrale koppeloverzicht (Meer > Instellingen).
// Eén plek waar de sporter alle externe bronnen ziet en beheert:
// - echte platformkoppelingen (Strava, Garmin, …) via de bestaande
//   ConnectionsSection (zelfde statusbron als de onboarding — GET /api/connectors);
// - de ingebouwde FIT/GPX/TCX-bestandsimport (bestaand ActivityImportPanel).
// Er wordt hier niets nieuws gesynchroniseerd: dit scherm toont en bedient
// uitsluitend de bestaande, werkende techniek. Geen tokens, geen technische
// codes, geen fictieve statussen.
export default function SparkiConnectPage() {
  const [, setLocation] = useLocation()

  // Bestaand Smart Missing Input-patroon: ?focus=import (bv. vanaf de
  // Analyse-knop "Rit importeren") scrolt direct naar de bestandsimport,
  // zodat die knop aantoonbaar iets anders doet dan "Platform koppelen".
  const importRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus")
    if (focus === "import") {
      importRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  return (
    <ScreenShell bg={null} section="meer" bare terug={false}>
      <button
        type="button"
        onClick={() => setLocation("/meer")}
        className="flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-accent-cyan"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Terug
      </button>

      <h1 className="mt-3 font-sans text-xl font-extralight text-foreground/90">
        Sparki Connect
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Koppel je sportplatforms en importeer bestanden. Hier staat alleen wat
        echt werkt en daadwerkelijk gekoppeld is.
      </p>

      <div className="mt-5">
        <ConnectionsSection />
      </div>

      <div className="mt-8 scroll-mt-6" ref={importRef}>
        <div className="flex items-center gap-2.5">
          <FileUp className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
          <h2 className="font-sans text-[15px] font-light text-foreground/80">
            Bestand importeren
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Zet een training uit een FIT-, GPX- of TCX-bestand direct in je
          activiteiten. Werkt altijd, ook zonder gekoppeld platform.
        </p>
        <div className="mt-3">
          <ActivityImportPanel />
        </div>
      </div>
    </ScreenShell>
  )
}
