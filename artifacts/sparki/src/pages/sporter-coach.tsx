// Taak #607 — Aparte coach-omgeving voor SPORTERS op /coach (besluit René
// 05-08-2026, hoort bij AI_COACH_KOPPELING_EN_GEHEUGEN_01).
//
// Dit is de rustige, complete blik van de coach — los van het dagelijkse
// /trainen (dat zijn vier-lagen-structuur behoudt):
//  - doellijn: de canonieke seizoensdoel-zin zoals de server die bouwt
//    (lib/season-goal → plan.goal) — hier NIET opnieuw geformuleerd;
//  - het complete plan per week en fase uit de bestaande plan-engine
//    (/api/training-plan days) — geen tweede berekening;
//  - voortgang uit het bestaande belastingsmodel (useLoad → computeLoadSeries
//    server-side) + de deterministische ontwikkelingTrend-zin — geen inline EWMA;
//  - de coach-boodschap uit de deterministische decideCoach-engine en de
//    waarnemingen uit de observation-engine (server-side, al gegated).
//
// De route /coach is rol-bewust: trainers houden hun rooster (CoachHome),
// sporters landen hier. Geen dubbele kaarten met de shell: dit is geen
// home-sectie, dus CoachAnalysisCard/CoachDecisionCard van de shell spelen
// hier niet.

import { useMemo } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  ChevronRight,
  Flag,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { CommercialShell } from "@/components/sparki/commercial-shell";
import { CoachHome } from "@/components/sparki/coach-home";
import { useUserProfile } from "@/contexts/UserContext";
import { useTrainingPlan, type PlanDay } from "@/hooks/use-training-plan";
import { useLoad } from "@/hooks/use-load";
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard";
import { useRaceContext } from "@/hooks/use-races";
import { useObservations } from "@/hooks/use-ai-memory";
import {
  decideCoach,
  coachInputFromProfile,
  type CoachDayData,
  type CoachDecision,
} from "@/lib/coach-engine";
import {
  faseVoorDatum,
  faseLabel,
  ontwikkelingTrend,
  maandagVanISO,
  type Fase,
} from "@/lib/plan-overview";

// ── helpers (puur, presentatie-only) ─────────────────────────────────────────

function datumKort(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function urenZin(minuten: number): string {
  if (minuten <= 0) return "—";
  const u = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (u === 0) return `${m} min`;
  return m === 0 ? `${u} u` : `${u} u ${m.toString().padStart(2, "0")}`;
}

export type WeekGroep = {
  weekIndex: number;
  maandagISO: string;
  fase: Fase | null;
  dagen: PlanDay[];
  sessies: number;
  minuten: number;
};

/** Groepeer de plan-dagen per weekIndex — puur uit bestaande engine-data. */
export function groepeerWeken(days: PlanDay[], raceDateISO: string | null): WeekGroep[] {
  const map = new Map<number, PlanDay[]>();
  for (const d of days) {
    const arr = map.get(d.weekIndex) ?? [];
    arr.push(d);
    map.set(d.weekIndex, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, dagen]) => {
      const gesorteerd = dagen.slice().sort((a, b) => a.dayDate.localeCompare(b.dayDate));
      const maandagISO = maandagVanISO(gesorteerd[0]!.dayDate);
      const trainingsdagen = gesorteerd.filter((d) => !d.isRest);
      return {
        weekIndex,
        maandagISO,
        fase: faseVoorDatum(maandagISO, raceDateISO),
        dagen: gesorteerd,
        sessies: trainingsdagen.length,
        minuten: trainingsdagen.reduce((s, d) => s + (d.estDurationMin ?? 0), 0),
      };
    });
}

// ── kaart-bouwstenen ─────────────────────────────────────────────────────────

function Kaart({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {children}
    </section>
  );
}

function KaartKop({
  icon: Icon,
  titel,
  uitleg,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  titel: string;
  uitleg: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titel}
        </h2>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">{uitleg}</p>
    </div>
  );
}

// ── secties ──────────────────────────────────────────────────────────────────

