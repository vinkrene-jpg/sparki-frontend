// Tester QR onboarding access. Generates scannable QR codes from real entry URLs
// so a remote tester can open the live app on a phone and land straight in the
// accelerated onboarding. A QR that carries a tester invite token grants the
// correct role/link automatically (reusing the invitation flow); a plain entry
// QR simply opens onboarding. Admins can mint a named tester invite inline.
// Cinematic Sparki design language.

import { useMemo, useRef, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { apiFetch } from "@/lib/api"
import { useUserProfile } from "@/contexts/UserContext"
import { useInvitations, useCreateInvitation } from "@/hooks/use-invitations"
import { RELATIONSHIP_LABEL, type Invitation } from "@/lib/invitation-types"

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
const BASE_URL_KEY = "sparki_qr_base_url"

// The base ("origin") part of the live URL. Defaults to wherever this page is
// opened from — when opened on the published deployment that is already the live
// domain. The field is editable + persisted so codes can be prepared from the
// workspace by pasting the published domain once.
function defaultBase(): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(BASE_URL_KEY) || window.location.origin
}

function normalizeBase(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

function entryUrl(base: string): string {
  return `${normalizeBase(base)}${basePath}/`
}

function inviteUrl(base: string, token: string): string {
  return `${normalizeBase(base)}${basePath}/invite/${token}`
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "code"
  )
}

