// Analyse (/lab) op het centrale designsysteem — Core-afbouwwave 2A.
// Uitsluitend presentatielaag: dezelfde hooks, dezelfde berekeningen
// (lib/performance-radar, engines via API) en dezelfde flows als het
// bestaande Lab-scherm, gepresenteerd in de commerciële schil. Flag
// commercial_shell uit = exact de bestaande pagina (switch in App.tsx).
//
// Eerlijkheid: elke sectie kent vier toestanden uit lib/core-analyse —
// laden (skeleton), fout (geen cijfers, één herstelactie), verouderd
// (cache tonen mág, uitsluitend mét melding) en leeg (bestaande
// MissingInputNotice-flows). Er bestaat hier geen mock- of vervangdata.

import { useState } from "react"
import { useLocation } from "wouter"

import { CommercialShell } from "@/components/sparki/commercial-shell"
import { DsCard, DsCardTitel } from "@/components/ds/card"
import { DsButton } from "@/components/ds/button"
import { DsState } from "@/components/ds/state"
import { DsStatus } from "@/components/ds/status"
import { ClubChip } from "@/components/sparki/club-chip"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { SparkiObservations } from "@/components/sparki/insights-section"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { MentalResilienceCard } from "@/components/sparki/mental-resilience-card"
import { AiMemoryPanel } from "@/components/sparki/ai-memory-panel"
import { ContextMemoryPanel } from "@/components/sparki/context-memory-panel"
import { UitlegDot } from "@/components/viz/uitleg"
import { useLoad, type LoadData } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { computePerformanceRadar, type RadarAxis } from "@/lib/performance-radar"
import { localISODate } from "@/lib/commercial-shell"
import type { TrainingSession } from "@/lib/athlete-types"
import {
  analyseToestand,
  combineerToestanden,
  laatstBijgewerktLabel,
  ANALYSE_PERIODES,
  type AnalysePeriode,
  periodeLabel,
  contextRegel,
  dekkingRegel,
  ftpWeergave,
  maandLabel,
  readinessReeks,
  hrvReeks,
  hrvVandaag,
  hrvDelta,
  reeksSamenvatting,
  radarSamenvatting,
  ftpSamenvatting,
  sessieDatumLabel,
  sessieTitel,
  sessieDuurLabel,
  sessieBelasting,
  ANALYSE_COPY,
  type AnalyseToestand,
} from "@/lib/core-analyse"

// ── Gedeelde bouwstenen ──────────────────────────────────────────────────────

/** Structurele vorm van een react-query-resultaat — geen eigen datalaag. */
type Bron<T> = {
  data: T | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => unknown
  dataUpdatedAt?: number
}

type Profiel =
  | {
      displayName?: string | null
      ftp?: number | null
      weightKg?: number | null
    }
  | null
  | undefined

function toestandVan(bron: Bron<unknown>, hasData: boolean): AnalyseToestand {
  return analyseToestand({
    isLoading: bron.isLoading,
    isError: bron.isError,
    hasData,
  })
}

