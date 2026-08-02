// Race Day homepage (task #4, step 4). Competition mode: timings, weather,
// race/team info, coach instructions and material status — converging on ONE
// large primary action: START RACE MODE (a focused full-screen overlay). Honours
// grondregel 5: a single primary action, no competing CTAs.

import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { DayTypeBriefing } from "@/components/sparki/day-type-briefing"
import { HomeIntro } from "@/components/sparki/home-sections"
import {
  RaceCountdown,
  RaceSummaryCard,
  InfoBlock,
  NoRaceCard,
} from "@/components/sparki/race/race-shared"
import { RacePlannerTimeline } from "@/components/sparki/race/race-planner-timeline"
import { ChecklistStatus } from "@/components/sparki/race/prep-checklist"
import { RaceModeOverlay } from "@/components/sparki/race/race-mode-overlay"
import { RaceDayReport, RaceFuelCard } from "@/components/sparki/race/race-intel"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import { useRaceIntel } from "@/hooks/use-race-intel"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import { computeRaceDayTimings } from "@/lib/race-planner"
import type { DayHomeComponentProps } from "@/lib/day-type"

export function RaceDayHome({ briefing }: DayHomeComponentProps) {
  const { data, isLoading } = useAthleteDashboard()
  const { context } = useRaceContext()
  const profile = data?.athleteProfile
  const race = context?.race ?? null
  // Go-poort (taak 385): race-intelligentie hoort bij Sparki Go.
  const goAccess = useFeatureAccess("race_intel")
  const raceGoBlocked = goAccess.known && !goAccess.entitled
  const { data: intel } = useRaceIntel(raceGoBlocked ? undefined : race?.id)
  const [raceMode, setRaceMode] = useState(false)

  return (
    <ScreenShell section="Home" bg="/atmosphere/wedstrijd-renster-oranje.webp">
      <HomeIntro kicker="WEDSTRIJDDAG" profile={profile} isLoading={isLoading} />

      {!isLoading && <DayTypeBriefing config={briefing} />}

      <section>
        <SectionLabel n="01" title="Aftellen" large />
        <div className="mt-4 space-y-3">
          {race ? (
            <>
              <RaceCountdown race={race} daysUntil={context!.daysUntil} />
              <RaceSummaryCard race={race} />
            </>
          ) : (
            <NoRaceCard />
          )}
        </div>
      </section>

      {race && (
        <>
          <section>
            <SectionLabel n="02" title="Timings" large />
            <div className="mt-4">
              <RacePlannerTimeline
                race={race}
                steps={computeRaceDayTimings(race)}
                title="Dagplanning"
              />
            </div>
          </section>

          <section>
            <SectionLabel n="03" title="Weer & omstandigheden" large />
            <div className="mt-4">
              <InfoBlock
                label="Weer"
                value={race.weatherNote}
                empty="Nog geen weersinschatting toegevoegd"
              />
            </div>
          </section>

          <section>
            <SectionLabel n="04" title="Race-info" large />
            <div className="mt-4 grid grid-cols-1 gap-3">
              <InfoBlock label="Parcours" value={race.course} />
              <div className="grid grid-cols-2 gap-3">
                <InfoBlock
                  label="Afstand"
                  value={race.distanceKm ? `${race.distanceKm} km` : null}
                />
                <InfoBlock
                  label="Hoogtemeters"
                  value={race.elevationM != null ? `${race.elevationM} m` : null}
                />
              </div>
              {race.technicalSections && (
                <InfoBlock label="Technische delen" value={race.technicalSections} />
              )}
            </div>
          </section>

          {raceGoBlocked && (
            <section>
              <SectionLabel n="05" title="Wedstrijddagrapportage" large />
              <div className="mt-4">
                <UpgradeNudge feature="race_intel" compact />
              </div>
            </section>
          )}

          {intel && (
            <section>
              <SectionLabel n="05" title="Wedstrijddagrapportage" large />
              <div className="mt-4">
                <RaceDayReport report={intel.report} />
              </div>
            </section>
          )}

          {intel && (
            <section>
              <SectionLabel n="06" title="Race fuel" large />
              <div className="mt-4">
                <RaceFuelCard fuel={intel.fuel} />
              </div>
            </section>
          )}

          <section>
            <SectionLabel n="07" title="Team & coach" large />
            <div className="mt-4 space-y-3">
              <InfoBlock
                label={race.teamName ? race.teamName : "Team"}
                value={race.teamInfo}
                empty="Geen teaminfo toegevoegd"
              />
              <InfoBlock
                label="Coachinstructies"
                value={race.coachInstructions}
                empty="Geen instructies van je coach"
              />
            </div>
          </section>

          <section>
            <SectionLabel n="08" title="Materiaalstatus" large />
            <div className="mt-4">
              <ChecklistStatus race={race} />
            </div>
          </section>

          {/* THE single primary action — START RACE MODE */}
          <button
            type="button"
            onClick={() => setRaceMode(true)}
            className="group relative w-full overflow-hidden rounded-2xl border py-6 transition-transform active:scale-[0.99]"
            style={{
              borderColor: "rgba(120,210,230,0.4)",
              background:
                "linear-gradient(135deg, rgba(120,210,230,0.14), rgba(120,210,230,0.04))",
              boxShadow: "0 0 30px rgba(120,210,230,0.18)",
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-breathe-slow"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${ACCENT}, transparent 70%)`,
                opacity: 0.12,
              }}
            />
            <span className="relative block text-center">
              <span
                className="block font-sans text-2xl font-light tracking-wide"
                style={{ color: "rgba(255,255,255,0.96)" }}
              >
                START RACE MODE
              </span>
              <span className="mt-1 block font-mono text-[10px] tracking-[0.28em] text-accent-cyan">
                FOCUS · COUNTDOWN · GO
              </span>
            </span>
          </button>
        </>
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>

      {race && raceMode && (
        <RaceModeOverlay
          race={race}
          daysUntil={context!.daysUntil}
          onClose={() => setRaceMode(false)}
        />
      )}
    </ScreenShell>
  )
}
