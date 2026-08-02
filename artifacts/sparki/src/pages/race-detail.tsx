// Wedstrijddetail per geplande wedstrijd (/races/:id). Bereikbaar vanuit de
// kalender en de wedstrijdlijst. Toont per wedstrijd wat er écht is — naam,
// datum, tijd, locatie, discipline, parcoursvelden, doel, coachinstructie —
// en de gekoppelde voorbereiding (parcours & advies via het bestaande
// wedstrijddossier-werkblad). Ontbrekende gegevens staan eerlijk als "nog niet
// bekend"; niets wordt verzonnen. De acties koppelen door naar de bestaande
// schermen (wedstrijdkamer, volledig dossier, werkblad-bewerken).

import { useMemo } from "react"
import { useLocation, useRoute } from "wouter"
import { ChevronLeft, Film, BookOpen, Pencil } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { useRaces } from "@/hooks/use-races"
import { RaceWerkbladPanel } from "@/pages/races"
import type { Race, RacePriority } from "@/lib/race-types"

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"

const PRIORITY_LABEL: Record<RacePriority, string> = {
  A: "A-doel",
  B: "B-wedstrijd",
  C: "C-wedstrijd",
}

const REGISTRATION_LABEL: Record<string, string> = {
  niet_ingeschreven: "Nog niet ingeschreven",
  ingeschreven: "Ingeschreven",
  bevestigd: "Bevestigd",
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Eerlijke tabelregel: een echte waarde of het letterlijke "nog niet bekend".
function Fact({ label, value }: { label: string; value: string | null }) {
  const known = value != null && value.trim() !== ""
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[12px] text-white/45">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[13px] ${
          known ? "text-white/85" : "italic text-white/35"
        }`}
      >
        {known ? value : "nog niet bekend"}
      </span>
    </div>
  )
}

export default function RaceDetailPage() {
  const [, params] = useRoute("/races/:id")
  const raceId = params ? Number(params.id) : null

  return (
    <ScreenShell
      section="Races"
      bare
      terug={false}
      bg="/atmosphere/wedstrijd-renner-landschap.webp"
    >
      {raceId != null && Number.isFinite(raceId) ? (
        <RaceDetailView raceId={raceId} />
      ) : (
        <InvalidRace />
      )}
      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
    >
      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      Terug
    </button>
  )
}

function InvalidRace() {
  const [, setLocation] = useLocation()
  return (
    <>
      <BackButton onClick={() => setLocation("/races")} />
      <div className={`${cardClass} mt-3`}>
        <p className="text-sm text-white/70">
          Deze wedstrijd kon niet worden gevonden.
        </p>
      </div>
    </>
  )
}

function RaceDetailView({ raceId }: { raceId: number }) {
  const [, setLocation] = useLocation()
  const { data: races, isLoading, isError } = useRaces()

  const race: Race | undefined = useMemo(
    () => races?.find((r) => r.id === raceId),
    [races, raceId],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !race) {
    return (
      <>
        <BackButton onClick={() => setLocation("/races")} />
        <div className={`${cardClass} mt-3`}>
          <p className="text-sm text-white/70">
            {isError
              ? "De wedstrijden konden niet worden geladen. Probeer het later opnieuw."
              : "Deze wedstrijd kon niet worden gevonden. Mogelijk is hij verwijderd."}
          </p>
        </div>
      </>
    )
  }

  const cancelled = race.status === "geannuleerd"
  const distance =
    race.distanceKm != null && String(race.distanceKm).trim() !== ""
      ? `${Number(race.distanceKm)} km`
      : null
  const elevation = race.elevationM != null ? `${race.elevationM} m` : null
  const laps = race.localLaps != null ? `${race.localLaps} ronden` : null
  const registration = race.registrationStatus
    ? (REGISTRATION_LABEL[race.registrationStatus] ?? race.registrationStatus)
    : null

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <BackButton onClick={() => setLocation("/races")} />
        <div className="min-w-0">
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
            WEDSTRIJD
          </span>
          <h1 className="truncate text-lg font-semibold text-white">
            {race.name}
          </h1>
        </div>
        <span
          className="ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.16em]"
          style={{
            color: ACCENT,
            background: "rgba(120,210,230,0.08)",
            border: "1px solid rgba(120,210,230,0.22)",
          }}
        >
          {race.priority}
        </span>
      </header>

      {cancelled && (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
          <p className="text-[12px] text-amber-200/90">
            Deze wedstrijd is geannuleerd — hij telt nergens meer in je planning
            mee.
          </p>
        </div>
      )}

      {/* ── Basis: alleen echte gegevens; ontbrekend eerlijk gemarkeerd ── */}
      <section className={cardClass}>
        <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Basis
        </h2>
        <div className="divide-y divide-white/[0.05]">
          <Fact label="Datum" value={formatDate(race.raceDate)} />
          <Fact label="Starttijd" value={race.startTime} />
          <Fact label="Locatie" value={race.location} />
          <Fact label="Discipline" value={race.discipline} />
          <Fact label="Prioriteit" value={PRIORITY_LABEL[race.priority]} />
          <Fact label="Categorie" value={race.category} />
          <Fact label="Inschrijving" value={registration} />
        </div>
      </section>

      {/* ── Parcours: velden op de wedstrijd zelf (het diepe parcoursadvies
          staat in het werkblad hieronder) ── */}
      <section className={cardClass}>
        <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Parcours
        </h2>
        <div className="divide-y divide-white/[0.05]">
          <Fact label="Parcours" value={race.course} />
          <Fact label="Afstand" value={distance} />
          <Fact label="Hoogtemeters" value={elevation} />
          <Fact label="Lokale ronden" value={laps} />
          <Fact label="Technische stukken" value={race.technicalSections} />
        </div>
      </section>

      {/* ── Doel & opdracht: alleen tonen wat er echt is ── */}
      {(race.goal ||
        race.assignment ||
        race.coachInstructions ||
        race.notes) && (
        <section className={cardClass}>
          <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Doel & opdracht
          </h2>
          {race.goal && (
            <p className="pt-1 text-[13px] leading-relaxed text-white/75">
              <span className="text-white/40">Doel: </span>
              {race.goal}
            </p>
          )}
          {race.assignment && (
            <p className="pt-1 text-[13px] leading-relaxed text-white/75">
              <span className="text-white/40">Opdracht: </span>
              {race.assignment}
            </p>
          )}
          {race.coachInstructions && (
            <div
              className="mt-2 rounded-xl border p-3"
              style={{
                borderColor: "rgba(120,210,230,0.3)",
                background: "rgba(120,210,230,0.05)",
              }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
                Coachinstructie
              </span>
              <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                {race.coachInstructions}
              </p>
            </div>
          )}
          {race.notes && (
            <p className="pt-2 text-[12px] leading-relaxed text-white/55">
              {race.notes}
            </p>
          )}
        </section>
      )}

      {/* ── Voorbereiding: hergebruikt het bestaande parcours- & advieswerkblad
          (endpoint /api/races/:id/dossier). Toont zelf eerlijk wat er nog
          onbekend is. ── */}
      <RaceWerkbladPanel raceId={raceId} />

      {/* ── Acties: koppel door naar de bestaande schermen ── */}
      <section className="grid gap-2.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setLocation("/wedstrijd-room")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-[13px] font-medium text-cyan-100 transition-colors hover:bg-cyan-300/20"
        >
          <Film className="h-4 w-4" strokeWidth={1.75} />
          Wedstrijdkamer openen
        </button>
        <button
          type="button"
          onClick={() => setLocation(`/journey/wedstrijd/${raceId}`)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
        >
          <BookOpen className="h-4 w-4" strokeWidth={1.75} />
          Volledig dossier
        </button>
        <button
          type="button"
          onClick={() => setLocation(`/races?edit=${raceId}`)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} />
          Bewerken
        </button>
      </section>
    </div>
  )
}
