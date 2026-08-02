import { Link } from "wouter";
import { Compass, ArrowLeft } from "lucide-react";

const ACCENT = "rgba(120,210,230,1)";
const ACCENT_DIM = "rgba(120,210,230,0.12)";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="relative flex flex-col items-center gap-6">
        <div
          className="pointer-events-none absolute -top-12 left-1/2 h-48 w-80 -translate-x-1/2 opacity-70"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(120,210,230,0.16), transparent)" }}
        />
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-cyan/20 bg-muted"
        >
          <Compass className="h-8 w-8" style={{ color: ACCENT }} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-cyan">404</span>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">Pagina niet gevonden</h1>
          <p className="mx-auto max-w-[320px] font-sans text-sm leading-relaxed text-muted-foreground">
            Deze pagina bestaat niet of is verplaatst. Ga terug naar je Performance Center.
          </p>
        </div>

        <Link
          href="/"
          className="flex h-11 items-center justify-center gap-2 rounded-xl px-5 font-sans text-sm font-semibold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90"
          style={{ background: ACCENT }}
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar start
        </Link>
      </div>

      <div
        className="pointer-events-none mt-10 h-px w-40"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT_DIM}, transparent)` }}
      />
    </div>
  );
}
