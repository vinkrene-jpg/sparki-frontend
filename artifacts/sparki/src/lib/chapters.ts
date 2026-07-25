import {
  Home,
  Dumbbell,
  Trophy,
  HeartPulse,
  Wrench,
  Map,
  Users,
  User,
  CalendarDays,
  Building2,
  UserPlus,
  Radio,
  Compass,
  Activity,
  BookOpen,
  IdCard,
  Mountain,
  Music,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/contexts/UserContext"

// Eén bron van waarheid voor de hoofdstukken van de app. Wordt gebruikt door
// het startscherm (hoofdstukkenraster) én het hoofdmenu, zodat beide altijd
// dezelfde structuur tonen. Club is conditioneel: alleen bij een echte,
// geaccepteerde koppeling met een trainer op Sparki.
export type Chapter = {
  href: string
  icon: LucideIcon
  label: string
  hint: string
}

export const ATHLETE_CHAPTERS: Chapter[] = [
  { href: "/vandaag", icon: Home, label: "Vandaag", hint: "Dagstart & moment" },
  { href: "/train", icon: Dumbbell, label: "Trainen", hint: "Schema & verloop" },
  { href: "/races", icon: Trophy, label: "Wedstrijd", hint: "Races & voorbereiding" },
  { href: "/activiteiten", icon: Activity, label: "Activiteiten", hint: "Jouw ritten" },
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding, herstel, gezondheid" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Materiaal & onderhoud" },
  { href: "/routes", icon: Map, label: "Rijden", hint: "Routes & navigeren" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/feed", icon: Compass, label: "Ontdekken", hint: "Nieuws & inspiratie" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Trainingen & wedstrijden" },
  { href: "/you", icon: User, label: "Jij", hint: "Profiel & doelen" },
]

// Onderdelen achter de hoofdknop "Meer" (sporter). Alles wat niet in de vijf
// hoofdkeuzes (Vandaag · Trainen · Rijden · Wedstrijd · Meer) zit, blijft hier
// bereikbaar — er verdwijnt niets. Club en Admin worden op de Meer-pagina
// conditioneel toegevoegd (echte koppeling resp. server-bevestigde admin).
export const ATHLETE_MEER_CHAPTERS: Chapter[] = [
  { href: "/you", icon: User, label: "Jij", hint: "Profiel, instellingen & koppelingen" },
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding, herstel, gezondheid" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Materiaal & onderhoud" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/feed", icon: Compass, label: "Ontdekken", hint: "Nieuws & inspiratie" },
  { href: "/activiteiten", icon: Activity, label: "Activiteiten", hint: "Jouw ritten" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Trainingen & wedstrijden" },
  { href: "/kennis", icon: BookOpen, label: "Kennis", hint: "Kennisbank & inzichten" },
  { href: "/paspoort", icon: IdCard, label: "Sportpaspoort", hint: "Jouw gegevens & herkomst" },
  { href: "/klimmen", icon: Mountain, label: "Klimmen", hint: "Klimmenverkenner" },
  { href: "/geluid", icon: Music, label: "Geluid", hint: "Geluiden & wekker" },
  { href: "/", icon: Home, label: "Startoverzicht", hint: "Alle hoofdstukken" },
]

export const CLUB_CHAPTER: Chapter = {
  href: "/club",
  icon: Building2,
  label: "Club",
  hint: "Trainer, team & clubleven",
}

export const COACH_CHAPTERS: Chapter[] = [
  { href: "/vandaag", icon: Home, label: "Vandaag", hint: "Dagstart" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Sporters koppelen" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
]

export const PARENT_CHAPTERS: Chapter[] = [
  { href: "/vandaag", icon: Home, label: "Vandaag", hint: "Dagstart" },
  { href: "/feed", icon: Radio, label: "Nieuws", hint: "Wat er speelt" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Koppelen" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
]

// Hoofdnavigatie (onderbalk) — pure data zodat de navigatieregressietest dit
// zonder React kan importeren. Sporter: precies vijf hoofdkeuzes.
export type NavEntry = { href: string; label: string }

export const ATHLETE_NAV_ENTRIES: NavEntry[] = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/train", label: "Trainen" },
  { href: "/routes", label: "Rijden" },
  { href: "/races", label: "Wedstrijd" },
  { href: "/meer", label: "Meer" },
]

export const COACH_NAV_ENTRIES: NavEntry[] = [
  { href: "/", label: "Vandaag" },
  { href: "/invitations", label: "Uitnodigen" },
  { href: "/you", label: "Profiel" },
]

export const PARENT_NAV_ENTRIES: NavEntry[] = [
  { href: "/", label: "Vandaag" },
  { href: "/feed", label: "Nieuws" },
  { href: "/invitations", label: "Uitnodigen" },
  { href: "/you", label: "Profiel" },
]

export function chaptersForRole(
  role: Role | null | undefined,
  hasClub: boolean,
): Chapter[] {
  if (role === "coach") return COACH_CHAPTERS
  if (role === "parent") return PARENT_CHAPTERS
  return hasClub ? [...ATHLETE_CHAPTERS, CLUB_CHAPTER] : ATHLETE_CHAPTERS
}
