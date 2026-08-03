import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { Link } from 'wouter';
import { asset } from '@/lib/asset';

export function Home() {
  usePageMeta({
    title: 'Sparki',
    description: 'De digitale wielercoach die routes, training, analyse en de hele clubwereld in één eerlijke app samenbrengt.'
  });

  return (
    <Layout>
      <div className="relative min-h-[85vh] flex flex-col items-center justify-center pt-10 pb-20 px-6 overflow-hidden">
        
        {/* Background Haze Effect (respects reduced motion) */}
        <div className="absolute inset-0 -z-10 bg-background overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent-cyan/5 blur-[120px] rounded-full scene-haze mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-accent-cyan/5 blur-[150px] rounded-full scene-haze-2 mix-blend-multiply"></div>
        </div>

        <div className="w-full max-w-5xl mx-auto text-center space-y-12 animate-fade-in-up">
          <h1 className="type-metric text-foreground tracking-tight max-w-4xl mx-auto text-balance">
            De coach die de waarheid spreekt.
          </h1>
          
          <p className="type-title-card text-muted-foreground max-w-2xl mx-auto font-normal">
            Sparki brengt routes, training, analyse en je club samen in één app. Gebouwd op eerlijkheid: we verzinnen geen data, we leggen uit waarom, en we weten wat voor rit je vandaag nodig hebt.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mt-16 pt-8">
            <Link 
              href="/sporters" 
              className="group relative flex flex-col items-center justify-center p-12 rounded-[2rem] bg-card border border-border hover:border-border/80 shadow-sm hover:shadow-card transition-all duration-300"
            >
              <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-accent-cyan transition-colors">
                Voor sporters
              </h2>
              <p className="text-muted-foreground text-center">
                De routeplanner die weet wat je traint en de analyse die uitlegt waarom.
              </p>
              <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-foreground/5 pointer-events-none"></div>
            </Link>

            <Link 
              href="/professionals" 
              className="group relative flex flex-col items-center justify-center p-12 rounded-[2rem] bg-card border border-border hover:border-border/80 shadow-sm hover:shadow-card transition-all duration-300"
            >
              <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-accent-cyan transition-colors">
                Voor professionals
              </h2>
              <p className="text-muted-foreground text-center">
                Training, clubbeheer en koersdagen in één overzicht.
              </p>
              <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-foreground/5 pointer-events-none"></div>
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full relative py-24 bg-secondary/50 border-y border-border/30">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="type-display mb-6">Niets te schreeuwen.</h2>
            <p className="type-body text-muted-foreground max-w-md">
              Grote beloftes sneuvelen in de eerste tegenwind. Sparki gebruikt geen magische algoritmes of valse urgentie. Wat je ziet, is gemeten. Wat we adviseren, kun je herleiden.
            </p>
          </div>
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
            <img 
              src={asset('/sfeer/routes-polder-blauwuur.webp')} 
              alt="Een rustige polderweg in het vroege blauwe uur" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