function DoellijnKaart({ goal, raceNaam, raceDatum }: {
  goal: string | null;
  raceNaam: string | null;
  raceDatum: string | null;
}) {
  return (
    <Kaart>
      <KaartKop
        icon={Flag}
        titel="Doellijn"
        uitleg="Waar dit plan naartoe werkt. De zin komt rechtstreeks uit je seizoensdoel."
      />
      {goal ? (
        <p className="text-[15px] font-medium text-foreground">{goal}</p>
      ) : (
        <p className="text-[14px] text-muted-foreground">
          Er is nog geen seizoensdoel gekoppeld. Zonder doel is er geen doellijn —
          stel er één in via{" "}
          <Link href="/train" className="text-primary underline underline-offset-2">
            Trainen
          </Link>
          .
        </p>
      )}
      {raceNaam && raceDatum && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Eerstvolgende wedstrijd: {raceNaam} op {datumKort(raceDatum)}.
        </p>
      )}
    </Kaart>
  );
}

function CoachBoodschapKaart({ decision }: { decision: CoachDecision | null }) {
  return (
    <Kaart>
      <KaartKop
        icon={MessageCircle}
        titel="Coach-boodschap"
        uitleg="Vandaag gelezen door de coach-engine: zelfde dag, gericht advies."
      />
      {decision ? (
        <div className="space-y-2">
          <p className="text-[15px] font-medium text-foreground">{decision.hoofdonderwerp}</p>
          <p className="text-[14px] text-foreground/90">{decision.advies}</p>
          {decision.vraag && (
            <p className="text-[13px] italic text-muted-foreground">{decision.vraag}</p>
          )}
          <p className="text-[12px] text-muted-foreground">Prioriteit: {decision.prioriteit}</p>
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground">
          Nog geen boodschap: daarvoor is eerst een ingevuld sportprofiel nodig.
        </p>
      )}
    </Kaart>
  );
}

function VoortgangKaart() {
  const { data: load, isLoading } = useLoad();
  const { data: plan } = useTrainingPlan();

  const race = plan?.inputs?.nextRace ?? null;
  const fase = plan?.inputs?.phase ?? null;
  const trend = ontwikkelingTrend({
    chartData: load?.chartData,
    fase,
    doelNaam: race?.name ?? null,
    doelDatum: race?.raceDate ?? null,
  });

  return (
    <Kaart>
      <KaartKop
        icon={TrendingUp}
        titel="Voortgang"
        uitleg="Fitheid (CTL), vermoeidheid (ATL) en vorm (TSB) uit het bestaande belastingsmodel."
      />
      {isLoading ? (
        <p className="text-[14px] text-muted-foreground">Belasting laden…</p>
      ) : load ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Fitheid (CTL)", waarde: load.ctl },
              { label: "Vermoeidheid (ATL)", waarde: load.atl },
              { label: "Vorm (TSB)", waarde: load.tsb },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-muted/50 p-3 text-center">
                <div className="text-[20px] font-semibold tabular-nums text-foreground">
                  {Math.round(m.waarde)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
          {trend ? (
            <p
              className={`mt-3 text-[13px] ${trend.afwijking ? "text-amber-600" : "text-muted-foreground"}`}
            >
              {trend.zin}
            </p>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Nog te weinig dagen met belastingsdata voor een trendoordeel
              (minimaal 14 nodig).
            </p>
          )}
        </>
      ) : (
        <p className="text-[14px] text-muted-foreground">
          Nog geen belastingsdata — die ontstaat zodra er activiteiten met
          vermogen of hartslag binnenkomen.
        </p>
      )}
    </Kaart>
  );
}

