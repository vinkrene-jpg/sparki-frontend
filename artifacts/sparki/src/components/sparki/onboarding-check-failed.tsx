// Beperkte foutstatus van de onboarding-gate (defectregister A2-01).
// Wordt getoond wanneer de server na retries de accountstatus niet kan
// bevestigen: geen normale app, geen automatische nieuwe onboarding — alleen
// een begrijpelijke uitleg en "Opnieuw proberen". Toegankelijk: role=status,
// gewone button (toetsenbord + schermlezer).
export function OnboardingCheckFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-card px-8 text-center"
    >
      <p className="text-[15px] font-medium text-foreground/85">
        Je accountstatus kan tijdelijk niet worden gecontroleerd
      </p>
      <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        Waarschijnlijk hapert de verbinding even. Je voortgang is veilig
        opgeslagen — niets gaat verloren. Probeer het zo opnieuw.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-6 py-2.5 text-[13px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20"
      >
        Opnieuw proberen
      </button>
    </div>
  )
}