function QrCard({
  url,
  title,
  subtitle,
  fileName,
}: {
  url: string
  title: string
  subtitle: string
  fileName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `sparki-qr-${slug(fileName)}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable — the link is shown below to copy manually */
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl bg-white p-2.5">
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            size={132}
            marginSize={1}
            level="M"
            bgColor="#ffffff"
            fgColor="#05070e"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[15px] font-light tracking-tight text-white/90">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
            {subtitle}
          </p>
          <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/30">
            {url}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={download}
          className="flex-1 rounded-lg border py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
          style={{
            borderColor: "rgba(120,210,230,0.4)",
            background: "rgba(120,210,230,0.1)",
            color: ACCENT,
          }}
        >
          Download QR
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/[0.05]"
        >
          {copied ? "Gekopieerd ✓" : "Kopieer link"}
        </button>
      </div>
    </div>
  )
}

function inviteLabel(inv: Invitation): string {
  return inv.email || RELATIONSHIP_LABEL[inv.relationship]
}

export default function TesterQrPage() {
  const { profile } = useUserProfile()
  const [, setLocation] = useLocation()
  const { data: invitations, isLoading } = useInvitations()
  const createInvite = useCreateInvitation()

  const [base, setBase] = useState(defaultBase)
  const [testerName, setTesterName] = useState("")
  const [asHeadTester, setAsHeadTester] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const isAdmin = profile?.isAdmin === true

  // Replays onboarding for the signed-in admin: clears the server completion
  // flags, drops the local "already onboarded" marker, then reloads at the app
  // root so the onboarding flow starts fresh.
  async function replayOnboarding() {
    setResetError(null)
    setResetting(true)
    try {
      await apiFetch("/api/admin/reset-onboarding", { method: "POST" })
      if (profile?.clerkId) {
        try {
          window.localStorage.removeItem(`sparki_onboarded_${profile.clerkId}`)
        } catch {
          /* localStorage unavailable — server reset is the source of truth */
        }
      }
      window.location.href = import.meta.env.BASE_URL
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Resetten mislukt.")
      setResetting(false)
    }
  }

  function saveBase(next: string) {
    setBase(next)
    try {
      window.localStorage.setItem(BASE_URL_KEY, normalizeBase(next))
    } catch {
      /* localStorage unavailable — value still held in component state */
    }
  }

  // Only pending invites are scannable; accepted/expired/revoked tokens won't
  // grant anything, so we never render a misleading QR for them.
  const pending = useMemo(
    () => (invitations ?? []).filter((i) => i.status === "pending"),
    [invitations],
  )

  function createTester() {
    setError(null)
    createInvite.mutate(
      {
        relationship: asHeadTester ? "head_tester" : "none",
        targetRole: "athlete",
        email: testerName.trim() || null,
      },
      {
        onSuccess: () => {
          setTesterName("")
          setAsHeadTester(false)
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Aanmaken mislukt."),
      },
    )
  }

  return (
    <ScreenShell section="You" bg="/concept-lab.png">
      <header>
        <button
          type="button"
          onClick={() => setLocation("/invitations")}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug
        </button>
        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
          TESTER-TOEGANG
        </span>
        <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
          QR-codes om te testen
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">
          Scan een code met je telefoon om de echte app te openen. Met een
          tester-code krijg je meteen de juiste toegang en start de snelle
          onboarding.
        </p>
      </header>

      <section className="space-y-3">
        <SectionLabel n="01" title="Live adres" large />
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <label className="block">
            <span className="label-xs text-white/40">ADRES VAN DE APP</span>
            <input
              type="url"
              value={base}
              onChange={(e) => saveBase(e.target.value)}
              placeholder="https://jouw-app.replit.app"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"
            />
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">
            Open deze pagina op de gepubliceerde app, of plak hierboven het
            live-adres. De QR-codes verwijzen altijd naar dit adres.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel n="02" title="Open de app" large />
        <QrCard
          url={entryUrl(base)}
          title="Algemene toegang"
          subtitle="Opent de app en start de onboarding. Zonder koppeling of rol."
          fileName="open-app"
        />
      </section>

      <section className="space-y-3">
        <SectionLabel n="03" title="Tester-codes" large />

        {isAdmin && (
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <label className="block">
              <span className="label-xs text-white/40">NAAM TESTER (OPTIONEEL)</span>
              <input
                type="text"
                value={testerName}
                onChange={(e) => setTesterName(e.target.value)}
                placeholder="bijv. Dylan"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={asHeadTester}
                onChange={(e) => setAsHeadTester(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-300"
              />
              <span className="text-[12px] leading-relaxed text-white/55">
                Markeer als <span className="text-white/80">hoofdtester</span> — geeft
                deze tester de Hoofdtester-status in Sparki.
              </span>
            </label>
            <button
              type="button"
              onClick={createTester}
              disabled={createInvite.isPending}
              className="w-full rounded-xl border py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
              style={{
                borderColor: "rgba(120,210,230,0.4)",
                background: "rgba(120,210,230,0.12)",
                color: ACCENT,
              }}
            >
              {createInvite.isPending
                ? "Aanmaken…"
                : asHeadTester
                  ? "Hoofdtester-code maken"
                  : "Tester-code maken"}
            </button>
            {error && <p className="text-[12px] text-red-300/80">{error}</p>}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : pending.length > 0 ? (
          pending.map((inv) => (
            <QrCard
              key={inv.id}
              url={inviteUrl(base, inv.token)}
              title={inviteLabel(inv)}
              subtitle={`${RELATIONSHIP_LABEL[inv.relationship]} · rol: ${inv.targetRole}`}
              fileName={inviteLabel(inv)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/55">
              Nog geen openstaande tester-codes.{" "}
              <button
                type="button"
                onClick={() => setLocation("/invitations")}
                className="underline transition-colors hover:text-cyan-300/90"
                style={{ color: ACCENT }}
              >
                Maak een uitnodiging
              </button>{" "}
              om een tester-code te krijgen.
            </p>
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <SectionLabel n="04" title="Onboarding testen" large />
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/55">
              Loop de onboarding opnieuw door om hem te controleren. Je profiel en
              gegevens blijven bewaard; alleen de onboarding-stappen worden gereset.
            </p>
            <button
              type="button"
              onClick={replayOnboarding}
              disabled={resetting}
              className="w-full rounded-xl border py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
              style={{
                borderColor: "rgba(120,210,230,0.4)",
                background: "rgba(120,210,230,0.12)",
                color: ACCENT,
              }}
            >
              {resetting ? "Bezig…" : "Onboarding opnieuw doorlopen"}
            </button>
            {resetError && <p className="text-[12px] text-red-300/80">{resetError}</p>}
          </div>
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
