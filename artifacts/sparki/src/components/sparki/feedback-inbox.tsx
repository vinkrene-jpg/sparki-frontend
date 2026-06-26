import { useMemo, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { ACCENT } from "@/components/sparki/ui";
import { BugReportThread } from "@/components/sparki/bug-report-thread";
import { formatWhen } from "@/lib/health-status";
import {
  useUpdateBugReportStatus,
  type BugReport,
  type BugReportStatus,
  type BugReportKind,
} from "@/hooks/use-bug-reports";
import {
  STATUS_ORDER,
  STATUS_META,
  KIND_META,
  kindOf,
  statusOf,
} from "@/lib/bug-report-status";

type KindFilter = "all" | BugReportKind;
type StatusFilter = "all" | BugReportStatus;

function FilterPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition"
      style={{
        borderColor: active ? ACCENT : "rgba(255,255,255,0.1)",
        color: active ? ACCENT : "rgba(255,255,255,0.45)",
        background: active ? "rgba(120,210,230,0.08)" : "transparent",
      }}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}

function ReportCard({ r }: { r: BugReport }) {
  const update = useUpdateBugReportStatus();
  const [threadOpen, setThreadOpen] = useState(false);
  const status = statusOf(r);
  const kind = kindOf(r);
  const meta = STATUS_META[status];

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#070d16]/[0.6] p-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: ACCENT, background: "rgba(120,210,230,0.1)" }}
          >
            {KIND_META[kind].label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
          {formatWhen(r.createdAt)}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-white/85">
        {r.description}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
        <span>{r.reporterName ?? "Onbekend"}</span>
        {r.userRole && <span>· {r.userRole}</span>}
        {r.pageUrl && (
          <span className="normal-case tracking-normal text-white/25">
            · {r.pageUrl}
          </span>
        )}
      </div>

      {r.screenshotUrl && (
        <a
          href={r.screenshotUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block"
        >
          <img
            src={r.screenshotUrl}
            alt="Schermafbeelding bij melding"
            className="max-h-32 rounded-lg border border-white/10 object-cover"
          />
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">
          Status:
        </span>
        {STATUS_ORDER.map((s) => {
          const sm = STATUS_META[s];
          const isCurrent = s === status;
          return (
            <button
              key={s}
              type="button"
              disabled={isCurrent || update.isPending}
              onClick={() => update.mutate({ id: r.id, status: s })}
              className="rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition disabled:cursor-default disabled:opacity-100"
              style={{
                borderColor: isCurrent ? sm.color : "rgba(255,255,255,0.1)",
                color: isCurrent ? sm.color : "rgba(255,255,255,0.5)",
                background: isCurrent ? sm.bg : "transparent",
                opacity: update.isPending && !isCurrent ? 0.4 : undefined,
              }}
            >
              {sm.label}
            </button>
          );
        })}
      </div>
      {update.isError && (
        <p className="mt-1.5 text-[11px] text-[rgba(255,140,140,1)]">
          Kon status niet bijwerken. Probeer opnieuw.
        </p>
      )}

      <button
        type="button"
        onClick={() => setThreadOpen((v) => !v)}
        className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40 transition hover:text-cyan-300"
      >
        <MessagesSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
        {threadOpen ? "Gesprek sluiten" : "Reageren / vraag stellen"}
      </button>

      {threadOpen && <BugReportThread reportId={r.id} viewerRole="admin" />}
    </div>
  );
}

export function FeedbackInbox({ reports }: { reports: BugReport[] }) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const r of reports) {
      const k = kindOf(r);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [reports]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const r of reports) {
      const s = statusOf(r);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [reports]);

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (kindFilter === "all" || kindOf(r) === kindFilter) &&
          (statusFilter === "all" || statusOf(r) === statusFilter),
      ),
    [reports, kindFilter, statusFilter],
  );

  return (
    <section className="mt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
        Feedback van testers ({reports.length})
      </p>
      <p className="mt-1 text-[12px] text-white/35">
        Bugs, ideeën en opmerkingen op één plek. Filter en zet elke melding op
        de juiste status.
      </p>

      {reports.length === 0 ? (
        <p className="mt-3 text-[12px] text-white/30">
          Nog geen feedback ontvangen.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={kindFilter === "all"}
              label="Alles"
              count={kindCounts.all ?? 0}
              onClick={() => setKindFilter("all")}
            />
            {(Object.keys(KIND_META) as BugReportKind[]).map((k) => (
              <FilterPill
                key={k}
                active={kindFilter === k}
                label={KIND_META[k].label}
                count={kindCounts[k] ?? 0}
                onClick={() => setKindFilter(k)}
              />
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FilterPill
              active={statusFilter === "all"}
              label="Alle statussen"
              count={statusCounts.all ?? 0}
              onClick={() => setStatusFilter("all")}
            />
            {STATUS_ORDER.map((s) => (
              <FilterPill
                key={s}
                active={statusFilter === s}
                label={STATUS_META[s].label}
                count={statusCounts[s] ?? 0}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-[12px] text-white/30">
                Geen meldingen met deze filters.
              </p>
            ) : (
              filtered.map((r) => <ReportCard key={r.id} r={r} />)
            )}
          </div>
        </>
      )}
    </section>
  );
}
