import * as React from "react";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { CommercialShell } from "@/components/sparki/commercial-shell";
import { HumorLine } from "@/components/sparki/humor-line";
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer";
import { TrainingProgression } from "@/components/sparki/training-progression";
import { useSessions } from "@/hooks/use-sessions";
import { useLoad } from "@/hooks/use-load";
import { localISODate } from "@/lib/commercial-shell";
import { cn } from "@/lib/utils";
import type { TrainingSession } from "@/lib/athlete-types";
import {
  typeLabel,
  sourceLabel,
  monthKey,
  monthLabel,
  relativeDate,
  calculateSummary,
  filterSessions,
  groupSessionsByMonth,
  sessionMetricsText,
} from "@/lib/core-activiteiten";
import { DsCard, DsCardTitel, DsState, IconChevron } from "@/components/ds";

export default function CoreActiviteitenPage() {
  const [, navigate] = useLocation();
  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsIsError,
    refetch: refetchSessions,
  } = useSessions(500);
  const { data: load, isLoading: loadLoading, isError: loadIsError } = useLoad();

  const [selected, setSelected] = useState<TrainingSession | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);

  const openSession = (s: TrainingSession) => {
    setSelected(s);
    setOpen(true);
  };

  const sessionsTrusted = sessionsIsError ? undefined : sessions;
  const loadTrusted = loadIsError ? undefined : load;

  const typeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sessionsTrusted ?? []) {
      const key = s.type.toLowerCase();
      if (!seen.has(key)) seen.set(key, typeLabel(s.type));
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [sessionsTrusted]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const s of sessionsTrusted ?? []) keys.add(monthKey(s.sessionDate));
    return [...keys].sort().reverse();
  }, [sessionsTrusted]);

  const filtered = useMemo(() => {
    if (!sessionsTrusted) return [];
    return filterSessions(sessionsTrusted, q, typeFilter, monthFilter);
  }, [sessionsTrusted, q, typeFilter, monthFilter]);

  const grouped = useMemo(() => groupSessionsByMonth(filtered), [filtered]);
  const summary = useMemo(() => calculateSummary(filtered), [filtered]);

  const hasFilters = q.trim() !== "" || typeFilter != null || monthFilter != null;

  if (sessionsLoading) {
    return (
      <CommercialShell actief="/activiteiten">
        <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-8 lg:max-w-3xl lg:px-10 lg:pb-16">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="type-display">Activiteiten</h1>
              <p className="type-body mt-1 text-content-secondary">
                Al je ritten — wat je deed, hoe het ging.
              </p>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            <div className="h-28 rounded-card bg-surface motion-safe:animate-pulse" />
            <div className="h-28 rounded-card bg-surface motion-safe:animate-pulse" />
            <div className="h-28 rounded-card bg-surface motion-safe:animate-pulse" />
          </div>
        </div>
      </CommercialShell>
    );
  }

  if (sessionsIsError || !sessionsTrusted) {
    return (
      <CommercialShell actief="/activiteiten">
        <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-8 lg:max-w-3xl lg:px-10 lg:pb-16">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="type-display">Activiteiten</h1>
              <p className="type-body mt-1 text-content-secondary">
                Al je ritten — wat je deed, hoe het ging.
              </p>
            </div>
          </div>
          <DsState
            className="mt-8"
            soort="nietBeschikbaar"
            titel="Je ritten konden niet geladen worden."
            beschrijving="Controleer je verbinding en probeer het opnieuw."
            actie={{ label: "Opnieuw proberen", onClick: () => void refetchSessions() }}
          />
        </div>
      </CommercialShell>
    );
  }

  if (sessionsTrusted.length === 0) {
    return (
      <CommercialShell actief="/activiteiten">
        <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-8 lg:max-w-3xl lg:px-10 lg:pb-16">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="type-display">Activiteiten</h1>
              <p className="type-body mt-1 text-content-secondary">
                Al je ritten — wat je deed, hoe het ging.
              </p>
            </div>
          </div>
          <DsState
            className="mt-8"
            soort="leeg"
            titel="Nog geen ritten"
            beschrijving="Koppel je fietscomputer of Strava, dan verschijnen je ritten hier vanzelf — met al je meetgegevens."
            actie={{
              label: "Koppeling instellen",
              onClick: () => navigate("/you?focus=connections"),
            }}
          />
          <HumorLine context="empty_training" className="mx-auto mt-4 max-w-xs text-center" />
        </div>
      </CommercialShell>
    );
  }

  return (
    <CommercialShell actief="/activiteiten">
      <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-8 lg:max-w-3xl lg:px-10 lg:pb-16">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="type-display">Activiteiten</h1>
            <p className="type-body mt-1 text-content-secondary">
              Al je ritten — wat je deed, hoe het ging.
            </p>
          </div>
          <Link
            href="/journey"
            className="type-action-inline shrink-0 text-accent-cyan transition-colors hover:underline"
          >
            Jouw verhaal
          </Link>
        </div>

        <DsCard className="mt-8">
          <DsCardTitel>Geselecteerde periode</DsCardTitel>
          {summary.count === 0 ? (
            <p className="type-body mt-2 text-content-secondary">Geen ritten in deze selectie.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <span className="label-sm text-content-secondary">RITTEN</span>
                <p className="type-title-insight num mt-0.5">{summary.count}</p>
              </div>
              {summary.durationMin > 0 && (
                <div>
                  <span className="label-sm text-content-secondary">TIJD</span>
                  <p className="type-title-insight num mt-0.5">
                    {Math.floor(summary.durationMin / 60)}u {summary.durationMin % 60}m
                  </p>
                </div>
              )}
              {summary.distanceKm > 0 && (
                <div>
                  <span className="label-sm text-content-secondary">AFSTAND</span>
                  <p className="type-title-insight num mt-0.5">
                    {Math.round(summary.distanceKm)} <span className="font-sans text-base font-normal">km</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </DsCard>

        <section className="mt-10" aria-label="Je ontwikkeling">
          <h2 className="type-title-card text-white/90">Je ontwikkeling</h2>
          <p className="type-body mt-1 text-content-secondary">
            Van je laatste ritten tot de afgelopen weken — zo bouw je op over tijd, niet alleen vandaag.
          </p>
          <div className="mt-4">
            <TrainingProgression
              hideLabel
              sessions={sessionsTrusted}
              chartData={loadTrusted?.chartData}
              loading={sessionsLoading || loadLoading}
            />
          </div>
        </section>

        <section className="mt-10" aria-label="Filters">
          <h2 className="type-title-card text-white/90">Alle ritten</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op titel, type of bron…"
                className="type-body flex min-h-11 w-full rounded-lg border border-border bg-surface px-4 text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
              />
            </div>
            <select
              value={monthFilter ?? ""}
              onChange={(e) => setMonthFilter(e.target.value || null)}
              className="type-body flex min-h-11 w-full appearance-none rounded-lg border border-border bg-surface px-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 sm:w-auto"
              aria-label="Filter op maand"
            >
              <option value="">Alle maanden</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          {typeOptions.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={cn(
                  "type-action min-h-11 rounded-control border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
                  typeFilter === null
                    ? "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
                    : "border-border bg-surface text-content-secondary hover:text-white/90"
                )}
              >
                Alles
              </button>
              {typeOptions.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === t.key ? null : t.key)}
                  className={cn(
                    "type-action min-h-11 rounded-control border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
                    typeFilter === t.key
                      ? "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan"
                      : "border-border bg-surface text-content-secondary hover:text-white/90"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {filtered.length === 0 ? (
          <DsState
            className="mt-8"
            soort="info"
            titel="Geen ritten gevonden."
            beschrijving={hasFilters ? "Probeer je zoekterm of filters aan te passen." : ""}
          />
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {grouped.map(([key, list]) => (
              <section key={key} className="flex flex-col gap-3">
                <h3 className="label-sm text-content-secondary">
                  {monthLabel(key)}
                  <span className="num ml-2 text-white/30">
                    {list.length} {list.length === 1 ? "rit" : "ritten"}
                  </span>
                </h3>
                {list.map((s) => (
                  <ActivityRow key={s.id} session={s} onOpen={() => openSession(s)} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <SessionDetailDrawer
        session={selected}
        open={open}
        onOpenChange={setOpen}
        recentSessions={sessionsTrusted ?? []}
      />
    </CommercialShell>
  );
}

function ActivityRow({
  session,
  onOpen,
}: {
  session: TrainingSession;
  onOpen: () => void;
}) {
  const metrics = sessionMetricsText(session);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-11 w-full flex-col gap-2 rounded-card border border-border bg-surface p-card text-left transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-sm text-content-secondary">
            {relativeDate(session.sessionDate, localISODate())}
          </p>
          <h4 className="type-title-card mt-1 truncate text-white/90">
            {session.title?.trim() || typeLabel(session.type)}
          </h4>
          {session.title?.trim() && (
            <p className="type-body-sm mt-0.5 truncate text-content-secondary">
              {typeLabel(session.type)}
            </p>
          )}
        </div>
        <IconChevron
          className="h-5 w-5 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-accent-cyan"
          aria-hidden="true"
        />
      </div>

      {metrics.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {metrics.map((m, i) => (
            <span
              key={i}
              className="num inline-flex items-center rounded-sm bg-control px-1.5 py-0.5 text-[11px] font-medium text-white/75"
            >
              {m}
            </span>
          ))}
        </div>
      ) : (
        <p className="type-body-sm mt-1 text-content-secondary">
          Nog geen meetgegevens bij deze rit.
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="label-xs rounded-full border border-border bg-surface-strong px-2 py-0.5 text-content-secondary">
          Bron: {sourceLabel(session.source)}
        </span>
        {session.feelScore != null && (
          <span className="label-xs rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-2 py-0.5 text-accent-cyan">
            Gevoel {session.feelScore}/5
          </span>
        )}
      </div>
    </button>
  );
}
