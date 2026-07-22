// Centrale registry voor uitleg in drie niveaus: Wat / Waarom / Hoe.
// Eén bron van waarheid zodat dezelfde grafiek of metric overal in de app
// dezelfde eerlijke uitleg krijgt. Plain Dutch, geen jargon zonder uitleg.
//
// Regels:
// - Dezelfde term gebruikt overal dezelfde key en dus dezelfde basisdefinitie.
// - Persoonlijke context komt uit buildUitlegContextRegels (eerlijk: echte
//   waarden, benoemt wat ontbreekt, verzint niets, geen medische diagnose).
// - Bij inhoudelijke tekstwijziging: verhoog `versie`.

export type Uitleg = {
  /** Wat zie je hier? Eén à twee zinnen. */
  wat: string
  /** Waarom is dit belangrijk voor jou? */
  waarom: string
  /** Hoe gebruik je dit / hoe wordt het berekend? */
  hoe: string
  /**
   * Versie van deze uitlegtekst. Verhoog dit veld bij iedere inhoudelijke
   * wijziging, zodat uitleg gecontroleerd kan veranderen zonder dat oude
   * analyses met terugwerkende kracht een andere betekenis krijgen.
   */
  versie: number
}

export const UITLEG: Record<string, Uitleg> = {
  vermogen: {
    wat: "Je vermogen in watt door de rit heen: hoe hard je op elk moment op de pedalen drukte.",
    waarom: "Vermogen is de eerlijkste maat voor je inspanning — wind, helling en vermoeidheid vertekenen het niet, in tegenstelling tot snelheid.",
    hoe: "Gemeten door je vermogensmeter en per stukje van de rit gemiddeld. Gaten in de lijn zijn momenten waarop de meter even niets doorgaf — die vullen we niet in.",
    versie: 1,
  },
  hartslag: {
    wat: "Je hartslag in slagen per minuut door de rit heen.",
    waarom: "Je hartslag laat zien wat de inspanning met je lichaam doet. Dezelfde wattage bij een lagere hartslag betekent dat je conditie groeit.",
    hoe: "Gemeten door je hartslagband of horloge. Vergelijk hem met je vermogen: loopt je hartslag op terwijl je vermogen gelijk blijft, dan raak je vermoeid of gedehydrateerd.",
    versie: 1,
  },
  cadans: {
    wat: "Hoe snel je trapt, in omwentelingen per minuut.",
    waarom: "Je traptempo bepaalt of de belasting op je spieren of op je hart-longsysteem ligt. Grote schommelingen kosten energie.",
    hoe: "Gemeten door je cadanssensor. De meeste renners zitten comfortabel tussen 80 en 95; er is geen 'perfect' getal — kijk naar wat bij jou past.",
    versie: 1,
  },
  snelheid: {
    wat: "Je snelheid in kilometer per uur door de rit heen.",
    waarom: "Snelheid vertelt hoe de rit verliep, maar zegt weinig over je inspanning: wind en hellingen vertekenen sterk.",
    hoe: "Gemeten door je fietscomputer, of afgeleid uit de afgelegde afstand als er geen snelheidssensor was — dat staat er dan eerlijk bij.",
    versie: 1,
  },
  hoogte: {
    wat: "Het hoogteprofiel van je rit in meters.",
    waarom: "Hellingen verklaren pieken in je vermogen en hartslag. Leg deze lijn naast de andere grafieken om je rit te begrijpen.",
    hoe: "Gemeten door de barometer of GPS van je fietscomputer.",
    versie: 1,
  },
  temperatuur: {
    wat: "De temperatuur tijdens je rit, gemeten door je fietscomputer.",
    waarom: "Warmte verhoogt je hartslag bij hetzelfde vermogen en vergroot je vochtverlies. Een zware dag kan gewoon een warme dag zijn geweest.",
    hoe: "Gemeten door de sensor in je fietscomputer. Die reageert traag en zit dicht op het stuur — zie het als een indicatie.",
    versie: 1,
  },
  vermogenszones: {
    wat: "Hoeveel tijd je in elke vermogenszone reed, van herstel (Z1) tot anaeroob (Z6).",
    waarom: "Elke zone traint iets anders. De verdeling laat zien of de rit deed wat hij moest doen: een duurrit hoort vooral Z1–Z2 te zijn, een intervaltraining laat blokken Z4–Z5 zien.",
    hoe: "Berekend uit je gemeten vermogen en je FTP (drempelvermogen). Kloppen je zones niet, controleer dan je FTP bij je profiel.",
    versie: 1,
  },
  hartslagzones: {
    wat: "Hoeveel tijd je in elke hartslagzone zat, van zeer licht tot maximaal.",
    waarom: "Zonder vermogensmeter is dit de beste maat voor hoe zwaar de rit werkelijk was.",
    hoe: "Berekend uit je gemeten hartslag en je maximale hartslag. Klopt de verdeling niet, controleer dan je maximale hartslag bij je profiel.",
    versie: 1,
  },
  hartslagdrift: {
    wat: "Hoeveel je hartslag opkroop ten opzichte van je vermogen tussen de eerste en tweede helft van de rit.",
    waarom: "Weinig drift (onder 5%) betekent dat je duurvermogen sterk is. Veel drift wijst op vermoeidheid, te weinig drinken of een te hoog tempo voor de duur.",
    hoe: "We vergelijken vermogen-per-hartslag in de eerste helft met de tweede helft. Hiervoor zijn zowel vermogen als hartslag nodig.",
    versie: 1,
  },
  vermogensverval: {
    wat: "Het verschil tussen je vermogen aan het begin en aan het einde van de rit.",
    waarom: "Zakt je vermogen flink in, dan was het tempo te hoog, at of dronk je te weinig, of mist er nog duurbasis. Een sterker einde is juist een teken van goede pacing.",
    hoe: "We vergelijken het gemiddelde vermogen van het eerste derde deel met het laatste derde deel van de rit.",
    versie: 1,
  },
  pacing: {
    wat: "Hoe gelijkmatig je je inspanning verdeelde over de rit.",
    waarom: "Gelijkmatig rijden is bijna altijd sneller en zuiniger. Veel korte uitschieters kosten energie die je aan het einde mist.",
    hoe: "Berekend als de variatie van je vermogen rond je gemiddelde. Bij een intervaltraining hoort de variatie hoog te zijn — dat is dan geen probleem.",
    versie: 1,
  },
  intervallen: {
    wat: "De werkblokken die in je vermogen terug te vinden zijn, naast wat er gepland stond.",
    waarom: "Zo zie je of je de training uitvoerde zoals bedoeld: haalde je het doelvermogen, en hield je het vol tot het laatste blok?",
    hoe: "We zoeken in je vermogen naar aaneengesloten stukken die duidelijk boven je ritgemiddelde liggen en leggen die naast de geplande blokken.",
    versie: 1,
  },
  vergelijkbaarheid: {
    wat: "Of twee sessies eerlijk naast elkaar gezet kunnen worden.",
    waarom: "Een korte intervaltraining vergelijken met een lange bergrit zegt niets. Alleen een eerlijke vergelijking levert een bruikbare conclusie op.",
    hoe: "We controleren het soort training, de duur, het terrein en of beide ritten dezelfde meting hebben (vermogen of hartslag). Verschilt dat te veel, dan zeggen we dat eerlijk.",
    versie: 1,
  },

  // — Kerngetallen & belastingsmodel —
  ftp: {
    wat: "Je FTP (drempelvermogen): het vermogen in watt dat je ongeveer een uur vol kunt houden.",
    waarom: "Je FTP is het ankerpunt van je training: zones, belastingsscores en trainingsadvies worden er allemaal uit berekend. Klopt je FTP niet, dan klopt de rest ook niet.",
    hoe: "Uit een test, een schatting of afgeleid uit je beste inspanningen. Een geschatte FTP is een ondergrens, geen exacte meting — dat staat er dan eerlijk bij.",
    versie: 1,
  },
  belasting: {
    wat: "De belastingsscore (TSS) van een training: hoe zwaar die was voor jouw lichaam, in één getal.",
    waarom: "Zo tellen een korte intensieve training en een lange rustige rit eerlijk mee in hetzelfde model. Rond de 100 staat voor een uur voluit op je drempel.",
    hoe: "Berekend uit je vermogen ten opzichte van je FTP en de duur van de rit. Zonder vermogensmeter schatten we hem uit hartslag of duur — dat is grover en staat er eerlijk bij.",
    versie: 1,
  },
  fitheid: {
    wat: "Je fitheid (CTL): het voortschrijdend gemiddelde van je trainingsbelasting over ongeveer zes weken.",
    waarom: "Dit is je opgebouwde basis. Een stijgende lijn betekent dat je lichaam went aan meer werk; na een rustperiode zakt hij langzaam terug.",
    hoe: "Berekend uit je dagelijkse belastingsscores met een gewogen gemiddelde over 42 dagen. Ontbrekende trainingen tellen als nul — koppel je bronnen om het beeld compleet te houden.",
    versie: 1,
  },
  vermoeidheid: {
    wat: "Je vermoeidheid (ATL): het voortschrijdend gemiddelde van je belasting over de laatste dagen.",
    waarom: "Dit getal reageert snel: een zwaar blok jaagt hem omhoog, een paar rustige dagen laten hem zakken. Hoge vermoeidheid vlak voor een wedstrijd is onhandig.",
    hoe: "Zelfde berekening als fitheid, maar over 7 dagen in plaats van 42. Daardoor beweegt hij veel sneller.",
    versie: 1,
  },
  vorm: {
    wat: "Je vorm (TSB): het verschil tussen je fitheid en je vermoeidheid.",
    waarom: "Positief betekent fris (goed voor wedstrijden), licht negatief hoort bij een trainingsblok, sterk negatief is een signaal om herstel in te plannen.",
    hoe: "Vorm = fitheid min vermoeidheid, berekend per dag. Het is een model op basis van je geregistreerde trainingen — geen meting van hoe je je voelt.",
    versie: 1,
  },
  readiness: {
    wat: "Hoe klaar je lichaam vandaag is om te trainen, op basis van je eigen check-in.",
    waarom: "Trainen op een dag dat je lichaam eraan toe is levert meer op. Op een slechte dag is aanpassen slimmer dan doorduwen.",
    hoe: "Berekend uit je check-in: gevoel, slaapkwaliteit en vermoeidheid. Alleen ingevulde onderdelen tellen mee; zonder check-in is er geen score. Het is een hulpmiddel, geen medisch oordeel.",
    versie: 1,
  },
  herstel: {
    wat: "Hoe goed je lichaam bijkomt van eerdere trainingen.",
    waarom: "Trainen prikkelt, maar het herstel erna maakt je sterker. Structureel te weinig herstel breekt meer af dan het opbouwt.",
    hoe: "Afgeleid uit je vorm (fitheid versus vermoeidheid), je check-ins en je recente trainingspatroon. Voel je je langdurig uitgeput of ziek, bespreek dat dan met een arts — dat kan deze app niet beoordelen.",
    versie: 1,
  },
  trainingsadvies: {
    wat: "Wat vandaag de meest zinvolle training voor je is.",
    waarom: "Het advies weegt je opbouw, je vermoeidheid en je doel tegen elkaar af, zodat je niet hoeft te gokken wat vandaag verstandig is.",
    hoe: "Opgebouwd uit vaste, controleerbare regels over je belasting, je vorm, je check-in en je geplande wedstrijden. Ontbreekt er data, dan wordt het advies voorzichtiger en staat erbij wat er mist. Jij beslist altijd zelf.",
    versie: 1,
  },
  performanceRadar: {
    wat: "Je capaciteitsprofiel over zes signalen: fitheid, vorm, herstel, vermogen, gevoel en regelmaat.",
    waarom: "Eén getal zegt weinig over een renner. Zes assen naast elkaar laten zien waar je sterk bent en waar ruimte zit — zonder een verzonnen totaalscore.",
    hoe: "Iedere as wordt berekend uit echte data: fitheid/vorm/herstel uit je belastingsmodel (90 dagen), vermogen uit je FTP en gewicht (W/kg, schaal 2,0–5,5), gevoel en regelmaat uit je sessies van de laatste 28 dagen. Ontbreekt de data voor een as, dan wordt die as niet getekend en staat eronder wat er mist.",
    versie: 1,
  },
  readinessTrend: {
    wat: "Het verloop van je dagelijkse gevoel-score uit je check-ins, over de gekozen periode.",
    waarom: "Eén slechte dag zegt weinig; een dalende lijn over weken wel. De trend laat zien of je opbouw vol te houden is.",
    hoe: "Iedere ingevulde check-in telt als één punt (gevoel 1–5, getoond als 0–100). Dagen zonder check-in ontbreken gewoon in de lijn — er wordt niets ingevuld of geschat.",
    versie: 1,
  },
  hrvTrend: {
    wat: "Het verloop van je hartritmevariatie (HRV) uit je check-ins, in milliseconden.",
    waarom: "Een dalende HRV over meerdere dagen kan wijzen op oplopende vermoeidheid of stress. De trend zegt meer dan één losse meting.",
    hoe: "Alleen zelf ingevoerde HRV-waarden uit je check-in tellen mee, over de gekozen periode. Dagen zonder meting ontbreken in de lijn. Vergelijk vooral met je eigen normale waarden — HRV verschilt sterk per persoon.",
    versie: 1,
  },
  ftpOntwikkeling: {
    wat: "Je huidige FTP uit je Sportpaspoort, met daaronder je geregistreerde tests en metingen door de tijd.",
    waarom: "Zo zie je of je drempelvermogen zich ontwikkelt. De grote waarde is altijd dezelfde als in je Sportpaspoort — er bestaat maar één FTP in Sparki.",
    hoe: "De balken zijn je FTP-registraties (tests, schattingen, correcties) op datum. Pas je je FTP aan in je Sportpaspoort, dan verandert hij hier automatisch mee.",
    versie: 1,
  },
  records: {
    wat: "Je beste vermogens over vaste tijdsduren, van 5 seconden tot 20 minuten.",
    waarom: "Je records laten zien waar je sterk bent (sprint, aanval of duurvermogen) en of je vooruitgaat ten opzichte van eerder.",
    hoe: "Berekend uit het volledige vermogenssignaal van geïmporteerde ritbestanden. Ritten zonder vermogensmeting of zonder bestand tellen niet mee — records kunnen dus onvolledig zijn.",
    versie: 1,
  },
  materiaalstatus: {
    wat: "De staat van je fiets en onderdelen op basis van hun werkelijke gebruik.",
    waarom: "Slijtage sluipt erin. Een ketting op tijd vervangen is goedkoper dan een versleten cassette, en veiliger dan een falende remblok.",
    hoe: "Kilometers en uren komen live uit je gekoppelde ritten. Drempels per onderdeel geven een controleadvies; een defect komt alleen uit je eigen melding — nooit uit een gok.",
    versie: 1,
  },
  wedstrijdanalyse: {
    wat: "De analyse van je wedstrijd: verloop, sterke momenten en verbeterpunten.",
    waarom: "Een wedstrijd is de eerlijkste test. De analyse maakt van een gevoel ('zwaar') een concreet verhaal waar je volgende voorbereiding beter van wordt.",
    hoe: "Gebaseerd op de gekoppelde activiteit (vermogen, hartslag, verloop), de wedstrijdgegevens en je eigen terugblik. Ontbreekt de activiteit of een meting, dan blijft dat deel eerlijk leeg.",
    versie: 1,
  },
  voedingsadvies: {
    wat: "Wat en hoeveel je rond je training het beste kunt eten en drinken.",
    waarom: "Goed gevoed trainen levert meer op en voorkomt de man met de hamer. Vooral bij lange of intensieve ritten maakt dit een groot verschil.",
    hoe: "Berekend uit de duur en zwaarte van de training en, waar bekend, je gewicht. Het zijn vuistregels voor sporters — geen dieetadvies en geen medische voedingsbegeleiding.",
    versie: 1,
  },
  onzekerheid: {
    wat: "Hoe zeker de conclusie op deze plek is, en welke gegevens er eventueel ontbreken.",
    waarom: "Een conclusie op halve data verdient minder vertrouwen. Door onzekerheid eerlijk te tonen weet je wanneer je op een getal kunt bouwen.",
    hoe: "Per analyse wordt bijgehouden welke bronnen echt beschikbaar waren. Ontbreekt er iets, dan staat dat erbij en wordt er niets bijverzonnen.",
    versie: 1,
  },
}

