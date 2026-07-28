/**
 * Sparki Visual Atmosphere Library
 * ─────────────────────────────────
 * Centrale configuratie voor alle 28 Midjourney-sfeerbeelden.
 *
 * Gebruik:
 *   import { ATMOSPHERE, getAtmosphereByCategorie } from "@/lib/atmosphere-library"
 *
 * Beelden staan in:
 *   /atmosphere/<naam>.webp   ← geoptimaliseerd (q85)
 *   /atmosphere/<naam>.png    ← origineel (behouden)
 *   /atmosphere/originelen/   ← MJ-originelen met UUID-namen
 *
 * Schermkoppeling: zie paginaVoorkeur[] per asset.
 * Vandaag-hero: alleen training-renster-bos (warm licht, open landschap).
 */

export type AtmosphereCategorie = "wedstrijd" | "training" | "samen" | "routes"

export type SchermCategorie =
  | "vandaag"
  | "activiteiten"
  | "trainen"
  | "routes"
  | "club"
  | "profiel"
  | "wedstrijden"
  | "onboarding"

/** Welk deel van de afbeelding prioriteit krijgt bij object-fit: cover */
export type CropPositie =
  | "50% 30%"  // nadruk boven (lucht, hoofd renner)
  | "50% 40%"
  | "50% 50%"  // gecentreerd
  | "50% 60%"
  | "50% 70%"  // nadruk onder (weg, voeten)

export type TekstPositie =
  | "links-boven"
  | "links-midden"
  | "links-onder"
  | "rechts-onder"
  | "midden"

/** Hoeveel lokale contrastbehandeling het beeld nodig heeft om tekst leesbaar te houden */
export type ContrastBehoefte = "geen" | "licht" | "matig"

export interface AtmosphereAsset {
  /** Unieke identifier — ook de bestandsnaam (zonder extensie) */
  id: string
  /** Korte Nederlandstalige omschrijving van het beeld */
  beschrijving: string
  /** Stemmingswoord (intern gebruik) */
  sfeer: string
  /** Inhoudscategorie */
  categorie: AtmosphereCategorie[]
  /** Originele afmetingen in pixels */
  afmetingen: { breedte: number; hoogte: number }
  /** CSS object-position voor hero-gebruik */
  cropPositie: CropPositie
  /** Aanbevolen positie voor tekst-overlay */
  tekstPositie: TekstPositie
  /**
   * Indicatie voor lokale contrastlaag:
   *   "geen"  → beeld is al contrasterend genoeg
   *   "licht" → subtiele schaduw of dunne gradient nodig
   *   "matig" → lichte gradient nodig onder tekstzone
   */
  contrastBehoefte: ContrastBehoefte
  /** Schermen waarvoor dit beeld geschikt is */
  paginaVoorkeur: SchermCategorie[]
  /** WebP-pad (relatief aan /public) */
  webp: string
  /** PNG-fallback-pad */
  png: string
}

// ── 28 assets ────────────────────────────────────────────────────────────────

