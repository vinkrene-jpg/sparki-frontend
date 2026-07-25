import {
  ATHLETE_CHAPTERS,
  ATHLETE_MEER_CHAPTERS,
  CLUB_CHAPTER,
  COACH_CHAPTERS,
  PARENT_CHAPTERS,
} from "@/lib/chapters"
import type { Role } from "@/contexts/UserContext"

// Zoekregister — de client-side kant van de app-brede zoekfunctie. Hergebruikt
// lib/chapters als enige bron van waarheid voor hoofdstukken (label/hint/href)
// en voegt per pagina Nederlandse trefwoorden toe, zodat "wekker" bij Geluid
// uitkomt en "voeding" bij Lichaam. Eigen data (ritten, routes, wedstrijden,
// kennis) komt uit GET /api/search — dit register kent alleen pagina's.

export type ZoekIngang = {
  href: string
  label: string
  hint: string
  trefwoorden: string[]
}

// Trefwoorden per pagina (href → synoniemen). Alleen begrippen die echt op de
// pagina thuishoren — geen loze termen die naar een dood spoor leiden.
const TREFWOORDEN: Record<string, string[]> = {
  "/vandaag": ["vandaag", "dagstart", "home", "moment", "dag"],
  "/train": ["trainen", "training", "schema", "plan", "verloop", "blok"],
  "/races": ["wedstrijd", "wedstrijden", "races", "race", "koers", "voorbereiding"],
  "/activiteiten": ["activiteiten", "ritten", "rit", "sessies", "geschiedenis"],
  "/lichaam": ["lichaam", "voeding", "eten", "herstel", "gezondheid", "slaap", "ziek", "blessure"],
  "/mechanieker": ["mechanieker", "materiaal", "fiets", "onderhoud", "ketting", "banden", "garage"],
  "/routes": ["rijden", "routes", "route", "navigatie", "navigeren", "gpx", "kaart", "volgauto"],
  "/samen": ["samen", "team", "vrienden", "sociaal", "kring"],
  "/feed": ["ontdekken", "nieuws", "inspiratie", "berichten"],
  "/kalender": ["kalender", "agenda", "planning", "week"],
  "/you": ["jij", "profiel", "doelen", "instellingen", "koppelingen", "account", "kern"],
  "/kennis": ["kennis", "kennisbank", "onderzoek", "artikelen", "inzichten", "literatuur"],
  "/paspoort": ["sportpaspoort", "paspoort", "gegevens", "herkomst", "waarden"],
  "/klimmen": ["klimmen", "klim", "beklimming", "cols", "bergen"],
  "/geluid": ["geluid", "geluiden", "wekker", "alarm", "muziek"],
  "/club": ["club", "trainer", "clubleven", "vereniging"],
  "/": ["start", "startoverzicht", "hoofdstukken", "overzicht"],
  "/support": ["hulp", "support", "helpdesk", "vragen", "probleem", "contact"],
  "/journey": ["journey", "verhaal", "dossier", "terugblik", "mijlpalen"],
  "/connect": ["koppelen", "bronnen", "strava", "garmin", "wahoo", "importeren"],
  "/lab": ["inzicht", "lab", "cijfers", "analyse", "belasting", "vorm"],
  "/meer": ["meer", "onderdelen"],
  "/sprinten": ["sprinten", "sprint", "bordjes", "plaatsnaamborden"],
  "/invitations": ["uitnodigen", "uitnodiging", "koppelen", "sporters"],
}

// Extra ingangen die niet in de hoofdstukkenlijsten staan maar wel een eigen
// pagina hebben. Alleen paden die echt bestaan in App.tsx.
const EXTRA_ATHLETE: ZoekIngang[] = [
  { href: "/support", label: "Help & support", hint: "Hulp & vragen", trefwoorden: TREFWOORDEN["/support"] },
  { href: "/journey", label: "Journey", hint: "Jouw verhaal & dossier", trefwoorden: TREFWOORDEN["/journey"] },
  { href: "/connect", label: "Koppelingen", hint: "Bronnen verbinden", trefwoorden: TREFWOORDEN["/connect"] },
  { href: "/lab", label: "Inzicht", hint: "Cijfers & analyse", trefwoorden: TREFWOORDEN["/lab"] },
  { href: "/meer", label: "Meer", hint: "Alle onderdelen", trefwoorden: TREFWOORDEN["/meer"] },
]

const EXTRA_COACH_PARENT: ZoekIngang[] = [
  { href: "/support", label: "Help & support", hint: "Hulp & vragen", trefwoorden: TREFWOORDEN["/support"] },
]

function metTrefwoorden(chapters: { href: string; label: string; hint: string }[]): ZoekIngang[] {
  return chapters.map((c) => ({
    href: c.href,
    label: c.label,
    hint: c.hint,
    trefwoorden: TREFWOORDEN[c.href] ?? [],
  }))
}

/** Alle zoekbare pagina's voor de actieve rol. Club alleen bij echte koppeling. */
export function zoekIngangen(role: Role | null | undefined, hasClub: boolean): ZoekIngang[] {
  let base: ZoekIngang[]
  if (role === "coach") {
    base = [...metTrefwoorden(COACH_CHAPTERS), ...EXTRA_COACH_PARENT]
  } else if (role === "parent") {
    base = [...metTrefwoorden(PARENT_CHAPTERS), ...EXTRA_COACH_PARENT]
  } else {
    base = [
      ...metTrefwoorden(ATHLETE_CHAPTERS),
      ...metTrefwoorden(ATHLETE_MEER_CHAPTERS),
      ...(hasClub ? metTrefwoorden([CLUB_CHAPTER]) : []),
      ...EXTRA_ATHLETE,
    ]
  }
  // Ontdubbel op href (hoofdstukken en Meer overlappen deels).
  const seen = new Set<string>()
  return base.filter((e) => {
    if (seen.has(e.href)) return false
    seen.add(e.href)
    return true
  })
}

function normaliseer(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Filtert pagina-ingangen op label, hint of trefwoord (substring, accentloos). */
export function filterZoekIngangen(ingangen: ZoekIngang[], q: string): ZoekIngang[] {
  const nq = normaliseer(q.trim())
  if (nq.length < 2) return []
  return ingangen.filter(
    (e) =>
      normaliseer(e.label).includes(nq) ||
      normaliseer(e.hint).includes(nq) ||
      e.trefwoorden.some((t) => normaliseer(t).includes(nq)),
  )
}
