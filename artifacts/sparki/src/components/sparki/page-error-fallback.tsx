import { Zap } from "lucide-react";
import { BottomNav } from "@/components/sparki/bottom-nav";

// Fallback bij een paginacrash: Nederlandse melding MÉT de onderbalk, zodat
// je altijd naar een ander onderdeel kunt — één kapot menu-item mag nooit de
// navigatie meetrekken. Gedeeld door de productie-router (ProtectedPage) en de
// dev-preview-shell (task 588: de toetsomgeving miste deze per-paginaboundary,
// waardoor een paginacrash daar naar de kale rootboundary escaleerde en de
// BottomNav-fallback nooit te zien was).
export function PageErrorFallback() {
  return (
    <>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 pb-28 text-center">
        <Zap className="h-7 w-7 text-accent-cyan" aria-hidden="true" />
        <p className="font-sans text-base font-semibold text-foreground/80">
          Er ging iets mis op deze pagina
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Kies hieronder een ander onderdeel, of probeer het opnieuw.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan"
        >
          Probeer opnieuw
        </button>
      </div>
      <BottomNav />
    </>
  );
}
