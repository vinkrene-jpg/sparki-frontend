import { Link } from "wouter"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useAdminWhoami,
  useAdminStatus,
  useAdminBugReports,
  useUpdateBugReportStatus,
  type BugReport,
  type BugReportStatus,
} from "@/hooks/use-bug-reports"

const STATUS_LABELS: Record<string, string> = {
  users: "Gebruikers",
  coaches: "Coaches",
  parents: "Ouders",
  observations: "Observaties",
  active_observations: "Actieve observaties",
  ai_memory_enabled: "Sparki-geheugen aan",
  coach_links: "Coach-koppelingen",
  parent_links: "Ouder-koppelingen",
  nutrition_logs: "Voedingslogs",
  activity_imports: "Imports",
  notifications: "Meldingen",
  bug_reports: "Bugmeldingen",
  bug_reports_new: "Nieuwe bugs",
}

const STATUS_ORDER: BugReportStatus[] = ["new", "triaged", "fixed", "rejected"]
const STATUS_TEXT: Record<BugReportStatus, string> = {
  new: "Nieuw",
  triaged: "In behandeling",
  fixed: "Opgelost",
  rejected: "Afgewezen",
}
const STATUS_COLOR: Record<BugReportStatus, string> = {
  new: "rgba(245,200,110,0.9)",
  triaged: "rgba(120,210,230,0.9)",
  fixed: "rgba(140,230,170,0.9)",
  rejected: "rgba(255,120,110,0.85)",
}

function BugRow({ r }: { r: BugReport }) {
  const update = useUpdateBugReportStatus()
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em]"
          style={{ color: STATUS_COLOR[r.status] }}
        >
          {STATUS_TEXT[r.status]}
        </span>
        {r.userRole && (
          <span className="font-mono text-[9px] uppercase text-white/25">
            · {r.userRole}
          </span>
        )}
        {r.reporterName && (
          <span className="truncate font-mono text-[9px] text-white/25">
            · {r.reporterName}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-white/85">
        {r.description}
      </p>
      {r.pageUrl && (
        <p className="mt-1 truncate font-mono text-[10px] text-white/30">
          {r.pageUrl}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => update.mutate({ id: r.id, status: s })}
            disabled={update.isPending || r.status === s}
            className="rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition disabled:opacity-40"
            style={{
              borderColor:
                r.status === s ? STATUS_COLOR[s] : "rgba(255,255,255,0.12)",
              color: r.status === s ? STATUS_COLOR[s] : "rgba(255,255,255,0.5)",
            }}
          >
            {STATUS_TEXT[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

// Head-testers help recruit and onboard other testers, but their active role is
// usually `athlete` — which (by design) has no invite/tester entry in the 5-tab
// nav. Without this, a non-admin head-tester can't reach the tester link/QR page
// to hand out access. Admins already get these links via AdminPanel, so this is
// only shown to head-testers who aren't admins (avoids duplicate links).
export function TesterAccessLinks() {
  const { profile } = useUserProfile()
  if (!profile?.isHeadTester || profile?.isAdmin) return null

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel n="—" title="Tester-toegang" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tester-qr"
            className="rounded-full border px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Tester-QR →
          </Link>
          <Link
            href="/invitations"
            className="rounded-full border px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Uitnodigen →
          </Link>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-white/45">
        Deel de QR-code of link waarmee een tester de app opent. Bestaande
        testers openen de app met de algemene toegangscode.
      </p>
    </section>
  )
}

export function AdminPanel() {
  const { data: who } = useAdminWhoami()
  const isAdmin = who?.isAdmin === true
  const { data: statusData } = useAdminStatus(isAdmin)
  const { data: bugData } = useAdminBugReports(isAdmin)

  if (!isAdmin) return null

  const status = statusData?.status ?? {}
  const reports = bugData?.reports ?? []

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel n="10" title="Admin" />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/invitations"
            className="rounded-full border px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Uitnodigen →
          </Link>
          <Link
            href="/tester-qr"
            className="rounded-full border px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Tester-QR →
          </Link>
          <Link
            href="/admin"
            className="rounded-full border px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Gezondheidscheck →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
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
              {status[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          Bugmeldingen
        </p>
        <div className="mt-3 space-y-3">
          {reports.length > 0 ? (
            reports.map((r) => <BugRow key={r.id} r={r} />)
          ) : (
            <p className="text-[12px] text-white/30">Geen bugmeldingen</p>
          )}
        </div>
      </div>
    </section>
  )
}
