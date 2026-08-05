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
  Music,
  LifeBuoy,
  ClipboardList,
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
  { href: "/dashboard", icon: Home, label: "Dashboard", hint: "Waar sta je vandaag" },
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
// Taak #611 — ingang naar de sporter-coach-omgeving (/coach, taak #607).
// Bewust GEEN wijziging aan de vaste vijf nav-posities (BB-06/BB-07, MRC):
// de ingang loopt via het Meer-menu (chapters-SSOT) en een doorklik op /train.
export const SPORTER_COACH_CHAPTER: Chapter = {
  href: "/coach",
  icon: ClipboardList,
  label: "Coach",
  hint: "Plan per week & fase",
}

export const ATHLETE_MEER_CHAPTERS: Chapter[] = [
  { href: "/you", icon: User, label: "Jij", hint: "Profiel & doelen" },
  SPORTER_COACH_CHAPTER,
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding & herstel" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Fiets & onderhoud" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/activiteiten", icon: Activity, label: "Activiteiten", hint: "Jouw ritten" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Planning & seizoen" },
  { href: "/kennis", icon: BookOpen, label: "Kennis", hint: "Kennis & inzichten" },
  { href: "/paspoort", icon: IdCard, label: "Sportpaspoort", hint: "Jouw gegevens" },
  // Klimmen is bewust GEEN Meer-onderdeel meer (besluit 01-08-2026: de
  // Klimmenverkenner leeft in Ontdekken (/feed → sectie Klimmen); de pagina
  // /klimmen blijft bestaan en vindbaar via de app-brede zoek).
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
  { href: "/dashboard", icon: Home, label: "Dashboard", hint: "Dagstart" },
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
  { href: "/dashboard", label: "Dashboard" },
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
  { href: "/", label: "Dashboard" }, // 1 startpunt (MUX-76a)
  ...middenPosities("coach"), // 2–4 uit configuratie (voorstel MRU-22)
  { href: "/meer", label: "Meer" }, // 5 Meer (vast)
]

// WP-R1 bindende ouderonderbalk (besluit 31-07-2026).
export const PARENT_NAV_ENTRIES: NavEntry[] = [
  { href: "/kinderen", label: "Kinderen" },
  { href: "/dashboard", label: "Dashboard" },
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

// ── CLUB_AFRONDING_01 C2 — onderbalken voor clubrollen ───────────────────────
// Besluit 01-08: Club en Team horen in de hoofdnavigatie onderin voor wie een
// clubrol heeft; geen terugval op de sporterbalk. Labels/volgorde bevestigd
// door René op 05-08-2026; bindend: vaste posities met "Meer" altijd als
// laatste. Alle hrefs zijn bestaande
// schermen (tab-parameter opent het juiste tabblad).
const CLUB_BEHEER_NAV: NavEntry[] = [
  { href: "/club/beheer?tab=organisatie", label: "Organisatie" },
  { href: "/club/beheer?tab=mensen", label: "Leden" },
  { href: "/club?tab=vandaag", label: "Agenda" },
  { href: "/club?tab=berichten", label: "Berichten" },
  { href: "/meer", label: "Meer" },
]

const CLUB_HOOFDTRAINER_NAV: NavEntry[] = [
  { href: "/club?tab=vandaag", label: "Trainingen" },
  { href: "/club/beheer?tab=structuur", label: "Groepen" },
  { href: "/club?tab=meer", label: "Wedstrijden" },
  { href: "/club?tab=berichten", label: "Berichten" },
  { href: "/meer", label: "Meer" },
]

const CLUB_WEDSTRIJDSTAF_NAV: NavEntry[] = [
  { href: "/club?tab=meer", label: "Wedstrijden" },
  { href: "/club?tab=vandaag", label: "Agenda" },
  { href: "/club?tab=documenten", label: "Documenten" },
  { href: "/club?tab=berichten", label: "Berichten" },
  { href: "/meer", label: "Meer" },
]

// Overige stafrollen: het eigen werkgebied (cluboverzicht) voorop.
const CLUB_STAF_NAV: NavEntry[] = [
  { href: "/club?tab=vandaag", label: "Club" },
  { href: "/club?tab=documenten", label: "Documenten" },
  { href: "/club?tab=berichten", label: "Berichten" },
  { href: "/meer", label: "Meer" },
]

export const CLUB_ROLE_NAV_ENTRIES: Record<string, NavEntry[]> = {
  owner: CLUB_BEHEER_NAV,
  admin: CLUB_BEHEER_NAV,
  hoofdtrainer: CLUB_HOOFDTRAINER_NAV,
  ploegleider: CLUB_WEDSTRIJDSTAF_NAV,
  teammanager: CLUB_WEDSTRIJDSTAF_NAV,
  trainer: CLUB_STAF_NAV,
  assistent: CLUB_STAF_NAV,
  mechanieker: CLUB_STAF_NAV,
  soigneur: CLUB_STAF_NAV,
  medical_staff: CLUB_STAF_NAV,
  vrijwilliger: CLUB_STAF_NAV,
  alleen_lezen: CLUB_STAF_NAV,
}

/** Onderbalk voor een clubrol, of null als de rol geen eigen balk heeft. */
export function clubNavEntriesFor(clubRole: string | null | undefined): NavEntry[] | null {
  if (!clubRole) return null
  return CLUB_ROLE_NAV_ENTRIES[clubRole] ?? null
}

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
