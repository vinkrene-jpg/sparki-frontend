// Routeplanner-weergaveniveaus (besluit B6, René 30/31-07-2026).
//
// Vier WEERGAVEN van dezelfde routeplanner — geen vier planners en geen
// rechtenlaag. De weergave wordt automatisch voorgesteld op basis van het
// echte profiel, is altijd handmatig aanpasbaar (met terug-naar-automatisch)
// en staat volledig los van het abonnement. Het hoogste niveau heet
// "Wedstrijd" — uitdrukkelijk NIET "Compleet" (dat is de abonnementsnaam).
//
// Veiligheid is niveau-onafhankelijk: blokkadepoort, eindverificatie en
// wegdek-/routewaarschuwingen worden hier bewust NIET gefilterd — dit
// bestand gaat alleen over welke invoeropties zichtbaar zijn.

export type PlannerView = "gratis" | "go_fietser" | "go_sport" | "wedstrijd"

export const PLANNER_VIEW_ORDER: readonly PlannerView[] = [
  "gratis",
  "go_fietser",
  "go_sport",
  "wedstrijd",
]

export const PLANNER_VIEW_LABELS: Record<PlannerView, string> = {
  gratis: "Gratis",
  go_fietser: "Go gewone fietser",
  go_sport: "Go wielrenner / MTB / gravel",
  wedstrijd: "Wedstrijd",
}

export const PLANNER_VIEW_DESCRIPTIONS: Record<PlannerView, string> = {
  gratis: "Eenvoudig: afstand, startpunt en fietstype — meer heb je niet nodig.",
  go_fietser: "Plus hoogtevoorkeur en drukke wegen vermijden.",
  go_sport:
    "Plus eigen routebouwer, onverhard-voorkeur en een vrije routewens.",
  wedstrijd: "Alles, inclusief koppeling aan je trainingen en trainingstype.",
}

// Welke planner-invoeropties elke weergave toont. Puur presentatie: een
// verborgen optie stuurt de routemotor ook niet stiekem mee (de aanroeper
// gebruikt effectieve waarden). Veiligheidsmeldingen vallen hier bewust
// buiten — die zijn op elk niveau zichtbaar.
export type PlannerFeature =
  | "samen" // samen rijden / bordjes-sprint
  | "hoogte" // hoogtevoorkeur
  | "nWegen" // vermijd drukke N-wegen
  | "eigenRoute" // eigen routebouwer (waypoints)
  | "onverhard" // onverhard-percentage schuifbalk
  | "wens" // vrije-tekst routewens
  | "training" // trainingstype + koppeling aan geplande training

const FEATURES: Record<PlannerView, readonly PlannerFeature[]> = {
  gratis: ["samen"],
  go_fietser: ["samen", "hoogte", "nWegen"],
  go_sport: ["samen", "hoogte", "nWegen", "eigenRoute", "onverhard", "wens"],
  wedstrijd: [
    "samen",
    "hoogte",
    "nWegen",
    "eigenRoute",
    "onverhard",
    "wens",
    "training",
  ],
}

export function plannerViewHas(
  view: PlannerView,
  feature: PlannerFeature,
): boolean {
  return FEATURES[view].includes(feature)
}

// Automatisch voorstel uit het ECHTE profiel — deterministisch en uitlegbaar.
// Geen profiel(gegevens) = eenvoudigste weergave; wedstrijd-/gevorderd-
// kenmerken = Wedstrijd; sportieve discipline = Go wielrenner/MTB/gravel.
export function suggestPlannerView(profile: {
  discipline?: string | null
  experienceLevel?: string | null
  competitionLevel?: string | null
} | null | undefined): PlannerView {
  if (!profile) return "gratis"
  const comp = (profile.competitionLevel ?? "").toLowerCase()
  const exp = (profile.experienceLevel ?? "").toLowerCase()
  const disc = (profile.discipline ?? "").toLowerCase()
  // Wedstrijdniveau kan in het Engels óf Nederlands zijn opgeslagen
  // (bv. "regional" of "regionaal/nationaal") — beide tellen.
  if (
    /local|regional|national|lokaal|regionaal|nationaal/.test(comp) ||
    ["advanced", "elite", "gevorderd"].includes(exp)
  )
    return "wedstrijd"
  const sportief =
    /race|weg|wielren|gravel|mtb|mountain|cyclocross|veldrij/.test(disc)
  if (sportief || exp === "intermediate") return "go_sport"
  if (disc || exp || comp) return "go_fietser"
  return "gratis"
}

export function isPlannerView(v: unknown): v is PlannerView {
  return (
    typeof v === "string" && (PLANNER_VIEW_ORDER as readonly string[]).includes(v)
  )
}
