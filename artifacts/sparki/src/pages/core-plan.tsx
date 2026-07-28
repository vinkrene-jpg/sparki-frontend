// Plan (/train) in de commerciële schil — Core-afbouwwave 1.
// Volledig gepresenteerd op het centrale designsysteem.
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { CommercialShell } from "@/components/sparki/commercial-shell";
import { localISODate } from "@/lib/commercial-shell";

import { DsWeek, type DsWeekDag } from "@/components/ds/week";
import { DsCard, DsCardTitel } from "@/components/ds/card";
import { DsButton } from "@/components/ds/button";
import { DsStatus } from "@/components/ds/status";
import { DsState } from "@/components/ds/state";
import { IconChevron } from "@/components/ds/icons";

// Intelligence / Logic
import { bronZin, kiesPlanActie, afleidDagStatus, startOfLocalWeek, derivedFacts, awaitsFeel, withinFeelWindow, sourceLabel } from "@/lib/core-plan";
import { judgeGoalFit } from "@/lib/train-intelligence";

// Hooks
import { useTrainingPlan, usePlanWindow, usePlanRange, useGenerateTrainingPlan, useAdaptTrainingPlan } from "@/hooks/use-training-plan";
import { useUpdateWorkout } from "@/hooks/use-today-workout";
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile";
import { useFixParams } from "@/hooks/use-missing-input";
import { useSessions, useUpdateSessionFeel } from "@/hooks/use-sessions";
import { useLoad } from "@/hooks/use-load";

// MissingInputNotice etc
import { isTargetSet } from "@/lib/missing-input";
import { MissingInputNotice } from "@/components/sparki/missing-input-notice";
import { CorePredictionPanel } from "@/components/sparki/core-prediction-panel";
import { WorkoutDetailDrawer } from "@/components/sparki/workout-detail-drawer";
import { AddTrainingModal } from "@/components/sparki/add-training";
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer";
import { TrainingProgression } from "@/components/sparki/training-progression";
import { ActivityImportPanel } from "@/components/sparki/activity-import-panel";
import { DocumentAnalysisPanel } from "@/components/sparki/document-analysis-panel";

// AI Insights imports
import { useObservations, useRunConnections } from "@/hooks/use-ai-memory";
import { useFtpHistory } from "@/hooks/use-ftp-history";
import { useDailyMetrics } from "@/hooks/use-daily-metrics";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { ownsObservation } from "@/lib/insight-ownership";
import { groupObservations, dedupeObservationsByText, type InsightGroup } from "@/lib/insight-grouping";
import { GraphInsightCard } from "@/components/sparki/insight/graph-insight-card";
import { HerkomstKnop } from "@/components/sparki/herkomst-sheet";
import type { TrainingSession, PlannedWorkout } from "@/lib/athlete-types";

// --- Sub-components --------------------------------------------------------

function PlanHeader() {
  const { data: plan } = useTrainingPlan();
  const { data: planWindow } = usePlanWindow(3);
  const hasManual = (planWindow?.length ?? 0) > 0 && !plan?.plan && !plan?.hasCoach;
  
  return (
    <div className="mb-8">
      <h1 className="type-display">Plan</h1>
      <p className="type-body text-content-secondary mt-1">
        Schema: {bronZin(plan, hasManual)}
      </p>
    </div>
  );
}

// ─── Kalender helpers ────────────────────────────────────────────────────────

function addDagenLocal(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function bouwMaandGrid(year: number, month: number): Date[][] {
  const eerste = new Date(year, month, 1);
  const laatste = new Date(year, month + 1, 0);
  const start = startOfLocalWeek(eerste);
  // Last Sunday of the last week that contains a day of this month:
  const lastMonday = startOfLocalWeek(laatste);
  const einde = addDagenLocal(lastMonday, 6);
  const weken: Date[][] = [];
  let huidig = new Date(start);
  while (huidig <= einde) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(huidig));
      huidig = addDagenLocal(huidig, 1);
    }
    weken.push(week);
  }
  return weken;
}

const MAANDNAMEN = [
  "Januari","Februari","Maart","April","Mei","Juni",
  "Juli","Augustus","September","Oktober","November","December",
] as const;

const DAGKOPPEN = ["Ma","Di","Wo","Do","Vr","Za","Zo"] as const;

/** Bepaalt de visuele stijl van een kalendercel.
 *  - isPast: de dag ligt vóór vandaag
 *  - hasSession: er bestaat minimaal één TrainingSession op die dag
 *    (ongeacht of er een geplande training is)
 */
