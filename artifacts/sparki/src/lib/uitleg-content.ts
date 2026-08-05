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
  /** Welke andere data hangt hiermee samen? Eerlijk en concreet. */
  verbanden?: string
  /** Hoe kun je dit positief beïnvloeden? Vuistregels, geen beloftes. */
  beinvloeden?: string
  /**
   * Versie van deze uitlegtekst. Verhoog dit veld bij iedere inhoudelijke
   * wijziging, zodat uitleg gecontroleerd kan veranderen zonder dat oude
   * analyses met terugwerkende kracht een andere betekenis krijgen.
   */
  versie: number
}

export const UITLEG: Record<string, Uitleg> = {
  seizoensdoel: {
    wat: "Je zelf ingestelde gewichtsdoel voor het seizoen (afvallen, aankomen of behoud) met een streefgewicht en de datum waarop het goed moet zitten.",
    waarom: "Dit doel weegt overal mee waar een keuze wordt gemaakt: in je voedingsplan, je dagadvies, je trainingsschema en je analyse. Waar het meeweegt, wordt het ook benoemd — zo zie je dat het doel echt iets doet.",
    hoe: "De sturing is bewust rustig: maximaal 0,5 kg per week, alleen via je gewone maaltijden op rustige momenten. Trainingen worden altijd volledig gevoed — het doel snijdt nooit in je trainingsvoeding. Onder de 17 wordt bewust helemaal niet op gewicht gestuurd.",
    versie: 1,
  },
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
    hoe: "Gemeten door je fietscomputer, of afgeleid uit de afgelegde afstand als er geen snelheidssensor was — dat staat er dan bij.",
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
    verbanden: "Hangt samen met je duurbasis (fitheid), de temperatuur tijdens de rit en je vochtinname. Veel drift op een warme dag hoeft geen conditiegebrek te zijn.",
    beinvloeden: "Meer rustige duurritten verlagen je drift over weken. Tijdens de rit helpen drinken (elke 15–20 min) en een realistisch starttempo direct.",
    versie: 2,
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
    wat: "Of twee sessies goed naast elkaar gezet kunnen worden.",
    waarom: "Een korte intervaltraining vergelijken met een lange bergrit zegt niets. Alleen een eerlijke vergelijking levert een bruikbare conclusie op.",
    hoe: "We controleren het soort training, de duur, het terrein en of beide ritten dezelfde meting hebben (vermogen of hartslag). Verschilt dat te veel, dan staat dat erbij.",
    versie: 1,
  },

  // — Kerngetallen & belastingsmodel —
  ftp: {
    wat: "Je FTP (drempelvermogen): het vermogen in watt dat je ongeveer een uur vol kunt houden.",
    waarom: "Je FTP is het ankerpunt van je training: zones, belastingsscores en trainingsadvies worden er allemaal uit berekend. Klopt je FTP niet, dan klopt de rest ook niet.",
    hoe: "Uit een test, een schatting of afgeleid uit je beste inspanningen. Een geschatte FTP is een ondergrens, geen exacte meting — dat staat er dan bij.",
    versie: 1,
  },
  trainingsvolume: {
    wat: "Je trainingsvolume: hoeveel uur je per week hebt getraind.",
    waarom: "Tijd is de eerlijkste maat voor hoeveel je traint: elke geregistreerde rit heeft een duur, ook zonder vermogensmeter. Zo telt elke echte rit mee in het beeld.",
    hoe: "We tellen de duur van al je geregistreerde trainingen per week bij elkaar op. Alleen wat is vastgelegd telt mee — koppel je bronnen om het beeld compleet te houden.",
    verbanden: "Volume is de motor achter je fitheidslijn en je regelmaat-as in de radar. Een plotse sprong omhoog zie je terug als piek in je vermoeidheid.",
    beinvloeden: "Verhoog geleidelijk (vuistregel: niet meer dan zo'n 10% per week) en houd je aan een vast weekritme. Consistentie over maanden verslaat elke uitschieter-week.",
    versie: 2,
  },
  belastingsverloop: {
    wat: "Twee lijnen door de tijd: je fitheid (wat je lichaam aan training gewend is) en je vermoeidheid (het werk van de laatste dagen).",
    waarom: "Fitheid bouw je in weken op en verlies je langzaam; vermoeidheid komt snel en zakt snel. De afstand tussen de twee lijnen bepaalt je vorm.",
    hoe: "Beide lijnen komen uit hetzelfde belastingsmodel: fitheid is een langzaam gemiddelde (ongeveer 42 dagen) van je dagelijkse belastingsscores, vermoeidheid een snel gemiddelde (ongeveer 7 dagen).",
    verbanden: "Het verschil tussen deze twee lijnen is je vorm (TSB) hieronder; beide worden gevoed door de belastingsscore (TSS) van elke training.",
    beinvloeden: "Regelmatig trainen tilt de fitheidslijn langzaam omhoog; een rustweek laat vooral de vermoeidheidslijn zakken. Grote sprongen in de fitheidslijn zijn niet haalbaar — kleine, volgehouden stappen wel.",
    versie: 1,
  },
  ontkoppeling: {
    wat: "Of je hartslag in de tweede helft van een rit wegloopt terwijl je vermogen gelijk blijft: de verhouding vermogen-per-hartslag tussen de eerste en de tweede helft.",
    waarom: "Dit is de directste maat voor je duuruithoudingsvermogen. Blijft de verhouding stabiel (lage ontkoppeling), dan houdt je lichaam de inspanning goed vol — dit verbetert zichtbaar in een goede winter.",
    hoe: "Per rit vergelijken we vermogen per hartslag in de eerste en tweede helft. Alleen ritten met vermogen én hartslag, minimaal een uur en zonder al te wisselend rijden tellen mee; bij een ongeschikte rit staat de reden erbij in plaats van een getal.",
    verbanden: "Hangt samen met je efficiëntie (zelfde meetbasis) en je belastingsverloop: veel diepe vermoeidheid laat de ontkoppeling tijdelijk oplopen.",
    beinvloeden: "Rustige lange duurritten zijn de motor: wie de winter door consequent onder de drempel rijdt, ziet de ontkoppeling over maanden dalen.",
    versie: 1,
  },
  efficientie: {
    wat: "Hoeveel vermogen je levert per hartslag (watt per slag), per rit, over de tijd gevolgd.",
    waarom: "Stijgt deze verhouding over maanden, dan wordt dezelfde snelheid je letterlijk goedkoper: je hart hoeft minder hard te werken voor dezelfde watts.",
    hoe: "Per geschikte rit delen we je gemiddelde vermogen door je gemiddelde hartslag — met dezelfde selectie-eisen als de ontkoppeling. Vergelijk dit over maanden, niet per rit: warmte, vermoeidheid en cafeïne bewegen de hartslag per dag.",
    verbanden: "Zelfde databron als de ontkoppeling; hangt ook samen met je FTP-ontwikkeling en je gewicht (W/kg).",
    beinvloeden: "Consequente duurtraining en voldoende herstel tillen de lijn langzaam op. Eén rit zegt weinig; de trend over maanden telt.",
    versie: 1,
  },
  opbouwsnelheid: {
    wat: "Hoe snel je fitheid (CTL) per week stijgt of daalt — de week-op-week-verandering van dezelfde fitheidslijn die je hierboven ziet.",
    waarom: "Te snelle opbouw is de meest voorkomende oorzaak van blessures en overbelasting. Hier zie je het aankomen vóórdat het misgaat.",
    hoe: "Rechtstreeks afgeleid uit je bestaande belastingsverloop — geen tweede berekening. Als vuistregel is tot ongeveer +5 per week vol te houden; daarboven wordt het risico op overbelasting snel groter.",
    verbanden: "Eén-op-één gekoppeld aan je belastingsverloop en je vorm (TSB): een week hard stijgen drukt je vorm tijdelijk in de min.",
    beinvloeden: "Bouw in kleine stappen en plan elke drie à vier weken een rustiger week; dat houdt de stijging vol te houden.",
    versie: 1,
  },
  eisprofiel: {
    wat: "Wat je eerstvolgende doelwedstrijd van je vermogenscurve vraagt, gelegd naast wat je nu daadwerkelijk hebt gemeten.",
    waarom: "Zo zie je welk stuk van je curve nog tekortschiet voor jóuw doel — niet voor een gemiddelde renner, maar voor de koers waar je voor traint.",
    hoe: "Per wedstrijdtype tellen andere duurvensters (bij een criterium de sprint en de herstart, bij een tijdrit het lange werk). We vergelijken je beste recente meting (laatste 42 dagen) per venster met je eigen beste ooit — nooit met een verzonnen norm. Ontbreekt een meting, dan staat de reden erbij.",
    verbanden: "Gebruikt dezelfde vermogensrecords als de powercurve; hangt samen met je FTP en je belastingsverloop.",
    beinvloeden: "Train gericht het venster dat achterblijft: sprintjes voor het korte werk, blokken rond de drempel voor het lange werk. Een recente meting vergt ook gewoon een keer voluit rijden op dat venster.",
    versie: 1,
  },
  belasting: {
    wat: "De belastingsscore (TSS) van een training: hoe zwaar die was voor jouw lichaam, in één getal.",
    waarom: "Zo tellen een korte intensieve training en een lange rustige rit allebei mee in hetzelfde model. Rond de 100 staat voor een uur voluit op je drempel.",
    hoe: "Berekend uit je vermogen ten opzichte van je FTP en de duur van de rit. Zonder vermogensmeter schatten we hem uit hartslag of duur — dat is grover en staat er dan bij.",
    verbanden: "Hangt direct samen met je FTP (klopt die niet, dan klopt de score niet), en voedt je fitheid, vermoeidheid en vorm in het belastingsmodel.",
    beinvloeden: "Je stuurt dit niet omhoog of omlaag als doel op zich — een goede weekverdeling wisselt hoge en lage scores af. Rijd met vermogensmeter voor een nauwkeurige score en houd je FTP actueel.",
    versie: 2,
  },
  intensiteitsfactor: {
    wat: "De intensiteitsfactor (IF): hoe zwaar deze training was ten opzichte van je drempelvermogen (FTP), als getal rond de 0,5–1,1.",
    waarom: "Zo zie je in één oogopslag of een rit rustig (rond 0,6), stevig (rond 0,8) of voluit (rond 1,0) was — los van hoe lang hij duurde.",
    hoe: "Berekend als je genormaliseerd vermogen gedeeld door je FTP. Klopt je FTP niet, dan klopt dit getal ook niet.",
    verbanden: "Hangt direct samen met je FTP en je genormaliseerd vermogen, en bepaalt samen met de duur je belastingsscore (TSS).",
    beinvloeden: "Dit is geen doel op zich: een goede trainingsweek wisselt lage en hoge intensiteit af. Houd vooral je FTP actueel zodat het getal eerlijk blijft.",
    versie: 1,
  },
  genormaliseerd_vermogen: {
    wat: "Je genormaliseerd vermogen (NP): een gecorrigeerd gemiddelde dat pieken en dalen in je vermogen zwaarder laat meetellen dan een gewoon gemiddelde.",
    waarom: "Een rit met veel sprintjes voelt zwaarder dan een vlakke rit met hetzelfde gemiddelde vermogen. NP maakt die zwaarte zichtbaar.",
    hoe: "Berekend uit je vermogensmeting met een vaste formule (30-seconden voortschrijdend gemiddelde, tot de vierde macht gewogen). Zonder vermogensmeter is er geen NP.",
    verbanden: "Voedt je intensiteitsfactor (NP gedeeld door FTP) en daarmee je belastingsscore (TSS).",
    beinvloeden: "Niet direct te sturen: het beschrijft hoe je gereden hebt. Gelijkmatiger rijden brengt NP dichter bij je gemiddelde vermogen.",
    versie: 1,
  },
  fitheid: {
    wat: "Je fitheid (CTL): het voortschrijdend gemiddelde van je trainingsbelasting over ongeveer zes weken.",
    waarom: "Dit is je opgebouwde basis. Een stijgende lijn betekent dat je lichaam went aan meer werk; na een rustperiode zakt hij langzaam terug.",
    hoe: "Berekend uit je dagelijkse belastingsscores met een gewogen gemiddelde over 42 dagen. Ontbrekende trainingen tellen als nul — koppel je bronnen om het beeld compleet te houden.",
    verbanden: "Wordt opgebouwd uit je belastingsscores en beweegt samen met je trainingsvolume. Vorm = fitheid min vermoeidheid, dus stijgende fitheid zonder herstel drukt je vorm.",
    beinvloeden: "Consequent trainen over weken telt zwaarder dan één zware week. Kleine, volgehouden verhogingen van je weekvolume laten de lijn duurzaam stijgen; lange gaten laten hem zakken.",
    versie: 2,
  },
  vermoeidheid: {
    wat: "Je vermoeidheid (ATL): het voortschrijdend gemiddelde van je belasting over de laatste dagen.",
    waarom: "Dit getal reageert snel: een zwaar blok jaagt hem omhoog, een paar rustige dagen laten hem zakken. Hoge vermoeidheid vlak voor een wedstrijd is onhandig.",
    hoe: "Zelfde berekening als fitheid, maar over 7 dagen in plaats van 42. Daardoor beweegt hij veel sneller.",
    verbanden: "Reageert op dezelfde belastingsscores als je fitheid, maar over 7 dagen. Hoge vermoeidheid drukt je vorm en zie je vaak terug in je check-in-gevoel en slaap.",
    beinvloeden: "Plan na een zwaar blok bewust lichte dagen; dan zakt dit getal binnen een week. Slaap en rustige duurritten versnellen het herstel meer dan volledig stilzitten.",
    versie: 2,
  },
  vorm: {
    wat: "Je vorm (TSB): het verschil tussen je fitheid en je vermoeidheid.",
    waarom: "Positief betekent fris (goed voor wedstrijden), licht negatief hoort bij een trainingsblok, sterk negatief is een signaal om herstel in te plannen.",
    hoe: "Vorm = fitheid min vermoeidheid, berekend per dag. Het is een model op basis van je geregistreerde trainingen — geen meting van hoe je je voelt.",
    verbanden: "Rechtstreeks afgeleid van fitheid en vermoeidheid. Je gevoel-score en HRV bewegen er vaak mee mee; vlak voor wedstrijden wil je hem licht positief hebben.",
    beinvloeden: "Wil je frisser aan de start staan: verlaag de belasting in de laatste week (taperen) zonder te stoppen met trainen. Structureel sterk negatief? Bouw een herstelweek in.",
    versie: 2,
  },
  readiness: {
    wat: "Hoe klaar je lichaam vandaag is om te trainen, op basis van je eigen check-in.",
    waarom: "Trainen op een dag dat je lichaam eraan toe is levert meer op. Op een slechte dag is aanpassen slimmer dan doorduwen.",
    hoe: "Berekend uit je check-in: gevoel, slaapkwaliteit en vermoeidheid. Alleen ingevulde onderdelen tellen mee; zonder check-in is er geen score. Het is een hulpmiddel, geen medisch oordeel.",
    verbanden: "Combineert je check-in met wat je belastingsmodel al weet: na zware dagen zie je hem vaak zakken, net als bij korte nachten in je slaapgrafiek.",
    beinvloeden: "Vaste slaaptijden, rustdagen serieus nemen en stress beperken doen hier het meest. Vul je check-in dagelijks in — zonder invoer is er niets te sturen.",
    versie: 2,
  },
  herstel: {
    wat: "Hoe goed je lichaam bijkomt van eerdere trainingen.",
    waarom: "Trainen prikkelt, maar het herstel erna maakt je sterker. Structureel te weinig herstel breekt meer af dan het opbouwt.",
    hoe: "Afgeleid uit je vorm (fitheid versus vermoeidheid), je check-ins en je recente trainingspatroon. Voel je je langdurig uitgeput of ziek, bespreek dat dan met een arts — dat kan deze app niet beoordelen.",
    verbanden: "Volgt uit je vorm, je check-ins en je trainingspatroon. Slechte slaap of veel stress zie je hier vaak eerder terug dan in je vermogens.",
    beinvloeden: "Slaap is het krachtigste herstelmiddel, gevolgd door voeding direct na de training en echte rustdagen. Herstel verbetert niet door extra te trainen.",
    versie: 2,
  },
  trainingsadvies: {
    wat: "Wat vandaag de meest zinvolle training voor je is.",
    waarom: "Het advies weegt je opbouw, je vermoeidheid en je doel tegen elkaar af, zodat je niet hoeft te gokken wat vandaag verstandig is.",
    hoe: "Opgebouwd uit vaste, controleerbare regels over je belasting, je vorm, je check-in en je geplande wedstrijden. Ontbreekt er data, dan wordt het advies voorzichtiger en staat erbij wat er mist. Jij beslist altijd zelf.",
    versie: 1,
  },
  performanceRadar: {
    wat: "Je capaciteitsprofiel over zes signalen: fitheid, vorm, herstel, vermogen, gevoel en regelmaat.",
    waarom: "Eén getal zegt weinig over een renner. Zes assen naast elkaar laten zien waar je sterk bent en waar ruimte zit.",
    hoe: "Iedere as wordt berekend uit echte data: fitheid/vorm/herstel uit je belastingsmodel (90 dagen), vermogen uit je FTP en gewicht (W/kg, schaal 2,0–5,5), gevoel en regelmaat uit je sessies van de laatste 28 dagen. Ontbreekt de data voor een as, dan wordt die as niet getekend en staat eronder wat er mist.",
    verbanden: "Elke as komt uit een andere grafiek: fitheid/vorm/herstel uit je belastingsverloop, vermogen uit FTP en gewicht, gevoel en regelmaat uit je sessies. Verandert daar iets, dan beweegt de radar mee.",
    beinvloeden: "Kies één zwakke as tegelijk: regelmaat verbeter je met een vast weekritme, vermogen met gerichte FTP-training, herstel met slaap en rustdagen. Meer assen meetbaar maken kan al door check-ins in te vullen.",
    versie: 2,
  },
  readinessTrend: {
    wat: "Het verloop van je dagelijkse gevoel-score uit je check-ins, over de gekozen periode.",
    waarom: "Eén slechte dag zegt weinig; een dalende lijn over weken wel. De trend laat zien of je opbouw vol te houden is.",
    hoe: "Iedere ingevulde check-in telt als één punt (gevoel 1–5, getoond als 0–100). Dagen zonder check-in ontbreken gewoon in de lijn — er wordt niets ingevuld of geschat.",
    verbanden: "Loopt vaak gelijk op met je slaapuren en tegengesteld aan je vermoeidheid: zware trainingsweken drukken de lijn, herstelweken tillen hem op.",
    beinvloeden: "Een dalende lijn over twee weken is een signaal om belasting te verlagen vóór je lichaam het afdwingt. Vaste slaaptijden en een lichtere week keren de trend meestal.",
    versie: 2,
  },
  hrvTrend: {
    wat: "Het verloop van je hartritmevariatie (HRV) uit je check-ins, in milliseconden.",
    waarom: "Een dalende HRV over meerdere dagen kan wijzen op oplopende vermoeidheid of stress. De trend zegt meer dan één losse meting.",
    hoe: "Alleen zelf ingevoerde HRV-waarden uit je check-in tellen mee, over de gekozen periode. Dagen zonder meting ontbreken in de lijn. Vergelijk vooral met je eigen normale waarden — HRV verschilt sterk per persoon.",
    verbanden: "Beweegt vaak mee met slaap, stress en vermoeidheid: na zware blokken of korte nachten daalt HRV bij de meeste mensen. Leg hem naast je vorm- en slaapgrafiek.",
    beinvloeden: "Meet op een vast moment (bijv. direct na het wakker worden). Meer slaap, minder alcohol en een rustige week laten HRV doorgaans herstellen; vergelijk altijd met je eigen normaal.",
    versie: 2,
  },
  ftpOntwikkeling: {
    wat: "Je huidige FTP uit je Sportpaspoort, met daaronder je geregistreerde tests en metingen door de tijd.",
    waarom: "Zo zie je of je drempelvermogen zich ontwikkelt. De grote waarde is altijd dezelfde als in je Sportpaspoort — er bestaat maar één FTP in Sparki.",
    hoe: "De balken zijn je FTP-registraties (tests, schattingen, correcties) op datum. Pas je je FTP aan in je Sportpaspoort, dan verandert hij hier automatisch mee.",
    verbanden: "Je FTP bepaalt je zones, je belastingsscores en de vermogen-as van de radar — een verandering hier werkt overal in door. Je records (5s–20 min) geven een ondergrens-check.",
    beinvloeden: "FTP groeit vooral door consequente duurtraining aangevuld met blokken rond je drempel (bijv. 2×20 min), over maanden. Test of her-schat elke 6–8 weken, anders train je op verouderde zones.",
    versie: 2,
  },
  records: {
    wat: "Je beste vermogens over vaste tijdsduren, van 5 seconden tot 20 minuten.",
    waarom: "Je records laten zien waar je sterk bent (sprint, aanval of duurvermogen) en of je vooruitgaat ten opzichte van eerder.",
    hoe: "Berekend uit het volledige vermogenssignaal van geïmporteerde ritbestanden. Ritten zonder vermogensmeting of zonder bestand tellen niet mee — records kunnen dus onvolledig zijn.",
    verbanden: "Records voeden de controle op je FTP en laten samen met je intensiteitsverdeling zien welk type inspanning je veel of weinig traint.",
    beinvloeden: "Sprint (5–15s) verbeter je met korte maximale sprints, je 20-minutenwaarde met drempelblokken. Records vragen frisheid: jaag ze na een rustige dag, niet in een zware week.",
    versie: 2,
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
    hoe: "Gebaseerd op de gekoppelde activiteit (vermogen, hartslag, verloop), de wedstrijdgegevens en je eigen terugblik. Ontbreekt de activiteit of een meting, dan blijft dat deel leeg.",
    versie: 1,
  },
  voedingsadvies: {
    wat: "Wat en hoeveel je rond je training het beste kunt eten en drinken.",
    waarom: "Goed gevoed trainen levert meer op en voorkomt de man met de hamer. Vooral bij lange of intensieve ritten maakt dit een groot verschil.",
    hoe: "Berekend uit de duur en zwaarte van de training en, waar bekend, je gewicht. Het zijn vuistregels voor sporters — geen dieetadvies en geen medische voedingsbegeleiding.",
    versie: 1,
  },
  powercurve: {
    wat: "Je beste gemiddelde vermogen per duur (5 seconden tot 60 minuten), voor dit blok van 42 dagen en het blok ervoor.",
    waarom: "Zo zie je in één oogopslag of je sprint, aanval of duurvermogen vooruitgaat ten opzichte van de vorige periode.",
    hoe: "Per rit met vermogensmeter wordt het beste gemiddelde over elk tijdvenster berekend; de curve toont per periode het hoogste van al die ritten. Duren zonder echte meting blijven leeg — er wordt niets bijgeschat.",
    verbanden: "Dezelfde getallen voeden je recordtabel en de ondergrens-check op je FTP. Het 20-minutenpunt zegt het meest over je drempelvermogen.",
    beinvloeden: "Vooruitgang op korte duren komt uit sprint- en intervalwerk, op lange duren uit drempel- en duurblokken. Test af en toe gericht, anders blijft de curve een onderschatting.",
    versie: 1,
  },
  weekzoneverdeling: {
    wat: "Hoeveel tijd je per week in elke vermogenszone reed, opgeteld over alle ritten met vermogensmeter.",
    waarom: "Per rit zie je één training; per week zie je je werkelijke mix. Veel goede trainingsweken zijn vooral rustig (Z1–Z2) met gerichte harde tijd erbovenop.",
    hoe: "Uit het echte vermogenssignaal van je geïmporteerde ritten, afgezet tegen je FTP (Coggan-zones). Ritten zonder vermogensdata tellen niet mee in de verdeling — de week toont dan eerlijk minder tijd dan je echt reed.",
    verbanden: "Hangt samen met je intensiteitsverdeling en je belastingsverloop: veel tijd in Z3 zonder plan jaagt vermoeidheid op zonder evenredige fitheidswinst.",
    beinvloeden: "Houd je FTP actueel, anders verschuiven alle zones mee. Wil je de mix veranderen: maak rustige ritten écht rustig en plan harde tijd bewust.",
    versie: 1,
  },
  intensiteitsverdeling: {
    wat: "Hoe je trainingstijd verdeeld is over rustige, stevige en harde sessies.",
    waarom: "Een gezonde mix — veel rustig, gericht hard — levert doorgaans meer op dan alles op middelmatige intensiteit rijden.",
    hoe: "Per sessie wordt de belastingsscore per uur bekeken en in een categorie geplaatst. Sessies zonder score tellen als onbekend en worden niet gegokt.",
    verbanden: "Hangt samen met je belastingsverloop: veel middelmatig-harde sessies jagen je vermoeidheid op zonder dat je fitheid er evenveel van groeit. Ook je gevoel-trend reageert hierop.",
    beinvloeden: "Vuistregel: maak rustige ritten écht rustig (praattempo) en harde dagen gericht hard. Twee kwaliteitssessies per week is voor de meeste sporters genoeg; de rest is opbouw.",
    versie: 2,
  },
  slaap: {
    wat: "Het verloop van je gerapporteerde slaapuren over de gekozen periode.",
    waarom: "Slaap is je belangrijkste herstelmiddel: structureel te weinig slaap remt het effect van je trainingen.",
    hoe: "Gebaseerd op wat je zelf invult bij de dagelijkse check-in of wat een gekoppeld platform doorgeeft. Ontbrekende dagen blijven leeg.",
    verbanden: "Slaap werkt door in bijna alles hier: je readiness, je HRV, je gevoel-score en hoe snel je vermoeidheid zakt na zware dagen.",
    beinvloeden: "Vaste bedtijden, een donkere koele kamer en schermen eerder uit doen het meest. Na zware trainingsdagen heeft je lichaam eerder méér slaap nodig, niet minder.",
    versie: 2,
  },
  gewichtWkg: {
    wat: "Het verloop van je gewicht en, als je FTP bekend is, je vermogen per kilo (W/kg).",
    waarom: "Bergop en bij versnellingen telt vermogen per kilo zwaarder dan absoluut vermogen. De trend zegt meer dan één losse meting.",
    hoe: "Gewicht komt uit je eigen metingen; W/kg wordt berekend uit je meest recente FTP gedeeld door het gewicht op die dag. Zonder gewicht of FTP blijft de lijn leeg.",
    verbanden: "W/kg combineert twee grafieken: je FTP-ontwikkeling en je gewichtsverloop. Bergop en in je radar-as vermogen telt deze verhouding zwaarder dan absolute watts.",
    beinvloeden: "Er zijn twee knoppen: vermogen opbouwen (duurzaam, altijd verstandig) en gewicht — dat laatste alleen geleidelijk en buiten zware trainingsblokken. Crashdiëten kosten juist vermogen.",
    versie: 2,
  },
  doelscenario: {
    wat: "Een verwachting van je fitheidsontwikkeling als je je trainingsvolume verhoogt of verlaagt, weergegeven als brede band.",
    waarom: "Zo zie je vooraf wat een voornemen — bijvoorbeeld twintig procent meer trainen — naar verwachting doet met fitheid en vorm, voordat je het uitvoert.",
    hoe: "Berekend met hetzelfde belastingsmodel als de grafiek, op basis van je gemiddelde belasting van de afgelopen vier weken. De band toont een boven- en onderwaarde: het is een verwachting, geen zekerheid.",
    versie: 1,
  },
  onzekerheid: {
    wat: "Hoe zeker de conclusie op deze plek is, en welke gegevens er eventueel ontbreken.",
    waarom: "Een conclusie op halve data verdient minder vertrouwen. Door onzekerheid te tonen weet je wanneer je op een getal kunt bouwen.",
    hoe: "Per analyse wordt bijgehouden welke bronnen echt beschikbaar waren. Ontbreekt er iets, dan staat dat erbij.",
    versie: 1,
  },
  doelenOverzicht: {
    wat: "Je actieve doelen en aankomende wedstrijden op één plek.",
    waarom: "Zonder doel is elke training even goed — met een doel kun je keuzes maken en zien of je op koers ligt.",
    hoe: "Doelen stel je zelf in; wedstrijden voeg je toe of komen uit je gekoppelde kalender. Alleen wat je zelf hebt vastgelegd staat hier — er wordt niets verzonnen.",
    versie: 1,
  },
  sessielijst: {
    wat: "Al je geregistreerde trainingen op een rij, met datum, duur en belastingsscore.",
    waarom: "Dit is de brondata onder elke grafiek hierboven: klopt een lijn niet, dan vind je hier de rit die het verklaart.",
    hoe: "Elke rij is een echte geregistreerde sessie uit je gekoppelde bronnen of handmatige invoer. Klik op een rij voor de volledige analyse van die training.",
    versie: 1,
  },
}