function SkeletonBlok({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-card border border-border bg-surface ${className}`}
    />
  )
}

/** Verouderd-melding: cache blijft zichtbaar, maar nooit stilzwijgend. */
function VerouderdMelding({ bron }: { bron: Bron<unknown> }) {
  const bijgewerkt = laatstBijgewerktLabel(bron.dataUpdatedAt ?? null, Date.now())
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <DsStatus status="waarschuwing">{ANALYSE_COPY.verouderd}</DsStatus>
      {bijgewerkt && (
        <span className="type-body-sm text-content-secondary">
          {ANALYSE_COPY.laatstBijgewerkt} {bijgewerkt}.
        </span>
      )}
      <DsButton variant="secundair" onClick={() => void bron.refetch()}>
        {ANALYSE_COPY.opnieuw}
      </DsButton>
    </div>
  )
}

function FoutBlok({ titel, onOpnieuw }: { titel: string; onOpnieuw: () => void }) {
  return (
    <DsState
      soort="nietBeschikbaar"
      titel={titel}
      beschrijving={ANALYSE_COPY.foutBeschrijving}
      actie={{ label: ANALYSE_COPY.opnieuw, onClick: onOpnieuw }}
    />
  )
}

// ── 1. Performance-radar (primaire grafiek) ──────────────────────────────────

function RadarSectie({
  load,
  sessies,
  profiel,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
  profiel: Profiel
}) {
  const toestand = combineerToestanden(
    toestandVan(load, load.data != null),
    toestandVan(sessies, sessies.data != null),
  )
  const verouderdBron = load.isError ? load : sessies

  const assen = computePerformanceRadar({
    load: load.data
      ? { ctl: load.data.ctl, atl: load.data.atl, tsb: load.data.tsb }
      : null,
    sessions: (sessies.data ?? []).map((s) => ({
      sessionDate: s.sessionDate,
      feelScore: s.feelScore ?? null,
    })),
    ftpWatts: profiel?.ftp ?? null,
    weightKg: profiel?.weightKg ?? null,
    todayIso: localISODate(new Date()),
  })
  const meetbaar = assen.filter(
    (a): a is RadarAxis & { level: number } => a.level != null,
  )
  const nietMeetbaar = assen.filter((a) => a.level == null)
  const sterkste =
    meetbaar.length > 0
      ? meetbaar.reduce((a, b) => (b.level > a.level ? b : a))
      : null
  const samenvatting = radarSamenvatting(meetbaar)

  return (
    <section className="mb-8" aria-label="Performance-radar">
      <DsCard>
        <div className="flex items-center gap-1.5">
          <DsCardTitel>Performance-radar</DsCardTitel>
          <UitlegDot uitlegKey="performanceRadar" label="Performance Radar" />
        </div>
        {toestand === "fout" ? (
          <div className="mt-4">
            <FoutBlok
              titel={ANALYSE_COPY.radarFout}
              onOpnieuw={() => {
                void load.refetch()
                void sessies.refetch()
              }}
            />
          </div>
        ) : toestand === "laden" ? (
          <div className="mt-4 flex justify-center">
            <SkeletonBlok className="h-[260px] w-[260px] rounded-full" />
          </div>
        ) : (
          <>
            {toestand === "verouderd" && (
              <div className="mt-4">
                <VerouderdMelding bron={verouderdBron} />
              </div>
            )}
            {meetbaar.length >= 3 ? (
              <div className="mt-2 flex flex-col items-center">
                <BioRadar size={260} axes={meetbaar} />
                {samenvatting && <p className="sr-only">{samenvatting}</p>}
                <p className="max-w-[20rem] text-pretty text-center type-body-sm text-content-secondary">
                  {dekkingRegel(meetbaar.length, assen.length)} Je sterkste
                  signaal nu: {sterkste?.label}.
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <DsState
                  soort="leeg"
                  titel="Nog te weinig gegevens voor je radar"
                  beschrijving="Log sessies en check-ins zodat Sparki je capaciteitsprofiel kan opbouwen."
                />
              </div>
            )}
            {nietMeetbaar.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="type-label text-content-secondary">
                  Nog niet meetbaar
                </p>
                <ul className="mt-2 space-y-1.5">
                  {nietMeetbaar.map((a) => (
                    <li key={a.key} className="type-body-sm text-white/50">
                      <span className="text-white/80">{a.label}</span> —{" "}
                      {a.missingReason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </DsCard>
    </section>
  )
}

// ── 2. Readiness-trend met periodefilter (14/30/90 dagen) ────────────────────

function ReadinessSectie({
  metrics,
  periode,
  onPeriode,
}: {
  metrics: Bron<Array<{ feelScore?: number | null; hrv?: number | null }>>
  periode: AnalysePeriode
  onPeriode: (p: AnalysePeriode) => void
}) {
  const toestand = toestandVan(metrics, metrics.data != null)
  const reeks = readinessReeks(metrics.data ?? [])
  const samenvatting = reeksSamenvatting("Gereedheid", reeks, "van 100")

  return (
    <section className="mb-8" aria-label="Readiness-trend">
      <DsCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <DsCardTitel>Readiness-trend</DsCardTitel>
            <UitlegDot uitlegKey="readinessTrend" label="Readiness-trend" />
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Periode">
            {ANALYSE_PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriode(p)}
                aria-pressed={periode === p}
                aria-label={periodeLabel(p)}
                className={`min-h-11 min-w-11 rounded-control border px-3 font-mono text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 ${
                  periode === p
                    ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                    : "border-border text-white/45 hover:text-white/70"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
        {toestand === "fout" ? (
          <div className="mt-4">
            <FoutBlok
              titel={ANALYSE_COPY.metriekenFout}
              onOpnieuw={() => void metrics.refetch()}
            />
          </div>
        ) : toestand === "laden" ? (
          <SkeletonBlok className="mt-4 h-14 w-full" />
        ) : (
          <>
            {toestand === "verouderd" && (
              <div className="mt-4">
                <VerouderdMelding bron={metrics} />
              </div>
            )}
            {reeks.length >= 2 ? (
              <>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="type-label text-content-secondary">
                    {periodeLabel(periode)}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-accent-cyan">
                    {reeks[reeks.length - 1]} gereedheid
                  </span>
                </div>
                <div className="mt-3">
                  <Sparkline
                    data={reeks}
                    width={340}
                    height={56}
                    className="w-full text-accent-cyan"
                  />
                </div>
                {samenvatting && <p className="sr-only">{samenvatting}</p>}
                <p className="mt-3 type-body-sm text-content-secondary">
                  Gebaseerd op dagelijkse check-in scores. Gestage opbouw is het
                  doel.
                </p>
              </>
            ) : (
              <div className="mt-4">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen readiness-trend"
                  description="Log je dagelijkse check-in zodat Sparki je readiness-trend kan opbouwen."
                  targets={["checkin"]}
                  returnTo="/lab"
                />
              </div>
            )}
          </>
        )}
      </DsCard>
    </section>
  )
}

// ── 3. HRV-trend ─────────────────────────────────────────────────────────────

function HrvSectie({
  metrics,
  periode,
}: {
  metrics: Bron<Array<{ feelScore?: number | null; hrv?: number | null }>>
  periode: AnalysePeriode
}) {
  const toestand = toestandVan(metrics, metrics.data != null)
  const vandaag = hrvVandaag(metrics.data ?? [])
  const delta = hrvDelta(metrics.data ?? [])
  const reeks = hrvReeks(metrics.data ?? [])
  const samenvatting = reeksSamenvatting("HRV", reeks, "ms")

  return (
    <section className="mb-8" aria-label="HRV-trend">
      <DsCard>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <DsCardTitel>HRV-trend</DsCardTitel>
            <UitlegDot uitlegKey="hrvTrend" label="HRV-trend" />
          </div>
          <span className="type-label text-content-secondary">
            {periodeLabel(periode)}
          </span>
        </div>
        {toestand === "fout" ? (
          <div className="mt-4">
            <FoutBlok
              titel={ANALYSE_COPY.metriekenFout}
              onOpnieuw={() => void metrics.refetch()}
            />
          </div>
        ) : toestand === "laden" ? (
          <SkeletonBlok className="mt-4 h-16 w-full" />
        ) : (
          <>
            {toestand === "verouderd" && (
              <div className="mt-4">
                <VerouderdMelding bron={metrics} />
              </div>
            )}
            {vandaag != null ? (
              <>
                <div className="mt-4 flex items-end justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="num text-4xl font-extralight">
                      {Math.round(vandaag)}
                    </span>
                    <span className="type-label text-content-secondary">ms</span>
                  </div>
                  {delta != null && (
                    <div className="flex items-center gap-2">
                      <span className="type-label text-content-secondary">
                        vs gisteren
                      </span>
                      <span
                        className={`font-mono text-[12px] tabular-nums ${
                          delta > 0
                            ? "text-positive"
                            : delta < 0
                              ? "text-negative"
                              : "text-white/60"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    </div>
                  )}
                </div>
                {reeks.length >= 2 && (
                  <div className="mt-3">
                    <Sparkline
                      data={reeks}
                      width={340}
                      height={48}
                      className="w-full text-accent-cyan"
                    />
                  </div>
                )}
                {samenvatting && <p className="sr-only">{samenvatting}</p>}
              </>
            ) : (
              <div className="mt-4">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen HRV"
                  description="Voer je HRV in bij de dagelijkse check-in zodat Sparki je herstel kan volgen."
                  targets={["checkin"]}
                  returnTo="/lab"
                />
              </div>
            )}
          </>
        )}
      </DsCard>
    </section>
  )
}

// ── 4. FTP-ontwikkeling (Sportpaspoort blijft bron van waarheid) ─────────────

function FtpSectie({
  ftp,
  profiel,
}: {
  ftp: Bron<Array<{ ftpWatts: number; measuredAt: string }>>
  profiel: Profiel
}) {
  const toestand = toestandVan(ftp, ftp.data != null)
  const weergave = ftpWeergave(ftp.data ?? [], profiel?.ftp ?? null)
  const samenvatting = ftpSamenvatting(weergave.gesorteerd)

  return (
    <section className="mb-8" aria-label="FTP-ontwikkeling">
      <DsCard>
        <div className="flex items-center gap-1.5">
          <DsCardTitel>FTP-ontwikkeling</DsCardTitel>
          <UitlegDot
            uitlegKey="ftpOntwikkeling"
            label="FTP-ontwikkeling"
            persoonlijk={{ ftp: profiel?.ftp ?? null }}
          />
        </div>
        {toestand === "fout" ? (
          <div className="mt-4">
            <FoutBlok
              titel={ANALYSE_COPY.ftpFout}
              onOpnieuw={() => void ftp.refetch()}
            />
          </div>
        ) : toestand === "laden" ? (
          <SkeletonBlok className="mt-4 h-24 w-full" />
        ) : (
          <>
            {toestand === "verouderd" && (
              <div className="mt-4">
                <VerouderdMelding bron={ftp} />
              </div>
            )}
            {weergave.getoond == null ? (
              <div className="mt-4">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen FTP-tests"
                  description="Sparki heeft je FTP nodig om je vooruitgang te volgen. Stel je FTP in of log een test."
                  targets={["ftp"]}
                  returnTo="/lab"
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="num text-4xl font-extralight">
                      {weergave.getoond}
                    </span>
                    <span className="type-label text-content-secondary">
                      W{weergave.bronIsProfiel ? " · uit je Sportpaspoort" : ""}
                    </span>
                  </div>
                  {weergave.gesorteerd.length >= 2 && (
                    <span
                      className={`font-mono text-[12px] tabular-nums ${
                        weergave.deltaAllTime > 0
                          ? "text-positive"
                          : weergave.deltaAllTime < 0
                            ? "text-negative"
                            : "text-white/60"
                      }`}
                    >
                      {weergave.deltaAllTime > 0 ? "+" : ""}
                      {weergave.deltaAllTime}W all-time
                    </span>
                  )}
                </div>
                {weergave.gesorteerd.length > 0 && (
                  <div aria-hidden="true" className="mt-4 flex items-end gap-2">
                    {weergave.gesorteerd.map((t, i) => {
                      const hoogte =
                        weergave.maxWatts > 0
                          ? Math.max(
                              8,
                              Math.round((t.ftpWatts / weergave.maxWatts) * 100),
                            )
                          : 0
                      const laatste = i === weergave.gesorteerd.length - 1
                      return (
                        <div
                          key={`${t.measuredAt}-${i}`}
                          className="flex flex-1 flex-col items-center gap-1.5"
                        >
                          <div className="flex h-20 w-full max-w-10 items-end">
                            <div
                              className={`w-full rounded-t-sm ${
                                laatste ? "bg-accent-cyan/80" : "bg-white/10"
                              }`}
                              style={{ height: `${hoogte}%` }}
                            />
                          </div>
                          <span className="type-label text-content-secondary">
                            {maandLabel(t.measuredAt)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {samenvatting && <p className="sr-only">{samenvatting}</p>}
              </>
            )}
          </>
        )}
      </DsCard>
    </section>
  )
}

// ── 5. Trainingsverloop (bestaande component, DS-kaart eromheen) ─────────────

function VerloopSectie({
  load,
  sessies,
}: {
  load: Bron<LoadData>
  sessies: Bron<TrainingSession[]>
}) {
  const verouderd =
    combineerToestanden(
      toestandVan(load, load.data != null),
      toestandVan(sessies, sessies.data != null),
    ) === "verouderd"
  return (
    <section className="mb-8" aria-label="Trainingsverloop">
      <DsCard>
        <DsCardTitel>Trainingsverloop</DsCardTitel>
        {verouderd && (
          <div className="mt-3">
            <VerouderdMelding bron={load.isError ? load : sessies} />
          </div>
        )}
        <div className="mt-2">
          <TrainingProgression
            sessions={sessies.data}
            chartData={load.data?.chartData}
            loading={
              (load.isLoading && load.data == null) ||
              (sessies.isLoading && sessies.data == null)
            }
            hideLabel
          />
        </div>
      </DsCard>
    </section>
  )
}

// ── 6. Recente sessies → detail-drawer ───────────────────────────────────────

function SessiesSectie({
  sessies,
  onOpen,
}: {
  sessies: Bron<TrainingSession[]>
  onOpen: (s: TrainingSession) => void
}) {
  const [, navigate] = useLocation()
  const toestand = toestandVan(sessies, sessies.data != null)
  const lijst = sessies.data ?? []

  return (
    <section className="mb-8" aria-label="Recente sessies">
      <DsCard variant="compact">
        <DsCardTitel>Recente sessies</DsCardTitel>
        {toestand === "fout" ? (
          <div className="mt-4">
            <FoutBlok
              titel={ANALYSE_COPY.sessiesFout}
              onOpnieuw={() => void sessies.refetch()}
            />
          </div>
        ) : toestand === "laden" ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonBlok key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            {toestand === "verouderd" && (
              <div className="mt-4">
                <VerouderdMelding bron={sessies} />
              </div>
            )}
            {lijst.length > 0 ? (
              <div className="mt-2 flex flex-col">
                {lijst.slice(0, 8).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => onOpen(s)}
                    className="flex min-h-11 w-full items-center gap-4 border-b border-border py-3 text-left transition-colors last:border-0 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
                  >
                    <span className="w-14 shrink-0 font-mono text-[11px] text-white/40">
                      {sessieDatumLabel(s.sessionDate)}
                    </span>
                    <span className="flex-1 truncate type-body text-white/85">
                      {sessieTitel(s)}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {sessieDuurLabel(s.durationMin) != null && (
                        <span className="font-mono text-[11px] text-white/40">
                          {sessieDuurLabel(s.durationMin)}
                        </span>
                      )}
                      {sessieBelasting(s.tss) != null && (
                        <span className="font-mono text-[12px] tabular-nums text-accent-cyan">
                          {sessieBelasting(s.tss)}
                          <span className="sr-only"> belastingscore</span>
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog geen sessies gelogd"
                  description="Log een training om je sessie-historie en belasting op te bouwen."
                  actions={[
                    {
                      label: "Ga naar Training",
                      onClick: () => navigate("/train"),
                    },
                  ]}
                />
              </div>
            )}
          </>
        )}
      </DsCard>
    </section>
  )
}

// ── Hoofdpagina ──────────────────────────────────────────────────────────────

export default function CoreAnalysePage() {
  const [periode, setPeriode] = useState<AnalysePeriode>(14)
  const [openSessie, setOpenSessie] = useState<TrainingSession | null>(null)

  const load = useLoad()
  const ftp = useFtpHistory()
  const sessies = useSessions(60)
  const metrics = useDailyMetrics(periode)
  const profielQuery = useAthleteExtendedProfile()
  const profiel = profielQuery.data as Profiel

  // Bestaande profielregel (naam · FTP · W/kg) — zelfde afleiding als het
  // oude Lab-scherm, alleen weergave. Geen waarde = geen regel.
  const wkg =
    profiel?.ftp && profiel?.weightKg
      ? (profiel.ftp / profiel.weightKg).toFixed(1).replace(".", ",")
      : null
  const context = contextRegel(
    profiel
      ? { displayName: profiel.displayName, ftp: profiel.ftp, wkg }
      : null,
  )

  return (
    <CommercialShell actief="/lab">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="type-display">{ANALYSE_COPY.paginaTitel}</h1>
              <p className="type-body mt-1 text-content-secondary">
                {ANALYSE_COPY.paginaOnderschrift}
              </p>
              {context && (
                <p className="type-body-sm mt-2 text-content-secondary">
                  {context}
                </p>
              )}
            </div>
            <ClubChip />
          </div>
        </header>

        {/* Belangrijkste conclusie eerst: wat Sparki nu ziet (bestaande
            observaties — geen nieuwe analyses). */}
        <section className="mb-8" aria-label="Wat Sparki nu ziet">
          <SparkiObservations />
        </section>

        <RadarSectie load={load} sessies={sessies} profiel={profiel} />
        <ReadinessSectie
          metrics={metrics}
          periode={periode}
          onPeriode={setPeriode}
        />
        <HrvSectie metrics={metrics} periode={periode} />
        <FtpSectie ftp={ftp} profiel={profiel} />
        <VerloopSectie load={load} sessies={sessies} />
        <SessiesSectie sessies={sessies} onOpen={setOpenSessie} />

        <section className="mb-8" aria-label="Mentale weerbaarheid">
          <MentalResilienceCard />
        </section>
        <section className="mb-8" aria-label="AI-geheugen">
          <AiMemoryPanel />
        </section>
        <section className="mb-2" aria-label="Sparki onthoudt">
          <ContextMemoryPanel />
        </section>
      </div>

      <SessionDetailDrawer
        session={openSessie}
        open={openSessie != null}
        onOpenChange={(open) => {
          if (!open) setOpenSessie(null)
        }}
      />
    </CommercialShell>
  )
}
