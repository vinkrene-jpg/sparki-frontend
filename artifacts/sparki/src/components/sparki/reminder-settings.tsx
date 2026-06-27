import {
  Bell,
  BellOff,
  HeartPulse,
  MessageCircleQuestion,
  Dumbbell,
  Flag,
  UserCog,
  Smartphone,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useReminderPreferences,
  useUpdateReminderPreferences,
  type ReminderPreferences,
} from "@/hooks/use-reminder-preferences"
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
              desc="De hoofdschakelaar. Staat deze uit, dan stuurt Sparki je geen enkele herinnering — in de app of per e-mail."
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
              desc="Een herinnering 's avonds als je je check-in nog niet hebt gedaan, zodat Sparki je advies voor morgen scherp kan maken."
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
              desc="Een herinnering als Sparki nog een korte vraag voor je heeft openstaan om je advies preciezer te maken."
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
              desc="Eén korte vraag per keer als Sparki nog een belangrijk gegeven mist (bijv. je FTP, gewicht of lengte), zodat je advies klopt."
              dimmed={!p.enabled}
            >
              <Toggle
                on={p.profile}
                disabled={busy || !p.enabled}
                onClick={() => set({ profile: !p.profile })}
              />
            </Row>
          </div>
        )}
      </div>

      <PushSettingsRow />

      <p className="mt-2 px-1 text-[11px] leading-snug text-white/30">
        Herinneringen verschijnen altijd in de app. Per e-mail versturen werkt
        zodra het e-mailkanaal volledig is gekoppeld; tot die tijd blijft alles
        netjes in de app staan.
      </p>
    </section>
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
