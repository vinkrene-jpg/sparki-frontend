// F4 (SPARKI_BUILD_01) — de drie contextcomponenten in de componentbibliotheek.
//
// De actieve rol, de organisatie (club) en het team/de groep zijn permanent
// zichtbaar in de schil. Puur presentatiecomponenten: géén datafetching en
// bewust géén aantallen of informatie uit niet-actieve contexten — alleen de
// naam van de context die nú actief is.

export function DsRolContext({ label }: { label: string }) {
  return (
    <span
      data-testid="context-rol"
      className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/90"
    >
      {label}
    </span>
  )
}

export function DsOrganisatieContext({
  naam,
  kleur,
  logoUrl,
}: {
  naam: string
  kleur?: string | null
  logoUrl?: string | null
}) {
  const color = kleur ?? "rgba(120,210,230,1)"
  return (
    <span
      data-testid="context-organisatie"
      className="inline-flex max-w-[40vw] items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[11px] text-white/75"
      style={{ borderColor: `${color}55`, background: `${color}14` }}
      title={naam}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-3 w-3 shrink-0 object-contain" />
      ) : null}
      <span className="truncate">{naam}</span>
    </span>
  )
}

export function DsTeamContext({ naam }: { naam: string }) {
  return (
    <span
      data-testid="context-team"
      className="inline-flex max-w-[32vw] items-center truncate rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/65"
      title={naam}
    >
      <span className="truncate">{naam}</span>
    </span>
  )
}

// Samengestelde contextregel: rol · organisatie · team. Organisatie/team
// verschijnen alleen wanneer die context echt bestaat — nooit een placeholder.
export function DsContextRegel({
  rolLabel,
  clubNaam,
  teamNaam,
  clubKleur,
  clubLogoUrl,
}: {
  rolLabel: string
  clubNaam?: string | null
  teamNaam?: string | null
  clubKleur?: string | null
  clubLogoUrl?: string | null
}) {
  return (
    <span
      data-testid="context-regel"
      className="flex flex-wrap items-center gap-1.5"
    >
      <DsRolContext label={rolLabel} />
      {clubNaam ? (
        <DsOrganisatieContext naam={clubNaam} kleur={clubKleur} logoUrl={clubLogoUrl} />
      ) : null}
      {teamNaam ? <DsTeamContext naam={teamNaam} /> : null}
    </span>
  )
}
