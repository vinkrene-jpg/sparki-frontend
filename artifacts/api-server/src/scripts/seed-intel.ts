// Curated seed for the Performance Intelligence Hub (intel_cards).
//
// Every card below is REAL, sourced editorial content — myth verdicts grounded in
// exercise-physiology consensus, gear comparisons using published manufacturer
// figures (and "—"/null where a spec is not published, never guessed), trends and
// debates that reflect genuine peloton/coaching practice. Each card states its
// provenance in `sourceLabel`. No fabricated numbers.
//
// Idempotent: keyed on `dedupeKey`, re-running upserts in place. Safe to run
// repeatedly in dev and as a one-off in prod.
//
// Run: `pnpm --filter @workspace/api-server run seed:intel`
// Requires: DATABASE_URL.

import {
  db,
  pool,
  intelCardsTable,
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
];

async function seed() {
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

  const byKind = new Map<string, number>();
  for (const c of CARDS) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);

  console.log(
    `[seed-intel] ${CARDS.length} cards: ${inserted} new, ${updated} updated.`,
  );
  console.log(
    `[seed-intel] by kind: ${Array.from(byKind.entries())
      .map(([k, n]) => `${k}=${n}`)
      .join(", ")}`,
  );
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed-intel] failed:", err);
    await pool.end();
    process.exit(1);
  });
