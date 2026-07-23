// Definitieve, configureerbare juridische teksten. De database (legal_documents)
// is de bron van waarheid; deze module levert de startversie (1.0) en zaait die
// lui op het leespad zodat de teksten er ook zonder handmatige setup staan.
// Nieuwe versies worden als nieuwe rij gepubliceerd (nooit een oude rij wijzigen),
// zodat "geaccepteerd op versie X" altijd verifieerbaar blijft.

import { eq, desc, and } from "drizzle-orm";
import { db, legalDocumentsTable, type LegalDocument } from "@workspace/db";

export const CURRENT_LEGAL_VERSION = "1.0";

const PRIVACY_MD = `# Privacyverklaring Sparki

*Versie 1.0 — geldig vanaf 22 juli 2026*

Sparki is een digitale prestatie-assistent voor wielrenners, hun ouders en coaches. In deze verklaring lees je welke gegevens Sparki verwerkt, waarom, en welke rechten je hebt.

## 1. Wie is verantwoordelijk?
De beheerder van deze Sparki-omgeving is verwerkingsverantwoordelijke voor jouw gegevens. Vragen of verzoeken? Gebruik de knoppen onder **Profiel → Privacy & account** — daar kun je alles direct zelf regelen.

## 2. Welke gegevens verwerken we?
- **Accountgegevens:** e-mailadres, naam, rol (sporter, coach, ouder).
- **Sportprofiel:** geboortedatum, gewicht, FTP, trainingsuren, doelen.
- **Trainingsdata:** ritten, vermogen, hartslag, slaap en herstel — alleen uit bronnen die jij zelf koppelt of uploadt.
- **Gezondheidssignalen:** door jou ingevoerde welzijns- en gezondheidsmeldingen.
- **Gesprekken met Sparki:** jouw vragen en Sparki's antwoorden, als geheugen voor betere begeleiding.
- **Technische gegevens:** beveiligingslogboek (inlogacties, toestemmingswijzigingen, exports) met minimale inhoud.

## 3. Waarvoor gebruiken we je gegevens?
- Persoonlijke trainingsbegeleiding en analyses — het doel van de app.
- Delen met jouw coach of ouder, **uitsluitend** binnen het niveau dat jij instelt.
- Beveiliging en misbruikpreventie (auditlog, limieten op verzoeken).
We verkopen je gegevens nooit en gebruiken ze niet voor advertenties.

## 4. Automatische analyse
Sparki analyseert je trainingsdata automatisch om advies te geven. Je kunt deze verwerking van gevoelige signalen en het geheugen uitschakelen onder **Profiel → Privacy & account**. Advies is nooit een medisch oordeel.

## 5. Delen met anderen
- **Coach:** ziet alleen wat jij instelt (niets, samenvatting, of volledig).
- **Ouder:** ziet alleen veiligheids- en welzijnssignalen, tenzij jij meer toestaat. Prestatie- en gezondheidsdetails worden nooit automatisch gedeeld.
- **Club:** heeft geen directe toegang; een club kijkt alleen mee via een gekoppelde coach, binnen jouw coach-instelling.
- **Externe diensten (zoals Strava):** alleen na jouw koppeling; toegangssleutels worden versleuteld opgeslagen en je kunt de koppeling altijd intrekken.

## 6. Minderjarigen
Ben je jonger dan 16, dan is toestemming van een ouder of voogd vereist voordat gegevens met een coach gedeeld worden. Ouders zien nooit automatisch prestatie- of gezondheidsdetails. Elke wijziging in toestemming wordt vastgelegd in het auditlog.

## 7. Bewaartermijnen
Je gegevens blijven bewaard zolang je account bestaat. Na accountverwijdering worden je gegevens binnen de hersteltermijn van 14 dagen definitief verwijderd. Beveiligings-auditregels blijven bewaard als wettelijk bewijs; ze bevatten geen inhoudelijke persoonsgegevens.

## 8. Jouw rechten
Onder **Profiel → Privacy & account** kun je direct:
- al je gegevens inzien en corrigeren;
- een volledige export downloaden;
- gekoppelde databronnen intrekken;
- actieve sessies beëindigen;
- je account verwijderen (met 14 dagen hersteltermijn).
Daarnaast heb je het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens.

## 9. Beveiliging
Toegangssleutels van externe diensten worden versleuteld opgeslagen (AES-256). Toegang tot jouw gegevens is per rol afgeschermd en wordt gelogd. Verzoeken worden begrensd om misbruik te voorkomen.

## 10. Wijzigingen
Bij een nieuwe versie van deze verklaring vragen we opnieuw je akkoord. De versie en datum van jouw akkoord worden vastgelegd.`;

