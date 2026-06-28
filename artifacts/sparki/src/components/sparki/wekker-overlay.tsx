import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { soundManager } from "@/lib/sound/manager";

// Full-screen in-app wekker. Rendered globally by SoundProvider when the armed
// time is reached while the app is open. Portals to <body> at a high z-index so
// it sits above the bottom nav and every sheet (z-50 collides with the nav).
//
// Honest about its limits: a web app cannot ring on a locked phone. This only
// fires while Sparki is open; the settings screen states that plainly.
export function WekkerOverlay({
  alarmLabel,
  onStop,
  onSnooze,
}: {
  alarmLabel: string;
  onStop: () => void;
  onSnooze: () => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // If autoplay was blocked, mounting + any tap here re-attempts the sound.
  useEffect(() => {
    soundManager.resumeAlarm();
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const hour = now.getHours();
  const greet =
    hour < 6
      ? "Goedemorgen, vroege vogel"
      : hour < 12
        ? "Goedemorgen"
        : hour < 18
          ? "Goedemiddag"
          : "Goedenavond";

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6 text-center"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 8%, #0a1a2a 0%, #05070e 55%, #020308 100%)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Wekker"
      onClick={() => soundManager.resumeAlarm()}
    >
      <div className="flex items-center gap-2 text-cyan-300/80">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.32em]">
          Wekker · {alarmLabel}
        </span>
      </div>

      <Bell className="mt-8 h-10 w-10 text-cyan-300" strokeWidth={1.5} />

      <div className="mt-4 text-7xl font-semibold tabular-nums tracking-tight text-white">
        {hh}
        <span className="text-cyan-300/70">:</span>
        {mm}
      </div>
      <p className="mt-3 text-base text-white/70">{greet}</p>

      <div className="mt-12 flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={onStop}
          className="rounded-full bg-[oklch(0.82_0.16_200)] px-6 py-4 text-base font-semibold text-[#040506] transition hover:brightness-110"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={onSnooze}
          className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
        >
          9 minuten sluimeren
        </button>
      </div>
    </div>,
    document.body,
  );
}
