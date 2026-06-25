// Invitation management (tester / onboarding flow). Lets a coach invite athletes,
// a parent link a minor athlete, and an admin grant any role — all via token-based
// links. Lists created invitations with live status, copy-link and revoke.
// Cinematic Sparki design language.

import { useMemo, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import {
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
} from "@/hooks/use-invitations"
import { useTestDashboard, useSetTesterCompleted } from "@/hooks/use-testers"
import { TestDashboardView } from "@/components/sparki/test-dashboard"
import {
  STATUS_LABEL,
  RELATIONSHIP_LABEL,
  type Invitation,
  type InvitationStatus,
  type InvitationRelationship,
} from "@/lib/invitation-types"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")

function inviteUrl(token: string): string {
  return `${window.location.origin}${basePath}/invite/${token}`
}

const STATUS_STYLE: Record<InvitationStatus, { color: string; bg: string; border: string }> = {
  pending: { color: ACCENT, bg: "rgba(120,210,230,0.08)", border: "rgba(120,210,230,0.22)" },
  accepted: { color: "rgba(130,220,160,0.95)", bg: "rgba(130,220,160,0.08)", border: "rgba(130,220,160,0.22)" },
  expired: { color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)" },
  revoked: { color: "rgba(255,140,120,0.9)", bg: "rgba(255,140,120,0.07)", border: "rgba(255,140,120,0.22)" },
}

function StatusBadge({ status }: { status: InvitationStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}


type Capability = {
  relationship: InvitationRelationship
  targetRole: Role
  label: string
  description: string
}

export default function InvitationsPage() {
  const { profile } = useUserProfile()
  const [, setLocation] = useLocation()
  const { data: invitations, isLoading } = useInvitations()
  const createInvite = useCreateInvitation()
  const revokeInvite = useRevokeInvitation()
  const isAdminUser = profile?.isAdmin === true
  const { data: dashboard, isLoading: dashboardLoading } =
    useTestDashboard(isAdminUser)
  const setTesterDone = useSetTesterCompleted()

  const [email, setEmail] = useState("")
  const [selected, setSelected] = useState<InvitationRelationship | null>(null)
  const [adminRole, setAdminRole] = useState<Role>("coach")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const roles = (profile?.roles ?? []) as Role[]
  const isAdmin = profile?.isAdmin === true

  const capabilities = useMemo<Capability[]>(() => {
    const caps: Capability[] = []
    if (roles.includes("coach")) {
      caps.push({
        relationship: "coach_athlete",
        targetRole: "athlete",
        label: "Atleet uitnodigen",
        description: "De atleet wordt aan jou als coach gekoppeld.",
      })
    }
    if (roles.includes("parent")) {
      caps.push({
        relationship: "parent_athlete",
        targetRole: "athlete",
        label: "Atleet koppelen",
        description: "Koppel een (minderjarige) atleet aan jouw ouderaccount.",
      })
    }
    if (isAdmin) {
      caps.push({
        relationship: "none",
        targetRole: adminRole,
        label: "Rol-uitnodiging",
        description: "Geef een tester een rol zonder koppeling.",
      })
    }
    return caps
  }, [roles, isAdmin, adminRole])

  const activeCap = capabilities.find((c) => c.relationship === selected) ?? null

  function submit() {
    if (!activeCap) {
      setError("Kies eerst een type uitnodiging.")
      return
    }
    setError(null)
    createInvite.mutate(
      {
        relationship: activeCap.relationship,
        targetRole: activeCap.relationship === "none" ? adminRole : undefined,
        email: email.trim() || null,
      },
      {
        onSuccess: () => {
          setEmail("")
          setSelected(null)
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Aanmaken mislukt."),
      },
    )
  }

  async function copyLink(inv: Invitation) {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv.token))
      setCopiedId(inv.id)
      setTimeout(() => setCopiedId((id) => (id === inv.id ? null : id)), 1800)
    } catch {
      setError("Kopiëren mislukt — kopieer de link handmatig.")
    }
  }

  function revoke(inv: Invitation) {
    if (!window.confirm("Deze uitnodiging intrekken?")) return
    revokeInvite.mutate(inv.id, {
      onError: (e) => setError(e instanceof Error ? e.message : "Intrekken mislukt."),
    })
  }

  return (
    <ScreenShell section="You" bg="/concept-lab.png">
      <header>
        <button
          type="button"
          onClick={() => setLocation("/you")}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug
        </button>
        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
          UITNODIGINGEN
        </span>
        <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
          Testers & koppelingen
        </h1>
        <button
          type="button"
          onClick={() => setLocation("/tester-qr")}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
          style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.08)", color: ACCENT }}
        >
          QR-codes om te testen →
        </button>
      </header>

      {capabilities.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-white/55">
            Je hebt geen rechten om uitnodigingen aan te maken. Coaches kunnen
            atleten uitnodigen, ouders kunnen een atleet koppelen.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <SectionLabel n="01" title="Nieuwe uitnodiging" large />

          <div className="space-y-2">
            {capabilities.map((cap) => {
              const active = selected === cap.relationship
              return (
                <button
                  key={cap.relationship}
                  type="button"
                  onClick={() => setSelected(active ? null : cap.relationship)}
                  className="block w-full rounded-2xl border p-4 text-left backdrop-blur-md transition-colors"
                  style={{
                    borderColor: active ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.08)",
                    background: active ? "rgba(120,210,230,0.06)" : "rgba(7,13,22,0.82)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-sans text-[15px] font-light tracking-tight text-white/90">
                      {cap.label}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.14em]"
                      style={{ color: ACCENT, background: "rgba(120,210,230,0.08)", border: "1px solid rgba(120,210,230,0.22)" }}
                    >
                      {RELATIONSHIP_LABEL[cap.relationship]}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                    {cap.description}
                  </p>
                </button>
              )
            })}
          </div>

          {activeCap && (
            <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
              {activeCap.relationship === "none" && (
                <label className="block">
                  <span className="label-xs text-white/40">ROL</span>
                  <div className="mt-1.5 flex gap-1.5">
                    {(["athlete", "coach", "parent"] as Role[]).map((r) => {
                      const on = adminRole === r
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAdminRole(r)}
                          className="flex-1 rounded-xl border py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors"
                          style={{
                            borderColor: on ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)",
                            background: on ? "rgba(120,210,230,0.1)" : "transparent",
                            color: on ? ACCENT : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </label>
              )}

              <label className="block">
                <span className="label-xs text-white/40">E-MAIL (OPTIONEEL)</span>
                <div className="mt-1.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tester@voorbeeld.nl"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={submit}
                disabled={createInvite.isPending}
                className="w-full rounded-xl border py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
                style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.12)", color: ACCENT }}
              >
                {createInvite.isPending ? "Aanmaken…" : "Uitnodigingslink maken"}
              </button>
            </div>
          )}

          {error && <p className="text-[12px] text-red-300/80">{error}</p>}
        </section>
      )}

      {isAdminUser && (
        <section className="space-y-3">
          <SectionLabel n="02" title="Testdashboard" large />

          {dashboardLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : dashboard ? (
            <TestDashboardView
              summary={dashboard.summary}
              testers={dashboard.testers}
              busy={setTesterDone.isPending}
              onToggleDone={(clerkId, completed) =>
                setTesterDone.mutate(
                  { clerkId, completed },
                  {
                    onError: (e) =>
                      setError(
                        e instanceof Error ? e.message : "Bijwerken mislukt.",
                      ),
                  },
                )
              }
            />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
              <p className="text-[13px] leading-relaxed text-white/55">
                Het testdashboard kon niet worden geladen.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <SectionLabel n={isAdminUser ? "03" : "02"} title="Verstuurde uitnodigingen" large />

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : invitations && invitations.length > 0 ? (
          invitations.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-sans text-[14px] font-light text-white/90">
                    {inv.email || RELATIONSHIP_LABEL[inv.relationship]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {RELATIONSHIP_LABEL[inv.relationship]} · rol: {inv.targetRole}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-white/30">
                    {inv.status === "pending"
                      ? `verloopt ${formatDateTime(inv.expiresAt)}`
                      : `aangemaakt ${formatDateTime(inv.createdAt)}`}
                  </p>
                </div>
                <StatusBadge status={inv.status} />
              </div>

              {inv.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(inv)}
                    className="flex-1 rounded-lg border border-white/10 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/[0.05]"
                  >
                    {copiedId === inv.id ? "Gekopieerd ✓" : "Kopieer link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(inv)}
                    disabled={revokeInvite.isPending}
                    className="rounded-lg border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-red-300/80 disabled:opacity-50"
                  >
                    Intrekken
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/55">
              Nog geen uitnodigingen verstuurd.
            </p>
          </div>
        )}
      </section>

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