const TERMS_MD = `# Gebruiksvoorwaarden Sparki

*Versie 1.0 — geldig vanaf 22 juli 2026*

## 1. Wat is Sparki?
Sparki is een digitale prestatie-assistent voor wielrenners. Sparki geeft trainings-, voedings- en herstelinzichten op basis van jouw eigen gegevens.

## 2. Geen medisch advies
Sparki's adviezen zijn sportbegeleiding, geen medische zorg. Raadpleeg bij gezondheidsklachten, blessures of twijfel altijd een arts. Volg nooit een advies op dat tegen het oordeel van een arts of je eigen lichaam ingaat.

## 3. Jouw account
- Je bent zelf verantwoordelijk voor de juistheid van je gegevens en het vertrouwelijk houden van je inloggegevens.
- Ben je jonger dan 16, dan is toestemming van een ouder of voogd vereist.
- Eén persoon per account; deel je account niet.

## 4. Eerlijk gebruik
Het is niet toegestaan Sparki te gebruiken om anderen te schaden, beveiligingen te omzeilen, andermans gegevens op te vragen of de dienst te overbelasten. Misbruik kan leiden tot blokkering.

## 5. Jouw data blijft van jou
Jij bepaalt wat je deelt en met wie. Je kunt je gegevens altijd exporteren en je account verwijderen. Door gegevens te uploaden geef je Sparki alleen het recht die te verwerken om jou te begeleiden — niets meer.

## 6. Rollen en toegang
Coaches, ouders en clubs zien uitsluitend wat de sporter expliciet toestaat. Bestaande toegang wordt nooit verruimd zonder nieuwe expliciete toestemming van de sporter.

## 7. Beschikbaarheid
Sparki wordt met zorg gebouwd, maar we garanderen geen ononderbroken beschikbaarheid. Gekoppelde externe diensten (zoals Strava) vallen buiten onze controle.

## 8. Aansprakelijkheid
Sparki is niet aansprakelijk voor schade door het opvolgen van trainingsadviezen tegen medisch advies in, door onjuist aangeleverde gegevens, of door storingen bij externe diensten — behalve waar de wet dit dwingend anders bepaalt.

## 9. Wijzigingen
Bij belangrijke wijzigingen van deze voorwaarden vragen we opnieuw je akkoord; de versie en datum van je akkoord worden vastgelegd.

## 10. Toepasselijk recht
Op deze voorwaarden is Nederlands recht van toepassing.`;

const GEZONDHEID_MD = `# Gezondheids- en trainingsdisclaimer Sparki

*Versie 1.0 — geldig vanaf 23 juli 2026*

## 1. Sportbegeleiding, geen medische zorg
Sparki geeft trainings-, voedings- en herstelinzichten op basis van jouw eigen gegevens. Dit is sportbegeleiding — géén medisch advies, diagnose of behandeling.

## 2. Raadpleeg bij twijfel een arts
Heb je gezondheidsklachten, een blessure, pijn op de borst, duizeligheid, een chronische aandoening of twijfel je over je belastbaarheid? Raadpleeg dan altijd eerst een arts of sportarts voordat je (verder) traint.

## 3. Luister naar je lichaam
Volg nooit een trainingsadvies op dat tegen het oordeel van een arts of tegen duidelijke signalen van je eigen lichaam ingaat. Stop bij alarmsignalen en zoek zo nodig direct medische hulp.

## 4. Eigen verantwoordelijkheid
Trainen brengt altijd risico's mee. Jij (of je ouder/voogd als je minderjarig bent) blijft zelf verantwoordelijk voor de beslissing om een training, wedstrijd of route uit te voeren, en voor veilige omstandigheden onderweg (verkeer, weer, materiaal).

## 5. Gegevens zijn hulpmiddelen
Vermogens-, hartslag- en herstelwaarden in Sparki zijn hulpmiddelen op basis van de door jou gekoppelde bronnen. Ze kunnen onvolledig of onnauwkeurig zijn en vervangen nooit een medisch oordeel.

## 6. Wijzigingen
Bij een nieuwe versie van deze disclaimer vragen we opnieuw je akkoord. De versie en datum van jouw akkoord worden vastgelegd.`;

// ── Centraal register van verplichte documenten ──────────────────────────────
// Dit is de enige plek die bepaalt welke documenten verplicht geaccepteerd
// moeten zijn. De actieve versie per document komt uit legal_documents
// (hoogste published_at); een nieuwe verplichte versie = nieuwe rij publiceren.
export const REQUIRED_LEGAL_KINDS = ["terms", "privacy", "gezondheid"] as const;
export type RequiredLegalKind = (typeof REQUIRED_LEGAL_KINDS)[number];

export function isRequiredLegalKind(kind: string): kind is RequiredLegalKind {
  return (REQUIRED_LEGAL_KINDS as readonly string[]).includes(kind);
}

const SEEDS: Array<{ kind: RequiredLegalKind; title: string; bodyMd: string }> = [
  { kind: "privacy", title: "Privacyverklaring", bodyMd: PRIVACY_MD },
  { kind: "terms", title: "Gebruiksvoorwaarden", bodyMd: TERMS_MD },
  {
    kind: "gezondheid",
    title: "Gezondheids- en trainingsdisclaimer",
    bodyMd: GEZONDHEID_MD,
  },
];

/** Actieve (nieuwste) versie van een juridisch document; zaait versie 1.0 indien afwezig. */
export async function getActiveLegalDocument(
  kind: RequiredLegalKind,
): Promise<LegalDocument> {
  const [existing] = await db
    .select()
    .from(legalDocumentsTable)
    .where(eq(legalDocumentsTable.kind, kind))
    .orderBy(desc(legalDocumentsTable.publishedAt))
    .limit(1);
  if (existing) return existing;
  const seed = SEEDS.find((s) => s.kind === kind)!;
  await db
    .insert(legalDocumentsTable)
    .values({
      kind,
      version: CURRENT_LEGAL_VERSION,
      title: seed.title,
      bodyMd: seed.bodyMd,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(legalDocumentsTable)
    .where(
      and(
        eq(legalDocumentsTable.kind, kind),
        eq(legalDocumentsTable.version, CURRENT_LEGAL_VERSION),
      ),
    );
  return row!;
}
