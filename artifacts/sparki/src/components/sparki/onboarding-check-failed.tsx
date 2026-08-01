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
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-8 text-center"
    >
      <p className="text-[15px] font-medium text-white/85">
        Je accountstatus kan tijdelijk niet worden gecontroleerd
      </p>
      <p className="max-w-xs text-[13px] leading-relaxed text-white/45">
        Waarschijnlijk hapert de verbinding even. Je voortgang is veilig
        opgeslagen — niets gaat verloren. Probeer het zo opnieuw.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-6 py-2.5 text-[13px] font-medium text-cyan-200 transition-colors hover:bg-cyan-300/20"
      >
        Opnieuw proberen
      </button>
    </div>
  )
}
