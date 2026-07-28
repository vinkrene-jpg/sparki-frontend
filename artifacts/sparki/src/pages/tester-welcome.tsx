// Premium first-login moment for a head tester. Shown once (recorded in
// localStorage, keyed by clerkId) after a head-tester invite is accepted or on a
// head tester's first signed-in arrival. Cinematic Sparki design — dark, calm,
// cyan accent — plain Dutch, no "AI" wording. Honest: the number shown is the
// real assigned headTesterNumber; if it hasn't resolved yet we say so plainly.

import { useEffect } from "react"
import { useLocation } from "wouter"
import { Sparkles, Rocket, MessageSquarePlus, ShieldCheck } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"

function headTesterLabel(n: number | null | undefined): string | null {
  if (typeof n !== "number") return null
  return `Head Tester #${String(n).padStart(3, "0")}`
}

const PERKS: { icon: typeof Rocket; title: string; body: string }[] = [
  {
    icon: Rocket,
    title: "Vroege toegang",
    body: "Nieuwe functies staan voor jou als eerste aan — nog vóór iedereen.",
  },
  {
    icon: MessageSquarePlus,
    title: "Directe lijn",
    body: "Meld een bug of idee vanaf elk scherm, met screenshot. Het komt rechtstreeks binnen.",
  },
  {
    icon: ShieldCheck,
    title: "Jouw stem telt",
    body: "Wat je tegenkomt, vormt mee waar Sparki naartoe groeit.",
  },
]

export default function TesterWelcomePage() {
  const [, setLocation] = useLocation()
  const { profile } = useUserProfile()
  const label = headTesterLabel(profile?.headTesterNumber)

  // Record "seen" the moment the page renders for this account, so the once-only
  // gate (in SignedInHome) never routes here again.
  useEffect(() => {
    if (profile?.clerkId) {
      localStorage.setItem(`sparki_tester_welcomed_${profile.clerkId}`, "true")
    }
  }, [profile?.clerkId])

  const first = profile?.displayName?.split(" ")[0] ?? null

  return (
    <ScreenShell section="welkom" bare bg="/atmosphere/samen-fietsen-bakstenen.webp">
      <div className="flex flex-col items-center pt-6 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            borderColor: "rgba(120,210,230,0.35)",
            background: "rgba(120,210,230,0.08)",
            boxShadow: "0 0 40px rgba(120,210,230,0.18)",
          }}
        >
          <Sparkles className="h-6 w-6" style={{ color: ACCENT }} strokeWidth={1.5} />
        </span>

        {label ? (
          <span
            className="mt-5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em]"
            style={{
              color: ACCENT,
              background: "rgba(120,210,230,0.08)",
              border: "1px solid rgba(120,210,230,0.25)",
            }}
          >
            {label}
          </span>
        ) : (
          <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
            Je hoofdtester-nummer wordt toegekend…
          </span>
        )}

        <h1 className="mt-5 font-sans text-3xl font-light leading-tight tracking-tight text-white/95">
          {first ? `Welkom, ${first}.` : "Welkom."}
          <br />
          <span style={{ color: ACCENT }}>Je bent onze hoofdtester.</span>
        </h1>

        <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/60">
          Jij bent de eerste die Sparki echt op de proef stelt. Alles wat je ziet,
          voelt en tegenkomt helpt ons om Sparki scherper te maken.
        </p>
      </div>

      <section className="mt-9 space-y-3">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
          >
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(120,210,230,0.08)", color: ACCENT }}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={1.6} />
            </span>
            <div>
              <h3 className="text-[14px] font-medium text-white/90">{title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={() => setLocation("/")}
        className="mt-9 w-full rounded-xl py-3.5 font-mono text-[12px] uppercase tracking-[0.2em] text-black transition active:scale-[0.99]"
        style={{ background: ACCENT, boxShadow: "0 0 30px rgba(120,210,230,0.25)" }}
      >
        Begin met testen
      </button>

      <footer className="pt-6 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}
