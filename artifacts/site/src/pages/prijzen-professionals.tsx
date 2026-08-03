import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { TIER_PRICING, TRAINER_STAFFELS, TRAINER_EXTRA_PER_SPORTER_MONTH, formatEuro } from '@workspace/pricing';
import { CheckCircle2, Info } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

export function PrijzenProfessionals() {
  usePageMeta({
    title: 'Prijzen Professionals',
    description: 'Eén factuur, geen verrassingen. Voor trainers, clubs en teams.'
  });

  const [interval, setInterval] = useState<"month" | "year">("month");
  const [mobileTab, setMobileTab] = useState<"club" | "trainer" | "team">("trainer");
  const [athletes, setAthletes] = useState(20);

  const calculateTrainerPrice = (count: number, isYear: boolean) => {
    if (count <= TRAINER_STAFFELS[0].totSporters) {
      return isYear ? TRAINER_STAFFELS[0].year : TRAINER_STAFFELS[0].month;
    }
    if (count <= TRAINER_STAFFELS[1].totSporters) {
      return isYear ? TRAINER_STAFFELS[1].year : TRAINER_STAFFELS[1].month;
    }
    const extra = count - TRAINER_STAFFELS[1].totSporters;
    const base = isYear ? TRAINER_STAFFELS[1].year : TRAINER_STAFFELS[1].month;
    const extraPrice = extra * TRAINER_EXTRA_PER_SPORTER_MONTH * (isYear ? 10 : 1); // 2 months free
    return base + extraPrice;
  };

  const currentTrainerPrice = calculateTrainerPrice(athletes, interval === 'year');

  const plans = [
    {
      id: "club",
      name: "Voor de Club",
      priceMonth: "Gratis",
      priceYear: "Gratis",
      trial: null,
      description: "Beheer de leden en de jeugd, zonder softwarekosten voor de vereniging.",
      features: [
        "Leden- en groepsbeheer",
        "Trainers koppelen aan groepen",
        "Ouder-accounts voor de jeugd",
        "Toestemmingsbeheer (privacy)",
        "Overzicht wie er komt trainen"
      ],
      cta: "Maak de club aan",
      popular: false
    },
    {
      id: "trainer",
      name: TIER_PRICING.TRAINER.displayName,
      priceMonth: "Variabel", // controlled by slider
      priceYear: "Variabel",
      trial: `${TIER_PRICING.TRAINER.trialDays} dagen gratis proberen`,
      description: "Voor de zelfstandige trainer die zijn eigen sporters begeleidt.",
      features: [
        "Trainingsplannen bouwen & pushen",
        "Diepe analyse van je sporters",
        "Voedingsspecialisten uitnodigen",
        "Ingebouwde facturatie naar klanten",
        "Inclusief Sparki Complete voor jezelf"
      ],
      cta: "Start als trainer",
      popular: true
    },
    {
      id: "team",
      name: TIER_PRICING.TEAM.displayName,
      priceMonth: formatEuro(TIER_PRICING.TEAM.month) + " / mnd",
      priceYear: formatEuro(TIER_PRICING.TEAM.year) + " / jaar",
      trial: `${TIER_PRICING.TEAM.trialDays} dagen gratis proberen`,
      description: "Voor de ploegleider en de staf om de koers centraal te regelen.",
      features: [
        "Wedstrijdschema's en selecties",
        "Dagschema's voor renners & staf",
        "Taken offline op elke telefoon",
        "Materiaal- en voedingsplannen",
        "Onbeperkt aantal renners en staf"
      ],
      cta: "Start met je team",
      popular: false
    }
  ];

  return (
    <Layout>
      <div className="pt-24 pb-16 px-6 max-w-7xl mx-auto animate-fade-in-up">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="type-display text-foreground mb-6">Prijzen voor de koers.</h1>
          <p className="type-body text-muted-foreground mb-8">
            Geen per-user licenties voor de mechanieker. Gewoon heldere bundels voor wat je nodig hebt. En de basis voor verenigingen is altijd kosteloos.
          </p>

          <div className="inline-flex bg-secondary p-1 rounded-full border border-border">
            <button 
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${interval === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setInterval('month')}
            >
              Maandelijks
            </button>
            <button 
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${interval === 'year' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setInterval('year')}
            >
              Jaarlijks (2 maanden gratis)
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden mb-8 flex justify-center gap-2 overflow-x-auto pb-4 snap-x">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setMobileTab(p.id as any)}
              className={`snap-center shrink-0 px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                mobileTab === p.id 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'bg-card text-muted-foreground border-border hover:border-border/80'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`flex flex-col bg-card rounded-[2rem] border ${plan.popular ? 'border-accent-cyan shadow-float relative' : 'border-border shadow-card'} p-8 ${mobileTab !== plan.id ? 'hidden lg:flex' : 'flex'}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent-cyan text-on-accent px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Meest gekozen
                </div>
              )}
              
              <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground mb-2">{plan.name}</h2>
                <p className="text-sm text-muted-foreground h-10">{plan.description}</p>
              </div>

              <div className="mb-8">
                {plan.id === "trainer" ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-4xl font-extrabold text-foreground num">
                        {formatEuro(currentTrainerPrice).split(' ')[0]}
                      </span>
                      <span className="text-muted-foreground font-medium">
                        {interval === 'month' ? '/ mnd' : '/ jaar'}
                      </span>
                    </div>
                    
                    {/* Kostencalculator */}
                    <div className="bg-secondary/50 p-4 rounded-xl mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Aantal sporters</label>
                        <span className="text-sm font-bold num">{athletes}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={athletes} 
                        onChange={(e) => setAthletes(Number(e.target.value))}
                        className="w-full accent-accent-cyan cursor-pointer"
                        aria-label="Aantal sporters"
                      />
                      <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        {athletes <= 25 ? (
                          <span>Basistarief tot {TRAINER_STAFFELS[0].totSporters} sporters.</span>
                        ) : athletes <= 50 ? (
                          <span>Tweede staffel (26 t/m {TRAINER_STAFFELS[1].totSporters} sporters).</span>
                        ) : (
                          <span>Vanaf 51 sporters betaal je {formatEuro(TRAINER_EXTRA_PER_SPORTER_MONTH)} extra per maand per sporter.</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-extrabold text-foreground num">
                      {interval === 'month' ? plan.priceMonth.split(' ')[0] : plan.priceYear.split(' ')[0]}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      {plan.priceMonth === "Gratis" ? "" : interval === 'month' ? '/ mnd' : '/ jaar'}
                    </span>
                  </div>
                )}
                
                <div className="h-6">
                  {plan.trial && (
                    <span className="text-xs font-medium text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-full">
                      {plan.trial}
                    </span>
                  )}
                </div>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-accent-cyan shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Link 
                href="/app" 
                className={`w-full py-4 rounded-full text-center font-medium transition-colors ${
                  plan.popular 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
