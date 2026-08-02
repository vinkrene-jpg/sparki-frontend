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
  LifeBuoy,
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
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding & herstel" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Fiets & onderhoud" },
  { href: "/routes", icon: Map, label: "Routes", hint: "Maken & navigeren" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/feed", icon: Compass, label: "Ontdekken", hint: "Nieuws & inspiratie" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Planning & seizoen" },
  { href: "/you", icon: User, label: "Jij", hint: "Profiel & doelen" },
]

// Onderdelen achter de hoofdknop "Meer" (sporter). Alles wat niet in de vijf
// hoofdkeuzes (Vandaag · Trainen · Routes · Wedstrijd · Meer) zit, blijft hier
// bereikbaar — er verdwijnt niets. Club en Admin worden op de Meer-pagina
// conditioneel toegevoegd (echte koppeling resp. server-bevestigde admin).
//
// Samen (/samen) en Ontdekken (/feed) zijn bewust weggelaten: ze staan
// al in ATHLETE_CHAPTERS (StartPage-raster en MainMenu). Op het Meer-scherm
// leiden ze tot dubbele vermeldingen. Bereikbaar via Startoverzicht (/) of
// de directe navigatielinks in het MainMenu.
export const ATHLETE_MEER_CHAPTERS: Chapter[] = [
  { href: "/you", icon: User, label: "Jij", hint: "Profiel & doelen" },
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding & herstel" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Fiets & onderhoud" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/activiteiten", icon: Activity, label: "Activiteiten", hint: "Jouw ritten" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Planning & seizoen" },
  { href: "/kennis", icon: BookOpen, label: "Kennis", hint: "Kennis & inzichten" },
  { href: "/paspoort", icon: IdCard, label: "Sportpaspoort", hint: "Jouw gegevens" },
  { href: "/klimmen", icon: Mountain, label: "Klimmen", hint: "Klimmenverkenner" },
  { href: "/geluid", icon: Music, label: "Geluid", hint: "Geluiden & wekker" },
  { href: "/", icon: Home, label: "Startoverzicht", hint: "Alle hoofdstukken" },
]

export const CLUB_CHAPTER: Chapter = {
  href: "/club",
  icon: Building2,
  label: "Club",
  hint: "Team & clubleven",
}

