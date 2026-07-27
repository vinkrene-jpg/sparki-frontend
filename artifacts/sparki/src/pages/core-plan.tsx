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
import { bronZin, kiesPlanActie, afleidDagStatus, buildWeekGridLocal, derivedFacts, awaitsFeel, withinFeelWindow, sourceLabel } from "@/lib/core-plan";
import { judgeGoalFit } from "@/lib/train-intelligence";

// Hooks
import { useTrainingPlan, usePlanWindow, useGenerateTrainingPlan, useAdaptTrainingPlan } from "@/hooks/use-training-plan";
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
import type { TrainingSession } from "@/lib/athlete-types";

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

function WeekEnDagSection({ highlightWeek, onOpenAdd }: { highlightWeek: boolean, onOpenAdd: (iso: string) => void }) {
  const { data: planWindow, isError, isLoading, refetch } = usePlanWindow(3);
  const updateWorkout = useUpdateWorkout();
  const todayISO = localISODate(new Date());
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [detailId, setDetailId] = useState<number | null>(null);

  if (isError) {
    return (
      <section className="mb-8">
        <DsState 
          soort="nietBeschikbaar" 
          titel="Schema kon niet geladen worden." 
          actie={{ label: "Opnieuw proberen", onClick: () => refetch() }} 
        />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="mb-8 space-y-4">
        <div className="h-20 animate-pulse rounded-card bg-surface border border-border" />
        <div className="h-32 animate-pulse rounded-card bg-surface border border-border" />
      </section>
    );
  }

  const gridDates = buildWeekGridLocal(new Date(), weekOffset);
  const gridDatesISO = gridDates.map(d => localISODate(d));
  const trustedWorkouts = planWindow ?? [];

  const weekDagen: DsWeekDag[] = gridDates.map((date, idx) => {
    const iso = gridDatesISO[idx]!;
    const w = trustedWorkouts.find(x => x.scheduledDate === iso);
    const status = afleidDagStatus(w?.type);
    const label = date.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2);
    
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      status,
      actief: iso === selectedDate,
      vandaag: iso === todayISO,
      waarde: w?.targetTSS ? String(w.targetTSS) : "—"
    };
  });

  const selectedWorkout = trustedWorkouts.find(w => w.scheduledDate === selectedDate);
  const isSelectedToday = selectedDate === todayISO;
  const isRest = selectedWorkout?.type === "rest";

  return (
    <section className="mb-8 flex flex-col gap-6">
      <div id="week-nav" className={cn("transition-shadow duration-500 rounded-xl", highlightWeek && "shadow-[0_0_0_2px_var(--color-accent-cyan)]")}>
        <div className="flex items-center justify-between mb-4">
          <DsCardTitel>Week {weekOffset === 0 ? "van nu" : weekOffset === 1 ? "hierna" : "daarna"}</DsCardTitel>
          <div className="flex gap-2">
             <DsButton variant="secundair" onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset <= 0} className="px-3 min-w-11" aria-label="Vorige week">
               <IconChevron className="rotate-180" />
             </DsButton>
             <DsButton variant="secundair" onClick={() => setWeekOffset(prev => Math.min(2, prev + 1))} disabled={weekOffset >= 2} className="px-3 min-w-11" aria-label="Volgende week">
               <IconChevron />
             </DsButton>
          </div>
        </div>
        <DsWeek 
          dagen={weekDagen} 
          onSelecteer={(idx) => setSelectedDate(gridDatesISO[idx]!)} 
          selectieLabel="Kies een dag in de planweek"
        />
      </div>

      <div>
        {!selectedWorkout ? (
          <DsState 
            soort="leeg" 
            titel="Geen training gepland" 
            beschrijving="Er staat niets gepland voor deze dag."
            actie={{ label: "Training toevoegen", onClick: () => onOpenAdd(selectedDate) }} 
          />
        ) : isRest ? (
          <DsCard variant="standaard" className="flex flex-col gap-3">
            <DsCardTitel>Rustdag</DsCardTitel>
            <p className="type-body text-content-secondary">Neem de tijd om te herstellen. Er is geen training gepland.</p>
          </DsCard>
        ) : (
          <DsCard variant="standaard" className="flex flex-col gap-4">
            <div className="flex justify-between items-start gap-4">
              <DsCardTitel>{selectedWorkout.title || "Training"}</DsCardTitel>
              {selectedWorkout.status === "completed" && <DsStatus status="positief">Afgerond</DsStatus>}
              {selectedWorkout.status === "skipped" && <DsStatus status="neutraal">Overgeslagen</DsStatus>}
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-2">
               {selectedWorkout.targetDurationMin != null && <span className="num type-action text-accent-cyan">{selectedWorkout.targetDurationMin} min</span>}
               {selectedWorkout.targetTSS != null && <span className="num type-action text-accent-cyan">{selectedWorkout.targetTSS} TSS</span>}
            </div>
            
            {selectedWorkout.description && (
              <p className="type-body text-content-secondary">{selectedWorkout.description}</p>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <DsButton variant="primair" onClick={() => setDetailId(selectedWorkout.id)}>
                Training bekijken
              </DsButton>
              
              {isSelectedToday && (selectedWorkout.status === "planned" || selectedWorkout.status === "modified") && (
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
          </DsCard>
        )}
      </div>

      <WorkoutDetailDrawer 
        workoutId={detailId} 
        open={detailId !== null} 
        onOpenChange={(o) => { if (!o) setDetailId(null); }} 
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
           <DsCardTitel className="mb-2">Laat Sparki een schema bouwen</DsCardTitel>
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
                Je trainingen zijn er, maar er zijn nog geen patronen vastgelegd. Laat Sparki je gegevens doorzoeken op verbanden.
              </p>
              <DsButton variant="primair" onClick={() => runConnections.mutate()} loading={runConnections.isPending}>
                Laat Sparki verbanden zoeken
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
        
        <WeekEnDagSection 
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
