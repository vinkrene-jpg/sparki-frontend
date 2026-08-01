import {
  Bell,
  BellOff,
  HeartPulse,
  MessageCircleQuestion,
  Dumbbell,
  Flag,
  UserCog,
  Smartphone,
  Sparkles,
  Clock,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useReminderPreferences,
  useUpdateReminderPreferences,
  type ReminderPreferences,
} from "@/hooks/use-reminder-preferences"
import {
  useEngagementRhythm,
  type EngagementRhythm,
} from "@/hooks/use-engagement"
import { usePush } from "@/hooks/use-push"

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{
        background: on ? ACCENT : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-[#05070e] transition-all"
        style={{ left: on ? "calc(100% - 1.375rem)" : "0.125rem" }}
      />
    </button>
  )
}

function Row({
  icon: Icon,
  title,
  desc,
  children,
  dimmed,
}: {
  icon: React.ElementType
  title: string
  desc: string
  children: React.ReactNode
  dimmed?: boolean
}) {
  return (
    <div className={`flex items-start gap-3 py-3.5 ${dimmed ? "opacity-40" : ""}`}>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <div className="text-[14px] tracking-tight text-white/85">{title}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-white/40">{desc}</div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

export function ReminderSettingsSection() {
  const { data, isLoading } = useReminderPreferences()
  const update = useUpdateReminderPreferences()
  const p = data?.preferences
  const busy = update.isPending

  const set = (patch: Partial<ReminderPreferences>) => update.mutate(patch)

  return (
    <section className="pt-2">
      <SectionLabel n="08" title="Herinneringen" />
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        {isLoading || !p ? (
          <div className="space-y-3 py-6">
            <div className="h-10 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-10 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            <Row
              icon={p.enabled ? Bell : BellOff}
              title="Herinneringen aan"
              desc="De hoofdschakelaar. Staat deze uit, dan krijg je geen enkele herinnering — in de app of per e-mail."
            >
              <Toggle
                on={p.enabled}
                disabled={busy}
                onClick={() => set({ enabled: !p.enabled })}
              />
            </Row>

            <Row
              icon={HeartPulse}
              title="Avond-check-in"
              desc="Een herinnering 's avonds als je je check-in nog niet hebt gedaan, voor een scherper advies voor morgen."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.checkins}
                disabled={busy || !p.enabled}
                onClick={() => set({ checkins: !p.checkins })}
              />
            </Row>

            <Row
              icon={MessageCircleQuestion}
              title="Openstaande vragen"
              desc="Een herinnering als er nog een korte vraag voor je openstaat om je advies preciezer te maken."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.followups}
                disabled={busy || !p.enabled}
                onClick={() => set({ followups: !p.followups })}
              />
            </Row>

            <Row
              icon={Dumbbell}
              title="Training morgen"
              desc="Een herinnering de dag vóór een geplande training, zodat je je kunt voorbereiden."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.training}
                disabled={busy || !p.enabled}
                onClick={() => set({ training: !p.training })}
              />
            </Row>

            <Row
              icon={Flag}
              title="Wedstrijd komt eraan"
              desc="Een herinnering in de dagen vóór een wedstrijd, zodat je op tijd met de voorbereiding begint."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.races}
                disabled={busy || !p.enabled}
                onClick={() => set({ races: !p.races })}
              />
            </Row>

            <Row
              icon={UserCog}
              title="Profiel aanvullen"
              desc="Eén korte vraag per keer als er nog een belangrijk gegeven ontbreekt (bijv. je FTP, gewicht of lengte), zodat je advies klopt."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.profile}
                disabled={busy || !p.enabled}
                onClick={() => set({ profile: !p.profile })}
              />
            </Row>

            <Row
              icon={Sparkles}
              title="Er is iets nieuws"
              desc="Een tik als er écht iets nieuws voor je klaarstaat — een nieuw inzicht of vers nieuws — op een moment dat bij jou past. Nooit zomaar, en nooit als er niets nieuws is."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.pulse}
                disabled={busy || !p.enabled}
                onClick={() => set({ pulse: !p.pulse })}
              />
            </Row>
          </div>
        )}
      </div>

      {p && (
        <ChannelsAndQuietHours
          p={p}
          busy={busy}
          set={set}
        />
      )}

      <RhythmReadout />

      <PushSettingsRow />

      <p className="mt-2 px-1 text-[11px] leading-snug text-white/30">
        Herinneringen verschijnen altijd in de app. Per e-mail versturen werkt
        zodra het e-mailkanaal volledig is gekoppeld; tot die tijd blijft alles
        netjes in de app staan.
      </p>
    </section>
  )
}