function WeekPlanKaart() {
  const { data: plan, isLoading, isError } = useTrainingPlan();
  const raceDateISO = plan?.inputs?.nextRace?.raceDate ?? null;

  const weken = useMemo(
    () => groepeerWeken(plan?.days ?? [], raceDateISO),
    [plan?.days, raceDateISO],
  );

  return (
    <Kaart>
      <KaartKop
        icon={CalendarDays}
        titel="Het complete plan"
        uitleg="Alle geplande weken uit je huidige schema, met fase en weekomvang."
      />
      {isLoading ? (
        <p className="text-[14px] text-muted-foreground">Plan laden…</p>
      ) : isError ? (
        <p className="text-[14px] text-muted-foreground">
          Het plan kon niet worden geladen. Probeer het later opnieuw.
        </p>
      ) : weken.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          Er staat nog geen plan. Bouw er één via{" "}
          <Link href="/train" className="text-primary underline underline-offset-2">
            Trainen
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {plan?.plan && (
            <p className="text-[12px] text-muted-foreground">
              Schema door {plan.plan.maker} · {plan.days.length} geplande dagen
            </p>
          )}
          {weken.map((week) => (
            <div key={week.weekIndex} className="rounded-xl border border-border/70">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/70 px-4 py-2.5">
                <div className="text-[13px] font-semibold text-foreground">
                  Week {week.weekIndex + 1}
                  <span className="ml-2 font-normal text-muted-foreground">
                    vanaf {datumKort(week.maandagISO)}
                  </span>
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {week.fase ? `${faseLabel(week.fase)} · ` : ""}
                  {week.sessies} {week.sessies === 1 ? "sessie" : "sessies"} ·{" "}
                  {urenZin(week.minuten)}
                </div>
              </div>
              <ul className="divide-y divide-border/50">
                {week.dagen.map((dag) => (
                  <li
                    key={dag.id}
                    className="flex items-center justify-between gap-3 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-foreground">
                        {datumKort(dag.dayDate)}
                      </span>
                      <span className="ml-2 text-[13px] text-muted-foreground">
                        {dag.isRest ? "Rust" : dag.focus}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {dag.isRest ? "" : dag.estDurationMin ? `${dag.estDurationMin} min` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Kaart>
  );
}

function WaarnemingenKaart() {
  const { data, isLoading } = useObservations();
  const top = (data?.observations ?? []).slice(0, 3);
  return (
    <Kaart>
      <KaartKop
        icon={ChevronRight}
        titel="Wat de coach opvalt"
        uitleg="Patronen uit je eigen data — alleen wat echt is waargenomen."
      />
      {isLoading ? (
        <p className="text-[14px] text-muted-foreground">Waarnemingen laden…</p>
      ) : top.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          Nog geen waarnemingen — die ontstaan pas als er genoeg trainingsdata is.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((o) => (
            <li key={o.id} className="text-[14px] text-foreground/90">
              {o.observationText}
            </li>
          ))}
        </ul>
      )}
    </Kaart>
  );
}

// ── rol-switch ───────────────────────────────────────────────────────────────

// Taak #607 — /coach is rol-bewust: trainers houden hun bestaande
// werkomgeving (roster, CoachHome); sporters krijgen hier hun eigen
// coach-omgeving met het complete plan per week/fase, doellijn en voortgang.
// (Hier gedefinieerd — naast de sporter-pagina — zodat de node-page-test
// de switch samen met groepeerWeken kan bewaken; App.tsx importeert 'm.)
export function CoachSwitchPage() {
  const { profile } = useUserProfile();
  if (profile?.activeRole === "coach") return <CoachHome />;
  return <SporterCoachPage />;
}

// ── pagina ───────────────────────────────────────────────────────────────────

export default function SporterCoachPage() {
  const { data: plan } = useTrainingPlan();
  const { data: dashboard } = useAthleteDashboard();
  const { context: raceContext } = useRaceContext();

  // Zelfde deterministische afleiding als de Dashboard-dispatcher: engine
  // tussen profiel en advies, dag-data uit echte metingen (nooit verzonnen).
  const decision: CoachDecision | null = useMemo(() => {
    const profiel = dashboard?.athleteProfile ?? null;
    const realDay: CoachDayData = {
      feelScore: dashboard?.todayMetrics?.feelScore ?? null,
      fatigueScore: dashboard?.todayMetrics?.fatigueScore ?? null,
      tsb: dashboard?.load?.tsb ?? null,
    };
    const race = raceContext ? { daysUntil: raceContext.daysUntil } : null;
    const input = coachInputFromProfile(profiel, realDay, race);
    return input ? decideCoach(input) : null;
  }, [dashboard, raceContext]);

  const nextRace = plan?.inputs?.nextRace ?? null;

  return (
    <CommercialShell actief="/coach">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">
        <header className="mb-5">
          <h1 className="text-[22px] font-semibold text-foreground">Coach</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Het complete overzicht: je doellijn, het hele plan per week en fase,
            en je voortgang. Voor de training van vandaag blijft{" "}
            <Link href="/train" className="text-primary underline underline-offset-2">
              Trainen
            </Link>{" "}
            het dagelijkse scherm.
          </p>
        </header>

        <div className="space-y-4">
          <DoellijnKaart
            goal={plan?.plan?.goal ?? null}
            raceNaam={nextRace?.name ?? null}
            raceDatum={nextRace?.raceDate ?? null}
          />
          <CoachBoodschapKaart decision={decision} />
          <WeekPlanKaart />
          <VoortgangKaart />
          <WaarnemingenKaart />
        </div>
      </div>
    </CommercialShell>
  );
}
