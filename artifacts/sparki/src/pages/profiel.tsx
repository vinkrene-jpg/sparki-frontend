// Openbaar sportersprofiel (/profiel/:clerkId) — toont uitsluitend wat de
// eigenaar per categorie zichtbaar heeft gemaakt. De server filtert; deze
// pagina toont eerlijk "niet gedeeld" voor afgeschermde onderdelen.
import { useState } from "react"
import { useRoute, useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import {
  usePublicProfile,
  useFollowUser,
  useUnfollowUser,
  useSendFriendRequest,
  useBlockUser,
  useReportUser,
} from "@/hooks/use-social"
import {
  ArrowLeft,
  UserPlus,
  Eye,
  EyeOff,
  Flag,
  ShieldOff,
  Activity,
  Users,
} from "lucide-react"

const SPORT_LABEL: Record<string, string> = {
  cycling: "Wielrennen",
  running: "Hardlopen",
  triathlon: "Triatlon",
  mtb: "Mountainbike",
  gravel: "Gravel",
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      {children}
    </div>
  )
}

export default function ProfielPage() {
  const [, params] = useRoute("/profiel/:clerkId")
  const [, navigate] = useLocation()
  const clerkId = params?.clerkId ?? null
  const { data, isLoading, isError } = usePublicProfile(clerkId)
  const follow = useFollowUser()
  const unfollow = useUnfollowUser()
  const sendRequest = useSendFriendRequest()
  const block = useBlockUser()
  const report = useReportUser()
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  const profile = data?.profile

  return (
    <ScreenShell bg="/atmosphere/samen-fietsen-keitjes.webp" section="samen" bare terug={false}>
      <button
        type="button"
        onClick={() => navigate("/samen")}
        className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-white/50"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Terug naar Samen
      </button>

      {isLoading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : isError || !profile ? (
        <Card>
          <p className="text-[14px] leading-relaxed text-white/70">
            Dit profiel is niet beschikbaar.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">
            Het bestaat niet, is afgeschermd of is niet voor jou zichtbaar.
          </p>
        </Card>
      ) : (
        <>
          <section className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 font-sans text-[18px] font-medium text-white/85"
              style={{ background: "rgba(120,210,230,0.08)" }}
            >
              {(profile.displayName ?? "S")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-sans text-xl font-light tracking-tight text-white">
                {profile.displayName ?? "Naam niet gedeeld"}
              </h1>
              <p className="truncate font-mono text-[10px] tracking-wide text-white/40">
                {[
                  profile.sport
                    ? (SPORT_LABEL[profile.sport.toLowerCase()] ?? profile.sport)
                    : null,
                  profile.club,
                  profile.team,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sporter op Sparki"}
              </p>
            </div>
          </section>

          {profile.counts ? (
            <Card>
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-2 text-[13px] text-white/70">
                  <Users className="h-4 w-4 text-white/35" strokeWidth={1.75} />
                  {profile.counts.vrienden} vrienden
                </span>
                <span className="text-[13px] text-white/70">
                  {profile.counts.volgers} volgers
                </span>
              </div>
            </Card>
          ) : null}

          {profile.relation !== "self" && (
            <div className="flex flex-wrap gap-2">
              {profile.volgIk ? (
                <button
                  type="button"
                  disabled={unfollow.isPending}
                  onClick={() => unfollow.mutate(profile.clerkId)}
                  className="rounded-full border border-white/15 px-4 py-2 font-sans text-[12px] text-white/70 disabled:opacity-40"
                >
                  Ontvolgen
                </button>
              ) : (
                <button
                  type="button"
                  disabled={follow.isPending}
                  onClick={() =>
                    follow.mutate(profile.clerkId, {
                      onError: () =>
                        setFeedback("Deze actie is nu niet mogelijk."),
                    })
                  }
                  className="flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-4 py-2 font-sans text-[12px] font-medium"
                  style={{ color: ACCENT }}
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  Volgen
                </button>
              )}
              {profile.isVriend ? (
                <span className="rounded-full border border-white/12 px-4 py-2 font-mono text-[11px] text-white/45">
                  Jullie zijn vrienden
                </span>
              ) : profile.verzoekMogelijk ? (
                <button
                  type="button"
                  disabled={sendRequest.isPending}
                  onClick={() =>
                    sendRequest.mutate(profile.clerkId, {
                      onSuccess: () => setFeedback("Verzoek verstuurd."),
                      onError: () =>
                        setFeedback("Dit verzoek kan niet worden verstuurd."),
                    })
                  }
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 font-sans text-[12px] font-semibold disabled:opacity-40"
                  style={{ background: ACCENT, color: "#040506" }}
                >
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
                  Vriend worden
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-2 font-sans text-[12px] text-white/50"
              >
                <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
                Rapporteren
              </button>
              <button
                type="button"
                disabled={block.isPending}
                onClick={() =>
                  block.mutate(profile.clerkId, {
                    onSuccess: () => navigate("/samen"),
                  })
                }
                className="flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-2 font-sans text-[12px] text-white/50 hover:text-[rgba(255,140,120,0.85)] disabled:opacity-40"
              >
                <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Blokkeren
              </button>
            </div>
          )}

          {feedback && (
            <p className="font-mono text-[11px] tracking-wide text-white/50">
              {feedback}
            </p>
          )}

          {reporting && (
            <Card>
              <p className="text-[13px] text-white/80">
                Waarom rapporteer je dit profiel?
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={2}
                placeholder="Korte toelichting (optioneel)…"
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white/90 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={report.isPending}
                  onClick={() =>
                    report.mutate(
                      {
                        clerkId: profile.clerkId,
                        reason: reportReason.trim() || undefined,
                      },
                      {
                        onSuccess: () => {
                          setReporting(false)
                          setReportReason("")
                          setFeedback(
                            "Bedankt voor je melding. We kijken ernaar.",
                          )
                        },
                      },
                    )
                  }
                  className="rounded-full px-3.5 py-1.5 font-sans text-[12px] font-semibold disabled:opacity-40"
                  style={{ background: ACCENT, color: "#040506" }}
                >
                  Melding versturen
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(false)}
                  className="rounded-full border border-white/12 px-3.5 py-1.5 font-sans text-[12px] text-white/55"
                >
                  Annuleren
                </button>
              </div>
            </Card>
          )}

          {profile.zichtbaar.trainingen && profile.trainingSummary ? (
            <Card>
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                <Activity className="h-3.5 w-3.5" strokeWidth={1.75} />
                Trainingen (laatste 4 weken)
              </p>
              <div className="mt-2 flex gap-6">
                <div>
                  <p className="text-[20px] font-light text-white">
                    {profile.trainingSummary.last28dCount}
                  </p>
                  <p className="font-mono text-[10px] text-white/40">
                    trainingen
                  </p>
                </div>
                <div>
                  <p className="text-[20px] font-light text-white">
                    {profile.trainingSummary.last28dHours}
                  </p>
                  <p className="font-mono text-[10px] text-white/40">uur</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="flex items-center gap-2 text-[12px] text-white/40">
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Trainingen zijn niet gedeeld.
              </p>
            </Card>
          )}

          {profile.zichtbaar.wedstrijden ? (
            profile.nextRace ? (
              <Card>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Eerstvolgende wedstrijd
                </p>
                <p className="mt-1 text-[14px] text-white/85">
                  {profile.nextRace.name}
                </p>
                <p className="font-mono text-[11px] text-white/40">
                  {new Date(profile.nextRace.date).toLocaleDateString("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </Card>
            ) : (
              <Card>
                <p className="text-[12px] text-white/40">
                  Geen aankomende wedstrijd bekend.
                </p>
              </Card>
            )
          ) : (
            <Card>
              <p className="flex items-center gap-2 text-[12px] text-white/40">
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Wedstrijden zijn niet gedeeld.
              </p>
            </Card>
          )}
        </>
      )}
    </ScreenShell>
  )
}