function dagUiterlijk(
  w: PlannedWorkout | undefined,
  isPast: boolean,
  hasSession: boolean,
): { cel: string; label: string; stip: string } {
  // Geen geplande training — maar wel een sessie (onverwachte activiteit)
  if (!w) {
    if (hasSession && isPast) {
      return { cel: "border-white/[0.05] bg-transparent", label: "text-white/30", stip: "bg-positive/30" };
    }
    return { cel: "border-white/[0.05] bg-transparent", label: "text-white/25", stip: "" };
  }
  if (w.type === "rest") return { cel: "border-white/[0.05] bg-transparent", label: "text-white/25", stip: "" };
  if (w.status === "skipped") return { cel: "border-white/[0.05] bg-transparent", label: "text-white/25 line-through", stip: "bg-white/15" };
  if (w.status === "completed") return { cel: "border-white/10 bg-white/[0.02]", label: "text-white/40", stip: "bg-positive/50" };
  // Gemist: gepland of aangepast, datum voorbij, geen bewijs van uitvoering
  if (isPast && (w.status === "planned" || w.status === "modified") && w.sessionId == null) {
    return { cel: "border-white/[0.05] bg-transparent", label: "text-white/30 line-through", stip: "bg-red-400/40" };
  }
  // Automatisch aangepast — toekomstige training
  if (w.status === "modified") {
    return { cel: "border-amber-400/20 bg-amber-400/[0.04]", label: "text-amber-300/70", stip: "bg-amber-400/50" };
  }
  return { cel: "border-accent-cyan/20 bg-accent-cyan/[0.04]", label: "text-white/80", stip: "bg-accent-cyan" };
}

function kortTitel(w: PlannedWorkout): string {
  if (w.type === "rest") return "rust";
  const t = w.title ?? w.type;
  return t.length > 13 ? t.slice(0, 12) + "…" : t;
}

// ─── Geselecteerde dag kaart ─────────────────────────────────────────────────

/** Vergelijkingsrij gepland vs werkelijk (alleen zichtbaar bij historische items
 *  die gekoppeld zijn aan een uitgevoerde sessie). Nooit verzonnen data. */
