// SPARKI_BUILD_04 F4 — rolcatalogus begeleidingsdocumenten (3c0, G t/m L).
//
// Eén register op de gedeelde werkobjectlaag: per rol de toegestane
// objecttypen. GEEN eigen documentmodel, geen 96 losse modules — dit is
// uitsluitend de catalogus + validatie. Gedeelde typen (bv. weekplan,
// voortgangsrapport) bestaan één keer en staan in meerdere catalogi.
//
// Plannen dragen daarnaast het 18-onderdelencontract uit 3c.2; de laatste
// vier (AI-concept, brondata, onzekerheid, menselijke bevestiging) zijn de
// kern: een plan-sjabloon zonder die secties is ongeldig.

export const ROLE_CATALOGS = {
  // G. Trainer (21)
  trainer: [
    "intake",
    "doelenoverzicht",
    "jaarplan",
    "seizoensplan",
    "trainingsblok",
    "weekplan",
    "dagsessie",
    "groepsplan",
    "individuele_afwijking",
    "testprotocol",
    "testverslag",
    "ftp_zoneverslag",
    "voortgangsrapport",
    "hersteladvies",
    "wedstrijdvoorbereiding",
    "wedstrijdanalyse",
    "sporterbespreking",
    "ouderbriefing",
    "trainersevaluatie",
    "overdrachtsdocument",
    "eindrapport_begeleiding",
  ],
  // H. Hoofdtrainer (15) — staffevaluatie/trainerbespreking: geen geheime
  // personeelsbeoordeling; wie beoordeeld wordt kan dat weten, een score
  // wordt nooit een automatische beslissing.
  hoofdtrainer: [
    "jaarplanning",
    "seizoensstrategie",
    "groepsindeling",
    "trainerstoewijzing",
    "trainerbespreking",
    "sporterbespreking",
    "talentontwikkeling",
    "selectiekader",
    "wedstrijdprogramma",
    "trainingskwaliteitsoverzicht",
    "staffevaluatie",
    "teamoverstijgende_analyse",
    "seizoensevaluatie",
    "organisatie_lessons_learned",
    "overdracht_volgend_seizoen",
  ],
  // I. Medical staff (12) — de twee geschiktheidsberichten zijn de enige
  // uitgang naar niet-medische rollen: geschiktheid, nooit de medische reden.
  medical_staff: [
    "inzetbaarheidsstatus",
    "toestemmingsverzoek",
    "blessuremelding",
    "praktische_beperking",
    "hersteltraject",
    "terugkeer_naar_sportplan",
    "noodinformatie",
    "incidentrapport",
    "medische_overdracht",
    "evaluatie_hersteltraject",
    "geschiktheidsbericht_trainer",
    "geschiktheidsbericht_ploegleider",
  ],
  // J. Ouder en minderjarige (14)
  ouder: [
    "toestemmingsformulier",
    "ouderinformatie",
    "ouderbriefing",
    "sporterbriefing",
    "vervoersbevestiging",
    "aanwezigheidsbevestiging",
    "noodcontactformulier",
    "wedstrijdinformatie",
    "trainingsinformatie",
    "voortgangsrapport",
    "wijzigingsmelding",
    "incidentinformatie",
    "consentintrekking",
    "overdracht_meerderjarigheid",
  ],
  // K. Zelfstandige trainer (22) — klantkaart en sporterkaart zijn twee
  // documenten omdat klant en sporter twee entiteiten zijn (BB-62).
  zelfstandige_trainer: [
    "trainerprofiel",
    "begeleidingsvoorstel",
    "overeenkomst",
    "klantkaart",
    "sporterkaart",
    "intake",
    "doelenplan",
    "jaarplan",
    "weekplan",
    "trainingsplan",
    "testverslag",
    "voortgangsrapport",
    "wedstrijdvoorbereiding",
    "wedstrijdanalyse",
    "evaluatie",
    "eindrapport",
    "overdracht",
    "coachingfactuur",
    "aanvullende_dienstenfactuur",
    "creditnota",
    "betaalherinnering",
    "boekhoudersexport",
  ],
  // L. Sporter (12) — het consentoverzicht is geen extraatje: de sporter moet
  // kunnen zien welke gegevens over hem bestaan en met wie ze gedeeld zijn.
  sporter: [
    "persoonlijk_doelenoverzicht",
    "trainingsweek",
    "wedstrijdbriefing",
    "eigen_taken",
    "eigen_materiaalcheck",
    "eigen_voedingsplan",
    "aanwezigheidsbevestiging",
    "feedbackformulier",
    "wedstrijdevaluatie",
    "voortgangsoverzicht",
    "persoonlijke_rapporten",
    "gegevens_consentoverzicht",
  ],
} as const;

export type CatalogRole = keyof typeof ROLE_CATALOGS;

// Plantypen die het 18-onderdelencontract (3c.2) dragen.
export const PLAN_TYPES = new Set([
  "jaarplan",
  "seizoensplan",
  "trainingsblok",
  "weekplan",
  "dagsessie",
  "groepsplan",
  "doelenplan",
  "trainingsplan",
  "jaarplanning",
  "trainingsweek",
  "terugkeer_naar_sportplan",
]);

// 3c.2 — de achttien planonderdelen; de laatste vier zijn de kern.
export const PLAN_SECTIONS = [
  "doel",
  "periode",
  "uitgangssituatie",
  "beschikbare_tijd",
  "beperkingen",
  "prioriteiten",
  "trainingen",
  "belasting",
  "herstel",
  "wedstrijden",
  "evaluatiemomenten",
  "afwijkingen",
  "trainernotities",
  "sporterfeedback",
  "ai_concept",
  "brondata",
  "onzekerheid",
  "menselijke_bevestiging",
] as const;

export function isTypeAllowedForRole(role: CatalogRole, objectType: string): boolean {
  return (ROLE_CATALOGS[role] as readonly string[]).includes(objectType);
}

export function catalogRolesForType(objectType: string): CatalogRole[] {
  return (Object.keys(ROLE_CATALOGS) as CatalogRole[]).filter((r) =>
    (ROLE_CATALOGS[r] as readonly string[]).includes(objectType),
  );
}
