// Pure indeling voor de Meer-pagina in de commerciële schil. Alle
// chaptersForRole- en ATHLETE_MEER_CHAPTERS-data wordt hier logisch gegroepeerd
// in een vaste volgorde (harde eis): 1 Profiel & account; 2 Veelgebruikt;
// 3 Sport & materiaal; 4 Koppelingen & gegevens; 5 Ondersteuning & kennis;
// 6 Beheer, instellingen & privacy. Elke bestemming exact een keer; lege groepen
// niet tonen. Geen React — testbaar met node:test.

import type { Chapter } from "@/lib/chapters"
import {
  ATHLETE_MEER_CHAPTERS,
  CLUB_CHAPTER,
  COACH_CHAPTERS,
  PARENT_CHAPTERS,
} from "@/lib/chapters"

export type MeerGroep = {
  titel: string
  items: Chapter[]
}

export type BouwMeerGroepenInput = {
  role: "athlete" | "coach" | "parent"
  isClubMember: boolean
  isAdmin: boolean
}

// Connect, Support en Admin zijn losse knoppen in de oude pagina — nu gewoon
// chapter-rijen. Iconen komen uit lucide-react (via chapters.ts-lookup).
const CONNECT_ITEM: Chapter = {
  href: "/connect",
  icon: null as never, // wordt in de page via lucide geimporteerd
  label: "Sparki Connect",
  hint: "Koppelingen & import",
}

const SUPPORT_ITEM: Chapter = {
  href: "/support",
  icon: null as never,
  label: "Hulp & ondersteuning",
  hint: "Vragen & contact",
}

const ADMIN_ITEM: Chapter = {
  href: "/admin",
  icon: null as never,
  label: "Beheer",
  hint: "Systeembeheer",
}

const KENNIS_ITEM: Chapter = {
  href: "/kennis",
  icon: null as never,
  label: "Kennis",
  hint: "Kennis & inzichten",
}

// Vaste groepsvolgorde (harde eis). De functie hieronder vult de groepen met
// chapters uit de bestaande ATHLETE_MEER_CHAPTERS / chaptersForRole-sets. Elke
// bestemming komt precies een keer voor — geen duplicaten, niets verwijderen
// zonder aantoonbare noodzaak. Lege groepen worden niet getoond (filter in page).

function groepeerAtleet(isClubMember: boolean, isAdmin: boolean): MeerGroep[] {
  // ATHLETE_MEER_CHAPTERS bevat: /you, /lichaam, /mechanieker, /samen, /feed,
  // /activiteiten, /kalender, /kennis, /paspoort, /klimmen, /geluid, /.
  // Indeling volgens de gebruikerseisen:
  // 1. Profiel & account: /you, /paspoort
  // 2. Veelgebruikt: /, /kalender, /activiteiten, /samen, /feed, Club (indien lid)
  // 3. Sport & materiaal: /lichaam, /mechanieker, /klimmen, /geluid
  // 4. Koppelingen & gegevens: Connect
  // 5. Ondersteuning & kennis: /kennis, Support
  // 6. Beheer, instellingen & privacy: Admin (indien admin)

  const byHref = new Map<string, Chapter>()
  for (const ch of ATHLETE_MEER_CHAPTERS) byHref.set(ch.href, ch)

  const groepen: MeerGroep[] = [
    {
      titel: "Profiel & account",
      items: ["/you", "/paspoort"].map((h) => byHref.get(h)!).filter(Boolean),
    },
    {
      titel: "Veelgebruikt",
      items: [
        ...["/", "/kalender", "/activiteiten", "/samen", "/feed"].map((h) =>
          byHref.get(h)!,
        ),
        ...(isClubMember ? [CLUB_CHAPTER] : []),
      ].filter(Boolean),
    },
    {
      titel: "Sport & materiaal",
      items: ["/lichaam", "/mechanieker", "/klimmen", "/geluid"]
        .map((h) => byHref.get(h)!)
        .filter(Boolean),
    },
    {
      titel: "Koppelingen & gegevens",
      items: [CONNECT_ITEM],
    },
    {
      titel: "Ondersteuning & kennis",
      items: [byHref.get("/kennis")!, SUPPORT_ITEM].filter(Boolean),
    },
  ]

  if (isAdmin) {
    groepen.push({
      titel: "Beheer, instellingen & privacy",
      items: [ADMIN_ITEM],
    })
  }

  return groepen
}

function groepeerCoach(): MeerGroep[] {
  // COACH_CHAPTERS: /vandaag, /samen, /invitations, /you.
  // Indeling: 1 = /you; 2 = /vandaag, /samen, /invitations; 5 = Support.
  const byHref = new Map<string, Chapter>()
  for (const ch of COACH_CHAPTERS) byHref.set(ch.href, ch)

  return [
    {
      titel: "Profiel & account",
      items: [byHref.get("/you")!].filter(Boolean),
    },
    {
      titel: "Veelgebruikt",
      items: ["/vandaag", "/samen", "/invitations"]
        .map((h) => byHref.get(h)!)
        .filter(Boolean),
    },
    {
      titel: "Ondersteuning & kennis",
      items: [SUPPORT_ITEM],
    },
  ]
}

function groepeerOuder(): MeerGroep[] {
  // PARENT_CHAPTERS: /vandaag, /feed, /invitations, /you.
  // Indeling: 1 = /you; 2 = /vandaag, /feed, /invitations; 5 = Support.
  const byHref = new Map<string, Chapter>()
  for (const ch of PARENT_CHAPTERS) byHref.set(ch.href, ch)

  return [
    {
      titel: "Profiel & account",
      items: [byHref.get("/you")!].filter(Boolean),
    },
    {
      titel: "Veelgebruikt",
      items: ["/vandaag", "/feed", "/invitations"]
        .map((h) => byHref.get(h)!)
        .filter(Boolean),
    },
    {
      titel: "Ondersteuning & kennis",
      items: [SUPPORT_ITEM],
    },
  ]
}

export function bouwMeerGroepen(input: BouwMeerGroepenInput): MeerGroep[] {
  if (input.role === "coach") return groepeerCoach()
  if (input.role === "parent") return groepeerOuder()
  return groepeerAtleet(input.isClubMember, input.isAdmin)
}
