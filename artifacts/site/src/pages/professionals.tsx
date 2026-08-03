import { Layout } from '@/components/layout';
import { usePageMeta } from '@/hooks/use-page-meta';
import { Link } from 'wouter';
import { asset } from '@/lib/asset';

export function Professionals() {
  usePageMeta({
    title: 'Voor Professionals',
    description: 'Training, analyse en de hele clubwereld in één eerlijke app.'
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-24 pb-32 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 min-h-[80vh]">
        <div className="flex-1 animate-fade-in-up">
          <h1 className="type-display text-foreground mb-6">
            Je sporters en je club in één overzicht.
          </h1>
          <p className="type-title-card text-muted-foreground font-normal mb-10 max-w-lg">
            Ontworpen voor de zelfstandige trainer, de club en de ploegleider. Niet nog een platform vol ruis, maar gereedschap dat doet wat het moet doen.
          </p>
          <Link href="/prijzen/professionals" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-float">
            Bekijk de prijzen
          </Link>
        </div>
        
        <div className="flex-1 w-full max-w-[360px] mx-auto md:max-w-none md:flex md:justify-end animate-fade-in-up delay-100">
          <div className="relative rounded-[3rem] overflow-hidden border-[8px] border-foreground/5 bg-background shadow-2xl drop-shadow-2xl">
            <div className="absolute top-0 inset-x-0 h-6 bg-background z-10 flex justify-center">
              <div className="w-1/3 h-4 bg-foreground/5 rounded-b-xl"></div>
            </div>
            <img 
              src={asset('/screens/mobiel/sessie.png')} 
              alt="Overzicht van een trainingssessie" 
              className="w-full h-auto min-h-[600px] object-cover bg-secondary block" 
              width={390} height={844}
            />
          </div>
        </div>
      </section>

      {/* Feature 1: Club & Trainers */}
      <section className="py-32 px-6 bg-secondary/30 border-y border-border/20">
        <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16">
          <div className="flex-1 relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
            <img src={asset('/sfeer/jeugd-clubgebouw-avondlicht.webp')} alt="Clubgebouw in het avondlicht" className="w-full h-full object-cover block" loading="lazy" />
          </div>
          <div className="flex-1">
            <h2 className="type-display text-foreground mb-6">Clubbeheer dat eindelijk werkt.</h2>
            <p className="type-body text-muted-foreground max-w-md">
              Leden, seizoenen, jeugd en toestemmingen geregeld — en voor de club is het gratis. Trainers zien in één beeld wie er bij hun groep hoort en wie aandacht nodig heeft.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 2: Wedstrijddag */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="type-display text-foreground mb-6">De wedstrijddag in één plan.</h2>
            <p className="type-body text-muted-foreground max-w-md">
              Zaterdag geregeld: bezetting, dagschema, vervoer, materiaal, taken. Iedereen van de staf en de renners heeft zijn eigen deel van het plan direct op zijn telefoon, ook zonder bereik.
            </p>
          </div>
          <div className="flex-1 relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
             <img src={asset('/sfeer/materiaal-garage-silhouet.webp')} alt="Voorbereiding in de garage" className="w-full h-full object-cover block" loading="lazy" />
          </div>
        </div>
      </section>

      {/* Target Groups Index */}
      <section className="py-32 px-6 bg-secondary/50 border-t border-border/20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <h2 className="type-display mb-4">Jouw rol in de koers.</h2>
            <p className="text-muted-foreground">Kies je functie en zie hoe Sparki je werk makkelijker maakt.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/trainer" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De zelfstandige trainer</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Training, analyse, voeding én facturatie in één.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/club" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De club</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Clubbeheer, leden en toestemmingen — gratis.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/clubtrainer" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De clubtrainer</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Je groep in één beeld.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/team" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">Het team</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">De hele wedstrijdoperatie in één plan.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>

            <Link href="/ploegleider" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De ploegleider</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Dagschema en takenlijsten in de volgwagen.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>
            
            <Link href="/staf" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De staf</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Jouw deel van het plan, op je telefoon.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>
            
            <Link href="/specialist" className="group bg-card border border-border p-6 rounded-[1.5rem] hover:border-accent-cyan/50 hover:shadow-card transition-all flex flex-col h-full">
              <h3 className="type-title-card mb-2 group-hover:text-accent-cyan transition-colors">De specialisten</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1">Analyseer dossiers zonder de trainer dwars te zitten.</p>
              <span className="text-sm font-medium">Lees meer →</span>
            </Link>
          </div>
        </div>
      </section>

    </Layout>
  );
}
