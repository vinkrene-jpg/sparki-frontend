import { useState } from "react";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { MOTION } from "@/lib/motion";

// MEDIA_UITLEG_01 F1 — testpagina. Bestaat alleen voor toetsing (F1-bewijs);
// is nergens in de navigatie gelinkt en achter de flag media_uitleg_motion.
// Geen gebruikersdata, geen persoonlijke inhoud.
export default function DevMotionPage() {
  const enabled = useFeatureFlag("media_uitleg_motion");
  const {
    motionOff,
    systemReduced,
    sparkiReduced,
    sparkiReducedLoaded,
    setSparkiReduced,
    saving,
  } = useMotionPreference();
  const [open, setOpen] = useState(false);

  if (!enabled) {
    return (
      <div className="p-8 text-sm text-white/60">
        Deze testpagina is niet beschikbaar.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8 text-white">
      <h1 className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300/70">
        Motion-testpagina (F1)
      </h1>

      <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-sm">
        <p data-testid="motion-status">
          Effectief: <strong>{motionOff ? "beweging UIT" : "beweging AAN"}</strong>
        </p>
        <p className="text-white/60">
          Systeem (prefers-reduced-motion): {systemReduced ? "aan" : "uit"} ·
          Sparki-instelling: {sparkiReducedLoaded ? (sparkiReduced ? "aan" : "uit") : "laden…"}
        </p>
        <p className="text-white/60">
          Duurklassen: kort {MOTION.duur.kort}ms · normaal {MOTION.duur.normaal}ms ·
          traag {MOTION.duur.traag}ms
        </p>
        <button
          type="button"
          data-testid="motion-toggle"
          disabled={saving || !sparkiReducedLoaded}
          onClick={() => setSparkiReduced(!sparkiReduced)}
          className="mt-3 rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          Verminder beweging {sparkiReduced ? "uitzetten" : "aanzetten"}
        </button>
      </div>

      {/* Proefelement: één verschijn-overgang (categorie "openen"). Bij
          beweging-uit verschijnt direct de eindtoestand — zelfde layout. */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4">
        <button
          type="button"
          data-testid="motion-demo-open"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80"
        >
          Proefkaart {open ? "sluiten" : "openen"}
        </button>
        <div
          data-testid="motion-demo-target"
          className="mt-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06]"
          style={{
            maxHeight: open ? 96 : 0,
            opacity: open ? 1 : 0,
            transitionProperty: "max-height, opacity",
            transitionDuration: "var(--motion-duur-normaal)",
            transitionTimingFunction: open
              ? "var(--motion-easing-in)"
              : "var(--motion-easing-uit)",
          }}
        >
          <p className="p-4 text-sm text-white/80">
            Eindtoestand — inhoud en bediening zijn identiek met en zonder
            animatie.
          </p>
        </div>
      </div>
    </div>
  );
}
