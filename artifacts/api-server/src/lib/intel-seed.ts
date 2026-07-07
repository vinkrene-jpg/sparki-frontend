// Curated seed for the Performance Intelligence Hub (intel_cards).
//
// Every card below is REAL, sourced editorial content — myth verdicts grounded in
// exercise-physiology consensus, gear comparisons using published manufacturer
// figures (and "—"/null where a spec is not published, never guessed), trends and
// debates that reflect genuine peloton/coaching practice. Each card states its
// provenance in `sourceLabel`. No fabricated numbers.
//
// Idempotent: keyed on `dedupeKey`, re-running upserts in place. Runs on every
// api-server boot (see src/index.ts) so the curated content ships with each
// release — in dev AND production — and via the manual script
// `pnpm --filter @workspace/api-server run seed:intel`.

import {
  db,
  intelCardsTable,
  featureFlagsTable,
  type InsertIntelCard,
  type IntelCardContent,
} from "@workspace/db";
import { sql } from "drizzle-orm";

type SeedCard = Omit<InsertIntelCard, "content"> & { content: IntelCardContent };

const CARDS: SeedCard[] = [
  // ── MYTH BUSTERS ──────────────────────────────────────────────────────────
  {
    dedupeKey: "myth-lactic-acid-soreness",
    kind: "myth_buster",
    topic: "herstel",
    title: "Melkzuur veroorzaakt spierpijn de dagen erna",
    summary:
      "De klassieke uitleg voor stijve benen twee dagen na een zware rit. Klopt het?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Inspanningsfysiologie — consensus reviews",
    content: {
      statement:
        "De spierpijn die je 1–2 dagen na een zware training voelt, komt door opgehoopt melkzuur.",
      answer: "niet_waar",
      explanation:
        "Melkzuur (lactaat) is binnen ongeveer een uur na de inspanning weer afgevoerd. De late spierpijn heet DOMS en ontstaat door kleine schade aan spiervezels en de ontstekingsreactie die het herstel op gang brengt.",
      science:
        "Lactaat wordt tijdens en kort na inspanning gebruikt als brandstof en omgezet in de lever. DOMS (Delayed Onset Muscle Soreness) piekt na 24–72 uur en hangt samen met excentrische belasting en micro-schade, niet met lactaat.",
      application:
        "Wil je minder last van DOMS na een zware blok? Bouw de belasting geleidelijk op, las rustige hersteldagen in en onderschat de waarde van slaap niet. 'Het zuur eruit rijden' bestaat niet.",
      relevance:
        "Helpt je je hersteldagen juist te plannen in plaats van te jagen op een mythe.",
    },
  },
  {
    dedupeKey: "myth-fasted-fat-burn",
    kind: "myth_buster",
    topic: "voeding",
    title: "Nuchter trainen is altijd de beste manier om vet te verbranden",
    summary: "Populair advies om af te vallen. Maar werkt het ook zo simpel?",
    disciplines: ["all"],
    levels: ["beginner", "intermediate", "advanced"],
    sourceLabel: "Sportvoedingsonderzoek — overzichtsstudies",
    content: {
      statement:
        "Op de nuchtere maag trainen verbrandt altijd meer vet en is dus altijd beter om af te vallen.",
      answer: "hangt_ervan_af",
      explanation:
        "Nuchter trainen verschuift de brandstofmix richting vet tijdens die rit, maar wat telt voor afvallen is je totale energiebalans over de dag — niet welke brandstof je tijdens één rit gebruikt.",
      science:
        "Bij lage intensiteit gebruikt het lichaam relatief meer vet. Nuchter rijden kan die vetoxidatie trainen, maar bij hoge intensiteit lever je kwaliteit in en kan het herstel en spierbehoud onder druk komen.",
      application:
        "Rustige duurritten kun je prima nuchter doen. Intensieve intervallen of lange ritten: eet eerst koolhydraten, anders gaat het ten koste van je kwaliteit.",
      relevance:
        "Voorkomt dat je je beste trainingen verprutst door op de verkeerde momenten nuchter te rijden.",
    },
  },
  {
    dedupeKey: "myth-no-pain-no-gain",
    kind: "myth_buster",
    topic: "training",
    title: "Elke training moet zwaar zijn om vooruitgang te boeken",
    summary: "Zonder afzien geen vooruitgang — geldt dat echt voor duursporters?",
    disciplines: ["all"],
    levels: ["beginner", "intermediate"],
    sourceLabel: "Trainingsleer — gepolariseerd trainen",
    content: {
      statement:
        "Als een training niet zwaar aanvoelt, heeft hij weinig zin voor je conditie.",
      answer: "niet_waar",
      explanation:
        "Het overgrote deel van de progressie bij duursporters komt juist uit rustige, goed vol te houden trainingen. Te vaak zwaar trainen leidt tot stilstand en vermoeidheid.",
      science:
        "Veel succesvolle duursporters trainen ongeveer 80% van de tijd rustig en 20% hard (gepolariseerd model). Rustige duur bouwt het aerobe fundament; te veel grijze-zone-training geeft vermoeidheid zonder de winst van echt hard.",
      application:
        "Maak je rustige ritten écht rustig (je kunt blijven praten) en je harde ritten écht hard. Vermijd de grijze zone ertussenin.",
      relevance:
        "Bespaart je vermoeidheid en levert vaak méér vooruitgang op.",
    },
  },

  // ── PELOTON TRENDS ────────────────────────────────────────────────────────
  {
    dedupeKey: "trend-wide-tyres-low-pressure",
    kind: "trend",
    topic: "materiaal",
    title: "Bredere banden op lagere druk",
    summary:
      "Het peloton reed jaren op 23 mm. Nu zie je 28–32 mm als standaard.",
    disciplines: ["road", "gravel", "all"],
    levels: ["all"],
    sourceLabel: "Materiaaltrends profwielrennen + rolweerstandstests",
    content: {
      whatChanges:
        "Waar 23–25 mm jarenlang de norm was, rijden veel profs nu 28–30 mm (en op kasseien breder), op lagere bandenspanning.",
      why: "Rolweerstandstests en praktijk laten zien dat een bredere band op lagere druk vaak even snel of sneller rolt op echt wegdek, met meer grip en comfort. Minder trillingen betekent ook minder vermoeidheid.",
      pros: [
        "Meer comfort en grip",
        "Vergelijkbare of lagere rolweerstand op ruw wegdek",
        "Minder kans op snijlek bij lagere druk",
      ],
      cons: [
        "Iets meer luchtweerstand bij hoge snelheid",
        "Moet passen binnen je frame en velg",
        "Juiste spanning hangt af van gewicht en velgbreedte",
      ],
      confidence: "high",
      confidenceNote:
        "Breed onderbouwd door rolweerstandstests en zichtbaar overgenomen in het profpeloton.",
    },
  },
  {
    dedupeKey: "trend-carb-intake-racing",
    kind: "trend",
    topic: "voeding",
    title: "Veel meer koolhydraten per uur in de koers",
    summary:
      "Van 60 g/u naar 90–120 g/u koolhydraten tijdens lange wedstrijden.",
    disciplines: ["road", "gravel", "triathlon", "all"],
    levels: ["intermediate", "advanced", "elite"],
    sourceLabel: "Sportvoedingsonderzoek + praktijk WorldTour",
    content: {
      whatChanges:
        "Profs mikken in zware koersen op 90–120 g koolhydraten per uur, waar 60 g/u lang als bovengrens gold.",
      why: "Met een mix van glucose en fructose kan de darm meer koolhydraten tegelijk opnemen. Meer beschikbare brandstof betekent meer vermogen laat in de wedstrijd.",
      pros: [
        "Meer energie en vermogen in de finale",
        "Minder kans op een hongerklop",
      ],
      cons: [
        "Je darm moet het wennen (trainen op de fiets)",
        "Risico op maagklachten als je te snel opbouwt",
        "Niet nodig voor korte of rustige ritten",
      ],
      confidence: "medium",
      confidenceNote:
        "Sterk in de top, maar de optimale hoeveelheid verschilt per persoon en moet je opbouwen.",
    },
  },

  // ── GEAR WARS (compare, no winner) ────────────────────────────────────────
  {
    dedupeKey: "gear-di2-vs-axs-shifting",
    kind: "gear_compare",
    topic: "materiaal",
    title: "Elektronisch schakelen: Shimano Di2 vs SRAM AXS",
    summary:
      "Twee draadloze topgroepen vergeleken op de punten die er echt toe doen.",
    disciplines: ["road", "all"],
    levels: ["intermediate", "advanced", "elite"],
    sourceLabel: "Gepubliceerde fabrieksspecificaties Shimano & SRAM",
    content: {
      productA: "Shimano Dura-Ace Di2 (R9200)",
      productB: "SRAM RED eTap AXS",
      attributes: [
        {
          label: "Bediening",
          a: "Semi-draadloos (kabel naar derailleurs)",
          b: "Volledig draadloos",
        },
        { label: "Versnellingen achter", a: "12", b: "12" },
        {
          label: "Voorblad",
          a: "Dubbel",
          b: "Dubbel (ook 1x-opties)",
        },
        {
          label: "Accu",
          a: "Centrale accu",
          b: "Verwisselbare accu per derailleur",
        },
        {
          label: "Opgegeven gewicht groep",
          unit: "g",
          a: null,
          b: null,
          note: "Hangt sterk af van gekozen onderdelen; niet als één getal te vergelijken.",
        },
      ],
      strengthsA: [
        "Zeer snelle, vaste achterschakeling",
        "Eén accu om op te laden",
      ],
      strengthsB: [
        "Volledig draadloos, eenvoudige montage",
        "Verwisselbare accu's die je kunt wisselen onderweg",
      ],
      weaknessesA: [
        "Interne bekabeling maakt montage bewerkelijker",
      ],
      weaknessesB: [
        "Meerdere accu's om in de gaten te houden",
      ],
      verdict:
        "Geen winnaar: kies Di2 als je houdt van een strakke, vaste schakelvoeling met één accu. Kies AXS als je volledige draadloosheid en verwisselbare accu's belangrijker vindt. Beide zijn topniveau.",
    },
  },
  {
    dedupeKey: "gear-power-pedals-vs-spider",
    kind: "gear_compare",
    topic: "materiaal",
    title: "Vermogensmeter: pedalen vs crankstel-meter",
    summary:
      "Waar meet je je watts het handigst? Twee veelgekozen plekken vergeleken.",
    disciplines: ["all"],
    levels: ["beginner", "intermediate", "advanced"],
    sourceLabel: "Algemene productcategorie-vergelijking",
    content: {
      productA: "Vermogensmeter in de pedalen",
      productB: "Vermogensmeter in het crankstel (spider/arm)",
      attributes: [
        {
          label: "Overzetten naar andere fiets",
          a: "Eenvoudig (pedalen omwisselen)",
          b: "Bewerkelijk (crankstel wisselen)",
        },
        {
          label: "Links/rechts-balans",
          a: "Meestal beschikbaar",
          b: "Afhankelijk van model",
        },
        {
          label: "Gevoeligheid voor stoten/afstelling",
          a: "Pedalen vangen meer klappen",
          b: "Beschermder gemonteerd",
        },
        {
          label: "Exacte prijs",
          unit: "€",
          a: null,
          b: null,
          note: "Verschilt sterk per merk en model; geen vaste prijs te noemen.",
        },
      ],
      strengthsA: [
        "Makkelijk te verplaatsen tussen fietsen",
        "Vaak echte links/rechts-meting",
      ],
      strengthsB: [
        "Robuust en uit het zicht",
        "Geen invloed van pedaalkeuze",
      ],
      weaknessesA: [
        "Gevoeliger voor schade bij vallen",
      ],
      weaknessesB: [
        "Lastiger over te zetten naar een andere fiets",
      ],
      verdict:
        "Geen winnaar: rijd je op één fiets en wil je een onderhoudsarme oplossing, dan is een crankstel-meter prima. Wissel je vaak van fiets of wil je je links/rechts-balans zien, dan zijn pedalen handiger.",
    },
  },

  // ── SPARKI ACADEMY (mini-masterclass, tiered depth) ───────────────────────
  {
    dedupeKey: "academy-what-is-ftp",
    kind: "academy",
    topic: "training",
    title: "Wat is FTP en waarom bepaalt het je zones?",
    summary:
      "De belangrijkste getal-in-één voor je training, in gewone taal uitgelegd.",
    disciplines: ["all"],
    levels: ["beginner", "intermediate"],
    sourceLabel: "Trainingsleer — functionele drempel",
    content: {
      simple:
        "FTP staat voor het hoogste gemiddelde vermogen dat je ongeveer een uur kunt volhouden. Het is een praktische maat voor je duurvermogen. Uit je FTP leidt Sparki je trainingszones af, zodat 'rustig' en 'hard' voor jou de juiste watts betekenen.",
      deep:
        "FTP benadert de inspanning waarbij je lichaam nog net in balans is tussen lactaat aanmaken en afvoeren (rond je lactaatdrempel). Train je net onder die drempel, dan verbeter je je vermogen om lang hoog vermogen vast te houden; train je er ver boven, dan werk je aan je piekvermogen maar word je sneller moe. Omdat je zones percentages van je FTP zijn, schuiven al je trainingsprikkels mee zodra je FTP verandert — daarom is het zo belangrijk om hem af en toe opnieuw te bepalen.",
      example:
        "Stel je FTP is 250 watt. Een rustige duurrit zit dan rond 140–185 watt (zone 2), en drempelblokken rond 235–265 watt. Wordt je FTP 270, dan schuiven al die getallen mee omhoog.",
      conclusion:
        "Ken je FTP, dan weten jij én Sparki precies hoe zwaar elke training voor jóu is. Weet je hem nog niet? Sparki kan een veilige schatting maken en die later bijstellen.",
      readMinutes: 3,
    },
  },
  {
    dedupeKey: "academy-zone2-base",
    kind: "academy",
    topic: "training",
    title: "Waarom rustige zone 2 je motor groter maakt",
    summary:
      "De training die te saai lijkt om te werken — en juist het meeste oplevert.",
    disciplines: ["all"],
    levels: ["beginner", "intermediate", "advanced"],
    sourceLabel: "Inspanningsfysiologie — aerobe basis",
    content: {
      simple:
        "Zone 2 is rustig duurvermogen: je kunt nog makkelijk praten. Het voelt te makkelijk om iets te doen, maar juist deze intensiteit bouwt je aerobe basis — de motor waarmee je alles langer en sneller volhoudt.",
      deep:
        "Bij rustige duur traint je lichaam vooral de zuurstofverwerkende kant: meer en grotere mitochondriën, dichtere haarvaten en een beter vetverbrandend systeem. Daardoor kun je bij dezelfde snelheid meer energie uit vet halen en spaar je je koolhydraten voor als het er echt toe doet. Deze aanpassingen vragen volume en tijd, maar geven weinig vermoeidheid — dus je kunt er veel van doen zonder jezelf op te blazen.",
      example:
        "Twee rustige uren in zone 2 voelen onspectaculair, maar herhaald over weken stijgt je tempo bij dezelfde hartslag. Dat is je groeiende motor.",
      conclusion:
        "Heb de discipline om rustig écht rustig te houden. De winst zie je niet in één rit, maar in je vorm na een paar weken.",
      readMinutes: 4,
    },
  },

  // ── DEBATE ────────────────────────────────────────────────────────────────
  {
    dedupeKey: "debate-stretching-before-ride",
    kind: "debate",
    topic: "herstel",
    title: "Moet je rekken vóór een rit?",
    summary:
      "Statisch rekken voor het opstappen: zinvolle voorbereiding of achterhaald?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportwetenschap — warming-up & blessurepreventie",
    content: {
      proposition: "Statisch rekken vóór een rit hoort bij een goede warming-up.",
      argumentFor:
        "Voorstanders zeggen dat rekken de spieren losmaakt, de bewegingsvrijheid vergroot en blessures voorkomt — het voelt voor velen prettig en vertrouwd.",
      argumentAgainst:
        "Tegenstanders wijzen erop dat lang statisch rekken vóór inspanning het explosieve vermogen tijdelijk kan verlagen en blessures niet aantoonbaar voorkomt bij fietsen.",
      science:
        "Onderzoek laat zien dat een actieve, opbouwende warming-up (rustig beginnen en geleidelijk de intensiteit verhogen) beter werkt voor fietsers dan langdurig statisch rekken vooraf. Statisch rekken is vooral nuttig op andere momenten, los van de rit.",
      proTeams:
        "In de praktijk warmen profs zich vooral dynamisch op — op de rollen of rustig wegrijden — in plaats van lang statisch te rekken vlak voor de start.",
      conclusion:
        "Voor fietsen wint een rustige, opbouwende warming-up het van lang statisch rekken vooraf. Rekken mag, maar dan liever op een ander moment.",
      hasConsensus: true,
    },
  },
  {
    dedupeKey: "debate-train-by-power-or-feel",
    kind: "debate",
    topic: "training",
    title: "Trainen op vermogen of op gevoel?",
    summary:
      "Watts liegen niet — maar je lichaam ook niet. Wat moet leidend zijn?",
    disciplines: ["all"],
    levels: ["intermediate", "advanced"],
    sourceLabel: "Trainingsleer — meten vs. interne belasting",
    content: {
      proposition: "Je training laten leiden door je vermogensmeter is beter dan op gevoel rijden.",
      argumentFor:
        "Vermogen is objectief en direct: je ziet meteen of je de afgesproken intensiteit haalt en je kunt je vooruitgang precies volgen.",
      argumentAgainst:
        "Gevoel (en hartslag) vangt iets wat watts niet zien: vermoeidheid, stress, slecht geslapen. Blind een wattgetal najagen op een slechte dag kan je dieper de put in trainen.",
      science:
        "De wetenschap ziet beide als waardevol: vermogen meet de externe belasting, gevoel en hartslag meten de interne belasting. De beste aanpak combineert ze — stuur op vermogen, maar corrigeer op basis van hoe je je voelt.",
      proTeams:
        "Profs rijden met vermogensmeters én rapporteren dagelijks hun gevoel, slaap en herstel. Coaches passen de geplande watts aan op basis van die signalen.",
      conclusion:
        "Het is geen of-of. Gebruik vermogen om gericht te sturen en gevoel om bij te sturen. Geen consensus dat één van de twee alleen volstaat.",
      hasConsensus: false,
    },
  },

  // ── AERODYNAMICA ──────────────────────────────────────────────────────────
  {
    dedupeKey: "myth-aero-only-high-speed",
    kind: "myth_buster",
    topic: "aerodynamica",
    title: "Aerodynamica telt alleen bij hoge snelheid",
    summary:
      "Veel renners denken dat aero pas zin heeft als je hard gaat. Klopt dat?",
    disciplines: ["road", "triathlon", "all"],
    levels: ["all"],
    sourceLabel: "Aerodynamica-onderzoek wielrennen",
    content: {
      statement:
        "Aan je aerodynamica werken heeft alleen zin als je heel hard rijdt.",
      answer: "niet_waar",
      explanation:
        "Luchtweerstand is al de grootste remmende kracht bij gewone snelheden op het vlakke. Vanaf zo'n 20–25 km/u gaat het grootste deel van je vermogen op aan het verplaatsen van lucht, niet aan rolweerstand.",
      science:
        "Luchtweerstand groeit met het kwadraat van de snelheid en het benodigde vermogen nog sterker. Bij vlak rijden is de rijder zelf veruit de grootste hap luchtweerstand (ruwweg twee derde tot driekwart van het totaal), dus je houding telt zwaarder dan je materiaal.",
      application:
        "Je hoeft geen tijdritfiets te kopen. Iets lager op het stuur, smallere ellebogen en jezelf klein maken in de wind levert op elke rit gratis snelheid op.",
      relevance:
        "Helpt je sneller rijden zonder meer vermogen — puur door slimmer in de wind te zitten.",
    },
  },
  {
    dedupeKey: "academy-position-beats-gear-aero",
    kind: "academy",
    topic: "aerodynamica",
    title: "Waarom je houding meer scheelt dan je wielen",
    summary:
      "Het goedkoopste aerovoordeel zit niet in je portemonnee maar in je houding.",
    disciplines: ["road", "triathlon", "gravel", "all"],
    levels: ["beginner", "intermediate", "advanced"],
    sourceLabel: "Aerodynamica — verdeling luchtweerstand",
    content: {
      simple:
        "De grootste 'rem' in de wind ben je zelf, niet je fiets. Daarom levert kleiner maken in je houding meestal meer snelheid op dan dure aerospullen.",
      deep:
        "Van de totale luchtweerstand komt het grootste deel van het lichaam van de rijder en maar een kleiner deel van het frame en de wielen. Een lagere, compactere houding (vlakke rug, smalle ellebogen, hoofd uit de wind) verkleint je frontale oppervlak en daarmee je weerstand. Aerowielen en -frames helpen ook, maar het effect is kleiner én duurder dan wat je gratis met je lichaam kunt doen. De kunst is een aerohouding vinden die je lang kunt volhouden en waarin je nog goed vermogen kwijt kunt.",
      example:
        "Dezelfde renner die van rechtop naar laag-op-de-beugels gaat, rijdt bij gelijk vermogen merkbaar harder — vaak meer winst dan een set aerowielen oplevert.",
      conclusion:
        "Werk eerst (gratis) aan je houding, daarna pas aan materiaal. En train je aerohouding, zodat hij comfortabel en vol te houden wordt.",
      readMinutes: 4,
    },
  },

  // ── SLAAP ─────────────────────────────────────────────────────────────────
  {
    dedupeKey: "academy-sleep-recovery-tool",
    kind: "academy",
    topic: "slaap",
    title: "Slaap: je sterkste hersteltool",
    summary: "Geen supplement of massage komt in de buurt van een goede nacht.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Slaap- en herstelonderzoek bij sporters",
    content: {
      simple:
        "Je wordt niet sterker tijdens het trainen, maar tijdens het herstellen — en slaap is daarvan het belangrijkste deel. Te weinig slaap remt je herstel, je vorm en je concentratie.",
      deep:
        "In de diepe slaap lopen herstelprocessen die spieren en energievoorraden herstellen en het zenuwstelsel laten kalmeren. Structureel te kort slapen verhoogt je vermoeidheid, verlaagt je vermogen om hard te trainen en vergroot de kans op ziekte en blessures. Volwassen sporters hebben vaak baat bij zo'n 7–9 uur, met extra behoefte in zware trainingsweken; jonge sporters hebben er doorgaans nog meer nodig.",
      example:
        "Een week met structureel te weinig slaap voelt als 'benen vol' en mindere motivatie, ook al klopt je training. Herstel je slaap, dan komt je scherpte vaak vanzelf terug.",
      conclusion:
        "Behandel slaap als training: vaste tijden, donker en koel, scherm weg vóór het slapen. Het is de goedkoopste winst die er is.",
      readMinutes: 3,
    },
  },
  {
    dedupeKey: "myth-catch-up-sleep-weekend",
    kind: "myth_buster",
    topic: "slaap",
    title: "Slaaptekort haal je in het weekend in",
    summary: "Doordeweeks kort slapen en zaterdag uitslapen — lost dat het op?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Slaaponderzoek — slaapschuld",
    content: {
      statement:
        "Een week te weinig slapen maak je goed met één keer flink uitslapen in het weekend.",
      answer: "hangt_ervan_af",
      explanation:
        "Eén keer uitslapen helpt iets tegen acute vermoeidheid, maar herstelt niet alles van een hele week tekort. De aanpassingen die je training laten plakken, vragen om regelmaat, niet om één lange nacht.",
      science:
        "Opgebouwde 'slaapschuld' los je niet volledig op met een enkele uitslaapnacht; sommige effecten op alertheid en stofwisseling blijven hangen. Een regelmatig slaapritme werkt beter dan grote uitschieters.",
      application:
        "Mik op consistente bedtijden door de week heen. Een keer wat extra in het weekend mag, maar reken er niet op als reparatie voor structureel tekort.",
      relevance:
        "Voorkomt dat je je herstel ondermijnt met een ritme dat je vorm in de weg zit.",
    },
  },

  // ── WETENSCHAP ────────────────────────────────────────────────────────────
  {
    dedupeKey: "academy-what-is-vo2max",
    kind: "academy",
    topic: "wetenschap",
    title: "Wat is VO2max — en kun je het verbeteren?",
    summary: "Het 'motorvermogen' van je lichaam, in gewone taal.",
    disciplines: ["all"],
    levels: ["beginner", "intermediate", "advanced"],
    sourceLabel: "Inspanningsfysiologie — zuurstofopname",
    content: {
      simple:
        "VO2max is hoeveel zuurstof je lichaam maximaal kan opnemen en gebruiken per minuut. Hoe hoger, hoe groter je 'motor' voor harde, langere inspanningen. En ja: je kunt hem trainen.",
      deep:
        "VO2max hangt af van hoeveel zuurstofrijk bloed je hart kan rondpompen en hoe goed je spieren die zuurstof gebruiken. Aanleg speelt een rol, maar gerichte training — vooral stevige intervallen rond je maximale duurinspanning, bovenop een brede aerobe basis — verhoogt het meetbaar. De winst is het grootst bij wie nog ongetraind is en vlakt af naarmate je beter getraind raakt.",
      example:
        "Een paar weken intervallen van enkele minuten hard, afgewisseld met rust en bovenop rustige duur, tilt bij de meeste renners de VO2max omhoog.",
      conclusion:
        "VO2max is deels aanleg, deels training. Combineer een stevige aerobe basis met gerichte intervallen om hem te laten groeien.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "debate-marginal-gains",
    kind: "debate",
    topic: "wetenschap",
    title: "Werken 'marginal gains' echt?",
    summary:
      "Tientallen kleine voordeeltjes optellen tot winst — feit of marketing?",
    disciplines: ["all"],
    levels: ["intermediate", "advanced", "elite"],
    sourceLabel: "Sportwetenschap — kleine winsten vs. basis",
    content: {
      proposition:
        "Veel kleine verbeteringen optellen ('marginal gains') maakt het verschil tussen winnen en verliezen.",
      argumentFor:
        "Op topniveau liggen renners zo dicht bij elkaar dat een handvol kleine voordelen — aero, voeding, slaap, materiaal — samen een meetbaar verschil maken.",
      argumentAgainst:
        "Voor de meeste renners zijn de grote knoppen (trainingsopbouw, herstel, consistentie) nog lang niet uitgenut. Je verliezen in details terwijl de basis nog winst biedt, is zonde van je tijd.",
      science:
        "De wetenschap ondersteunt dat kleine voordelen optellen, maar vooral als de basis al op orde is. Het grootste rendement zit voor bijna iedereen in consistent trainen, voldoende herstel en goede voeding — pas daarna lonen de marges.",
      proTeams:
        "Topteams jagen op marginale winsten, maar bouwen die bovenop een keiharde trainings- en herstelbasis — niet in plaats daarvan.",
      conclusion:
        "Eerst de basis, dan de marges. Marginal gains werken, maar zijn geen shortcut om een onafgemaakte basis te omzeilen.",
      hasConsensus: false,
    },
  },

  // ── WEDSTRIJDEN ───────────────────────────────────────────────────────────
  {
    dedupeKey: "academy-pacing-race",
    kind: "academy",
    topic: "wedstrijden",
    title: "Pacing: waarom te hard starten je koers breekt",
    summary: "De klassieke fout: vol vertrekken en sterven in de finale.",
    disciplines: ["road", "gravel", "triathlon", "mtb", "all"],
    levels: ["all"],
    sourceLabel: "Wedstrijdfysiologie — verdeling van de inspanning",
    content: {
      simple:
        "Te hard beginnen voelt goed in de eerste minuten, maar kost je later veel meer dan het oplevert. Gelijkmatig verdelen is bijna altijd sneller over de hele afstand.",
      deep:
        "Wie ver boven zijn duurvermogen start, stapelt vroeg vermoeidheid en verzuring op die je later niet meer wegrijdt. Bij tijdritten en klimmen werkt een vrij gelijkmatige inspanning (of een ietsje conservatief begin) meestal het best. In een wedstrijd met groep en koerssituaties stuur je daarnaast op de juiste momenten — maar de basisregel blijft: spaar genoeg over voor het deel dat telt.",
      example:
        "Twee even sterke renners op een klim: wie gelijkmatig rijdt, klopt vaak wie vol start en halverwege instort.",
      conclusion:
        "Begin gecontroleerd en bewaar je beste kaarten voor het beslissende deel. Pacing wint koersen die kracht alleen niet wint.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "myth-early-attack-pointless",
    kind: "myth_buster",
    topic: "wedstrijden",
    title: "Van ver aanvallen is altijd kansloos",
    summary: "Vroege vluchters worden toch teruggepakt — of niet?",
    disciplines: ["road", "all"],
    levels: ["intermediate", "advanced"],
    sourceLabel: "Koerstactiek — praktijk profwielrennen",
    content: {
      statement:
        "Vroeg en van ver aanvallen heeft geen zin, want je wordt toch altijd teruggepakt.",
      answer: "hangt_ervan_af",
      explanation:
        "Vaak worden vroege aanvallen teruggehaald, maar lang niet altijd. Wind, parcours, samenwerking en het gedrag van het peloton bepalen of een vroege move standhoudt.",
      science:
        "Een groep die goed samenwerkt rijdt efficiënter dan een eenling, dus statistisch worden veel vluchten gegrepen. Maar bij tegenwind voor het peloton, een zwaar parcours, verdeeld jagen of een sterke samenwerkende kopgroep kan een vroege aanval wél slagen.",
      application:
        "Kies je moment: val van ver aan als de omstandigheden je helpen (wind, zwaar parcours, niemand die wil jagen) en spaar anders je krachten voor later.",
      relevance:
        "Helpt je inschatten wanneer een waagstuk slim is in plaats van zinloos.",
    },
  },

  // ── MENTAAL ───────────────────────────────────────────────────────────────
  {
    dedupeKey: "myth-mental-toughness-innate",
    kind: "myth_buster",
    topic: "mentaal",
    title: "Mentale kracht heb je of heb je niet",
    summary: "Is doorzettingsvermogen aangeboren talent of te trainen?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — mentale vaardigheden",
    content: {
      statement:
        "Mentale kracht is een aangeboren eigenschap: je hebt het of je hebt het niet.",
      answer: "niet_waar",
      explanation:
        "Mentale vaardigheden zijn net als fysieke: je kunt ze trainen. Focus, omgaan met ongemak en jezelf toespreken worden beter met oefening.",
      science:
        "Sportpsychologie laat zien dat technieken als doelen stellen, zelfspraak, ademhaling en het opdelen van een inspanning in stukken helpen om door zware momenten te komen — en dat ze trainbaar zijn, niet vast.",
      application:
        "Oefen mentale technieken net als intervallen: bedenk vooraf een paar zinnen voor zware momenten, hak een lange inspanning op in stukjes, en stuur je ademhaling als het zwaar wordt.",
      relevance:
        "Geeft je grip op je hoofd op de momenten dat je benen het willen opgeven.",
    },
  },
  {
    dedupeKey: "academy-focus-hard-moments",
    kind: "academy",
    topic: "mentaal",
    title: "Je focus sturen op de zwaarste momenten",
    summary:
      "Wat je tegen jezelf zegt als het pijn doet, bepaalt vaak hoe ver je komt.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — aandacht en zelfspraak",
    content: {
      simple:
        "Op zware momenten dwaalt je hoofd naar 'ik kan niet meer'. Je kunt je aandacht bewust ergens anders op richten — je ademhaling, je tempo, het volgende bochtje — en zo langer doorgaan.",
      deep:
        "Aandacht is stuurbaar. Naar binnen voelen (ademhaling, cadans, houding) helpt bij het bewaken van je inspanning; de aandacht naar buiten richten helpt om door een dood punt te komen. Korte, positieve zelfspraak ('rustig ademen', 'tot de boom') werkt beter dan jezelf afkraken. Door een lange inspanning op te delen in behapbare stukjes voelt de hele klus minder overweldigend.",
      example:
        "In plaats van 'nog 20 minuten' denken aan 'tot de volgende bocht' — en daarna weer de volgende. Stukje voor stukje kom je verder dan je dacht.",
      conclusion:
        "Bereid een paar zinnen en een focuspunt voor vóór je zwaarste trainingen en koersen. Wie zijn aandacht stuurt, houdt het langer vol.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "debate-visualisation-works",
    kind: "debate",
    topic: "mentaal",
    title: "Helpt visualisatie echt?",
    summary: "Een wedstrijd vooraf in je hoofd afspelen: zweverig of zinvol?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — mentale verbeelding",
    content: {
      proposition:
        "Je inspanning of wedstrijd vooraf in detail visualiseren verbetert je prestatie.",
      argumentFor:
        "Voorstanders zeggen dat het vooraf doorlopen van scenario's je voorbereidt op zware momenten, zenuwen vermindert en je sneller de juiste keuze laat maken.",
      argumentAgainst:
        "Critici vinden het vaag en moeilijk meetbaar, en waarschuwen dat het oefenen op de fiets niet vervangt.",
      science:
        "Onderzoek in de sportpsychologie laat zien dat gestructureerde mentale verbeelding — levendig, met alle zintuigen en herhaald — een ondersteunend effect kan hebben op vaardigheid en zelfvertrouwen. Het is een aanvulling op fysieke training, geen vervanging.",
      proTeams:
        "Veel topsporters gebruiken vaste mentale routines en visualiseren cruciale momenten als onderdeel van hun voorbereiding.",
      conclusion:
        "Visualisatie helpt als aanvulling, mits je het concreet en regelmatig doet. Het vervangt geen training, maar maakt je voorbereiding completer.",
      hasConsensus: true,
    },
  },
  {
    dedupeKey: "myth-nerves-are-bad",
    kind: "myth_buster",
    topic: "mentaal",
    title: "Zenuwen voor de start zijn een slecht teken",
    summary:
      "Kriebels in je buik voor een koers — betekent dat dat je er niet klaar voor bent?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — spanning en prestatie",
    content: {
      statement:
        "Als je zenuwachtig bent voor een wedstrijd, ben je mentaal niet sterk genoeg en ga je slechter presteren.",
      answer: "niet_waar",
      explanation:
        "Spanning voor de start is normaal en hoort erbij — ook bij profs. Je lichaam maakt zich klaar om te presteren: hogere hartslag, scherpere zintuigen. Het wordt pas een probleem als de spanning je verlamt of je nachtrust dagenlang verpest.",
      science:
        "Sportpsychologie beschrijft spanning als activatie: een zekere mate van opwinding helpt juist om scherp te zijn. Hoe je de spanning uitlegt maakt het verschil — wie kriebels ziet als 'klaar om te knallen' presteert doorgaans beter dan wie ze ziet als bewijs van zwakte.",
      application:
        "Zeg tegen jezelf 'ik ben er klaar voor' in plaats van 'ik ben bang'. Maak een vaste startroutine (materiaal checken, inrijden, ademhaling) zodat je hoofd iets te doen heeft. De spanning zakt meestal zodra het startschot klinkt.",
      relevance:
        "Voorkomt dat je gezonde wedstrijdspanning aanziet voor een probleem — en helpt je hem te gebruiken.",
    },
  },
  {
    dedupeKey: "academy-setback-bad-day",
    kind: "academy",
    topic: "mentaal",
    title: "Omgaan met een slechte dag of tegenvaller",
    summary:
      "Een mislukte training, een lekke band in de koers, ziek in een belangrijke week — wat doe je ermee?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — omgaan met tegenslag",
    content: {
      simple:
        "Eén slechte training of één mislukte koers zegt bijna niets over je vorm of je toekomst. Wat telt is wat je erna doet: kort balen mag, daarna kijk je wat je ervan kunt leren en ga je door met het plan.",
      deep:
        "Tegenslag hoort structureel bij sport — ook toppers rijden mislukte koersen. Het verschil zit in de verwerking: sporters die een tegenvaller zien als informatie ('wat kan ik hiervan leren?') herstellen mentaal sneller dan sporters die hem zien als bewijs ('ik ben niet goed genoeg'). Een handige volgorde: eerst even echt balen (emotie mag er zijn), dan feiten scheiden van conclusies (wat gebeurde er precies, wat lag binnen je macht?), dan één concrete les formuleren, en afsluiten door vooruit te kijken naar het volgende doel.",
      example:
        "Je valt stil in de finale omdat je te weinig gegeten hebt. Balen — maar de les is concreet: eetschema voor lange koersen aanpassen. Dat is bruikbaarder dan 'ik kan geen koers uitrijden'.",
      conclusion:
        "Geef een tegenvaller een vaste plek: kort balen, feiten op een rij, één les eruit halen, door. Zo wordt elke slechte dag bruikbaar in plaats van beschadigend.",
      readMinutes: 5,
    },
  },
  {
    dedupeKey: "academy-motivation-dips",
    kind: "academy",
    topic: "mentaal",
    title: "Als de zin even weg is",
    summary:
      "Elke sporter kent periodes waarin de motivatie inzakt. Wat helpt echt om er doorheen te komen?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — motivatie",
    content: {
      simple:
        "Een dip in je zin om te trainen is normaal en gaat meestal vanzelf over. Verlaag tijdelijk de lat: korter, rustiger of gewoon lekker fietsen zonder plan houdt de gewoonte in stand tot de zin terugkomt.",
      deep:
        "Motivatie golft — dat is geen karakterfout. De sterkste voorspeller van volhouden is niet wilskracht maar plezier en een gevoel van eigen keuze: sporters die zelf (mee)bepalen wat en waarom ze trainen, houden het langer vol dan sporters die alleen een schema uitvoeren. Bij een dip helpt het om terug te gaan naar de basis: waarom fiets je eigenlijk? Rij een rondje zonder meter, met vrienden, of een route die je mooi vindt. Waak wel voor het verschil tussen een gewone dip en aanhoudende futloosheid met slechte slaap en prikkelbaarheid — dat kan op te veel belasting wijzen.",
      example:
        "Een week alleen maar losse, korte ritjes zonder schema voelt als 'verloren training', maar houdt het wiel draaiend — en vaak komt halverwege zo'n week de zin vanzelf terug.",
      conclusion:
        "Bescherm in mindere periodes de gewoonte, niet de cijfers. Plezier is geen bijzaak: het is de motor onder alles.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "trend-mental-coaching-peloton",
    kind: "trend",
    topic: "mentaal",
    title: "Mentale begeleiding wordt normaal in het peloton",
    summary:
      "Waar het jarenlang taboe was, praten profs nu openlijk over de sportpsycholoog.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Ontwikkelingen profwielrennen — begeleidingsstaf",
    content: {
      whatChanges:
        "Steeds meer profploegen en talentopleidingen hebben vaste mentale begeleiding in de staf, en renners vertellen er openlijk over — van omgaan met wedstrijddruk en valpartijen tot terugkomen na blessures.",
      why: "De fysieke verschillen aan de top zijn klein; het verschil zit steeds vaker in wie er onder druk het beste bij blijft. Tegelijk is het taboe op praten over mentale gezondheid in de sport kleiner geworden.",
      pros: [
        "Problemen worden eerder besproken in plaats van opgekropt",
        "Vaardigheden als focus en omgaan met druk worden gericht getraind",
        "Terugkeer na een val of blessure wordt ook mentaal begeleid",
      ],
      cons: [
        "Goede begeleiding is niet overal beschikbaar, zeker niet bij de jeugd",
        "Het is geen quick fix — het vraagt net als training tijd en herhaling",
      ],
      confidence: "high",
      confidenceNote:
        "De verschuiving zelf is duidelijk zichtbaar in hoe ploegen hun staf inrichten en hoe renners erover praten; hoeveel het per individu oplevert verschilt.",
    },
  },
  {
    dedupeKey: "debate-analyse-direct-or-later",
    kind: "debate",
    topic: "mentaal",
    title: "Slechte koers: meteen analyseren of eerst laten bezinken?",
    summary:
      "De één wil direct de data in, de ander wil er een dag niet aan denken. Wie heeft gelijk?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Coachingpraktijk — evaluatie en emotie",
    content: {
      proposition:
        "Na een tegenvallende wedstrijd kun je het beste meteen analyseren wat er misging.",
      argumentFor:
        "Direct analyseren voelt daadkrachtig: de herinnering is vers, details zijn nog scherp en je zet frustratie meteen om in verbeterpunten.",
      argumentAgainst:
        "Vlak na de finish kijk je door een emotionele bril: alles lijkt slechter dan het was, en conclusies worden hard en persoonlijk ('ik stel niks voor') in plaats van zakelijk.",
      science:
        "Uit de coachingpraktijk en sportpsychologie komt een middenweg: emoties direct na afloop kleuren het oordeel sterk, waardoor evaluaties op dat moment onbetrouwbaar zijn. Een korte feitelijke notitie direct na afloop (wat gebeurde er?) gecombineerd met de echte analyse een dag later (waarom, en wat nu?) combineert verse details met een koeler hoofd.",
      proTeams:
        "Veel ploegleiders houden direct na de koers een korte feitelijke nabespreking en plannen de echte evaluatie pas dagen later.",
      conclusion:
        "Noteer direct kort de feiten, trek pas een dag later conclusies. Zo verlies je geen details én geen zelfvertrouwen.",
      hasConsensus: true,
    },
  },
  {
    dedupeKey: "academy-resilience-bad-legs",
    kind: "academy",
    topic: "mentaal",
    title: "Weerbaarheid: goed trainen zonder goede benen",
    summary:
      "In de winter voelen belangrijke trainingen zelden fijn. Weerbaarheid is de vaardigheid om ze tóch goed uit te voeren — en die kun je trainen.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie & coachingpraktijk — mentale weerbaarheid",
    content: {
      simple:
        "Wachten op goede benen is geen plan: in de winter komen ze zelden, en juist dan staan de belangrijke blokken op het programma. Weerbaarheid betekent dat de kwaliteit van je training niet afhangt van hoe je je voelt. Niet doorbeuken bij ziekte of echte vermoeidheid — wel leren dat 'geen zin, zware benen bij de start' meestal niets zegt over wat je vandaag kunt.",
      deep:
        "Weerbaarheid is een vaardigheid, geen karaktereigenschap — en elke zware winterdag is een oefenkans. Wat het oplevert: (1) je wordt onafhankelijk van je dagvorm — wie alleen goed traint op goede dagen, traint in de winter bijna nooit goed; (2) het betaalt uit in de koers, want daar voelt het óók nooit fijn op het moment dat het erom gaat — wie in november intervallen leerde afmaken op zware benen, herkent dat gevoel in de finale en schrikt er niet meer van; (3) elke afgemaakte training op een mindere dag is bewijs voor je zelfvertrouwen dat gevoel en kunnen twee verschillende dingen zijn. Hoe je het traint: verklein de opdracht tot alleen het eerstvolgende blok (niet 'nog twee uur', maar 'dit interval'); beoordeel de uitvoering op wat je deed — vermogen, uitvoering, afgemaakt — niet op hoe het voelde; en spreek vooraf met jezelf af waarop je écht mag stoppen (ziekte, pijn die verergert, aanhoudende oververmoeidheid), zodat 'geen zin' geen sluiproute wordt.",
      example:
        "Blokkentraining in januari: koud, zware benen vanaf de eerste minuut. In plaats van af te breken rijd je alleen het eerste blok — dat blijkt qua vermogen gewoon goed. Je maakt de training af en noteert: gevoel slecht, uitvoering prima. Drie maanden later, in de finale van een klassieker, herken je exact datzelfde gevoel — en weet je uit ervaring dat je er doorheen kunt.",
      conclusion:
        "Goede benen zijn schaars, belangrijke trainingen niet. Wie leert presteren op mindere dagen, bouwt precies de vaardigheid op die in de koers het verschil maakt — én het zelfvertrouwen dat erbij hoort.",
      readMinutes: 5,
    },
  },
  {
    dedupeKey: "myth-dnf-mental-weakness",
    kind: "myth_buster",
    topic: "mentaal",
    title: "Opgeven is altijd mentale zwakte",
    summary:
      "Afstappen in een koers of training afbreken — is dat per definitie een teken van een zwak hoofd?",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie & trainingsleer — belasting en beslissen",
    content: {
      statement:
        "Wie een koers of training niet afmaakt, is mentaal zwak — doorzetten is altijd de juiste keuze.",
      answer: "hangt_ervan_af",
      explanation:
        "Soms is stoppen juist de sterkste keuze: doorrijden met een blessure, ziekte of bij gevaarlijke omstandigheden maakt de schade groter. Maar wie bij elk zwaar moment afstapt, leert nooit dat een dood punt voorbijgaat. Het verschil zit in de reden.",
      science:
        "Trainingsleer is duidelijk over doortrainen bij ziekte of blessure: dat verlengt de uitval. Tegelijk laat de sportpsychologie zien dat het doorstaan van zware momenten — als het lichaam gezond is — het vertrouwen opbouwt dat je meer aankunt dan je denkt.",
      application:
        "Maak vooraf afspraken met jezelf: bij pijn die verergert, ziekte of gevaar stap je af, zonder schuldgevoel. Bij 'het is gewoon zwaar' geef je jezelf eerst tien minuten en een hapje eten — een dood punt trekt vaak weg.",
      relevance:
        "Helpt je op het moment zelf een eerlijk onderscheid te maken tussen verstandig stoppen en te vroeg opgeven.",
    },
  },
  {
    dedupeKey: "academy-breathing-under-pressure",
    kind: "academy",
    topic: "mentaal",
    title: "Ademhaling sturen als het zwaar wordt",
    summary:
      "Je adem is de snelste knop die je hebt om een mentale dip te dempen — op de fiets en ernaast.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — ademhaling en spanningsregulatie",
    content: {
      simple:
        "Als het zwaar wordt, gaat je ademhaling vanzelf hoog en snel — en dat versterkt het gevoel van paniek en 'ik kan niet meer'. Door je adem bewust te sturen (langer uit dan in) kalmeert je hoofd, terwijl je benen gewoon doortrappen.",
      deep:
        "Een bewust verlengde uitademing remt de stressreactie: hartslag en spanningsgevoel zakken iets, terwijl het vermogen dat je trapt gelijk blijft. Daarom is ademsturing zo bruikbaar op het moment dat je hoofd wil stoppen maar je lichaam nog kan. Het werkt het best als je het vooraf oefent op rustige ritten, zodat het patroon (bijvoorbeeld 3 tellen in, 4 tellen uit) er al in zit voordat je het onder druk nodig hebt. Belangrijk onderscheid: dit dempt de mentale dip, het maskeert geen echte uitputting — vermogen dat structureel wegzakt is een lichaamssignaal, geen ademkwestie.",
      example:
        "Halverwege het derde interval roept je hoofd 'stop'. In plaats van meteen te beslissen: tien ademhalingen, 3 tellen in, 4 tellen uit, blik op de weg. Daarna blijkt de dip meestal weggezakt — en het interval haalbaar.",
      conclusion:
        "Oefen één vast adempatroon op rustige ritten en zet het in bij de eerste mentale dip. Eerst ademen, dan pas beslissen.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "academy-chunking-long-efforts",
    kind: "academy",
    topic: "mentaal",
    title: "Opdelen: de hele training bestaat niet",
    summary:
      "Niemand rijdt '2 uur met blokken' — je rijdt steeds één blok. Wie zo denkt, maakt meer trainingen af.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — chunking en doelen stellen",
    content: {
      simple:
        "Een lange of zware training voelt als een berg zolang je naar het geheel kijkt. Deel hem op in stukken die je wél kunt overzien: dit interval, dit kwartier, tot dat dorp. Je hoofd hoeft alleen het eerstvolgende stuk aan te kunnen.",
      deep:
        "Grote opdrachten voelen zwaarder dan de som van hun delen: wie aan 'nog 90 minuten' denkt, geeft eerder op dan wie aan 'nog dit blok' denkt. Opdelen (chunking) verkleint de mentale last per beslismoment, en elk afgerond stuk levert een klein succesje op dat motivatie teruggeeft — precies op de momenten dat die wegzakt. De kunst zit in de maat: stukken van 5 à 15 minuten of één herhaling werken beter dan halve trainingen. En de regel is: beslissen over stoppen mag alleen op de grens tussen twee stukken, nooit middenin.",
      example:
        "Vier keer acht minuten drempel. In plaats van 'nog 24 minuten hard' na het eerste blok: alleen blok twee telt. Pauze. Dan pas bestaat blok drie. Wie zo telt, staat vaker verbaasd aan het einde van blok vier.",
      conclusion:
        "Knip elke zware training vooraf in stukken en beslis alleen op de grenzen. Het volgende blok is altijd haalbaar — en meer hoeft je hoofd niet te weten.",
      readMinutes: 4,
    },
  },
  {
    dedupeKey: "academy-acceptance-start-anyway",
    kind: "academy",
    topic: "mentaal",
    title: "Accepteren en tóch starten",
    summary:
      "Geen zin en zware benen hoef je niet weg te vechten. Erken ze — en start de eerste tien minuten toch.",
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "Sportpsychologie — acceptatie en gedrag",
    content: {
      simple:
        "Vechten tegen 'geen zin' kost energie en werkt zelden. Wat wél werkt: benoem wat je voelt ('geen zin', 'zware benen'), accepteer dat het er is, en spreek met jezelf af dat je alleen de eerste tien minuten rustig start. Daarna beslis je pas echt.",
      deep:
        "Gevoelens zijn geen opdrachten: 'geen zin' is informatie, geen instructie om over te slaan. Acceptatie betekent niet dat je alles goed vindt, maar dat je stopt met vechten tegen het gevoel en je energie in de eerstvolgende actie steekt. De tienminutenregel gebruikt een betrouwbaar patroon: weerstand is bijna altijd het grootst vóór de start en zakt zodra je bezig bent. Wie de beslissing verplaatst van de bank naar minuut tien, beslist met betere informatie — hoe het rijden nu écht voelt in plaats van hoe het idee ervan voelt. Blijkt het na tien minuten nog steeds leeg en zwaar, dan is aanpassen of inkorten een eerlijke, volwassen keuze — geen nederlaag.",
      example:
        "Woensdagavond, donker, geen zin. Afspraak met jezelf: alleen omkleden en tien minuten rustig rijden. Op minuut acht voelen de benen gewoon normaal en rijd je het geplande schema. Was het na tien minuten nog steeds niets geweest, dan had je met een gerust hart een rustige korte rit gedaan.",
      conclusion:
        "Erken het gevoel, start klein, en beslis pas op minuut tien. Zo beslist je hoofd niet vanaf de bank over een training die het nog niet kent.",
      readMinutes: 4,
    },
  },
];

export async function ensureIntelSeed(opts?: {
  log?: (msg: string) => void;
}): Promise<{ total: number; inserted: number; updated: number }> {
  const log = opts?.log ?? (() => {});
  let inserted = 0;
  let updated = 0;

  for (const card of CARDS) {
    const existing = await db
      .select({ id: intelCardsTable.id })
      .from(intelCardsTable)
      .where(sql`${intelCardsTable.dedupeKey} = ${card.dedupeKey}`);

    await db
      .insert(intelCardsTable)
      .values(card)
      .onConflictDoUpdate({
        target: intelCardsTable.dedupeKey,
        set: {
          kind: card.kind,
          topic: card.topic,
          title: card.title,
          summary: card.summary,
          content: card.content,
          disciplines: card.disciplines,
          levels: card.levels,
          sourceLabel: card.sourceLabel,
          sourceUrl: card.sourceUrl ?? null,
          status: card.status ?? "published",
          updatedAt: new Date(),
        },
      });

    if (existing.length) updated++;
    else inserted++;
  }

  // The Kennisbank surface is gated by the shared `knowledge_base` flag. A
  // flag with NO row is off for everyone, so a fresh database (e.g. a newly
  // provisioned production DB) would ship the cards invisibly. Create the row
  // enabled-globally ONLY when it does not exist yet — an admin decision to
  // disable it later is never overwritten (onConflictDoNothing).
  const flagRows = await db
    .insert(featureFlagsTable)
    .values({
      key: "knowledge_base",
      description:
        "Kennisbank: Voor jou-kaarten en de onderzoeksbibliotheek op /kennis.",
      enabledGlobally: true,
    })
    .onConflictDoNothing({ target: featureFlagsTable.key })
    .returning({ key: featureFlagsTable.key });
  if (flagRows.length > 0) {
    log("knowledge_base flag row created (enabled globally)");
  }

  const byKind = new Map<string, number>();
  for (const c of CARDS) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);

  log(`${CARDS.length} cards: ${inserted} new, ${updated} updated.`);
  log(
    `by kind: ${Array.from(byKind.entries())
      .map(([k, n]) => `${k}=${n}`)
      .join(", ")}`,
  );

  return { total: CARDS.length, inserted, updated };
}
