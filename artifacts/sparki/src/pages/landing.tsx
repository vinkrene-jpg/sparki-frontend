import { Link } from "wouter";
import { Zap } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 h-[70vh] w-[130vw] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.13), transparent 72%)",
        }}
      />
      {/* Scan line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(120,210,230,0.5), transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 text-center">
        {/* Logo mark */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent-cyan/30 bg-muted">
            <Zap className="h-5 w-5 text-accent-cyan" />
          </div>
          <span className="label-sm text-foreground/80 tracking-[0.22em]">SPARKI</span>
        </div>

        {/* Headline */}
        <div className="flex flex-col gap-3">
          <h1 className="font-sans text-4xl font-bold leading-[1.08] tracking-tight text-foreground">
            Sparki Performance
            <br />
            <span
              style={{ color: "oklch(0.82 0.16 200)" }}
            >
              Center
            </span>
          </h1>
          <p className="mx-auto max-w-xs font-sans text-sm text-muted-foreground leading-relaxed">
            Train smarter. Recover faster. Reach your peak — with Sparki coaching built for cyclists.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            href={`${basePath}/sign-up`}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-accent-cyan font-sans text-sm font-semibold tracking-wide text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90"
          >
            Get started free
          </Link>
          <Link
            href={`${basePath}/sign-in`}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-muted font-sans text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>

        <p className="label-xs text-muted-foreground">
          Athlete · Coach · Parent — one platform
        </p>
      </div>
    </main>
  );
}