function GeplandVsWerkelijkRij({
  geplandMin,
  werkelijkMin,
  geplandTSS,
  werkelijkTSS,
}: {
  geplandMin: number | null;
  werkelijkMin: number | null;
  geplandTSS: number | null;
  werkelijkTSS: number | null;
}) {
  if (geplandMin == null && geplandTSS == null) return null;
  const heeftWerkelijk = werkelijkMin != null || werkelijkTSS != null;
  if (!heeftWerkelijk) return null;

  function deltaLabel(plan: number | null, actual: number | null): string {
    if (plan == null || actual == null) return "";
    const d = actual - plan;
    return d === 0 ? "=" : d > 0 ? `+${d}` : String(d);
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 flex flex-col gap-1.5">
      <p className="type-label text-content-secondary uppercase tracking-wider text-[9px]">Gepland vs werkelijk</p>
      {(geplandMin != null || werkelijkMin != null) && (
        <div className="flex items-center gap-2 type-label">
          <span className="text-white/40 w-16 shrink-0">Duur</span>
          <span className="num text-white/60">{geplandMin != null ? `${geplandMin} min` : "—"}</span>
          <span className="text-white/25">→</span>
          <span className={cn("num font-medium", werkelijkMin != null ? "text-white/80" : "text-white/30")}>
            {werkelijkMin != null ? `${werkelijkMin} min` : "—"}
          </span>
          {geplandMin != null && werkelijkMin != null && (
            <span className={cn("num text-[10px] ml-auto", werkelijkMin >= geplandMin ? "text-positive/80" : "text-amber-400/70")}>
              {deltaLabel(geplandMin, werkelijkMin)}
            </span>
          )}
        </div>
      )}
      {(geplandTSS != null || werkelijkTSS != null) && (
        <div className="flex items-center gap-2 type-label">
          <span className="text-white/40 w-16 shrink-0">TSS</span>
          <span className="num text-white/60">{geplandTSS != null ? String(geplandTSS) : "—"}</span>
          <span className="text-white/25">→</span>
          <span className={cn("num font-medium", werkelijkTSS != null ? "text-white/80" : "text-white/30")}>
            {werkelijkTSS != null ? String(werkelijkTSS) : "—"}
          </span>
          {geplandTSS != null && werkelijkTSS != null && (
            <span className={cn("num text-[10px] ml-auto", werkelijkTSS >= geplandTSS ? "text-positive/80" : "text-amber-400/70")}>
              {deltaLabel(geplandTSS, werkelijkTSS)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function GeselecteerdeDagKaart({
  selectedDate,
  selectedWorkout,
  isSelectedToday,
  isPast,
  sessiesOpDag,
  onOpenAdd,
  onOpenDetail,
  onOpenSession,
  updateWorkout,
}: {
  selectedDate: string;
  selectedWorkout: PlannedWorkout | undefined;
  isSelectedToday: boolean;
  /** Datum ligt vóór vandaag */
  isPast: boolean;
  /** Alle TrainingSessions op deze dag (inclusief ongelinkte) */
  sessiesOpDag: TrainingSession[];
  onOpenAdd: () => void;
  onOpenDetail: (id: number) => void;
  onOpenSession: (s: TrainingSession) => void;
  updateWorkout: { mutate: (args: { id: number; status: string }) => void; isPending: boolean };
}) {
  const isRest = selectedWorkout?.type === "rest";
  const datumLabel = new Date(selectedDate + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Is deze training gemist? Gepland/aangepast, datum voorbij, geen sessionId.
  const isGemist =
    isPast &&
    selectedWorkout != null &&
    (selectedWorkout.status === "planned" || selectedWorkout.status === "modified") &&
    selectedWorkout.sessionId == null;

  // Gekoppelde sessie (bewijs van uitvoering).
  // Zoek eerst op sessionId, daarna op datum als fallback (bijv. handmatig gelinkt maar sessionId al gezet).
  const gekoppeldeSessie = selectedWorkout?.sessionId != null
    ? sessiesOpDag.find((s) => s.id === selectedWorkout.sessionId) ?? null
    : null;

  // Extra sessies op dezelfde dag die NIET de gekoppelde training zijn.
  const extraSessies = sessiesOpDag.filter(
    (s) => s.id !== (selectedWorkout?.sessionId ?? -1),
  );

  return (
    <div>
      <p className="type-label text-content-secondary mb-2 capitalize">{datumLabel}</p>

      {/* ── Geen geplande training ── */}
      {!selectedWorkout ? (
        sessiesOpDag.length > 0 ? (
          // Sessies aanwezig zonder geplande training (bijv. onverwachte rit)
          <div className="flex flex-col gap-3">
            {sessiesOpDag.map((s) => (
              <DsCard key={s.id} variant="standaard" className="flex flex-col gap-2 cursor-pointer hover:border-white/20 transition-colors" onClick={() => onOpenSession(s)}>
                <div className="flex items-start justify-between gap-3">
                  <DsCardTitel className="flex-1">{s.title ?? s.type}</DsCardTitel>
                  <DsStatus status="positief">Activiteit</DsStatus>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {s.durationMin != null && (
                    <span className="num type-label text-accent-cyan">{s.durationMin} min</span>
                  )}
                  {s.tss != null && (
                    <span className="num type-label text-accent-cyan">{s.tss} TSS</span>
                  )}
                </div>
              </DsCard>
            ))}
          </div>
        ) : isPast ? (
          // Verleden dag zonder enige activiteit — geen add-CTA (historisch)
          <DsState
            soort="leeg"
            titel="Geen activiteit op deze dag"
            beschrijving="Op deze dag is geen training gelogd of gepland."
          />
        ) : (
          // Toekomstige dag — voeg toe
          <DsState
            soort="leeg"
            titel="Geen training gepland"
            beschrijving="Er staat niets gepland voor deze dag."
            actie={{ label: "Training toevoegen", onClick: onOpenAdd }}
          />
        )
      ) : isRest ? (
        /* ── Rustdag ── */
        <DsCard variant="standaard" className="flex flex-col gap-3">
          <DsCardTitel>Rustdag</DsCardTitel>
          <p className="type-body text-content-secondary">
            {isPast
              ? "Op deze dag was herstel gepland."
              : "Neem de tijd om te herstellen. Er is geen training gepland."}
          </p>
          {/* Toon extra sessies ook op rustdagen (bijv. wandeling) */}
          {extraSessies.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="type-label text-content-secondary uppercase tracking-wider">Ook gelogd</p>
              {extraSessies.map((s) => (
                <button key={s.id} type="button" onClick={() => onOpenSession(s)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60">
                  <span className="type-action block">{s.title ?? s.type}</span>
                  {s.durationMin != null && (
                    <span className="num type-label text-content-secondary">{s.durationMin} min</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DsCard>
      ) : (
        /* ── Training (gepland / afgerond / gemist / aangepast / overgeslagen) ── */
        <DsCard variant="standaard" className="flex flex-col gap-4">
          <div className="flex justify-between items-start gap-4">
            <DsCardTitel>{selectedWorkout.title || "Training"}</DsCardTitel>
            <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
              {selectedWorkout.status === "completed" && !isGemist && (
                <DsStatus status="positief">Afgerond</DsStatus>
              )}
              {selectedWorkout.status === "skipped" && (
                <DsStatus status="neutraal">Overgeslagen</DsStatus>
              )}
              {selectedWorkout.status === "modified" && !isPast && (
                <DsStatus status="waarschuwing">Aangepast</DsStatus>
              )}
              {selectedWorkout.status === "modified" && isPast && !isGemist && (
                <DsStatus status="neutraal">Aangepast</DsStatus>
              )}
              {isGemist && <DsStatus status="fout">Gemist</DsStatus>}
            </div>
          </div>

          {/* Geplande waarden */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {selectedWorkout.targetDurationMin != null && (
              <div className="flex flex-col">
                <span className="type-label text-content-secondary text-[9px] uppercase tracking-wider">Gepland</span>
                <span className="num type-action text-accent-cyan">{selectedWorkout.targetDurationMin} min</span>
              </div>
            )}
            {selectedWorkout.targetTSS != null && (
              <div className="flex flex-col">
                <span className="type-label text-content-secondary text-[9px] uppercase tracking-wider">TSS</span>
                <span className="num type-action text-accent-cyan">{selectedWorkout.targetTSS}</span>
              </div>
            )}
          </div>

          {/* Gepland vs werkelijk (alleen bij gekoppelde sessie) */}
          {gekoppeldeSessie != null && (
            <GeplandVsWerkelijkRij
              geplandMin={selectedWorkout.targetDurationMin}
              werkelijkMin={gekoppeldeSessie.durationMin}
              geplandTSS={selectedWorkout.targetTSS}
              werkelijkTSS={gekoppeldeSessie.tss}
            />
          )}

          {selectedWorkout.description && (
            <p className="type-body text-content-secondary">{selectedWorkout.description}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <DsButton variant="primair" onClick={() => onOpenDetail(selectedWorkout.id)}>
              Training bekijken
            </DsButton>
            {!isPast && isSelectedToday && (selectedWorkout.status === "planned" || selectedWorkout.status === "modified") && (
              <>
                <DsButton variant="secundair" onClick={() => updateWorkout.mutate({ id: selectedWorkout.id, status: "completed" })} loading={updateWorkout.isPending}>
                  Afronden
                </DsButton>
                <DsButton variant="secundair" onClick={() => updateWorkout.mutate({ id: selectedWorkout.id, status: "skipped" })} loading={updateWorkout.isPending}>
                  Overslaan
                </DsButton>
              </>
            )}
          </div>
          {isSelectedToday && <CorePredictionPanel workoutId={selectedWorkout.id} />}

          {/* Extra sessies op dezelfde dag (niet de gekoppelde — geen duplicaat) */}
          {extraSessies.length > 0 && (
            <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.06]">
              <p className="type-label text-content-secondary uppercase tracking-wider">
                {extraSessies.length === 1 ? "Nog een activiteit" : `Nog ${extraSessies.length} activiteiten`}
              </p>
              {extraSessies.map((s) => (
                <button key={s.id} type="button" onClick={() => onOpenSession(s)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60">
                  <span className="type-action block">{s.title ?? s.type}</span>
                  {s.durationMin != null && (
                    <span className="num type-label text-content-secondary">{s.durationMin} min</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DsCard>
      )}
    </div>
  );
}

// ─── Kalender sectie (vervangt WeekEnDagSection) ─────────────────────────────

function KalenderSection({ highlightWeek, onOpenAdd }: { highlightWeek: boolean; onOpenAdd: (iso: string) => void }) {
  const todayISO = localISODate(new Date());
  const todayDate = new Date();

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [openSessie, setOpenSessie] = useState<TrainingSession | null>(null);

  // Mobile: week offset (no limits — negative = past weeks)
  const [weekOffset, setWeekOffset] = useState(0);

  // Desktop: month navigation
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth()); // 0-indexed

  // Generous fetch range covering both views with buffer
  const weekCenter = addDagenLocal(todayDate, weekOffset * 7);
  const weekFetchFrom = addDagenLocal(startOfLocalWeek(weekCenter), -21);
  const weekFetchTo   = addDagenLocal(startOfLocalWeek(weekCenter),  35);
  const monthFetchFrom = new Date(viewYear, viewMonth - 1, 1);
  const monthFetchTo   = new Date(viewYear, viewMonth + 2, 0);

  // Union of both ranges ensures no cache miss when switching views
  const fetchFrom = localISODate(weekFetchFrom < monthFetchFrom ? weekFetchFrom : monthFetchFrom);
  const fetchTo   = localISODate(weekFetchTo   > monthFetchTo   ? weekFetchTo   : monthFetchTo);

  const { data: workouts, isLoading, isError, refetch } = usePlanRange(fetchFrom, fetchTo);
  const trustedWorkouts = workouts ?? [];
  const updateWorkout = useUpdateWorkout();

  // Sessies — nodig voor "gepland vs werkelijk" vergelijking en voor dagen
  // zonder geplande training maar met een gelogde activiteit.
  // Fetch 60 sessies om ook oudere maanden te dekken.
  const { data: sessies } = useSessions(60);
  const trustedSessies: TrainingSession[] = sessies ?? [];

  /** Geeft alle sessies op een specifieke datum — nooit gefabriceerde data. */
  function getSessiesOpDag(iso: string): TrainingSession[] {
    return trustedSessies.filter((s) => s.sessionDate === iso);
  }

  // Vandaag — reset all views
  function naarVandaag() {
    setSelectedDate(todayISO);
    setWeekOffset(0);
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
  }

  // Month navigation (desktop)
  function prevMaand() {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }
  function nextMaand() {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  // Week navigation (mobile) — also syncs month view
  function navigeerWeek(offset: number) {
    setWeekOffset(offset);
    const center = addDagenLocal(todayDate, offset * 7);
    setViewYear(center.getFullYear());
    setViewMonth(center.getMonth());
    // Move selection: if today is in the new week keep it, else pick Monday of that week
    const ws = startOfLocalWeek(center);
    const wsISO = localISODate(ws);
    const weISO = localISODate(addDagenLocal(ws, 6));
    if (todayISO >= wsISO && todayISO <= weISO) {
      setSelectedDate(todayISO);
    } else {
      setSelectedDate(wsISO);
    }
  }

  // Build week grid (7 ISOs from Monday of the offset week)
  const weekBase = startOfLocalWeek(addDagenLocal(todayDate, weekOffset * 7));
  const weekISOs = Array.from({ length: 7 }, (_, i) => localISODate(addDagenLocal(weekBase, i)));
  const weekDagen: DsWeekDag[] = weekISOs.map((iso, idx) => {
    const date = addDagenLocal(weekBase, idx);
    const w = trustedWorkouts.find(x => x.scheduledDate === iso);
    const raw = date.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2);
    const isWeekDagPast = iso < todayISO;
    const isMissed = isWeekDagPast && w != null && (w.status === "planned" || w.status === "modified") && w.sessionId == null;
    const heeftSessie = getSessiesOpDag(iso).length > 0;
    return {
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
      status: afleidDagStatus(w?.type),
      actief: iso === selectedDate,
      vandaag: iso === todayISO,
      // "!" hint voor gemiste training of "✓" voor dag met sessie maar geen plan
      waarde: isMissed
        ? "!"
        : w?.targetTSS
          ? String(w.targetTSS)
          : (w ? "—" : heeftSessie ? "✓" : undefined),
    };
  });

  const selectedWorkout = trustedWorkouts.find(w => w.scheduledDate === selectedDate);
  const isSelectedToday = selectedDate === todayISO;
  const isSelectedPast = selectedDate < todayISO;
  const isHuidigeMaand = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth();
  const maandGrid = bouwMaandGrid(viewYear, viewMonth);

  if (isError) {
    return (
      <section className="mb-8">
        <DsState soort="nietBeschikbaar" titel="Schema kon niet geladen worden." actie={{ label: "Opnieuw proberen", onClick: () => refetch() }} />
      </section>
    );
  }

  return (
    <section
      id="week-nav"
      className={cn("mb-8 transition-shadow duration-500 rounded-xl", highlightWeek && "shadow-[0_0_0_2px_var(--color-accent-cyan)]")}
    >
      {/* ── Navigatieheader ── */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          {/* Mobile: week label */}
          <span className="lg:hidden type-title-card">
            {weekOffset === 0
              ? "Deze week"
              : weekOffset > 0
                ? `Over ${weekOffset} week${weekOffset > 1 ? "en" : ""}`
                : `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? "en" : ""} geleden`}
          </span>
          {/* Desktop: month + year */}
          <span className="hidden lg:inline type-title-card">
            {MAANDNAMEN[viewMonth]} {viewYear}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(!isHuidigeMaand || weekOffset !== 0) && (
            <button
              type="button"
              onClick={naarVandaag}
              className="type-label uppercase tracking-wider text-accent-cyan px-2 py-1 rounded hover:bg-accent-cyan/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
            >
              Vandaag
            </button>
          )}
          {/* Mobile: vorige / volgende week */}
          <div className="flex gap-1.5 lg:hidden">
            <DsButton variant="secundair" onClick={() => navigeerWeek(weekOffset - 1)} className="px-3 min-w-11" aria-label="Vorige week">
              <IconChevron className="rotate-180" />
            </DsButton>
            <DsButton variant="secundair" onClick={() => navigeerWeek(weekOffset + 1)} className="px-3 min-w-11" aria-label="Volgende week">
              <IconChevron />
            </DsButton>
          </div>
          {/* Desktop: vorige / volgende maand */}
          <div className="hidden lg:flex gap-1.5">
            <DsButton variant="secundair" onClick={prevMaand} className="px-3 min-w-11" aria-label="Vorige maand">
              <IconChevron className="rotate-180" />
            </DsButton>
            <DsButton variant="secundair" onClick={nextMaand} className="px-3 min-w-11" aria-label="Volgende maand">
              <IconChevron />
            </DsButton>
          </div>
        </div>
      </div>

      {/* ── Laadskeleton ── */}
      {isLoading && (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-surface border border-border" />
          <div className="h-40 animate-pulse rounded-xl bg-surface border border-border" />
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">

          {/* ── Kalender (links op desktop, boven op mobiel) ── */}
          <div className="lg:flex-1 lg:min-w-0">

            {/* Mobile: week strip */}
            <div className="lg:hidden">
              <DsWeek
                dagen={weekDagen}
                onSelecteer={(idx) => setSelectedDate(weekISOs[idx]!)}
                selectieLabel="Kies een dag in de planweek"
              />
            </div>

            {/* Desktop: maandgrid */}
            <div className="hidden lg:block">
              {/* Dag-koppen */}
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {DAGKOPPEN.map(d => (
                  <div key={d} className="py-1.5 text-center text-[10px] uppercase tracking-widest text-content-secondary">
                    {d}
                  </div>
                ))}
              </div>
              {/* Weken */}
              <div className="space-y-1">
                {maandGrid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((date) => {
                      const iso = localISODate(date);
                      const inMaand = date.getMonth() === viewMonth;
                      const w = trustedWorkouts.find(x => x.scheduledDate === iso);
                      const celPast = iso < todayISO;
                      const celSessies = getSessiesOpDag(iso);
                      const celHeeftSessie = celSessies.length > 0;
                      const stijl = dagUiterlijk(w, celPast, celHeeftSessie);
                      const isToday = iso === todayISO;
                      const isSelected = iso === selectedDate;
                      // Extra stipje voor sessies zonder geplande training
                      const heeftOnverwachteSessie = celHeeftSessie && !w;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => inMaand && setSelectedDate(iso)}
                          disabled={!inMaand}
                          className={cn(
                            "min-h-[3.75rem] rounded-lg border p-1.5 text-left flex flex-col gap-0.5 transition-colors",
                            isSelected
                              ? "border-accent-cyan/60 bg-accent-cyan/10"
                              : isToday
                                ? "border-accent-cyan/35 bg-surface"
                                : w && w.type !== "rest"
                                  ? cn(stijl.cel)
                                  : "border-white/[0.05] bg-transparent",
                            !inMaand && "opacity-25 cursor-default",
                            inMaand && "hover:border-white/20",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
                          )}
                          aria-label={`${date.getDate()} ${MAANDNAMEN[date.getMonth()]}`}
                          aria-pressed={isSelected}
                          aria-current={isToday ? "date" : undefined}
                        >
                          <span className={cn(
                            "num text-[11px] font-mono leading-none",
                            isToday && !isSelected ? "text-accent-cyan font-semibold" :
                            isSelected ? "text-white font-semibold" :
                            inMaand ? "text-white/65" : "text-white/20",
                          )}>
                            {date.getDate()}
                          </span>
                          {w && w.type !== "rest" && (
                            <span className={cn("text-[10px] leading-tight flex-1 overflow-hidden", stijl.label)}>
                              {kortTitel(w)}
                            </span>
                          )}
                          {w?.type === "rest" && (
                            <span className="text-[10px] text-white/20 leading-tight">rust</span>
                          )}
                          {/* Stipje: geplande training (met kleur per status) OF onverwachte sessie */}
                          <div className="mt-auto flex items-end justify-between gap-0.5 self-end">
                            {w && w.type !== "rest" && stijl.stip && (
                              <span className={cn("h-1 w-1 rounded-full shrink-0", stijl.stip)} aria-hidden="true" />
                            )}
                            {heeftOnverwachteSessie && (
                              <span className="h-1 w-1 rounded-full shrink-0 bg-positive/40" aria-hidden="true" />
                            )}
                            {/* Meerdere sessies indicator */}
                            {celSessies.length > 1 && (
                              <span className="num text-[9px] font-mono text-white/30 leading-none">{celSessies.length}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Dagdetail (rechts op desktop, onder op mobiel) ── */}
          <div className="lg:w-64 lg:shrink-0">
            <GeselecteerdeDagKaart
              selectedDate={selectedDate}
              selectedWorkout={selectedWorkout}
              isSelectedToday={isSelectedToday}
              isPast={isSelectedPast}
              sessiesOpDag={getSessiesOpDag(selectedDate)}
              onOpenAdd={() => onOpenAdd(selectedDate)}
              onOpenDetail={(id) => setDetailId(id)}
              onOpenSession={(s) => setOpenSessie(s)}
              updateWorkout={updateWorkout}
            />
          </div>
        </div>
      )}

      <WorkoutDetailDrawer
        workoutId={detailId}
        open={detailId !== null}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
      />
      <SessionDetailDrawer
        session={openSessie}
        open={openSessie != null}
        onOpenChange={(o) => { if (!o) setOpenSessie(null); }}
      />
    </section>
  );
}

function PlanActieSection() {
  const { data: plan } = useTrainingPlan();
  const { data: profile } = useAthleteExtendedProfile();
  const generate = useGenerateTrainingPlan();
  const adapt = useAdaptTrainingPlan();
  
  const canBuildNow = isTargetSet("ftp", profile) && isTargetSet("weeklyHours", profile);
  const action = kiesPlanActie(plan, canBuildNow);

  if (action === "none") return null;

  return (
    <section className="mb-8">
      {action === "missing" && (
         <MissingInputNotice 
           compact
           showOrb={false}
           title="Laat je schema opbouwen"
           description="Met je FTP en wekelijkse uren komt er een periodiseerd plan dat meebeweegt met je vorm."
           targets={["ftp", "weeklyHours"]}
           profile={profile}
           returnTo="/train"
           retry="generate-plan"
         />
      )}
      {action === "generate" && (
         <DsCard>
           <DsCardTitel className="mb-2">Schema bouwen</DsCardTitel>
           <DsButton variant="primair" onClick={() => generate.mutate()} loading={generate.isPending}>Schema bouwen</DsButton>
           {generate.isError && <DsStatus status="fout" className="mt-3">Het opbouwen lukte niet.</DsStatus>}
         </DsCard>
      )}
      {action === "adapt" && (
         <DsCard>
           <DsCardTitel className="mb-3">Schema aanpassen</DsCardTitel>
           <div className="flex flex-col sm:flex-row gap-2">
             <DsButton variant="primair" onClick={() => adapt.mutate()} loading={adapt.isPending}>
               Pas mijn plan aan
             </DsButton>
             <DsButton variant="secundair" onClick={() => generate.mutate()} loading={generate.isPending}>
               Bouw opnieuw
             </DsButton>
           </div>
           {adapt.isError && <DsStatus status="fout" className="mt-3">Aanpassen lukte niet.</DsStatus>}
           {adapt.isSuccess && adapt.data && (
             <DsStatus status={adapt.data.adapted ? "positief" : "neutraal"} className="mt-3">
               {adapt.data.adapted ? adapt.data.note : "Geen aanpassing nodig — je voorlopige weken passen nog bij je herstel."}
             </DsStatus>
           )}
           {generate.isError && <DsStatus status="fout" className="mt-3">Het opbouwen lukte niet.</DsStatus>}
         </DsCard>
      )}
    </section>
  );
}

function DoelMeetlatSection() {
  const [, navigate] = useLocation();
  const { data: plan } = useTrainingPlan();
  const { data: load } = useLoad();
  const fit = judgeGoalFit({ inputs: plan?.inputs, load });
  const noGoal = !plan?.inputs?.nextRace;

  return (
    <section className="mb-8">
      <h2 className="type-title-card text-white/90 mb-3">Doel als meetlat</h2>
      <DsCard>
        <div className="flex items-center gap-2 mb-2">
           <DsStatus status={fit.verdict === "op_koers" ? "positief" : fit.verdict === "onbekend" ? "neutraal" : "waarschuwing"}>
             {fit.verdict.replace("_", " ")}
           </DsStatus>
        </div>
        <p className="type-title-insight mb-2 text-white/95">{fit.headline}</p>
        <p className="type-body text-content-secondary">{fit.reason}</p>
        {noGoal && (
           <DsButton variant="secundair" className="mt-4" onClick={() => navigate("/you?focus=doelen")}>Voeg een doel toe</DsButton>
        )}
      </DsCard>
    </section>
  );
}

function renderGroupExtended(group: InsightGroup): React.ReactNode | undefined {
  const { lead, members } = group
  const others = dedupeObservationsByText(
    members.filter((m) => m.id !== lead.id),
    [lead],
  ).slice(0, 3)
  const signals = lead.signals ?? []
  const alts = lead.alternativeExplanations ?? []
  if (!lead.recommendedAction && signals.length === 0 && others.length === 0 && alts.length === 0) {
    return undefined
  }
  return (
    <div className="space-y-3 type-body">
      {lead.recommendedAction && (
        <div className="rounded-lg border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-2 text-accent-cyan">
          {lead.recommendedAction}
        </div>
      )}
      {signals.length > 0 && (
        <div className="space-y-2">
          <p className="type-label text-content-secondary uppercase tracking-wider">Waarop dit is gebaseerd</p>
          {signals.map((s, i) => (
            <div key={`${s.kind}-${i}`} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
              <p className="text-white/60">
                <span className="text-white/80">{s.label}:</span> {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="type-label text-content-secondary uppercase tracking-wider">Ook hierover opgevallen</p>
          {others.map((o) => (
             <p key={o.id} className="text-white/55">{o.observationText}</p>
          ))}
        </div>
      )}
      {alts.length > 0 && (
        <div>
          <p className="text-white/40">Andere mogelijke verklaringen:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {alts.map((a, i) => (
              <li key={i} className="text-white/45">• {a}</li>
            ))}
          </ul>
        </div>
      )}
      {typeof lead.id === "number" && (
        <div className="pt-1">
           <HerkomstKnop target={{ type: "observation", id: lead.id }} compact />
        </div>
      )}
    </div>
  )
}

function PatronenSection() {
  const aiEnabled = useFeatureFlag("ai_observations");
  const { data: obs } = useObservations(aiEnabled);
  const { data: sessions } = useSessions(60);
  const { data: load } = useLoad();
  const { data: ftpHistory } = useFtpHistory();
  const { data: metrics } = useDailyMetrics(30);
  const runConnections = useRunConnections();
  const [, navigate] = useLocation();

  const training = (obs?.observations ?? []).filter((o) => ownsObservation("train", o));
  const groups = groupObservations(training, { metrics, ftpHistory, load, sessions });
  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <section className="mb-8">
      <h2 className="type-title-card text-white/90 mb-3">Wat over tijd opvalt</h2>
      
      {aiEnabled && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.slice(0, 6).map((g) => (
            <GraphInsightCard
              key={g.key}
              title={g.lead.title}
              confidence={g.lead.confidence}
              concern={g.lead.severity === "important" || g.lead.severity === "urgent"}
              series={g.series}
              read={g.lead.observationText}
              extended={renderGroupExtended(g)}
            />
          ))}
        </div>
      )}

      {aiEnabled && groups.length === 0 && (
        <DsCard>
          {hasSessions ? (
            <>
              <p className="type-body text-content-secondary mb-3">
                Je trainingen zijn er, maar er zijn nog geen patronen vastgelegd. Je gegevens worden doorzocht op verbanden.
              </p>
              <DsButton variant="primair" onClick={() => runConnections.mutate()} loading={runConnections.isPending}>
                Verbanden analyseren
              </DsButton>
            </>
          ) : (
            <DsState 
              soort="leeg" 
              titel="Nog te weinig trainingen voor patronen"
              beschrijving="Patronen worden pas zichtbaar na een paar weken aan gelogde trainingen. Log je trainingen of koppel een platform."
              actie={{ label: "Log een training", onClick: () => navigate("/train?focus=logsession") }}
            />
          )}
        </DsCard>
      )}
    </section>
  );
}

function OntwikkelingSection() {
  const { data: sessions, isLoading: sessionsLoading } = useSessions(60);
  const { data: load, isLoading: loadLoading } = useLoad();
  return (
    <section className="mb-8">
       <h2 className="type-title-card text-white/90">Je ontwikkeling</h2>
       <p className="type-body text-content-secondary mb-3">Niet alleen vandaag — zo ontwikkel je je over meerdere trainingen heen.</p>
       <TrainingProgression sessions={sessions} chartData={load?.chartData} loading={sessionsLoading || loadLoading} hideLabel={true} />
    </section>
  );
}

function DsConfirmActivityCard({ session }: { session: TrainingSession }) {
  const update = useUpdateSessionFeel();
  const [feel, setFeel] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const facts = derivedFacts(session);
  const date = new Date(session.sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", { weekday: "short", month: "short", day: "numeric" });
  
  function save() {
    update.mutate({
      id: session.id,
      feelScore: feel ?? undefined,
      notes: notes.trim() ? notes.trim() : undefined,
    });
  }

  return (
    <DsCard variant="standaard" className="flex flex-col gap-3">
      <div className="flex flex-col">
         <p className="type-label text-accent-cyan uppercase tracking-wider">Nieuwe activiteit binnen</p>
         <DsCardTitel className="mt-1">{session.title ?? session.type}</DsCardTitel>
         <p className="type-body-sm text-content-secondary mt-0.5">{date} · {sourceLabel(session.source)}</p>
      </div>
      
      {facts.length > 0 && (
         <div className="flex flex-wrap gap-1.5 mt-1">
           {facts.map(f => (
             <span key={f} className="rounded-control border border-border bg-surface px-2 py-1 type-label font-mono text-white/70">
               {f}
             </span>
           ))}
         </div>
      )}

      <p className="type-body-sm text-content-secondary mt-1">
        Eén ding ontbreekt nog: hoe voelde het?
      </p>

      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setFeel(n)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-control border py-2.5 font-mono text-sm transition-colors",
              feel === n ? "border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan" : "border-border bg-surface text-white/50 hover:bg-white/5"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1 type-label text-white/30 uppercase tracking-widest text-[9px]">
        <span>zwaar</span>
        <span>top</span>
      </div>

      {open && (
         <textarea
           className="mt-1 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 type-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
           placeholder="Notitie (optioneel)"
           rows={2}
           value={notes}
           onChange={e => setNotes(e.target.value)}
         />
      )}

      <div className="flex items-center gap-3 mt-1">
        <DsButton variant="primair" onClick={save} disabled={feel == null || update.isPending} className="flex-1">
          {update.isPending ? "Opslaan…" : "Bevestigen"}
        </DsButton>
        {!open && (
           <DsButton variant="tekst" onClick={() => setOpen(true)} className="type-label uppercase tracking-widest px-0">
             Notitie
           </DsButton>
        )}
      </div>
    </DsCard>
  )
}

function BevestigenSection() {
  const { data: sessions, isLoading } = useSessions(14);
  if (isLoading) return null;
  const pending = sessions?.filter(s => awaitsFeel(s) && withinFeelWindow(s)) ?? [];
  if (pending.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="type-title-card text-white/90 mb-3">Trainingen bevestigen</h2>
      <div className="flex flex-col gap-3">
        {pending.map(s => <DsConfirmActivityCard key={s.id} session={s} />)}
      </div>
    </section>
  )
}

function RecenteSessiesSection() {
  const { data: sessions, isLoading } = useSessions(10);
  const [openSession, setOpenSession] = useState<TrainingSession | null>(null);

  if (isLoading) return null;
  const recent = sessions?.slice(0, 5) ?? [];
  if (recent.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="type-title-card text-white/90">Recente sessies</h2>
        <Link href="/activiteiten" className="type-label text-accent-cyan uppercase tracking-wider hover:underline">
          Alles bekijken
        </Link>
      </div>
      <div className="flex flex-col gap-2">
         {recent.map(s => (
            <div 
              key={s.id} 
              role="button"
              tabIndex={0}
              className="rounded-card border border-border bg-surface p-card-compact cursor-pointer hover:bg-surface-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60" 
              onClick={() => setOpenSession(s)}
              onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') setOpenSession(s); }}
            >
               <p className="type-action">{s.title || s.type}</p>
               <p className="type-body-sm text-content-secondary mt-0.5">
                  {new Date(s.sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", { weekday: "short", month: "short", day: "numeric" })}
                  {s.durationMin != null && ` · ${s.durationMin}m`}
                  {s.tss != null && ` · ${s.tss} TSS`}
               </p>
            </div>
         ))}
      </div>
      <SessionDetailDrawer 
         session={openSession} 
         recentSessions={sessions ?? []} 
         open={openSession != null} 
         onOpenChange={(o) => { if (!o) setOpenSession(null) }} 
      />
    </section>
  )
}

function GegevensToevoegenSection() {
  return (
    <section className="mb-8 flex flex-col gap-8">
      <ActivityImportPanel />
      <DocumentAnalysisPanel />
    </section>
  )
}

// --- Hoofdpagina -------------------------------------------------------------

export default function CorePlanPage() {
  const { focus } = useFixParams();
  const [, navigate] = useLocation();
  const [highlightWeek, setHighlightWeek] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDateContext, setAddDateContext] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (focus === "plan") {
      setTimeout(() => {
        document.getElementById("week-nav")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setHighlightWeek(true);
        setTimeout(() => setHighlightWeek(false), 1600);
        navigate("/train", { replace: true });
      }, 200);
    } else if (focus === "logsession") {
      setAddDateContext(undefined);
      setAddOpen(true);
      navigate("/train", { replace: true });
    }
  }, [focus, navigate]);

  return (
    <CommercialShell actief="/train">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">
        <PlanHeader />
        
        <KalenderSection
          highlightWeek={highlightWeek}
          onOpenAdd={(iso) => { setAddDateContext(iso); setAddOpen(true); }}
        />
        
        <PlanActieSection />
        
        <DoelMeetlatSection />
        
        <PatronenSection />
        
        <OntwikkelingSection />
        
        <BevestigenSection />
        
        <RecenteSessiesSection />
        
        <GegevensToevoegenSection />
      </div>

      {addOpen && (
        <AddTrainingModal 
          onClose={() => setAddOpen(false)} 
          contextDate={addDateContext} 
        />
      )}
    </CommercialShell>
  );
}
