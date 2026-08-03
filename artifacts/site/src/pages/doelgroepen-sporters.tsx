import { TargetGroupPage } from '@/components/target-group-page';

export function Renner() {
  return (
    <TargetGroupPage
      title="De renner"
      promise="Een routeplanner die weet wat voor rit je wilt maken."
      screenPath="route"
      screenAlt="De routeplanner tekent een route op maat"
      benefits={[
        {
          title: "Jouw tijd, jouw afstand",
          description: "Zeg hoeveel uur je hebt. Sparki tekent de perfecte lus vanaf je voordeur."
        },
        {
          title: "Geen verrassingen op de weg",
          description: "Elke onverharde strook of kasseienstrook is duidelijk gemarkeerd."
        },
        {
          title: "Direct op je stuur",
          description: "Stuur de gemaakte route met één tik naar je Garmin of Wahoo."
        }
      ]}
      ctaType="buy"
      ctaText="Begin nu"
      pricingLink="/prijzen/sporters"
    />
  );
}

export function RennerMetPlan() {
  return (
    <TargetGroupPage
      title="De renner met een plan"
      promise="Begeleiding die uitlegt waarom, en een route die bij je training past."
      screenPath="train"
      screenAlt="Overzicht van het trainingsplan voor vandaag"
      benefits={[
        {
          title: "Snap wat je doet",
          description: "Geen blinde commando's. Elke training vertelt je het doel en het waarom."
        },
        {
          title: "Routes op basis van je schema",
          description: "Moet je vandaag blokken draaien? De routeplanner zoekt het juiste traject zonder stoplichten."
        },
        {
          title: "De waarheid in je analyse",
          description: "Zonder filter. Sparki zegt je precies of je de training goed hebt uitgevoerd of niet."
        }
      ]}
      ctaType="buy"
      ctaText="Begin nu"
      pricingLink="/prijzen/sporters"
    />
  );
}

export function Ouder() {
  return (
    <TargetGroupPage
      title="De ouder"
      promise="Je kind fietst bij een club en jij ziet wat er gebeurt."
      screenPath="ouder"
      screenAlt="Overzicht in de ouder-app met testdata voor een jeugdlid"
      benefits={[
        {
          title: "Veilig geregeld",
          description: "Jij beheert het account, je geeft toestemmingen, en je kind kan zich focussen op het fietsen."
        },
        {
          title: "Altijd op de hoogte",
          description: "Zie direct wanneer de trainingen zijn en of de locatie is veranderd."
        },
        {
          title: "Privacy voorop",
          description: "Alleen de trainer en jij zien de gegevens. Geen openbare profielen."
        }
      ]}
      ctaType="share"
      ctaText="Stuur dit naar je club"
      shareMessage="Kijk eens naar Sparki, misschien is dit iets voor onze club om het jeugdbeheer makkelijker te maken."
    />
  );
}
