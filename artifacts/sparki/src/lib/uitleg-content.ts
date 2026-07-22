// Centrale registry voor uitleg in drie niveaus: Wat / Waarom / Hoe.
// Eén bron van waarheid zodat dezelfde grafiek of metric overal in de app
// dezelfde eerlijke uitleg krijgt. Plain Dutch, geen jargon zonder uitleg.

export type Uitleg = {
  /** Wat zie je hier? Eén à twee zinnen. */
  wat: string
  /** Waarom is dit belangrijk voor jou? */
  waarom: string
  /** Hoe gebruik je dit / hoe wordt het berekend? */
  hoe: string
}

export const UITLEG: Record<string, Uitleg> = {
  vermogen: {
    wat: "Je vermogen in watt door de rit heen: hoe hard je op elk moment op de pedalen drukte.",
    waarom: "Vermogen is de eerlijkste maat voor je inspanning — wind, helling en vermoeidheid vertekenen het niet, in tegenstelling tot snelheid.",
    hoe: "Gemeten door je vermogensmeter en per stukje van de rit gemiddeld. Gaten in de lijn zijn momenten waarop de meter even niets doorgaf — die vullen we niet in.",
  },
  hartslag: {
    wat: "Je hartslag in slagen per minuut door de rit heen.",
    waarom: "Je hartslag laat zien wat de inspanning met je lichaam doet. Dezelfde wattage bij een lagere hartslag betekent dat je conditie groeit.",
    hoe: "Gemeten door je hartslagband of horloge. Vergelijk hem met je vermogen: loopt je hartslag op terwijl je vermogen gelijk blijft, dan raak je vermoeid of gedehydrateerd.",
  },
  cadans: {
    wat: "Hoe snel je trapt, in omwentelingen per minuut.",
    waarom: "Je traptempo bepaalt of de belasting op je spieren of op je hart-longsysteem ligt. Grote schommelingen kosten energie.",
    hoe: "Gemeten door je cadanssensor. De meeste renners zitten comfortabel tussen 80 en 95; er is geen 'perfect' getal — kijk naar wat bij jou past.",
  },
  snelheid: {
    wat: "Je snelheid in kilometer per uur door de rit heen.",
    waarom: "Snelheid vertelt hoe de rit verliep, maar zegt weinig over je inspanning: wind en hellingen vertekenen sterk.",
    hoe: "Gemeten door je fietscomputer, of afgeleid uit de afgelegde afstand als er geen snelheidssensor was — dat staat er dan eerlijk bij.",
  },
  hoogte: {
    wat: "Het hoogteprofiel van je rit in meters.",
    waarom: "Hellingen verklaren pieken in je vermogen en hartslag. Leg deze lijn naast de andere grafieken om je rit te begrijpen.",
    hoe: "Gemeten door de barometer of GPS van je fietscomputer.",
  },
  temperatuur: {
    wat: "De temperatuur tijdens je rit, gemeten door je fietscomputer.",
    waarom: "Warmte verhoogt je hartslag bij hetzelfde vermogen en vergroot je vochtverlies. Een zware dag kan gewoon een warme dag zijn geweest.",
    hoe: "Gemeten door de sensor in je fietscomputer. Die reageert traag en zit dicht op het stuur — zie het als een indicatie.",
  },
  vermogenszones: {
    wat: "Hoeveel tijd je in elke vermogenszone reed, van herstel (Z1) tot anaeroob (Z6).",
    waarom: "Elke zone traint iets anders. De verdeling laat zien of de rit deed wat hij moest doen: een duurrit hoort vooral Z1–Z2 te zijn, een intervaltraining laat blokken Z4–Z5 zien.",
    hoe: "Berekend uit je gemeten vermogen en je FTP (drempelvermogen). Kloppen je zones niet, controleer dan je FTP bij je profiel.",
  },
  hartslagzones: {
    wat: "Hoeveel tijd je in elke hartslagzone zat, van zeer licht tot maximaal.",
    waarom: "Zonder vermogensmeter is dit de beste maat voor hoe zwaar de rit werkelijk was.",
    hoe: "Berekend uit je gemeten hartslag en je maximale hartslag. Klopt de verdeling niet, controleer dan je maximale hartslag bij je profiel.",
  },
  hartslagdrift: {
    wat: "Hoeveel je hartslag opkroop ten opzichte van je vermogen tussen de eerste en tweede helft van de rit.",
    waarom: "Weinig drift (onder 5%) betekent dat je duurvermogen sterk is. Veel drift wijst op vermoeidheid, te weinig drinken of een te hoog tempo voor de duur.",
    hoe: "We vergelijken vermogen-per-hartslag in de eerste helft met de tweede helft. Hiervoor zijn zowel vermogen als hartslag nodig.",
  },
  vermogensverval: {
    wat: "Het verschil tussen je vermogen aan het begin en aan het einde van de rit.",
    waarom: "Zakt je vermogen flink in, dan was het tempo te hoog, at of dronk je te weinig, of mist er nog duurbasis. Een sterker einde is juist een teken van goede pacing.",
    hoe: "We vergelijken het gemiddelde vermogen van het eerste derde deel met het laatste derde deel van de rit.",
  },
  pacing: {
    wat: "Hoe gelijkmatig je je inspanning verdeelde over de rit.",
    waarom: "Gelijkmatig rijden is bijna altijd sneller en zuiniger. Veel korte uitschieters kosten energie die je aan het einde mist.",
    hoe: "Berekend als de variatie van je vermogen rond je gemiddelde. Bij een intervaltraining hoort de variatie hoog te zijn — dat is dan geen probleem.",
  },
  intervallen: {
    wat: "De werkblokken die in je vermogen terug te vinden zijn, naast wat er gepland stond.",
    waarom: "Zo zie je of je de training uitvoerde zoals bedoeld: haalde je het doelvermogen, en hield je het vol tot het laatste blok?",
    hoe: "We zoeken in je vermogen naar aaneengesloten stukken die duidelijk boven je ritgemiddelde liggen en leggen die naast de geplande blokken.",
  },
  vergelijkbaarheid: {
    wat: "Of twee sessies eerlijk naast elkaar gezet kunnen worden.",
    waarom: "Een korte intervaltraining vergelijken met een lange bergrit zegt niets. Alleen een eerlijke vergelijking levert een bruikbare conclusie op.",
    hoe: "We controleren het soort training, de duur, het terrein en of beide ritten dezelfde meting hebben (vermogen of hartslag). Verschilt dat te veel, dan zeggen we dat eerlijk.",
  },
}
