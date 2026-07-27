import { useState } from "react";
import { Link, Redirect, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { ACCENT } from "@/components/sparki/ui";
import { useAdminWhoami } from "@/hooks/use-bug-reports";
import {
  useAdminHealthCheck,
  useRunSingleHealthCheck,
  useResolveHealthCheck,
} from "@/hooks/use-admin-health";
import {
  STATUS_META,
  URGENCY_LABEL,
  CATEGORY_LABEL,
  formatWhen,
} from "@/lib/health-status";

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 10px ${color}` }}
    />
  );
}

export default function AdminHealthDetailPage() {
  const [, params] = useRoute("/admin/health/:checkKey");
  const checkKey = params?.checkKey ? decodeURIComponent(params.checkKey) : "";

  const { isSignedIn } = useUser();
  const { data: who, isLoading: whoLoading } = useAdminWhoami();
  const isAdmin = who?.isAdmin === true;

  const { data, isLoading } = useAdminHealthCheck(checkKey, isAdmin && !!checkKey);
  const reRun = useRunSingleHealthCheck();
  const resolve = useResolveHealthCheck();
  const [showTech, setShowTech] = useState(false);

  if (!whoLoading && !isAdmin && !DEV_PREVIEW) return <Redirect to="/" />;
  if (isSignedIn === false && !DEV_PREVIEW) return <Redirect to="/sign-in" />;

  const check = data?.check;
  const history = data?.history ?? [];
  const meta = check ? STATUS_META[check.statusColor] : STATUS_META.grey;
  const isFailing =
    check?.statusColor === "red" || check?.statusColor === "orange";

  return (
    <main className="relative min-h-dvh px-5 pb-28 pt-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Terug naar overzicht
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => reRun.mutate(checkKey)}
              disabled={reRun.isPending}
              className="rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              {reRun.isPending ? "Bezig…" : "Opnieuw testen"}
            </button>
            {isFailing && !check?.resolvedAt && (
              <button
                type="button"
                onClick={() => resolve.mutate(checkKey)}
                disabled={resolve.isPending}
                className="rounded-full border border-white/15 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-white/30 disabled:opacity-40"
              >
                Markeer als opgelost
              </button>
            )}
          </div>
        </div>

        {isLoading || !check ? (
          <p className="mt-8 text-[13px] text-white/30">Laden…</p>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
              <span>{CATEGORY_LABEL[check.category] ?? check.category}</span>
              <span>· {check.responsibleModule}</span>
            </div>
            <h1 className="mt-1.5 flex items-center gap-2.5 font-sans text-2xl font-extralight text-white/90">
              <StatusDot color={meta.dot} />
              {check.title}
            </h1>

            <div
              className="mt-4 rounded-2xl border p-4 backdrop-blur-md"
              style={{ borderColor: meta.color, background: meta.bg }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                  Urgentie: {URGENCY_LABEL[check.urgency]}
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                {check.errorMessage ?? check.description}
              </p>
              {check.resolvedAt && (
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">
                  Gemarkeerd als opgelost · {formatWhen(check.resolvedAt)}
                </p>
              )}
            </div>

            <section className="mt-5 grid gap-3">
              <Field label="Wat merkt de gebruiker?" value={check.userImpact} />
              <Field label="Wat verifieert deze test?" value={check.description} />
              {check.remediation && (
                <Field label="Aanbevolen actie" value={check.remediation} />
              )}
            </section>

            <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Laatste test" value={formatWhen(check.lastRunAt)} />
              <Metric
                label="Laatst goed"
                value={formatWhen(check.lastSuccessAt)}
              />
              <Metric
                label="Reactietijd"
                value={
                  check.responseTimeMs != null
                    ? `${check.responseTimeMs} ms`
                    : "—"
                }
              />
              <Metric label="Status" value={meta.label} />
            </section>

            {check.technicalDetails && (
              <section className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowTech((v) => !v)}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 transition hover:text-white/60"
                >
                  {showTech ? "Verberg" : "Toon"} technische details
                </button>
                {showTech && (
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/55">
                    {check.technicalDetails}
                  </pre>
                )}
              </section>
            )}

            <section className="mt-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Testgeschiedenis
              </p>
              <div className="mt-3 space-y-1.5">
                {history.length === 0 ? (
                  <p className="text-[12px] text-white/30">
                    Nog geen eerdere tests.
                  </p>
                ) : (
                  history.map((h) => {
                    const hm = STATUS_META[h.statusColor];
                    return (
                      <div
                        key={h.id}
                        className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#070d16]/[0.5] px-3 py-2 backdrop-blur-md"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusDot color={hm.dot} />
                          <span className="truncate text-[12px] text-white/65">
                            {hm.label}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                          {h.responseTimeMs != null && (
                            <span>{h.responseTimeMs}ms</span>
                          )}
                          <span>{formatWhen(h.ranAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/80">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#070d16]/[0.6] px-3 py-2.5 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] text-white/70">{value}</p>
    </div>
  );
}
