// Flowkeuze voor het venster "Training toevoegen".
// - Zonder datumcontext: eerst een duidelijke keuze tonen (geen voorselectie).
// - Geopend vanuit een toekomstige kalenderdag: "Training inplannen".
// - Geopend vanuit een verstreken kalenderdag: "Uitgevoerde training registreren".
// - Vandaag zelf blijft een keuze: je kunt vandaag plannen én registreren.

export type AddTrainingMode = "kies" | "plan" | "log" | "bouwen"

export function chooseInitialMode(
  contextDate: string | null | undefined,
  today: string,
): AddTrainingMode {
  if (!contextDate || !/^\d{4}-\d{2}-\d{2}$/.test(contextDate)) return "kies"
  if (contextDate > today) return "plan"
  if (contextDate < today) return "log"
  return "kies"
}

// Sport-/trainingstypen. Sparki wordt eerst als wielerapp afgebouwd:
// fietsen is de hoofdsport, kracht is ondersteunend, hardlopen en zwemmen
// bestaan alleen als duidelijk gelabelde crosstraining (bestaande DB-waarden
// "run"/"swim" blijven — alleen het label verandert, geen multisportomgeving).
export const TRAINING_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ride", label: "Fietstraining" },
  { value: "strength", label: "Krachttraining (ondersteunend)" },
  { value: "run", label: "Crosstraining — hardlopen" },
  { value: "swim", label: "Crosstraining — zwemmen" },
  { value: "other", label: "Anders" },
]

export const DISCIPLINE_OPTIONS: { value: string; label: string }[] = [
  { value: "weg", label: "Weg" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
  { value: "indoor", label: "Indoor" },
  { value: "herstel", label: "Herstelrit" },
  { value: "wedstrijd", label: "Wedstrijd" },
  { value: "techniek", label: "Techniek" },
  { value: "test", label: "Test" },
]

export const INTENSITY_OPTIONS: { value: string; label: string }[] = [
  { value: "rustig", label: "Rustig (zone 1–2)" },
  { value: "duur", label: "Duur (zone 2)" },
  { value: "tempo", label: "Tempo (zone 3)" },
  { value: "interval", label: "Interval (zone 4–5)" },
  { value: "maximaal", label: "Maximaal (zone 5+)" },
]
