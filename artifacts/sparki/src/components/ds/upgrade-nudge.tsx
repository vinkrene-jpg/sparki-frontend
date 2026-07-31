// Sparki-designsysteem — UpgradeNudge (taak 385).
//
// Eén herbruikbare Nederlandse upgrade-melding voor Go-only onderdelen.
// Vervangt de inhoud wanneer een abonnee zonder Go-recht een Go-onderdeel
// opent. Geen prijzen of marketing-copy (bewust buiten scope); eerlijk over
// wat het onderdeel doet en dat het bij Sparki Go hoort.
import { Lock } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** Vast doel van de upgrade-actie: het abonnementspaneel in de instellingen. */
export const UPGRADE_ACTION_PATH = "/you?focus=abonnement";
/** Vaste actie-copy — één plek, geen prijzen; leidt naar het abonnementsoverzicht. */
export const UPGRADE_ACTION_LABEL = "Bekijk je abonnement";

// Per onderdeel: titel, uitleg en het EERLIJKE pakket waar het bij hoort
// (Besluit René 31-07-2026, SPARKI-BESLUIT-2026-001 + -002): de vier
// oorspronkelijke onderdelen én course points/live-kaart zijn Sparki
// Compleet; de bibliotheek-beheer-extra's zijn Sparki Go.
export const GO_FEATURE_COPY: Record<
  string,
  { titel: string; uitleg: string; pakket: string }
> = {
  autonomous_training: {
    titel: "Trainingsplan-engine",
    uitleg:
      "Automatische trainingsplannen die met je meegroeien — opbouw, aanpassing en herstel, automatisch gepland.",
    pakket: "Sparki Compleet",
  },
  race_intel: {
    titel: "Race-intelligentie",
    uitleg:
      "Wedstrijdvoorbereiding, voedingsplan en wedstrijddossier — alles denkt met je mee naar de startstreep.",
    pakket: "Sparki Compleet",
  },
  ai_observations: {
    titel: "Coach-observaties & dagelijkse briefing",
    uitleg:
      "Sparki's dagelijkse briefing en coach-observaties over jouw training en herstel.",
    pakket: "Sparki Compleet",
  },
  performance_lab: {
    titel: "Performance Lab",
    uitleg:
      "Diepe analyse en trends: belasting, vermogenscurves en je ontwikkeling over de tijd.",
    pakket: "Sparki Compleet",
  },
  route_library_manage: {
    titel: "Routebibliotheek-beheer",
    uitleg:
      "Zoeken, sorteren, favorieten, archief, hernoemen en dupliceren in je routebibliotheek. Opslaan en je routes bekijken blijft gewoon gratis.",
    pakket: "Sparki Go",
  },
  route_course_points: {
    titel: "Course points & wedstrijdinformatie",
    uitleg:
      "Wedstrijdpunten (verzorging, klim, finish) in je routes en op je fietscomputer-export.",
    pakket: "Sparki Compleet",
  },
  live_friends_map: {
    titel: "Vrienden & ploeg live op de kaart",
    uitleg:
      "Zie tijdens de rit waar je vrienden of ploeggenoten rijden — en deel jouw positie veilig met hen.",
    pakket: "Sparki Compleet",
  },
};

export interface UpgradeNudgeProps {
  /** Go-onderdeel (autonomous_training | race_intel | ai_observations | performance_lab). */
  feature: string;
  /** Compacte kaartvorm voor inline gebruik (Home-kaarten e.d.). */
  compact?: boolean;
  /**
   * Toon de actieknop ("Bekijk Sparki Go") die naar het abonnementspaneel
   * leidt. Alleen aanzetten wanneer er daar echt een upgrade-actie klaarstaat
   * (bijv. via de billing-status) — anders eerlijk weglaten.
   */
  metActie?: boolean;
  className?: string;
}

function ActieKnop({ compact }: { compact?: boolean }) {
  return (
    <Link
      href={UPGRADE_ACTION_PATH}
      data-testid="upgrade-nudge-actie"
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 font-medium text-cyan-200 transition hover:bg-cyan-300/20",
        compact ? "mt-2 px-3 py-1.5 text-[12px]" : "mt-1 px-4 py-2 text-[13px]",
      )}
    >
      {UPGRADE_ACTION_LABEL}
    </Link>
  );
}

export function UpgradeNudge({ feature, compact, metActie, className }: UpgradeNudgeProps) {
  const copy = GO_FEATURE_COPY[feature] ?? {
    titel: "Dit onderdeel",
    uitleg: "Dit onderdeel hoort bij een Sparki-abonnement.",
    pakket: "Sparki Go",
  };

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 backdrop-blur",
          className,
        )}
        data-testid="upgrade-nudge"
      >
        <p className="flex items-center gap-2 text-[12px] font-medium text-white/80">
          <Lock className="h-3.5 w-3.5 text-cyan-300/80" aria-hidden />
          {copy.titel} hoort bij {copy.pakket}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-white/45">{copy.uitleg}</p>
        {metActie && <ActieKnop compact />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-10 text-center backdrop-blur",
        className,
      )}
      data-testid="upgrade-nudge"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10">
        <Lock className="h-4.5 w-4.5 text-cyan-300" aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-white/90">
        {copy.titel} hoort bij {copy.pakket}
      </p>
      <p className="text-[13px] leading-relaxed text-white/50">{copy.uitleg}</p>
      <p className="text-[12px] text-white/35">
        Met {copy.pakket} krijg je dit onderdeel erbij. Al je huidige gegevens en
        gratis onderdelen blijven gewoon werken.
      </p>
      {metActie && <ActieKnop />}
    </div>
  );
}
