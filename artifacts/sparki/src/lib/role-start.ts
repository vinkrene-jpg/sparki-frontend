// SPARKI_BUILD_01 F3 — rolgestuurde startpunten (BB-08).
//
// Eén registry met een eigen startpunt voor ELKE werkelijk bestaande
// server-side rolwaarde: de globale rollen (user_profiles.roles) en de
// clubrollen (club_members.role). Geen enkele rol valt terug op de
// sporterweergave; heeft een rol nog weinig functies, dan beschrijft het
// startpunt de eerlijke lege toestand: wat ontbreekt · wie het oplost ·
// één vervolgstap.
//
// Pure data (geen React) zodat de regressietest dit zonder DOM kan toetsen
// tegen de server-side rollenlijsten.

export type RoleStart = {
  /** Server-side rolwaarde (globaal of clubrol). */
  role: string
  /** Nederlandse titel van het startscherm. */
  label: string
  /** Wat deze rol nu écht kan — bestaande, werkende ingangen. */
  functies: { href: string; label: string }[]
  /** Eerlijke lege toestand — alleen gevuld als de rolomgeving nog dun is. */
  leeg?: {
    ontbreekt: string
    wieLostOp: string
    vervolgstap: { href: string; label: string }
  }
}

// ── Globale rollen (user_profiles.roles) ────────────────────────────────────
export const GLOBAL_ROLE_STARTS: RoleStart[] = [
  {
    role: "athlete",
    label: "Sporter",
    functies: [
      { href: "/vandaag", label: "Vandaag" },
      { href: "/train", label: "Trainen" },
      { href: "/routes", label: "Routes" },
    ],
  },
  {
    role: "coach",
    label: "Trainer",
    functies: [
      { href: "/vandaag", label: "Jouw sporters" },
      { href: "/invitations", label: "Sporters koppelen" },
    ],
  },
  {
    role: "parent",
    label: "Ouder/verzorger",
    functies: [
      { href: "/kinderen", label: "Kinderen" },
      { href: "/toestemmingen", label: "Toestemmingen" },
      { href: "/meldingen", label: "Meldingen" },
    ],
  },
  {
    role: "nutrition_specialist",
    label: "Voedingsdeskundige",
    functies: [],
    leeg: {
      ontbreekt:
        "Er zijn nog geen sporters aan je gekoppeld, dus er is nog geen voedingsbeeld om mee te werken.",
      wieLostOp:
        "Een sporter of clubbeheerder koppelt je; de koppeling vraagt altijd toestemming van de sporter (bij minderjarigen: de ouder).",
      vervolgstap: { href: "/support", label: "Vraag een koppeling aan via Hulp" },
    },
  },
]