export type UitlegKey = keyof typeof UITLEG

export const UITLEG_DOEN: Record<string, string> = {
  fitheid: "Stijgt de lijn gestaag, dan zit je goed; zakt hij weken achtereen, plan dan weer regelmaat in.",
  vermoeidheid: "Piekt dit getal vlak voor een belangrijke dag, las dan eerst een paar rustige dagen in.",
  vorm: "Plan zware blokken als je dit aankunt en stuur naar licht positief in de dagen vóór een wedstrijd.",
  belasting: "Vergelijk zware en lichte dagen en verdeel ze bewust over je week in plaats van alles even zwaar te maken.",
  belastingsverloop: "Kijk of je fitheidslijn over weken rustig stijgt; schiet de vermoeidheidslijn er ver bovenuit, plan dan eerst herstel.",
  trainingsvolume: "Groei per week met kleine stappen en gebruik een dip als teken om je ritme te herpakken.",
  intensiteitsverdeling: "Zie je vooral middelmatig-stevige ritten, maak dan je rustige ritten rustiger en je harde dagen gerichter.",
  slaap: "Zie je structureel korte nachten naast zware trainingsweken, plan dan eerst slaap en pas daarna extra training.",
  readinessTrend: "Daalt de lijn twee weken achtereen, verlaag dan je belasting voordat je lichaam het afdwingt.",
  hrvTrend: "Vergelijk met je eigen normale waarden en neem een aanhoudende daling serieus als sein voor rust.",
  performanceRadar: "Kies één zwakke as tegelijk om aan te werken in plaats van alles tegelijk te willen verbeteren.",
  ftpOntwikkeling: "Test of her-schat je FTP elke zes tot acht weken, zodat je zones en scores kloppen.",
  records: "Zoek je zwakste duur uit en train die gericht; jaag records na een rustige dag, niet in een zware week.",
  gewichtWkg: "Kijk naar de trend over weken en verander gewicht alleen geleidelijk, buiten zware trainingsblokken.",
  doelscenario: "Gebruik de band om een voornemen vooraf te toetsen, niet als belofte — het blijft een verwachting.",
  doelenOverzicht: "Houd je doelen actueel en haal weg wat niet meer speelt, zodat je advies erop kan sturen.",
  sessielijst: "Open een rij om de volledige analyse van die training te bekijken.",
  vermogen: "Zoek de momenten waar de lijn wegzakt of piekt en leg ze naast hoe de rit voelde.",
  hartslag: "Loopt je hartslag op terwijl je vermogen gelijk blijft, neem dan je herstel en je drinken onder de loep.",
  cadans: "Grote schommelingen kosten energie — probeer een tempo dat je een hele rit comfortabel volhoudt.",
  vermogenszones: "Controleer of de verdeling past bij het doel van de rit: rustig hoort laag, intervallen horen hoog.",
  hartslagzones: "Controleer of de rit zo zwaar was als bedoeld: veel tijd hoog in de zones op een rustige dag is een sein.",
  hartslagdrift: "Bij hoge drift op duurritten: rijd iets rustiger of neem meer tijd voor eten en drinken onderweg.",
  vermogensverval: "Zie je vaak duidelijk verval, begin dan rustiger zodat je het einde van de rit sterker haalt.",
  pacing: "Rijd duurritten gelijkmatiger; bewaar grote wisselingen voor trainingen waar dat de bedoeling is.",
  intervallen: "Vergelijk de gereden blokken met je plan en stel je doelvermogen bij als het structureel niet lukt.",
  vergelijkbaarheid: "Vergelijk alleen ritten die echt op elkaar lijken — anders vergelijk je omstandigheden, geen vooruitgang.",
  intensiteitsfactor: "Controleer of de zwaarte past bij het doel van de dag: rond 0,6 hoort bij rustig, rond 1,0 bij voluit.",
  genormaliseerd_vermogen: "Ligt NP ver boven je gemiddelde vermogen, dan reed je wisselvallig — bedoeld of niet, dat zie je hier.",
  ftp: "Houd deze waarde actueel; al je zones en scores rekenen ermee.",
  readiness: "Pas op een slechte dag je training aan in plaats van door te duwen.",
}
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

export const VORM_UITLEG_BASIS =
  "Groen betekent uitgerust, rood dat je nog werk van de afgelopen dagen meedraagt. " +
  "Rood hoort bij een trainingsblok, groen hoort bij de dagen vóór een wedstrijd."

export const VORM_UITLEG_WAARSCHUWING =
  "Let op: groen zonder training ervoor is geen vorm — dan zakt je fitheid mee."

/**
 * Bouwt de verplichte uitlegtekst onder de vormgrafiek. `actieveDagen` is het
 * aantal dagen mét geregistreerde belasting in de getoonde periode van
 * `periodeDagen` dagen. Weinig = minder dan 3 actieve dagen, of gemiddeld
 * minder dan één activiteit per twee weken.
 */
export function vormGrafiekUitleg(
  actieveDagen: number,
  periodeDagen: number,
): { tekst: string; waarschuwing: boolean } {
  const drempel = Math.max(3, Math.round(periodeDagen / 14))
  const waarschuwing = actieveDagen < drempel
  return {
    tekst: waarschuwing
      ? `${VORM_UITLEG_BASIS} ${VORM_UITLEG_WAARSCHUWING}`
      : VORM_UITLEG_BASIS,
    waarschuwing,
  }
}
