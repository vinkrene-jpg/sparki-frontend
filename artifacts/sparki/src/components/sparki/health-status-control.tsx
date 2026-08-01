// Health-status control (blueprint §4 #1). A compact, secondary control that
// lets the athlete declare they are sick or injured from any normal day. It is
// deliberately understated — never a primary action (grondregel 5) — but always
// reachable so the Emergency recovery-only home can be triggered. On the
// Emergency home itself, the inverse "Ik ben weer hersteld" control clears it.

import { useSetHealthStatus, type HealthStatus } from "@/hooks/use-health-status"

export function HealthStatusControl() {
  const setStatus = useSetHealthStatus()

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#070d16]/[0.6] p-4 backdrop-blur-md">
      <span className="font-mono text-[10px] tracking-[0.22em] text-white/35">
        VOEL JE JE NIET FIT?
      </span>
      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
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
            className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
