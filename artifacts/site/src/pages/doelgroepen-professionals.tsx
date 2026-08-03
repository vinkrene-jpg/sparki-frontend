import { TargetGroupPage } from '@/components/target-group-page';

export function Trainer() {
  return (
    <TargetGroupPage
      title="De zelfstandige trainer"
      promise="Training, analyse, voeding én facturatie in één, voor één prijs."
      screenPath="trainer"
      screenAlt="Trainersdashboard met testdossiers van sporters"
      benefits={[
        {
          title: "Stop met knippen en plakken",
          description: "Geen drie verschillende abonnementen meer. Alles wat je nodig hebt om je sporters te begeleiden zit in één app."
        },
        {
          title: "Snel schakelen met specialisten",
          description: "Nodig een voedingsdeskundige uit op een dossier, zonder dat ze de rest van je sporters kunnen zien."
        },
        {
          title: "Heldere communicatie",
          description: "Je atleet snapt waarom hij iets moet doen. Dat scheelt jou tijd in de uitleg."
        }
      ]}
      ctaType="buy"
      ctaText="Bekijk de prijzen"
      pricingLink="/prijzen/professionals"
    />
  );
}

export function Club() {
  return (
    <TargetGroupPage
      title="De club"
      promise="Leden, seizoenen, jeugd en toestemmingen geregeld — gratis."
      screenPath="club"
      screenAlt="Cluboverzicht met testleden in het systeem"
      benefits={[
        {
          title: "Voor altijd kosteloos",
          description: "De basisadministratie voor de club kost niets. Geld gaat naar de clubkas, niet naar software."
        },
        {
          title: "Jeugd en ouders centraal",
          description: "Ouders beheren de accounts van de jongste jeugd. Dat scheelt een berg administratie."
        },
        {
          title: "Een fundament om op te bouwen",
          description: "Als trainers of renners meer willen (zoals premium trainingsplannen), regelen ze dat zelf bovenop het gratis clubaccount."
        }
      ]}
      ctaType="buy"
      ctaText="Begin nu"
      pricingLink="/prijzen/professionals"
    />
  );
}

export function Clubtrainer() {
  return (
    <TargetGroupPage
      title="De clubtrainer"
      promise="Je groep in één beeld, en zien wie aandacht nodig heeft."
      screenPath="clubtrainer"
      screenAlt="Groepsweergave voor de clubtrainer met testdata van renners"
      benefits={[
        {
          title: "Wie is er vanavond?",
          description: "Geen app-groepen meer doorspitten. In één oogopslag helder wie er bij de training is."
        },
        {
          title: "Spot de overbelasting",
          description: "Je ziet gemarkeerd wie te veel doet of rust nodig heeft, nog voordat ze zelf klagen."
        },
        {
          title: "Deel makkelijk in",
          description: "Verdeel de grote groep soepel in subgroepen op basis van het gemeten niveau."
        }
      ]}
      ctaType="share"
      ctaText="Stuur dit naar je club"
      shareMessage="Deze app is ideaal om onze groepen en jeugd in te beheren."
    />
  );
}

export function Team() {
  return (
    <TargetGroupPage
      title="Het team"
      promise="De hele wedstrijdoperatie in één plan."
      screenPath="team"
      screenAlt="De teampagina in de clubomgeving, momenteel zonder actieve wedstrijden"
      caption="Echt scherm uit de clubomgeving — hier verschijnt de wedstrijddag zodra de club die vult."
      benefits={[
        {
          title: "Centrale regie",
          description: "Eén plek waar het hele wedstrijdschema, de selecties en de logistiek samenkomen."
        },
        {
          title: "Klaar voor de start",
          description: "Elke zaterdag verloopt vlekkeloos, omdat iedereen precies weet wat zijn rol is."
        },
        {
          title: "Eén factuur",
          description: "Eén abonnement voor het hele team, zonder gedoe met individuele vergoedingen."
        }
      ]}
      ctaType="buy"
      ctaText="Bekijk de prijzen"
      pricingLink="/prijzen/professionals"
    />
  );
}

export function Ploegleider() {
  return (
    <TargetGroupPage
      title="De ploegleider"
      promise="Zaterdag geregeld: bezetting, dagschema, vervoer, materiaal, taken."
      screenPath="ploegleider"
      screenAlt="De ploegleidersweergave, momenteel zonder actieve wedstrijden"
      caption="Echt scherm uit de clubomgeving — hier verschijnt de wedstrijddag zodra de club die vult."
      benefits={[
        {
          title: "Het draaiboek in je zak",
          description: "In de volgwagen heb je direct toegang tot de voedingstijden, het materiaal en de renners."
        },
        {
          title: "Direct communiceren",
          description: "Stuur last-minute wijzigingen door die meteen bij de juiste renners op het scherm verschijnen."
        },
        {
          title: "Na de koers",
          description: "Verzamel direct de data van de wedstrijd om maandag scherp te evalueren."
        }
      ]}
      ctaType="share"
      ctaText="Stuur dit naar je ploegleider"
      shareMessage="Als ploegleider heb je hier het complete overzicht van de wedstrijddag. Kijk eens of we dit in de ploeg kunnen gebruiken."
    />
  );
}

export function Staf() {
  return (
    <TargetGroupPage
      title="De staf"
      promise="Jouw deel van het plan, op je telefoon, ook zonder bereik."
      screenPath="staf"
      screenAlt="Het staf-overzicht, momenteel zonder geplande taken"
      caption="Echt scherm voor de staf — hier verschijnen jouw specifieke taken zodra het plan is gemaakt."
      benefits={[
        {
          title: "Alleen wat jij moet weten",
          description: "Als soigneur zie je de voeding en massagetijden. Als mechanieker de bandenspanning."
        },
        {
          title: "Offline beschikbaar",
          description: "Staat de materiaalwagen ergens in een polder zonder bereik? Het plan blijft werken."
        },
        {
          title: "Minder vragen, meer doen",
          description: "Iedereen kent zijn taken, dus je kunt je focussen op je vak."
        }
      ]}
      ctaType="share"
      ctaText="Stuur dit naar je ploegleider"
      shareMessage="Kijk eens naar deze app, dan hebben we als staf het complete draaiboek offline op onze telefoon."
    />
  );
}

export function Specialist() {
  return (
    <TargetGroupPage
      title="De specialisten"
      promise="Jouw analyse en plannen, gekoppeld aan de sporter, zonder dat de trainer je dossier inziet."
      screenPath="specialist"
      screenAlt="Het specialisten-dashboard, momenteel zonder gekoppelde sporters"
      caption="Echt scherm van de specialistenomgeving — hier verschijnen sporters zodra ze aan je gekoppeld zijn."
      benefits={[
        {
          title: "Bewaak je domein",
          description: "Jij beheert de voeding of de medische data. De hoofdtrainer ziet alleen wat nodig is."
        },
        {
          title: "Altijd de actuele data",
          description: "Je plannen sluiten naadloos aan op de trainingsarbeid die zojuist is gemeten."
        },
        {
          title: "Direct in verbinding",
          description: "De sporter ziet jouw adviezen op precies het juiste moment in zijn dashboard verschijnen."
        }
      ]}
      ctaType="share"
      ctaText="Stuur dit naar de ploeg of club"
      shareMessage="Deze app is handig voor onze samenwerking, want hiermee kan ik veilig mijn dossiers bijhouden naast de trainer."
    />
  );
}