export type UitlegKey = keyof typeof UITLEG

// ---------------------------------------------------------------------------
// Persoonlijke context ("Bij jou") — pure functie, eerlijk over wat ontbreekt.
// ---------------------------------------------------------------------------

export type UitlegPersoonlijk = {
  ftp?: number | null
  ftpEstimated?: boolean | null
  weightKg?: number | null
  ctl?: number | null
  atl?: number | null
  tsb?: number | null
  readinessScore?: number | null
  readinessState?: string | null
  /** Aantal ritten met vermogensdata dat meetelt voor records, indien bekend. */
  heeftVermogensdata?: boolean | null
}

const rond = (n: number) => String(Math.round(n))

/**
 * Bouwt eerlijke, persoonlijke regels bij een uitleg-key. Gebruikt alleen
 * meegegeven echte waarden; benoemt expliciet wat ontbreekt of geschat is.
 * Verzint nooit een waarde en trekt geen nieuwe conclusies — de regels
 * beschrijven bestaande getallen, ze veranderen geen enkel advies.
 */
export function buildUitlegContextRegels(
  key: string,
  p: UitlegPersoonlijk | null | undefined,
): string[] {
  if (!p) return []
  const regels: string[] = []

  switch (key) {
    case "ftp":
    case "vermogenszones": {
      if (p.ftp != null && p.ftp > 0) {
        regels.push(
          p.ftpEstimated
            ? `Jouw FTP staat op ${rond(p.ftp)} W. Dit is een schatting — een test of meer ritten met vermogen maken hem preciezer.`
            : `Jouw FTP staat op ${rond(p.ftp)} W.`,
        )
        if (p.weightKg != null && p.weightKg > 0) {
          regels.push(`Per kilo is dat ${(p.ftp / p.weightKg).toFixed(1)} W/kg.`)
        }
      } else {
        regels.push(
          "Je FTP is nog niet bekend. Vul hem in bij je profiel of laat hem schatten — zolang hij ontbreekt kunnen zones en belastingsscores niet worden berekend.",
        )
      }
      break
    }
    case "belasting": {
      if (p.ftp != null && p.ftp > 0) {
        regels.push(
          `Jouw belastingsscores worden berekend met een FTP van ${rond(p.ftp)} W${p.ftpEstimated ? " (schatting)" : ""}.`,
        )
      } else {
        regels.push(
          "Zonder bekende FTP wordt je belasting geschat uit hartslag of duur — dat is grover dan een berekening op vermogen.",
        )
      }
      break
    }
    case "fitheid": {
      if (p.ctl != null) regels.push(`Jouw fitheid staat nu op ${rond(p.ctl)}.`)
      else regels.push("Er is nog te weinig trainingsdata om jouw fitheid te berekenen.")
      break
    }
    case "vermoeidheid": {
      if (p.atl != null) regels.push(`Jouw vermoeidheid staat nu op ${rond(p.atl)}.`)
      else regels.push("Er is nog te weinig trainingsdata om jouw vermoeidheid te berekenen.")
      break
    }
    case "vorm": {
      if (p.tsb != null) {
        const t = Math.round(p.tsb)
        regels.push(
          t > 5
            ? `Jouw vorm staat nu op ${t}: je bent relatief fris.`
            : t < -15
              ? `Jouw vorm staat nu op ${t}: je draagt veel vermoeidheid mee — herstel verdient aandacht.`
              : `Jouw vorm staat nu op ${t}: passend bij een normaal trainingsritme.`,
        )
      } else {
        regels.push("Er is nog te weinig trainingsdata om jouw vorm te berekenen.")
      }
      break
    }
    case "readiness":
    case "herstel": {
      if (p.readinessScore != null) {
        regels.push(
          `Jouw score van vandaag is ${rond(p.readinessScore)} van 100${p.readinessState ? ` (${p.readinessState.toLowerCase()})` : ""}, op basis van je eigen check-in.`,
        )
      } else {
        regels.push(
          "Je hebt vandaag nog geen check-in gedaan, dus er is geen persoonlijke score.",
        )
      }
      break
    }
    case "records": {
      if (p.heeftVermogensdata === false) {
        regels.push(
          "Er zijn nog geen ritten met vermogensdata geïmporteerd, dus records kunnen nog niet worden berekend.",
        )
      }
      break
    }
    case "voedingsadvies": {
      if (p.weightKg != null && p.weightKg > 0) {
        regels.push(`De hoeveelheden zijn afgestemd op jouw gewicht van ${rond(p.weightKg)} kg.`)
      } else {
        regels.push(
          "Je gewicht is niet bekend, dus de hoeveelheden zijn algemene vuistregels in plaats van persoonlijke getallen.",
        )
      }
      break
    }
    default:
      break
  }

  return regels
}
