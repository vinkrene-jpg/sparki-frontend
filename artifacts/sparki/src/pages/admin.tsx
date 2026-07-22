import { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { ACCENT } from "@/components/sparki/ui";
import {
  useAdminWhoami,
  useAdminStatus,
} from "@/hooks/use-bug-reports";
import {
  useAdminHealth,
  useRunHealthChecks,
  useAdminHealthBatches,
  useAdminScheduledTasks,
  useAdminFeedback,
  useAdminFailedImports,
  useAdminSyncDiagnostics,
  useAdminAiInsights,
  useAdminQuality,
  type HealthCheck,
  type HealthBatch,
  type ScheduledTask,
} from "@/hooks/use-admin-health";
import { useAdminBugReports } from "@/hooks/use-bug-reports";
import { FeedbackInbox } from "@/components/sparki/feedback-inbox";
import { ReleaseAdminSection } from "@/components/sparki/release-admin";
import { KennisbankAdminSection } from "@/components/sparki/knowledge-admin";
import { SupportAdminSection } from "@/components/sparki/support-admin";
import {
  STATUS_META,
  CATEGORY_LABEL,
  formatWhen,
} from "@/lib/health-status";

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

function OverallBanner({
  overall,
  lastRunAt,
}: {
  overall: HealthCheck["statusColor"];
  lastRunAt: string | null;
}) {
  const meta = STATUS_META[overall];
  const headline =
    overall === "green"
      ? "Alles werkt"
      : overall === "orange"
        ? "Aandacht nodig"
        : overall === "red"
          ? "Er is een storing"
          : "Nog niet gecontroleerd";
  return (
    <div
      className="rounded-2xl border p-5 backdrop-blur-md"
      style={{ borderColor: meta.color, background: meta.bg }}
    >
      <div className="flex items-center gap-2.5">
        <StatusDot color={meta.dot} />
        <span
          className="font-sans text-xl font-light"
          style={{ color: meta.color }}
        >
          {headline}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        Laatste controle: {formatWhen(lastRunAt)}
      </p>
    </div>
  );
}

function CheckRow({ c }: { c: HealthCheck }) {
  const meta = STATUS_META[c.statusColor];
  return (
    <Link
      href={`/admin/health/${encodeURIComponent(c.checkKey)}`}
      className="block rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md transition hover:border-white/20"
    >
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot color={meta.dot} />
              <span className="truncate text-[13px] font-medium text-white/90">
                {c.title}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/45">
              {c.errorMessage ?? c.description}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
          <span>{c.responsibleModule}</span>
          {c.responseTimeMs != null && <span>· {c.responseTimeMs}ms</span>}
          <span>· {formatWhen(c.lastRunAt)}</span>
        </div>
      </>
    </Link>
  );
}

const AGG_LABELS: { key: keyof import("@/hooks/use-admin-health").HealthAggregates; label: string }[] = [
  { key: "active_users", label: "Gebruikers" },
  { key: "new_registrations", label: "Nieuw (7 dagen)" },
  { key: "open_bug_reports", label: "Open bugmeldingen" },
  { key: "feedback_messages", label: "Feedback-berichten" },
  { key: "failed_imports", label: "Mislukte imports" },
  { key: "expired_tokens", label: "Verlopen uitnodigingen" },
];

function BatchRow({ b }: { b: HealthBatch }) {
  const meta = STATUS_META[b.overallStatus];
  const MODE_LABEL: Record<string, string> = {
    manual: "Handmatig",
    single: "Losse test",
    daily: "Dagelijks",
    weekly: "Wekelijks",
    release: "Release-controle",
  };
  const automatic = b.triggeredBy === "scheduler";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#070d16]/[0.6] p-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusDot color={meta.dot} />
          <span className="text-[12px] text-white/80">
            {MODE_LABEL[b.runMode] ?? b.runMode}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
              automatic
                ? "bg-[oklch(0.82_0.16_200_/_0.14)] text-[oklch(0.82_0.16_200)]"
                : "bg-white/[0.06] text-white/40"
            }`}
          >
            {automatic ? "Automatisch" : "Handmatig"}
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
          {formatWhen(b.startedAt)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-white/40">
        <span style={{ color: STATUS_META.green.color }}>
          {b.greenCount} werkt
        </span>
        <span style={{ color: STATUS_META.orange.color }}>
          {b.orangeCount} let op
        </span>
        <span style={{ color: STATUS_META.red.color }}>
          {b.redCount} storing
        </span>
        <span style={{ color: STATUS_META.grey.color }}>
          {b.greyCount} grijs
        </span>
        <span className="text-white/25">· {b.totalChecks} totaal</span>
      </div>
    </div>
  );
}

function ScheduledTaskRow({ t }: { t: ScheduledTask }) {
  const meta = STATUS_META[t.statusColor];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot color={meta.dot} />
            <span className="truncate text-[13px] font-medium text-white/90">
              {t.title}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-white/55">
            {t.message}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
          style={{ color: meta.color, background: meta.bg }}
        >
          {t.statusColor === "green"
            ? "Draait"
            : t.statusColor === "orange"
              ? "Let op"
              : "Nog opzetten"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
        <span>
          {t.traceLabel}: {formatWhen(t.lastRunAt)}
        </span>
        <span className="text-white/20">· {t.schedule}</span>
      </div>
      <code className="mt-2 block truncate rounded-md bg-black/30 px-2 py-1 font-mono text-[10px] text-white/40">
        {t.runCommand}
      </code>
    </div>
  );
}

const FEEDBACK_LABEL: Record<string, string> = {
  done: "Gedaan",
  missed: "Gemist",
  too_hard: "Te zwaar",
  too_light: "Te licht",
  pain: "Pijn",
  tired: "Moe",
  move: "Verplaatst",
};

export default function AdminPage() {
  const { isSignedIn } = useUser();
  const { data: who, isLoading: whoLoading } = useAdminWhoami();
  const isAdmin = who?.isAdmin === true;

  const enabled = isAdmin || DEV_PREVIEW;
  const { data: health, isLoading } = useAdminHealth(enabled);
  const { data: statusData } = useAdminStatus(enabled);
  const { data: batchData } = useAdminHealthBatches(enabled);
  const { data: scheduledData } = useAdminScheduledTasks(enabled);
  const { data: bugData } = useAdminBugReports(enabled);
  const { data: feedbackData } = useAdminFeedback(enabled);
  const { data: importsData } = useAdminFailedImports(enabled);
  const { data: syncDiag } = useAdminSyncDiagnostics(enabled);
  const { data: aiInsights } = useAdminAiInsights(enabled);
  const runChecks = useRunHealthChecks();
  const { data: quality } = useAdminQuality(enabled);

  const grouped = useMemo(() => {
    const map = new Map<string, HealthCheck[]>();
    for (const c of health?.checks ?? []) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return [...map.entries()];
  }, [health?.checks]);

  if (!whoLoading && !isAdmin && !DEV_PREVIEW) {
    return <Redirect to="/" />;
  }
  if (isSignedIn === false && !DEV_PREVIEW) {
    return <Redirect to="/sign-in" />;
  }

  const agg = health?.aggregates ?? {};
  const status = statusData?.status ?? {};

  return (
    <main className="relative min-h-dvh px-5 pb-28 pt-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70"
          >
            ← Terug
          </Link>
          <button
            type="button"
            onClick={() => runChecks.mutate()}
            disabled={runChecks.isPending}
            className="rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {runChecks.isPending ? "Bezig met controleren…" : "Controleer nu"}
          </button>
        </div>

        <h1 className="mt-4 font-sans text-2xl font-extralight text-white/90">
          Beheer & gezondheid
        </h1>
        <p className="mt-1 text-[13px] text-white/40">
          Elke status komt uit een echte test. Grijs betekent: nog niet
          gekoppeld.
        </p>

        {isLoading || !health ? (
          <p className="mt-8 text-[13px] text-white/30">Laden…</p>
        ) : (
          <>
            <div className="mt-5">
              <OverallBanner
                overall={health.overall}
                lastRunAt={health.lastRunAt}
              />
            </div>

            {scheduledData && scheduledData.tasks.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Geplande taken
                  </p>
                  {scheduledData.missing > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                      style={{
                        color: STATUS_META.orange.color,
                        background: STATUS_META.orange.bg,
                      }}
                    >
                      {scheduledData.missing} nog opzetten
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-white/40">
                  Deze taken horen als Scheduled Deployment te draaien. De status
                  komt uit de echte data-sporen die elke taak achterlaat — geen
                  zichtbare run betekent dat de geplande taak mogelijk nog niet is
                  aangemaakt.
                </p>
                <div className="mt-3 space-y-2.5">
                  {scheduledData.tasks.map((t) => (
                    <ScheduledTaskRow key={t.key} t={t} />
                  ))}
                </div>
              </section>
            )}

            {syncDiag && syncDiag.providers.length > 0 && (
              <section className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Automatische datasync
                </p>
                <p className="mt-1 text-[12px] leading-snug text-white/40">
                  Echte synchronisaties en webhook-meldingen per platform —
                  alleen wat aantoonbaar gebeurd is.
                </p>
                <div className="mt-3 space-y-2">
                  {syncDiag.providers.map((p) => (
                    <div
                      key={p.provider}
                      className="rounded-lg border border-white/[0.06] bg-[#070d16]/[0.6] px-3 py-2.5 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-sans text-[13px] capitalize text-white/80">
                          {p.provider}
                        </p>
                        <p className="font-mono text-[10px] tabular-nums text-white/45">
                          {p.totalRuns} runs
                          {p.failedRuns > 0 && (
                            <span className="text-red-400">
                              {" "}
                              · {p.failedRuns} mislukt
                            </span>
                          )}
                          {p.partialRuns > 0 && (
                            <span className="text-amber-400/80">
                              {" "}
                              · {p.partialRuns} deels
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-white/35">
                        Laatste run: {formatWhen(p.lastRunAt)}
                        {p.lastSuccessAt
                          ? ` · laatst gelukt: ${formatWhen(p.lastSuccessAt)}`
                          : " · nog nooit gelukt"}
                      </p>
                    </div>
                  ))}
                  {syncDiag.webhooks.length > 0 && (
                    <p className="px-1 font-mono text-[10px] text-white/40">
                      Webhooks:{" "}
                      {syncDiag.webhooks
                        .map((w) => `${w.provider} ${w.status}: ${w.count}`)
                        .join(" · ")}
                    </p>
                  )}
                  {syncDiag.failedWebhooks.length > 0 && (
                    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-red-400/80">
                        Mislukte webhook-meldingen (
                        {syncDiag.failedWebhooks.length})
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {syncDiag.failedWebhooks.slice(0, 5).map((w) => (
                          <p
                            key={w.id}
                            className="font-mono text-[10px] leading-snug text-white/45"
                          >
                            {w.provider} · {formatWhen(w.receivedAt)} ·{" "}
                            {w.attempts}x geprobeerd
                            {w.lastError ? ` — ${w.lastError}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {aiInsights && (
              <section className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Sparki-denkkracht (gateway)
                </p>
                <p className="mt-1 text-[12px] leading-snug text-white/40">
                  Iedere modelaanroep loopt via één centrale poort met kill
                  switch, toestemming per doel, redactie en logging — alleen
                  metadata, nooit inhoud.
                </p>
                <p className="mt-2 font-mono text-[10px] text-white/45">
                  Laatste 24 uur: {aiInsights.last24h.calls} aanroepen
                  {aiInsights.last24h.costMicroUsd
                    ? ` · ±$${(Number(aiInsights.last24h.costMicroUsd) / 1_000_000).toFixed(2)} kostenindicatie`
                    : ""}
                </p>
                <div className="mt-3 space-y-2">
                  {aiInsights.usage.length === 0 && (
                    <p className="font-mono text-[10px] text-white/35">
                      Nog geen aanroepen geregistreerd.
                    </p>
                  )}
                  {aiInsights.usage.map((u) => {
                    const cfg = aiInsights.purposes.find(
                      (c) => c.purpose === u.purpose,
                    );
                    return (
                      <div
                        key={u.purpose}
                        className="rounded-lg border border-white/[0.06] bg-[#070d16]/[0.6] px-3 py-2.5 backdrop-blur-md"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-sans text-[13px] text-white/80">
                            {cfg?.label ?? u.purpose}
                          </p>
                          <p className="font-mono text-[10px] tabular-nums text-white/45">
                            {u.totalCalls} aanroepen
                            {u.failedCalls > 0 && (
                              <span className="text-red-400">
                                {" "}
                                · {u.failedCalls} mislukt
                              </span>
                            )}
                            {u.blockedCalls > 0 && (
                              <span className="text-amber-400/80">
                                {" "}
                                · {u.blockedCalls} geblokkeerd
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-white/35">
                          {cfg
                            ? `${cfg.model} · ${cfg.promptVersion} · toestemming: ${cfg.consent}${cfg.sensitive ? " · gevoelig" : ""}`
                            : "doel niet (meer) in register"}
                          {u.avgLatencyMs != null && ` · ±${u.avgLatencyMs} ms`}
                          {" · laatste: "}
                          {formatWhen(u.lastCallAt)}
                        </p>
                      </div>
                    );
                  })}
                  {aiInsights.recentProblems.length > 0 && (
                    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-red-400/80">
                        Recente niet-geslaagde aanroepen (
                        {aiInsights.recentProblems.length})
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {aiInsights.recentProblems.slice(0, 5).map((r) => (
                          <p
                            key={r.id}
                            className="font-mono text-[10px] leading-snug text-white/45"
                          >
                            {r.purpose} · {r.status}
                            {r.errorCode ? ` (${r.errorCode})` : ""} ·{" "}
                            {formatWhen(r.createdAt)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {health.openErrors.length > 0 && (
              <section className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Aandachtspunten ({health.openErrors.length})
                </p>
                <div className="mt-3 space-y-2.5">
                  {health.openErrors.map((c) => (
                    <CheckRow key={c.checkKey} c={c} />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                In één oogopslag
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AGG_LABELS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="rounded-lg border border-white/[0.06] bg-[#070d16]/[0.6] px-3 py-2.5 backdrop-blur-md"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                      {label}
                    </p>
                    <p
                      className="mt-0.5 font-sans text-2xl font-extralight tabular-nums"
                      style={{ color: ACCENT }}
                    >
                      {agg[key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {grouped.map(([category, checks]) => (
              <section key={category} className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {CATEGORY_LABEL[category] ?? category}
                </p>
                <div className="mt-3 space-y-2.5">
                  {checks.map((c) => (
                    <CheckRow key={c.checkKey} c={c} />
                  ))}
                </div>
              </section>
            ))}

            <section className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Testgeschiedenis
              </p>
              <div className="mt-3 space-y-2">
                {(batchData?.batches ?? []).length === 0 ? (
                  <p className="text-[12px] text-white/30">
                    Nog geen controles uitgevoerd.
                  </p>
                ) : (
                  (batchData?.batches ?? [])
                    .slice(0, 8)
                    .map((b) => <BatchRow key={b.id} b={b} />)
                )}
              </div>
            </section>

            <section className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Release-controles
              </p>
              <div className="mt-3 space-y-2">
                {(batchData?.releaseChecks ?? []).length === 0 ? (
                  <p className="text-[12px] text-white/30">
                    Nog geen release-controles uitgevoerd. Deze draaien vóór een
                    nieuwe versie live gaat.
                  </p>
                ) : (
                  (batchData?.releaseChecks ?? [])
                    .slice(0, 6)
                    .map((b) => <BatchRow key={b.id} b={b} />)
                )}
              </div>
            </section>

            <FeedbackInbox reports={bugData?.reports ?? []} />

            <section className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Feedback van sporters ({feedbackData?.feedback?.length ?? 0})
              </p>
              <div className="mt-3 space-y-2">
                {(feedbackData?.feedback ?? []).length === 0 ? (
                  <p className="text-[12px] text-white/30">
                    Nog geen feedback ontvangen.
                  </p>
                ) : (
                  (feedbackData?.feedback ?? []).slice(0, 10).map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-white/[0.07] bg-[#070d16]/[0.6] p-3 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                          style={{ color: ACCENT, background: "rgba(45,212,255,0.08)" }}
                        >
                          {FEEDBACK_LABEL[f.feedback_type] ?? f.feedback_type}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                          {f.reporterName ?? "Onbekend"} · {formatWhen(f.createdAt)}
                        </span>
                      </div>
                      {f.note && (
                        <p className="mt-1.5 text-[13px] leading-snug text-white/75">
                          {f.note}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Mislukte imports ({importsData?.imports?.length ?? 0})
              </p>
              <div className="mt-3 space-y-2">
                {(importsData?.imports ?? []).length === 0 ? (
                  <p className="text-[12px] text-white/30">
                    Geen mislukte imports. Alle uploads zijn goed verwerkt.
                  </p>
                ) : (
                  (importsData?.imports ?? []).slice(0, 10).map((im) => (
                    <div
                      key={im.id}
                      className="rounded-xl border p-3 backdrop-blur-md"
                      style={{
                        borderColor: STATUS_META.red.color,
                        background: STATUS_META.red.bg,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[13px] text-white/85">
                          {im.fileName}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-white/40">
                          {im.fileType}
                        </span>
                      </div>
                      {im.errorMessage && (
                        <p className="mt-1 text-[12px] leading-snug text-white/55">
                          {im.errorMessage}
                        </p>
                      )}
                      <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                        {im.reporterName ?? "Onbekend"} ·{" "}
                        {formatWhen(im.uploadedAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Kwaliteit van analyses
              </p>
              <p className="mt-1 text-[12px] leading-snug text-white/40">
                Oordelen van sporters en coaches over analyses en adviezen.
                Feedback wordt alleen geregistreerd — regels veranderen nooit
                automatisch.
              </p>
              {!quality ||
              Object.keys(quality.totals).length === 0 ? (
                <p className="mt-3 text-[12px] text-white/30">
                  Nog geen feedback ontvangen.
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(quality.totals).map(([verdict, count]) => (
                      <div
                        key={verdict}
                        className="rounded-lg border border-white/[0.05] bg-[#070d16]/[0.5] px-3 py-2 backdrop-blur-md"
                      >
                        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                          {verdict.replace(/_/g, " ")}
                        </p>
                        <p className="mt-0.5 font-sans text-lg font-extralight tabular-nums text-white/70">
                          {count}
                        </p>
                      </div>
                    ))}
                  </div>
                  {quality.byEngine.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {quality.byEngine.slice(0, 8).map((e) => (
                        <div
                          key={`${e.engine}-${e.engine_version}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-[#070d16]/[0.5] px-3 py-2 backdrop-blur-md"
                        >
                          <span className="truncate font-mono text-[10px] text-white/60">
                            {e.engine} · versie {e.engine_version}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/45">
                            {e.total} oordelen ·{" "}
                            <span
                              style={{
                                color:
                                  e.onjuist > 0
                                    ? STATUS_META.orange.color
                                    : undefined,
                              }}
                            >
                              {e.onjuist} onjuist
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {quality.recentIncorrect.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
                        Recent als onjuist gemeld
                      </p>
                      {quality.recentIncorrect.slice(0, 6).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border p-3 backdrop-blur-md"
                          style={{
                            borderColor: STATUS_META.orange.color,
                            background: STATUS_META.orange.bg,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-[10px] text-white/70">
                              {r.subjectType} · {r.subjectKey}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-white/40">
                              {r.actorRole} · {formatWhen(r.updatedAt)}
                            </span>
                          </div>
                          {(r.reasonText || r.reasonCode) && (
                            <p className="mt-1 text-[12px] leading-snug text-white/55">
                              {r.reasonText ??
                                (r.reasonCode
                                  ? r.reasonCode.replace(/_/g, " ")
                                  : "")}
                            </p>
                          )}
                          {r.context && (
                            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                              {String(r.context.engine ?? "onbekend")}
                              {r.context.ruleKey
                                ? ` · regel ${String(r.context.ruleKey)}`
                                : ""}
                              {r.context.engineVersion
                                ? ` · versie ${String(r.context.engineVersion)}`
                                : ""}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <SupportAdminSection />

            <ReleaseAdminSection />

            <KennisbankAdminSection />

            <section className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Cijfers
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(status).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-white/[0.05] bg-[#070d16]/[0.5] px-3 py-2 backdrop-blur-md"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                      {key}
                    </p>
                    <p className="mt-0.5 font-sans text-lg font-extralight tabular-nums text-white/70">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