export const COACH_CHAPTERS: Chapter[] = [
  { href: "/vandaag", icon: Home, label: "Vandaag", hint: "Dagstart" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Sporters koppelen" },
  // SPARKI_BUILD_04 F14 — facturatiewerkplek van de trainer.
  { href: "/facturatie", icon: IdCard, label: "Facturatie", hint: "Facturen & opvolging" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
]

// WP-R1: inhoud van het "Meer"-tabblad voor ouders — Profiel en Hulp leven
// hier (bindende onderbalk: Kinderen · Vandaag · Meldingen · Toestemmingen · Meer).
export const PARENT_CHAPTERS: Chapter[] = [
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
  { href: "/support", icon: LifeBuoy, label: "Hulp", hint: "Vragen & ondersteuning" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Kind koppelen" },
  { href: "/feed", icon: Radio, label: "Nieuws", hint: "Wat er speelt" },
]

// BB-14: voedingsdeskundige — eigen (dunne) rolomgeving, Voeding eerst.
// Nooit terugvallen op de sporterweergave: zolang er geen gekoppelde sporters
// zijn, toont het startscherm de eerlijke lege toestand.
export const NUTRITION_SPECIALIST_CHAPTERS: Chapter[] = [
  { href: "/", icon: HeartPulse, label: "Voeding", hint: "Jouw sporters & voeding" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
  { href: "/support", icon: LifeBuoy, label: "Hulp", hint: "Vragen & ondersteuning" },
]

// Hoofdnavigatie (onderbalk) — pure data zodat de navigatieregressietest dit
// zonder React kan importeren. Sporter: precies vijf hoofdkeuzes.
export type NavEntry = { href: string; label: string }

export const ATHLETE_NAV_ENTRIES: NavEntry[] = [
  { href: "/vandaag", label: "Vandaag" },
  { href: "/train", label: "Trainen" },
  { href: "/routes", label: "Routes" },
  { href: "/races", label: "Wedstrijd" },
  { href: "/meer", label: "Meer" },
]

// F4 (BB-06): vaste vijf posities met vaste betekenis voor élke rol —
// 1 startpunt · 2 hoofdonderwerp · 3 uitvoeren · 4 terugkijken · 5 Meer.
// Labels 1–4 mogen per rol verschillen; aantal, volgorde en betekenis niet.
// Positie 5 heet altijd "Meer". Nooit een zesde hoofditem (BB-07).
//
// Besluit René 01-08-2026: de labels voor positie 2–4 zijn een VOORSTEL
// (MRU-22) en worden definitief vastgesteld in MRC-F1 van MULTIROLE_CONTEXT_01
// (eigenaar). Daarom komen ze uit configuratie (config/role-nav-labels.json)
// en liggen ze hier niet in code vast. Positie 1 (MUX-76a) en 5 ("Meer")
// liggen wél vast.
import roleNavLabels from "../config/role-nav-labels.json"

type RoleNavConfigEntry = { positie: number; href: string; label: string }

function middenPosities(rol: "coach" | "nutrition_specialist"): NavEntry[] {
  const cfg = (roleNavLabels as Record<string, unknown>)[rol]
  const entries = Array.isArray(cfg) ? (cfg as RoleNavConfigEntry[]) : []
  return [2, 3, 4].map((positie) => {
    const e = entries.find((x) => x && x.positie === positie && x.href && x.label)
    // Ontbrekende configuratie ⇒ generiek positielabel (MRU-23), nooit een
    // gat of een zesde item.
    if (!e) return { href: "/meer", label: positie === 2 ? "Onderwerp" : positie === 3 ? "Uitvoeren" : "Overzicht" }
    return { href: e.href, label: e.label }
  })
}

export const COACH_NAV_ENTRIES: NavEntry[] = [
  { href: "/", label: "Vandaag" }, // 1 startpunt (MUX-76a)
  ...middenPosities("coach"), // 2–4 uit configuratie (voorstel MRU-22)
  { href: "/meer", label: "Meer" }, // 5 Meer (vast)
]

// WP-R1 bindende ouderonderbalk (besluit 31-07-2026).
export const PARENT_NAV_ENTRIES: NavEntry[] = [
  { href: "/kinderen", label: "Kinderen" },
  { href: "/vandaag", label: "Vandaag" },
  { href: "/meldingen", label: "Meldingen" },
  { href: "/toestemmingen", label: "Toestemmingen" },
  { href: "/meer", label: "Meer" },
]

// BB-14: onderbalk voedingsdeskundige — Voeding eerst; BB-06: vijf posities.
// Posities 2–4 uit configuratie (zelfde regel als coach, besluit 01-08-2026).
export const NUTRITION_SPECIALIST_NAV_ENTRIES: NavEntry[] = [
  { href: "/", label: "Voeding" }, // 1 startpunt (MUX-76a)
  ...middenPosities("nutrition_specialist"),
  { href: "/meer", label: "Meer" }, // 5 Meer (vast)
]

// F4: één bron van waarheid voor het zichtbare rollabel in de contextregel
// en het hoofdmenu.
export const ROLE_LABELS: Record<Role, string> = {
  athlete: "Sporter",
  coach: "Coach",
  parent: "Ouder",
  nutrition_specialist: "Voedingsdeskundige",
}

export function chaptersForRole(
  role: Role | null | undefined,
  hasClub: boolean,
): Chapter[] {
  if (role === "coach") return COACH_CHAPTERS
  if (role === "parent") return PARENT_CHAPTERS
  if (role === "nutrition_specialist") return NUTRITION_SPECIALIST_CHAPTERS
  return hasClub ? [...ATHLETE_CHAPTERS, CLUB_CHAPTER] : ATHLETE_CHAPTERS
}
