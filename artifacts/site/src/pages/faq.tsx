import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';

export function FAQ() {
  usePageMeta({
    title: 'Veelgestelde Vragen',
    description: 'Antwoorden op de meest gestelde vragen over Sparki, voor zowel sporters als professionals.'
  });

  const sportersFaq = [
    {
      q: "Hoe weet de routeplanner wat ik nodig heb?",
      a: "Sparki kijkt naar je trainingsplan voor vandaag, of naar wat je invoert. Wil je 2 uur in D1 (rustig) fietsen? Dan vermijdt de planner drukke stoplichten en steile klimmen, zodat je je hartslag laag kunt houden."
    },
    {
      q: "Kan ik de routes naar mijn Garmin of Wahoo sturen?",
      a: "Ja. Koppel je account één keer, en elke gemaakte route wordt met één druk op de knop naar je fietscomputer gestuurd."
    },
    {
      q: "Hoe wordt mijn data gebruikt?",
      a: "Je data is van jou. Wij verkopen geen gegevens aan derden en tonen geen advertenties. Jouw ritten worden puur en alleen gebruikt om jouw eigen analyse te verbeteren."
    }
  ];

  const professionalsFaq = [
    {
      q: "Waarom is het clubbeheer gratis?",
      a: "We vinden dat sportverenigingen hun contributie aan de jeugd en materiaal moeten besteden, niet aan softwarelicenties. De basis (leden, groepen, toestemmingen) is gratis. Wil een trainer meer functies? Dan betaalt die daar zelf voor."
    },
    {
      q: "Hoe zit het met de privacy van jeugdleden?",
      a: "Ouders beheren de accounts van jeugdleden tot 16 jaar. Een jeugdlid heeft geen openbaar profiel, en uitsluitend de trainer en de ouder kunnen de gegevens inzien."
    },
    {
      q: "Kunnen externe specialisten (zoals een diëtist) meekijken?",
      a: "Ja. Je kunt een specialist uitnodigen op het dossier van een specifieke sporter. De specialist ziet dan de data die hij/zij nodig heeft, maar heeft geen toegang tot de rest van je sporters."
    }
  ];

  return (
    <Layout>
      <div className="pt-24 pb-32 px-6 max-w-3xl mx-auto animate-fade-in-up">
        <h1 className="type-display text-foreground mb-4">Veelgestelde vragen</h1>
        <p className="type-body text-muted-foreground mb-16">
          Geen vage marketingtaal, gewoon antwoord op je vragen. Zodra ons helpcentrum klaar is, vind je hier nog meer uitgebreide artikelen.
        </p>

        <div className="space-y-16">
          <section>
            <h2 className="type-title-card text-foreground mb-8 pb-4 border-b border-border">Voor Sporters</h2>
            <div className="space-y-8">
              {sportersFaq.map((item, i) => (
                <div key={i}>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="type-title-card text-foreground mb-8 pb-4 border-b border-border">Voor Professionals</h2>
            <div className="space-y-8">
              {professionalsFaq.map((item, i) => (
                <div key={i}>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