// ── Clubrollen (club_members.role) ──────────────────────────────────────────
// Rollen met een echte werkomgeving linken daarheen; dunne rollen krijgen de
// eerlijke lege toestand. "member" en "parent" verwijzen naar hun globale
// omgeving (sporter- resp. ouderstart) — dat is hún startpunt, geen terugval.
export const CLUB_ROLE_STARTS: RoleStart[] = [
  {
    role: "owner",
    label: "Clubeigenaar",
    functies: [
      { href: "/club/beheer", label: "Clubbeheer" },
      { href: "/club", label: "Cluboverzicht" },
    ],
  },
  {
    role: "admin",
    label: "Clubbeheerder",
    functies: [
      { href: "/club/beheer", label: "Clubbeheer" },
      { href: "/club", label: "Cluboverzicht" },
    ],
  },
  {
    role: "hoofdtrainer",
    label: "Hoofdtrainer",
    functies: [
      { href: "/club", label: "Cluboverzicht & toewijzingen" },
      { href: "/club", label: "Trainerwerkruimte (via cluboverzicht)" },
    ],
  },
  {
    role: "trainer",
    label: "Trainer (club)",
    functies: [{ href: "/club", label: "Trainerwerkruimte (via cluboverzicht)" }],
  },
  {
    role: "assistent",
    label: "Assistent",
    functies: [{ href: "/club", label: "Clubkalender & berichten" }],
    leeg: {
      ontbreekt: "Aanwezigheid bijhouden per training is er nog niet.",
      wieLostOp: "Dit staat op de bouwlijst van Sparki; de clubbeheerder kan je intussen aan trainingen koppelen.",
      vervolgstap: { href: "/club", label: "Open de clubkalender" },
    },
  },
  {
    role: "teammanager",
    label: "Teammanager",
    functies: [{ href: "/club", label: "Selecties & kalender" }],
  },
  {
    role: "ploegleider",
    label: "Ploegleider",
    functies: [{ href: "/club", label: "Selecties & kalender" }],
    leeg: {
      ontbreekt: "Een eigen koersdag-werkblad (volgauto, rijderslijst) zit nog niet in de clubomgeving.",
      wieLostOp: "Dit staat op de bouwlijst van Sparki; selecties en kalender werken al.",
      vervolgstap: { href: "/club", label: "Open selecties & kalender" },
    },
  },
  {
    role: "mechanieker",
    label: "Mechanieker",
    functies: [{ href: "/club", label: "Clubmateriaal & leden" }],
    leeg: {
      ontbreekt: "Een club-brede materiaallijst per renner is er nog niet — materiaal leeft nu per sporter.",
      wieLostOp: "Dit staat op de bouwlijst van Sparki; per gekoppelde sporter kun je materiaalvelden al bijwerken.",
      vervolgstap: { href: "/club", label: "Open het cluboverzicht" },
    },
  },
  {
    role: "member",
    label: "Sporter (clublid)",
    functies: [
      { href: "/vandaag", label: "Vandaag" },
      { href: "/club", label: "Club" },
    ],
  },
  {
    role: "parent",
    label: "Ouder/verzorger (club)",
    functies: [
      { href: "/kinderen", label: "Kinderen" },
      { href: "/toestemmingen", label: "Toestemmingen" },
    ],
  },
  {
    role: "vrijwilliger",
    label: "Vrijwilliger",
    functies: [{ href: "/club", label: "Clubkalender & berichten" }],
    leeg: {
      ontbreekt: "Taken- of dienstenlijsten voor vrijwilligers zijn er nog niet.",
      wieLostOp: "Dit staat op de bouwlijst van Sparki; kalender en berichten werken al.",
      vervolgstap: { href: "/club", label: "Open de clubkalender" },
    },
  },
  {
    role: "alleen_lezen",
    label: "Gast (alleen lezen)",
    functies: [{ href: "/club", label: "Clubkalender (alleen lezen)" }],
    leeg: {
      ontbreekt: "Deze rol is bewust alleen-lezen: je kunt niets aanpassen of aanmaken.",
      wieLostOp: "Wil je meer kunnen, dan wijzigt de clubbeheerder jouw rol.",
      vervolgstap: { href: "/club", label: "Bekijk de clubkalender" },
    },
  },
  {
    role: "soigneur",
    label: "Soigneur",
    functies: [{ href: "/club", label: "Clubkalender & berichten" }],
    leeg: {
      ontbreekt: "Een verzorgingswerkblad (bidons, voeding per koers) bestaat nog niet.",
      wieLostOp: "Dit staat op de bouwlijst van Sparki; kalender en berichten werken al.",
      vervolgstap: { href: "/club", label: "Open de clubkalender" },
    },
  },
  {
    role: "medical_staff",
    label: "Medische staf",
    functies: [{ href: "/club", label: "Clubkalender & berichten" }],
    leeg: {
      ontbreekt:
        "Sportdata van renners zie je hier niet vanzelf — die vraagt altijd expliciete toestemming van de sporter (bij minderjarigen: de ouder).",
      wieLostOp: "De sporter of ouder geeft toestemming; daarna verschijnt wat er gedeeld is.",
      vervolgstap: { href: "/club", label: "Open het cluboverzicht" },
    },
  },
  // NB: arts/fysiotherapeut/diëtist enz. zijn géén rolwaarden maar
  // beschrijvende functietypes bij medical_staff (club-schema) — die krijgen
  // dus bewust géén eigen startpunt (F3: alleen werkelijk bestaande rollen).
]

export function roleStartFor(role: string): RoleStart | null {
  return (
    GLOBAL_ROLE_STARTS.find((r) => r.role === role) ??
    CLUB_ROLE_STARTS.find((r) => r.role === role) ??
    null
  )
}

// ── BB-08 laatste stap (SPARKI_INHAAL_01 §1) — inlogroutering naar rolstart ─
//
// Een account dat GEEN sporter is (geen "athlete" in user_profiles.roles) maar
// wél een actieve clubrol heeft, landde bij inloggen op de atleetweergave. De
// startschermen bestonden al (/rol-start/:rol); dit is de routering ernaartoe.
// Deterministische voorrang: leidinggevende rollen eerst, daarna staf, daarna
// meekijkrollen — zodat iemand met meerdere clubrollen altijd op hetzelfde
// startpunt uitkomt. Rollen met een eigen volwaardige omgeving (owner/admin →
// clubbeheer) staan óók in de lijst: beter een eerlijk rolstartpunt dan de
// sporterweergave van iemand die geen sporter is.
export const CLUB_START_PRIORITY: string[] = [
  "teammanager", // staat boven ploegleider (besluitenpatch B)
  "ploegleider",
  "owner",
  "admin",
  "hoofdtrainer",
  "trainer",
  "assistent",
  "mechanieker",
  "soigneur",
  "medical_staff",
  "vrijwilliger",
  "member",
  "parent",
  "alleen_lezen",
]

/**
 * Beste rolstart voor een account zonder sporterrol: de hoogst geprioriteerde
 * actieve clubrol met een geregistreerd startpunt, of null als er geen is.
 */
export function clubStartRole(activeClubRoles: string[]): string | null {
  for (const role of CLUB_START_PRIORITY) {
    if (activeClubRoles.includes(role) && roleStartFor(role)) return role
  }
  return null
}