// ── Kanalen, stille uren en categorieën (Golf 24) ────────────────────────────
// Kanalen bepalen WAAR een melding aankomt; stille uren bepalen WANNEER push en
// e-mail zwijgen (in de app blijft alles staan); categorieën bepalen WAT je
// wilt volgen. Privacy- en veiligheidsmeldingen kunnen nooit uit — die zijn te
// belangrijk om te missen.
function ChannelsAndQuietHours({
  p,
  busy,
  set,
}: {
  p: ReminderPreferences
  busy: boolean
  set: (patch: Partial<ReminderPreferences>) => void
}) {
  const quietOn = p.quietHoursStart != null && p.quietHoursEnd != null

  return (
    <>
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        <div className="divide-y divide-white/[0.06]">
          <Row
            icon={Smartphone}
            title="Kanaal: telefoonmelding"
            desc="Meldingen op je telefoon (push). Zet dit uit en er komt niets meer op je telefoon — behalve bij privacy of veiligheid."
          >
            <Toggle
              on={p.channelPush}
              disabled={busy}
              onClick={() => set({ channelPush: !p.channelPush })}
            />
          </Row>
          <Row
            icon={Bell}
            title="Kanaal: e-mail"
            desc="Herinneringen per e-mail. In de app blijft alles altijd zichtbaar."
          >
            <Toggle
              on={p.channelEmail}
              disabled={busy}
              onClick={() => set({ channelEmail: !p.channelEmail })}
            />
          </Row>
          <Row
            icon={Clock}
            title="Stille uren"
            desc={
              quietOn
                ? `Tussen ${p.quietHoursStart} en ${p.quietHoursEnd} blijven push en e-mail stil. Alleen privacy- en veiligheidsmeldingen komen er doorheen.`
                : "Kies een venster waarin je niet gestoord wordt met push of e-mail. In de app blijft alles gewoon staan."
            }
          >
            <Toggle
              on={quietOn}
              disabled={busy}
              onClick={() =>
                quietOn
                  ? set({ quietHoursStart: null, quietHoursEnd: null })
                  : set({ quietHoursStart: "22:00", quietHoursEnd: "07:00" })
              }
            />
          </Row>
          {quietOn && (
            <div className="flex items-center gap-3 py-3.5 pl-12">
              <label className="flex items-center gap-2 text-[12px] text-white/50">
                Van
                <input
                  type="time"
                  value={p.quietHoursStart ?? "22:00"}
                  disabled={busy}
                  onChange={(e) => set({ quietHoursStart: e.target.value })}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white/85 [color-scheme:dark]"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-white/50">
                tot
                <input
                  type="time"
                  value={p.quietHoursEnd ?? "07:00"}
                  disabled={busy}
                  onChange={(e) => set({ quietHoursEnd: e.target.value })}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[13px] text-white/85 [color-scheme:dark]"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        <div className="divide-y divide-white/[0.06]">
          {(
            [
              ["catCoach", "Coach en begeleiding", "Berichten en updates van je coach."],
              ["catClub", "Club", "Clubtrainingen, wedstrijden en clubberichten."],
              ["catSocial", "Sociaal", "Nieuws en updates uit je kring."],
              ["catMaterial", "Materiaal", "Onderhoudsadviezen van de Materiaalcoach."],
              ["catSync", "Synchronisatie", "Meldingen als een gegevenskoppeling hapert."],
            ] as const
          ).map(([key, title, desc]) => (
            <Row key={key} icon={Bell} title={title} desc={desc}>
              <Toggle
                on={p[key]}
                disabled={busy}
                onClick={() => set({ [key]: !p[key] } as Partial<ReminderPreferences>)}
              />
            </Row>
          ))}
        </div>
      </div>
      <p className="mt-2 px-1 text-[11px] leading-snug text-white/30">
        Privacy- en veiligheidsmeldingen kun je niet uitzetten — die zijn te
        belangrijk om te missen.
      </p>
    </>
  )
}

// ── Jouw ritme (transparency read-out) ────────────────────────────────────────
// An honest window into what Sparki learned about the athlete's OWN usage, so the
// "er is iets nieuws" tik never feels like a mystery. It only explains WHEN a tik
// may land — never what content is shown. Everything here is real telemetry; when
// there is too little to know a rhythm, it says so plainly.
function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`
}

const SCREEN_LABELS: Record<string, string> = {
  home: "Vandaag",
  training: "Training",
  races: "Wedstrijden",
  feed: "Nieuws",
  news: "Nieuws",
  you: "Profiel",
  lab: "Inzicht",
  insights: "Inzicht",
  voeding: "Voeding",
  samen: "Samen",
  kennis: "Kennisbank",
  world: "Renners",
}

function contentLabel(c: EngagementRhythm["topContent"][number]): string {
  if (c.kind === "screen") return SCREEN_LABELS[c.key] ?? c.key
  return c.key
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[15px] tabular-nums text-white/85">{value}</div>
      <div className="mt-0.5 text-[11px] text-white/40">{label}</div>
    </div>
  )
}

function RhythmReadout() {
  const { data, isLoading } = useEngagementRhythm()
  const r = data?.rhythm

  if (isLoading) {
    return (
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-4 backdrop-blur-md">
        <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-3 h-8 animate-pulse rounded bg-white/[0.06]" />
      </div>
    )
  }
  if (!r) return null

  const learned = r.windowSource === "learned" && r.receptiveHour != null
  const windowLine = learned
    ? `Je opent de app meestal rond ${fmtHour(r.receptiveHour as number)}. Een tik over iets nieuws komt daarom rond dat moment.`
    : `Je ritme is nog niet goed genoeg bekend, dus een tik komt op een rustig moment in de avond (tussen ${fmtHour(r.receptiveWindow.startHour)} en ${fmtHour(r.receptiveWindow.endHour)}).`

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-white/45" strokeWidth={1.75} />
        <div className="text-[13px] tracking-tight text-white/80">Jouw ritme</div>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-white/50">{windowLine}</p>

      {r.hasData && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Keer per week geopend" value={`${r.opensPerWeek}×`} />
          <Stat label="Actieve dagen (60d)" value={`${r.distinctActiveDays}`} />
        </div>
      )}

      {r.topContent.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-white/30">
            Waar je het vaakst kijkt
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {r.topContent.slice(0, 4).map((c) => (
              <span
                key={`${c.kind}:${c.key}`}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55"
              >
                {contentLabel(c)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-snug text-white/30">
        Dit komt van je eigen gebruik van de app en bepaalt alleen het moment van
        een tik — nooit wát je te zien krijgt.
      </p>
    </div>
  )
}

// ── Web Push toggle ───────────────────────────────────────────────────────────
// Lets the athlete receive nudges on the phone lock screen (and a paired watch),
// even when the app is closed. Every state shown here is REAL — see usePush.
function PushSettingsRow() {
  const { state, reason, busy, enable, disable } = usePush()

  const on = state === "on"
  const canToggle = state === "on" || state === "off"
  const subtitle =
    state === "on"
      ? "Aan op dit apparaat. Meldingen verschijnen op je telefoon, ook als de app dicht is."
      : state === "off"
        ? "Ontvang meldingen op je telefoon (en gekoppelde horloge), ook als de app dicht is."
        : reason ??
          "Meldingen op je telefoon zijn nu niet beschikbaar. Alles blijft netjes in de app staan."

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
      <Row icon={Smartphone} title="Meldingen op je telefoon" desc={subtitle}>
        {state === "loading" ? (
          <div className="h-6 w-11 animate-pulse rounded-full bg-white/[0.06]" />
        ) : canToggle ? (
          <Toggle
            on={on}
            disabled={busy}
            onClick={() => (on ? void disable() : void enable())}
          />
        ) : (
          <span className="text-[11px] text-white/30">—</span>
        )}
      </Row>
    </div>
  )
}
