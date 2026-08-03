import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { Link } from 'wouter';
import { asset } from '@/lib/asset';

export function Sporters() {
  usePageMeta({
    title: 'Voor Sporters',
    description: 'De routeplanner die weet wat je wilt trainen, en de analyse die uitlegt waarom.'
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-24 pb-32 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 min-h-[80vh]">
        <div className="flex-1 animate-fade-in-up">
          <h1 className="type-display text-foreground mb-6">
            Een routeplanner die snapt wat je vandaag nodig hebt.
          </h1>
          <p className="type-title-card text-muted-foreground font-normal mb-10 max-w-lg">
            Vertel Sparki hoe lang je wilt fietsen en wat je wilt trainen. Sparki tekent de route die daar exact bij past.
          </p>
          <Link href="/prijzen/sporters" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-float">
            Bekijk de prijzen
          </Link>
        </div>
        
        <div className="flex-1 w-full max-w-[360px] mx-auto md:max-w-none md:flex md:justify-end animate-fade-in-up delay-100">
          <div className="relative rounded-[3rem] overflow-hidden border-[8px] border-foreground/5 bg-background shadow-2xl drop-shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-6 bg-background z-10 flex justify-center">
              <div className="w-1/3 h-4 bg-foreground/5 rounded-b-xl"></div>
            </div>
            <img 
              src={asset('/screens/mobiel/route.png')} 
              alt="Sparki routeplanner die direct een route tekent" 
              className="w-full h-auto min-h-[600px] object-cover bg-secondary block" 
              width={390} height={844}
            />
          </div>
        </div>
      </section>

      {/* Feature 1: Analyse */}
      <section className="py-32 px-6 bg-secondary/30 border-y border-border/20">
        <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16">
          <div className="flex-1 w-full max-w-[360px] mx-auto md:max-w-none md:flex md:justify-start">
            <div className="relative rounded-[3rem] overflow-hidden border-[8px] border-foreground/5 bg-background shadow-xl">
               <div className="absolute top-0 inset-x-0 h-6 bg-background z-10 flex justify-center">
                <div className="w-1/3 h-4 bg-foreground/5 rounded-b-xl"></div>
              </div>
              <img src={asset('/screens/mobiel/analyse.png')} alt="Analyse van een gereden rit" className="w-full h-auto min-h-[600px] object-cover bg-secondary block" width={390} height={844} loading="lazy" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="type-display text-foreground mb-6">Je ritten terugzien, zonder de ruis.</h2>
            <p className="type-body text-muted-foreground max-w-md">
              Geen tabellen met honderd datapunten die je zelf moet ontcijferen. Sparki vertaalt je hartslag en vermogen naar gewone taal: wat was goed, wat kon beter.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 2: Begeleiding */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="type-display text-foreground mb-6">Begeleiding die uitlegt waarom.</h2>
            <p className="type-body text-muted-foreground max-w-md">
              Krijg je een rustige rit voorgeschreven? Dan staat erbij waarom dat vandaag nodig is. Je leert je eigen lichaam begrijpen, in plaats van blind commando's op te volgen.
            </p>
          </div>
          <div className="flex-1 w-full max-w-[360px] mx-auto md:max-w-none md:flex md:justify-end">
            <div className="relative rounded-[3rem] overflow-hidden border-[8px] border-foreground/5 bg-background shadow-xl">
               <div className="absolute top-0 inset-x-0 h-6 bg-background z-10 flex justify-center">
                <div className="w-1/3 h-4 bg-foreground/5 rounded-b-xl"></div>
              </div>
              <img src={asset('/screens/mobiel/train.png')} alt="Een opgestelde training voor vandaag" className="w-full h-auto min-h-[600px] object-cover bg-secondary block" width={390} height={844} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Target Groups Index */}
      <section className="py-32 px-6 bg-secondary/50 border-t border-border/20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="type-display mb-4">Wie ben jij?</h2>
            <p className="text-muted-foreground">Kies hoe jij fietst en ontdek wat Sparki precies voor je doet.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Link href="/renner" className="group bg-card border border-border p-8 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De renner</h3>
              <p className="text-muted-foreground text-sm mb-6">Ik wil gewoon mooi fietsen en af en toe zien hoe ik het doe.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/renner-met-plan" className="group bg-card border border-border p-8 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De renner met een plan</h3>
              <p className="text-muted-foreground text-sm mb-6">Ik heb doelen, ik wil beter worden en ik zoek begeleiding.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/ouder" className="group bg-card border border-border p-8 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De ouder</h3>
              <p className="text-muted-foreground text-sm mb-6">Mijn kind fietst bij een club en ik wil zien wat er gebeurt.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>
          </div>
        </div>
      </section>

    </Layout>
  );
}
