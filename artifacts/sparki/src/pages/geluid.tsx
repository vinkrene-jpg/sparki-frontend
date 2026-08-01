import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Bell,
  Check,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ScreenShell } from "@/components/sparki/screen-shell";
import { useSound } from "@/contexts/SoundContext";
import {
  eventUrl,
  getPack,
  listAlarms,
  SOUND_EVENTS,
  type SoundEvent,
} from "@/lib/sound/registry";

// Plain-Dutch labels for the event sounds (no English tech-jargon, no "AI").
const EVENT_LABELS: Record<SoundEvent, string> = {
  "training-start": "Training gestart",
  "training-voltooid": "Training voltooid",
  record: "Nieuw record",
  badge: "Mijlpaal behaald",
  observatie: "Melding of inzicht",
  "doel-bereikt": "Doel bereikt",
  herinnering: "Herinnering",
};

// JS getDay() order, presented Dutch-first (maandag … zondag).
const DAYS: { d: number; label: string }[] = [
  { d: 1, label: "ma" },
  { d: 2, label: "di" },
  { d: 3, label: "wo" },
  { d: 4, label: "do" },
  { d: 5, label: "vr" },
  { d: 6, label: "za" },
  { d: 0, label: "zo" },
];

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function GeluidPage() {
  const [, navigate] = useLocation();
  const { prefs, update, preview } = useSound();
  const pack = getPack(prefs.pack);

  // Local volume mirror for a smooth slider; persisted on release.
  const [vol, setVol] = useState(prefs.volume);
  useEffect(() => setVol(prefs.volume), [prefs.volume]);

  const availableEvents = SOUND_EVENTS.filter(
    (e) => eventUrl(prefs.pack, e) != null,
  );
  const alarms = listAlarms(prefs.pack);

  const toggleDay = (d: number) => {
    const set = new Set(prefs.alarmDays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    update({ alarmDays: Array.from(set).sort((a, b) => a - b) });
  };

  return (
    <ScreenShell bg={null} section="geluid" bare terug={false}>
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("/you")}
          className="flex w-fit items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>

        <header>
          <h1 className="text-2xl font-semibold text-white">Geluid &amp; wekker</h1>
          <p className="mt-1.5 text-sm text-white/55">
            De eigen Sparki-geluiden — set{" "}
            <span className="text-white/80">{pack.label}</span>. {pack.description}
          </p>
        </header>

        {/* Master ----------------------------------------------------------- */}
        <Card title="Geluid">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">App-geluiden</p>
              <p className="text-xs text-white/50">
                Korte tonen bij gebeurtenissen in de app.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              onClick={() => update({ enabled: !prefs.enabled })}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                prefs.enabled ? "bg-[oklch(0.82_0.16_200)]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  prefs.enabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            {vol === 0 ? (
              <VolumeX className="h-4 w-4 text-white/40" />
            ) : (
              <Volume2 className="h-4 w-4 text-cyan-300/80" />
            )}
            <input
              type="range"
              min={0}
              max={100}
              value={vol}
              onChange={(e) => setVol(Number(e.target.value))}
              onPointerUp={() => {
                update({ volume: vol });
                const u = eventUrl(prefs.pack, "observatie");
                if (u) preview(u);
              }}
              onBlur={() => update({ volume: vol })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-[oklch(0.82_0.16_200)]"
            />
            <span className="w-9 text-right font-mono text-xs text-white/60">
              {vol}%
            </span>
          </div>
        </Card>

        {/* Event previews --------------------------------------------------- */}
        {availableEvents.length > 0 && (
          <Card title="Geluiden beluisteren">
            <ul className="flex flex-col divide-y divide-white/[0.06]">
              {availableEvents.map((event) => {
                const url = eventUrl(prefs.pack, event)!;
                return (
                  <li
                    key={event}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-white/80">
                      {EVENT_LABELS[event]}
                    </span>
                    <button
                      type="button"
                      onClick={() => preview(url)}
                      className="flex items-center gap-1.5 rounded-full border border-cyan-300/30 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-300/10"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Speel af
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Wekker ----------------------------------------------------------- */}
        <Card title="Wekker">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-cyan-300/80" />
              <div>
                <p className="text-sm font-medium text-white">Wekker aan</p>
                <p className="text-xs text-white/50">
                  Wekt je op de ingestelde tijd terwijl de app openstaat.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.alarmEnabled}
              onClick={() => update({ alarmEnabled: !prefs.alarmEnabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                prefs.alarmEnabled ? "bg-[oklch(0.82_0.16_200)]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  prefs.alarmEnabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div
            className={`mt-5 flex flex-col gap-5 transition-opacity ${
              prefs.alarmEnabled ? "opacity-100" : "pointer-events-none opacity-40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Tijd</span>
              <input
                type="time"
                value={prefs.alarmTime}
                onChange={(e) => update({ alarmTime: e.target.value })}
                className="rounded-lg border border-white/10 bg-[oklch(0.16_0_0)] px-3 py-1.5 font-mono text-sm text-white [color-scheme:dark]"
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-white/70">Dagen</p>
              <div className="flex gap-1.5">
                {DAYS.map(({ d, label }) => {
                  const active = prefs.alarmDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`h-9 flex-1 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? "bg-[oklch(0.82_0.16_200)] text-[#040506]"
                          : "border border-white/10 text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-white/40">
                Geen dag gekozen = elke dag.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm text-white/70">Wekkergeluid</p>
              <ul className="flex flex-col gap-2">
                {alarms.map((a) => {
                  const selected = prefs.alarmSound === a.id;
                  return (
                    <li key={a.id}>
                      <div
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                          selected
                            ? "border-cyan-300/40 bg-cyan-300/[0.06]"
                            : "border-white/[0.08]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => update({ alarmSound: a.id })}
                          className="flex flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-cyan-300 bg-cyan-300 text-[#040506]"
                                : "border-white/25"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span>
                            <span className="block text-sm font-medium text-white">
                              {a.label}
                            </span>
                            <span className="block text-xs text-white/50">
                              {a.description}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const u = `${import.meta.env.BASE_URL}sounds/sparki/${pack.id}/${a.file}`;
                            preview(u);
                          }}
                          aria-label={`Beluister ${a.label}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 text-cyan-300 transition-colors hover:bg-cyan-300/10"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[11px] leading-relaxed text-amber-100/70">
            Let op: een website kan je telefoon niet wekken als het scherm op slot
            staat of de app dicht is. Deze wekker werkt nu volledig zolang de app
            openstaat. Een melding bij gesloten app volgt in een latere stap.
          </p>
        </Card>
      </div>
    </ScreenShell>
  );
}
