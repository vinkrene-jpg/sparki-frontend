// Weergavenaam voor routes — alleen presentatie, de oorspronkelijke naam
// blijft in de data staan. Automatisch gegenereerde namen zoals
// "Gereden: Eigen route vanuit BGV · 43.2 km · 12 aug" worden opgeschoond
// naar "Ronde vanuit BGV — 43 km". De gebruiker kan de route altijd zelf
// hernoemen; een zelfgekozen naam wordt nooit aangepast.
export function displayRouteName(
  name: string,
  distanceKm: number | null,
): { display: string; startHint: string | null; cleaned: boolean } {
  const auto = name.match(
    /^Gereden:\s*Eigen route vanuit\s+(.+?)(?:\s*[·—-]\s.*)?$/i,
  )
  if (auto) {
    const start = auto[1].trim()
    const km =
      typeof distanceKm === "number" ? ` — ${Math.round(distanceKm)} km` : ""
    return {
      display: `Ronde vanuit ${start}${km}`,
      startHint: start,
      cleaned: true,
    }
  }
  const vanuit = name.match(
    /vanuit\s+([A-Za-zÀ-ž0-9''.-]+(?:\s[A-Za-zÀ-ž0-9''.-]+)?)/i,
  )
  let startHint: string | null = null
  if (vanuit) {
    // Verbindingswoorden aan het einde horen niet bij de plaatsnaam
    // ("Amersfoort met" → "Amersfoort").
    startHint = vanuit[1]
      .replace(/[·—-]\s*$/, "")
      .replace(
        /\s+(met|en|naar|via|richting|langs|door|over|tot|de|het|een)$/i,
        "",
      )
      .trim()
    if (!startHint) startHint = null
  }
  return { display: name, startHint, cleaned: false }
}
