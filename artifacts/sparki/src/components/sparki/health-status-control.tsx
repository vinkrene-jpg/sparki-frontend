// Health-status control (blueprint §4 #1). A compact, secondary control that
// lets the athlete declare they are sick or injured from any normal day. It is
// deliberately understated — never a primary action (grondregel 5) — but always
// reachable so the Emergency recovery-only home can be triggered. On the
// Emergency home itself, the inverse "Ik ben weer hersteld" control clears it.

import { useSetHealthStatus, type HealthStatus } from "@/hooks/use-health-status"

export function HealthStatusControl() {
  const setStatus = useSetHealthStatus()

  return (
    <div className="rounded-xl border border-border bg-card p-4 backdrop-blur-md">
      <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
        VOEL JE JE NIET FIT?
      </span>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Markeer je status — dan schakelt de begeleiding over naar een rustige
        herstelmodus en blokkeert trainingsdruk.
      </p>
      <div className="mt-3 flex gap-2">
        {(
          [
            { label: "Ik ben ziek", value: "sick" },
            { label: "Ik ben geblesseerd", value: "injured" },
          ] as { label: string; value: HealthStatus }[]
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate(o.value)}
            className="rounded-full border border-border bg-muted px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/60 transition-colors hover:bg-muted disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
