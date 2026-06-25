// Invitation accept screen (`/invite/:token`). Shows what the invite grants, then
// lets the signed-in user accept it. On success the role + relationship are stored
// server-side and the user is sent to the home screen. Cinematic Sparki design.

import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { useInvitation, useAcceptInvitation } from "@/hooks/use-invitations"
import {
  STATUS_LABEL,
  RELATIONSHIP_LABEL,
  type InvitationStatus,
} from "@/lib/invitation-types"

const ROLE_LABEL: Record<string, string> = {
  athlete: "atleet",
  coach: "coach",
  parent: "ouder",
}

const NON_PENDING_COPY: Record<Exclude<InvitationStatus, "pending">, string> = {
  accepted: "Deze uitnodiging is al geaccepteerd.",
  expired: "Deze uitnodiging is verlopen.",
  revoked: "Deze uitnodiging is ingetrokken.",
}

export default function InviteAcceptPage() {
  const [location, setLocation] = useLocation()
  // Derive the token from the (base-stripped) location so this works both under
  // the production <Route path="/invite/:token"> and the dev-preview renderer,
  // which mounts the page directly without a matched route.
  const token = location.match(/\/invite\/([^/?#]+)/)?.[1]

  const { data: invite, isLoading, error } = useInvitation(token)
  const accept = useAcceptInvitation()
  const [accepted, setAccepted] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const isHeadTester = invite?.relationship === "head_tester"

  function onAccept() {
    if (!token) return
    setAcceptError(null)
    // Head testers land on their premium welcome moment; everyone else goes home.
    const dest = invite?.relationship === "head_tester" ? "/welkom-tester" : "/"
    accept.mutate(token, {
      onSuccess: () => {
        setAccepted(true)
        setTimeout(() => setLocation(dest), 1400)
      },
      onError: (e) =>
        setAcceptError(e instanceof Error ? e.message : "Accepteren mislukt."),
    })
  }

  // A head-tester invite grants a flag (no peer link, no extra choice to make),
  // so we accept it automatically the moment it loads and is still open — the
  // tester just sees the confirmation and is whisked to the welcome screen.
  const autoFired = useRef(false)
  useEffect(() => {
    if (autoFired.current) return
    if (!invite || invite.status !== "pending") return
    if (invite.relationship !== "head_tester") return
    autoFired.current = true
    onAccept()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite])

  return (
    <ScreenShell section="Home" bg="/concept-lab.png">
      <header>
        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
          UITNODIGING
        </span>
        <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
          Word lid van Sparki
        </h1>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : error || !invite ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-white/55">
            Deze uitnodiging bestaat niet of is niet langer geldig.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="mt-4 inline-flex rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(255,255,255,0.04)" }}
          >
            Naar home
          </button>
        </div>
      ) : (
        <section className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/70">
              {invite.relationship === "coach_athlete" && (
                <>Een coach nodigt je uit als <strong className="text-white/90">atleet</strong>. Je wordt aan deze coach gekoppeld.</>
              )}
              {invite.relationship === "parent_athlete" && (
                <>Je wordt gekoppeld als <strong className="text-white/90">atleet</strong> aan een ouderaccount.</>
              )}
              {invite.relationship === "none" && (
                <>Je krijgt toegang met de rol <strong className="text-white/90">{ROLE_LABEL[invite.targetRole] ?? invite.targetRole}</strong>.</>
              )}
              {invite.relationship === "head_tester" && (
                <>Je wordt <strong className="text-white/90">hoofdtester</strong> van Sparki — vroege toegang tot alles, plus een directe lijn om bugs en ideeën te melden.</>
              )}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                style={{ color: ACCENT, background: "rgba(120,210,230,0.08)", border: "1px solid rgba(120,210,230,0.22)" }}
              >
                {RELATIONSHIP_LABEL[invite.relationship]}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                rol: {ROLE_LABEL[invite.targetRole] ?? invite.targetRole}
              </span>
            </div>
          </div>

          {invite.status !== "pending" ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 text-center backdrop-blur-md">
              <p className="text-[13px] text-white/55">
                {NON_PENDING_COPY[invite.status as Exclude<InvitationStatus, "pending">] ??
                  `Status: ${STATUS_LABEL[invite.status]}`}
              </p>
            </div>
          ) : accepted ? (
            <div className="rounded-2xl border p-5 text-center backdrop-blur-md"
              style={{ borderColor: "rgba(130,220,160,0.3)", background: "rgba(130,220,160,0.06)" }}>
              <p className="text-[14px] font-light text-white/90">Gelukt! Je wordt doorgestuurd…</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={accept.isPending}
                className="w-full rounded-xl border py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] transition-colors disabled:opacity-50"
                style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.12)", color: ACCENT }}
              >
                {accept.isPending ? "Accepteren…" : "Uitnodiging accepteren"}
              </button>
              {acceptError && (
                <p className="text-center text-[12px] text-red-300/80">{acceptError}</p>
              )}
            </>
          )}
        </section>
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
