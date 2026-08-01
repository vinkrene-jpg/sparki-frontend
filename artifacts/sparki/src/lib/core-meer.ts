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

// Analyse staat inmiddels óók in de mobiele onderbalk (28-7-2026); deze rij
// blijft als vaste vindplaats in het Meer-overzicht.
const ANALYSE_ITEM: Chapter = {
  href: "/analyse",
  icon: null as never,
  label: "Analyse",
  hint: "Grafieken & trends",
}

const KENNIS_ITEM: Chapter = {
  href: "/kennis",
  icon: null as never,
  label: "Kennis",
  hint: "Kennis & inzichten",
}

// Beslisblok 01, veilige fixes 2 en 3: Privacy en Voorwaarden zijn bestaande
// routes die vanuit Meer bereikbaar horen te zijn (voor iedereen, ook coach en
// ouder), en de Photo Lab krijgt een bescheiden ingang (geen hoofdonderdeel).
const PRIVACY_ITEM: Chapter = {
  href: "/privacy",
  icon: null as never,
  label: "Privacy",
  hint: "Privacyverklaring",
}

const VOORWAARDEN_ITEM: Chapter = {
  href: "/voorwaarden",
  icon: null as never,
  label: "Voorwaarden",
  hint: "Gebruiksvoorwaarden",
}

const PHOTO_LAB_ITEM: Chapter = {
  href: "/photo-lab",
  icon: null as never,
  label: "Photo Lab",
  hint: "Foto's bewerken",
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
        ...["/", "/kalender", "/activiteiten"].map((h) => byHref.get(h)!),
        ANALYSE_ITEM,
        ...["/samen", "/feed"].map((h) => byHref.get(h)!),
        ...(isClubMember ? [CLUB_CHAPTER] : []),
      ].filter(Boolean),
    },
    {
      // Klimmen is verplaatst naar Ontdekken (besluit 01-08-2026): de
      // Klimmenverkenner is inspiratie & zoeken en leeft in de Ontdekken-feed
      // (/feed → sectie Klimmen); route-integratie zit in Route maken.
      titel: "Sport & materiaal",
      items: [
        ...["/lichaam", "/mechanieker", "/geluid"]
          .map((h) => byHref.get(h)!)
          .filter(Boolean),
        PHOTO_LAB_ITEM,
      ],
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

  // Altijd tonen: Privacy en Voorwaarden horen voor iedereen bereikbaar te
  // zijn (Beslisblok 01, veilige fix 2). Admin blijft conditioneel.
  groepen.push({
    titel: "Beheer, instellingen & privacy",
    items: [...(isAdmin ? [ADMIN_ITEM] : []), PRIVACY_ITEM, VOORWAARDEN_ITEM],
  })

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
    {
      titel: "Beheer, instellingen & privacy",
      items: [PRIVACY_ITEM, VOORWAARDEN_ITEM],
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
    {
      titel: "Beheer, instellingen & privacy",
      items: [PRIVACY_ITEM, VOORWAARDEN_ITEM],
    },
  ]
}

export function bouwMeerGroepen(input: BouwMeerGroepenInput): MeerGroep[] {
  if (input.role === "coach") return groepeerCoach()
  if (input.role === "parent") return groepeerOuder()
  return groepeerAtleet(input.isClubMember, input.isAdmin)
}