export const ATMOSPHERE: AtmosphereAsset[] = [
  // ── WEDSTRIJD ──────────────────────────────────────────────────────────────
  {
    id: "wedstrijd-renner-close-up",
    beschrijving: "Jonge mannelijke renner close-up, gouden uur, koerssfeer",
    sfeer: "intens-warm",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 30%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "wedstrijden", "activiteiten"],
    webp: "/atmosphere/wedstrijd-renner-close-up.webp",
    png:  "/atmosphere/wedstrijd-renner-close-up.png",
  },
  {
    id: "wedstrijd-renster-oranje",
    beschrijving: "Jonge vrouwelijke renner close-up, oranje tenue, bergachtige achtergrond",
    sfeer: "gefocust-warm",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 30%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "wedstrijden", "activiteiten"],
    webp: "/atmosphere/wedstrijd-renster-oranje.webp",
    png:  "/atmosphere/wedstrijd-renster-oranje.png",
  },
  {
    id: "wedstrijd-renster-goud",
    beschrijving: "Vrouwelijke renner close-up, witte helm, gouden-uur licht",
    sfeer: "warm-goud",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 30%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "wedstrijden"],
    webp: "/atmosphere/wedstrijd-renster-goud.webp",
    png:  "/atmosphere/wedstrijd-renster-goud.png",
  },
  {
    id: "wedstrijd-renster-bergen",
    beschrijving: "Vrouwelijke renner op asfaltweg, kale bergachtergrond, zonlicht",
    sfeer: "krachtig-open",
    categorie: ["wedstrijd", "training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "links-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["trainen", "wedstrijden", "activiteiten"],
    webp: "/atmosphere/wedstrijd-renster-bergen.webp",
    png:  "/atmosphere/wedstrijd-renster-bergen.png",
  },
  {
    id: "wedstrijd-renner-landschap",
    beschrijving: "Renner in aero-positie door berglandschap, warm droog licht",
    sfeer: "snel-landschap",
    categorie: ["wedstrijd", "training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "links-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["trainen", "wedstrijden", "routes"],
    webp: "/atmosphere/wedstrijd-renner-landschap.webp",
    png:  "/atmosphere/wedstrijd-renner-landschap.png",
  },
  {
    id: "wedstrijd-volgauto-grijs",
    beschrijving: "Zwarte ploegwagen van achter, fietsen op dak, grijze koersdag",
    sfeer: "wedstrijd-sfeer",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "midden",
    contrastBehoefte: "matig",
    paginaVoorkeur: ["wedstrijden"],
    webp: "/atmosphere/wedstrijd-volgauto-grijs.webp",
    png:  "/atmosphere/wedstrijd-volgauto-grijs.png",
  },
  {
    id: "wedstrijd-volgauto-regen",
    beschrijving: "Rode ploegwagen frontaal in regen, peloton op achtergrond",
    sfeer: "nat-koers",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 2048, hoogte: 1147 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "matig",
    paginaVoorkeur: ["wedstrijden"],
    webp: "/atmosphere/wedstrijd-volgauto-regen.webp",
    png:  "/atmosphere/wedstrijd-volgauto-regen.png",
  },
  {
    id: "wedstrijd-volgauto-peloton",
    beschrijving: "Zwarte ploegwagen frontaal, peloton achter, bewolkt landelijk",
    sfeer: "koers-klassiek",
    categorie: ["wedstrijd"],
    afmetingen: { breedte: 2048, hoogte: 1147 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["wedstrijden"],
    webp: "/atmosphere/wedstrijd-volgauto-peloton.webp",
    png:  "/atmosphere/wedstrijd-volgauto-peloton.png",
  },

  // ── TRAINING ───────────────────────────────────────────────────────────────
  {
    id: "training-renster-heide",
    beschrijving: "Vrouwelijke renner solo op droog heide-landschap, warm zijlicht",
    sfeer: "solo-warm",
    categorie: ["training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 40%",
    tekstPositie: "links-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["vandaag", "trainen", "activiteiten"],
    webp: "/atmosphere/training-renster-heide.webp",
    png:  "/atmosphere/training-renster-heide.png",
  },
  {
    id: "training-renster-bos",
    beschrijving: "Vrouwelijke renner bergop langs herfstbomen, warm oranje licht",
    sfeer: "herfst-warm",
    categorie: ["training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 40%",
    tekstPositie: "links-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["vandaag", "trainen", "activiteiten"],
    webp: "/atmosphere/training-renster-bos.webp",
    png:  "/atmosphere/training-renster-bos.png",
  },
  {
    id: "training-renster-bocht",
    beschrijving: "Vrouwelijke renner in gebogen houding op donker bospad",
    sfeer: "technisch-donker",
    categorie: ["training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["trainen", "activiteiten"],
    webp: "/atmosphere/training-renster-bocht.webp",
    png:  "/atmosphere/training-renster-bocht.png",
  },
  {
    id: "training-renner-mistig-bos",
    beschrijving: "Renner van achteren op mistige bosweg, herfstsfeer",
    sfeer: "mistig-rustig",
    categorie: ["training"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "midden",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "trainen"],
    webp: "/atmosphere/training-renner-mistig-bos.webp",
    png:  "/atmosphere/training-renner-mistig-bos.png",
  },

  // ── SAMEN ──────────────────────────────────────────────────────────────────
  {
    id: "samen-groepsrit-winter",
    beschrijving: "Groep renners op winterse weg, rood shirt vooraan",
    sfeer: "groep-winter",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["club", "activiteiten"],
    webp: "/atmosphere/samen-groepsrit-winter.webp",
    png:  "/atmosphere/samen-groepsrit-winter.png",
  },
  {
    id: "samen-groepsrit-zee",
    beschrijving: "Vrouwengroep bergop met zee op achtergrond, zomers licht",
    sfeer: "groep-zee",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "links-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["club", "activiteiten"],
    webp: "/atmosphere/samen-groepsrit-zee.webp",
    png:  "/atmosphere/samen-groepsrit-zee.png",
  },
  {
    id: "samen-groepsrit-peloton",
    beschrijving: "Rensters in peloton, warme herfstsfeer, gouden licht",
    sfeer: "peloton-warm",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 40%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["club", "activiteiten"],
    webp: "/atmosphere/samen-groepsrit-peloton.webp",
    png:  "/atmosphere/samen-groepsrit-peloton.png",
  },
  {
    id: "samen-koffiestop-close",
    beschrijving: "Vrouwelijke renner koffie drinkend, gezellige koffiestop",
    sfeer: "koffiestop-intiem",
    categorie: ["samen"],
    afmetingen: { breedte: 1024, hoogte: 1024 },
    cropPositie: "50% 30%",
    tekstPositie: "links-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["club"],
    webp: "/atmosphere/samen-koffiestop-close.webp",
    png:  "/atmosphere/samen-koffiestop-close.png",
  },
  {
    id: "samen-koffiestop-zon",
    beschrijving: "Vrouwelijke renner koffie drinkend in warm zonlicht",
    sfeer: "koffiestop-zon",
    categorie: ["samen"],
    afmetingen: { breedte: 2048, hoogte: 2048 },
    cropPositie: "50% 30%",
    tekstPositie: "links-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "club"],
    webp: "/atmosphere/samen-koffiestop-zon.webp",
    png:  "/atmosphere/samen-koffiestop-zon.png",
  },
  {
    id: "samen-koffiestop-stad",
    beschrijving: "Groep rensters koffie drinkend, stadsterras, gouden uur",
    sfeer: "sociaal-stad",
    categorie: ["samen"],
    afmetingen: { breedte: 2048, hoogte: 2048 },
    cropPositie: "50% 50%",
    tekstPositie: "midden",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["club"],
    webp: "/atmosphere/samen-koffiestop-stad.webp",
    png:  "/atmosphere/samen-koffiestop-stad.png",
  },
  {
    id: "samen-renners-gesprek",
    beschrijving: "Mannelijke renners in gesprek, gouden uur, stadsomgeving",
    sfeer: "gesprek-warm",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["club", "profiel"],
    webp: "/atmosphere/samen-renners-gesprek.webp",
    png:  "/atmosphere/samen-renners-gesprek.png",
  },
  {
    id: "samen-renner-rust",
    beschrijving: "Mannelijke renner in rust, stad op achtergrond, groepscontext",
    sfeer: "rust-stad",
    categorie: ["samen"],
    afmetingen: { breedte: 2048, hoogte: 1147 },
    cropPositie: "50% 50%",
    tekstPositie: "midden",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["profiel", "club"],
    webp: "/atmosphere/samen-renner-rust.webp",
    png:  "/atmosphere/samen-renner-rust.png",
  },
  {
    id: "samen-fietsen-cafe-avond",
    beschrijving: "Racefiets geparkeerd voor verlicht café, avond, sfeervolle straat",
    sfeer: "avond-stad",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["club"],
    webp: "/atmosphere/samen-fietsen-cafe-avond.webp",
    png:  "/atmosphere/samen-fietsen-cafe-avond.png",
  },
  {
    id: "samen-fietsen-bakstenen",
    beschrijving: "Rode racefiets leunend tegen bakstenen gevel, Nederlandse sfeer",
    sfeer: "klassiek-nl",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["profiel", "club", "onboarding"],
    webp: "/atmosphere/samen-fietsen-bakstenen.webp",
    png:  "/atmosphere/samen-fietsen-bakstenen.png",
  },
  {
    id: "samen-fietsen-keitjes",
    beschrijving: "Rij zwarte racefietsen voor stenen muur, keitjesstraat",
    sfeer: "klassiek-keitjes",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "licht",
    paginaVoorkeur: ["profiel", "club"],
    webp: "/atmosphere/samen-fietsen-keitjes.webp",
    png:  "/atmosphere/samen-fietsen-keitjes.png",
  },
  {
    id: "samen-fietsen-terras",
    beschrijving: "Fietsen leunend voor zonnig mediterraans terras, warm licht",
    sfeer: "zomer-terras",
    categorie: ["samen"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "links-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["vandaag", "club"],
    webp: "/atmosphere/samen-fietsen-terras.webp",
    png:  "/atmosphere/samen-fietsen-terras.png",
  },

  // ── ROUTES ─────────────────────────────────────────────────────────────────
  {
    id: "routes-weg-zonsondergang",
    beschrijving: "Rechte landweg richting zonsondergang, gouden licht",
    sfeer: "vrij-goud",
    categorie: ["routes"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 60%",
    tekstPositie: "midden",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["routes", "vandaag"],
    webp: "/atmosphere/routes-weg-zonsondergang.webp",
    png:  "/atmosphere/routes-weg-zonsondergang.png",
  },
  {
    id: "routes-weg-heuvels-mist",
    beschrijving: "Kronkelende weg door groene heuvels bij ochtendnevel",
    sfeer: "ochtend-groen",
    categorie: ["routes"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["routes", "trainen"],
    webp: "/atmosphere/routes-weg-heuvels-mist.webp",
    png:  "/atmosphere/routes-weg-heuvels-mist.png",
  },
  {
    id: "routes-weg-droge-heuvels",
    beschrijving: "Rechte weg door droge heuvels, zachte ochtendmist",
    sfeer: "stil-droog",
    categorie: ["routes"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "midden",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["routes", "trainen"],
    webp: "/atmosphere/routes-weg-droge-heuvels.webp",
    png:  "/atmosphere/routes-weg-droge-heuvels.png",
  },
  {
    id: "routes-weg-ochtend-mist",
    beschrijving: "Slingerende weg door groene heuvels, diepe ochtendmist",
    sfeer: "mystiek-ochtend",
    categorie: ["routes"],
    afmetingen: { breedte: 1456, hoogte: 816 },
    cropPositie: "50% 50%",
    tekstPositie: "rechts-onder",
    contrastBehoefte: "geen",
    paginaVoorkeur: ["routes", "trainen", "vandaag"],
    webp: "/atmosphere/routes-weg-ochtend-mist.webp",
    png:  "/atmosphere/routes-weg-ochtend-mist.png",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Zoek één asset op id */
export function getAtmosphere(id: string): AtmosphereAsset | undefined {
  return ATMOSPHERE.find((a) => a.id === id)
}

/** Filter op categorie */
export function getAtmosphereByCategorie(
  categorie: AtmosphereCategorie,
): AtmosphereAsset[] {
  return ATMOSPHERE.filter((a) => a.categorie.includes(categorie))
}

/** Filter op scherm */
export function getAtmosphereByScherm(
  scherm: SchermCategorie,
): AtmosphereAsset[] {
  return ATMOSPHERE.filter((a) => a.paginaVoorkeur.includes(scherm))
}

/**
 * Het ene Vandaag-hero-beeld — warme training-sfeer,
 * licht genoeg om zonder zware overlay te werken.
 * Vervang dit id zodra een andere keuze gemaakt wordt.
 */
export const VANDAAG_HERO_ID = "training-renster-bos"

export const VANDAAG_HERO = getAtmosphere(VANDAAG_HERO_ID)!
