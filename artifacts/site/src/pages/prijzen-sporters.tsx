import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { TIER_PRICING, formatEuro } from '@workspace/pricing';
import { Check, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

export function PrijzenSporters() {
  usePageMeta({
    title: 'Prijzen Sporters',
    description: 'Eerlijke prijzen zonder kleine lettertjes. Start gratis, of kies voor meer inzichten.'
  });

  const [interval, setInterval] = useState<"month" | "year">("month");
  const [mobileTab, setMobileTab] = useState<"free" | "go" | "complete">("go");

  const plans = [
    {
      id: "free",
      name: "Sparki Free",
      priceMonth: "Gratis",
      priceYear: "Gratis",
      trial: null,
      description: "Voor de clubrijder die gewoon af en toe mee wil rijden.",
      features: [
        "Lid worden van je club",
        "Zien wanneer de training is",
        "Basis routeplanner (5km rond de club)",
        "Ouder-account voor jeugdleden"
      ],
      cta: "Maak een gratis account",
      popular: false
    },
    {
      id: "go",
      name: TIER_PRICING.GO.displayName,
      priceMonth: formatEuro(TIER_PRICING.GO.month) + " / mnd",
      priceYear: formatEuro(TIER_PRICING.GO.year) + " / jaar",
      trial: `${TIER_PRICING.GO.trialDays} dagen gratis proberen`,
      description: "Voor de renner die zelf bepaalt, maar af en toe een goede route wil.",
      features: [
        "Alles uit Free",
        "Onbeperkte slimme routeplanner",
        "Exporteren naar Garmin / Wahoo",
        "Inzicht in gereden kilometers",
        "Geen advertenties"
      ],
      cta: "Start met Go",
      popular: true
    },
    {
      id: "complete",
      name: TIER_PRICING.COMPLETE.displayName,
      priceMonth: formatEuro(TIER_PRICING.COMPLETE.month) + " / mnd",
      priceYear: formatEuro(TIER_PRICING.COMPLETE.year) + " / jaar",
      trial: `${TIER_PRICING.COMPLETE.trialDays} dagen gratis proberen`,
      description: "Voor de renner met een plan die wil snappen waarom hij traint.",
      features: [
        "Alles uit Go",
        "Dagelijks een persoonlijk plan",
        "Begeleiding en uitleg bij elke rit",
        "Diepe analyse van je prestaties",
        "Koppeling met zelfstandige trainers"
      ],
      cta: "Start met Complete",
      popular: false
    }
  ];

  return (
    <Layout>
      <div className="pt-24 pb-16 px-6 max-w-7xl mx-auto animate-fade-in-up">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="type-display text-foreground mb-6">Wat kost het?</h1>
          <p className="type-body text-muted-foreground mb-8">
            Eerlijke software kost geld om te maken. Wij verkopen geen data en tonen geen advertenties. Je betaalt gewoon voor wat je gebruikt.
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

        {/* Mobile Tabs - MKT-19/25: één pakket tegelijk op telefoon */}
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
        <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-foreground num">
                    {interval === 'month' ? plan.priceMonth.split(' ')[0] : plan.priceYear.split(' ')[0]}
                  </span>
                  <span className="text-muted-foreground font-medium">
                    {plan.priceMonth === "Gratis" ? "" : interval === 'month' ? '/ mnd' : '/ jaar'}
                  </span>
                </div>
                <div className="h-6 mt-2">
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
