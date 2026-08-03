import { Link } from 'wouter';
import { ReactNode, useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export function Layout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [children]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-accent-cyan selection:text-on-accent">
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="type-wordmark text-foreground hover:opacity-80 transition-opacity">
            Sparki
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/sporters" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Voor sporters
            </Link>
            <Link href="/professionals" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Voor professionals
            </Link>
            <div className="h-4 w-px bg-border"></div>
            <Link href="/prijzen/sporters" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Prijzen sporters
            </Link>
            <Link href="/prijzen/professionals" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Prijzen professionals
            </Link>
            <Link href="/app" className="text-sm font-medium px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Inloggen
            </Link>
          </nav>

          {/* Mobile Nav Toggle */}
          <button 
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-background border-b border-border/40 p-6 flex flex-col gap-6 shadow-float">
            <Link href="/sporters" className="text-lg font-medium text-foreground">
              Voor sporters
            </Link>
            <Link href="/professionals" className="text-lg font-medium text-foreground">
              Voor professionals
            </Link>
            <hr className="border-border" />
            <Link href="/prijzen/sporters" className="text-lg font-medium text-foreground">
              Prijzen sporters
            </Link>
            <Link href="/prijzen/professionals" className="text-lg font-medium text-foreground">
              Prijzen professionals
            </Link>
            <Link href="/app" className="mt-4 text-center text-lg font-medium px-6 py-3 rounded-full bg-primary text-primary-foreground">
              Inloggen
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer crossover - MKT-06: "Onderaan elke pagina staan beide kolommen naast elkaar" */}
      <footer className="bg-secondary mt-24 py-16 sm:py-24 border-t border-border/20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">Voor sporters</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                De routeplanner die weet wat voor rit je vandaag nodig hebt, en de analyse die uitlegt waarom.
              </p>
              <ul className="flex flex-col gap-4">
                <li><Link href="/renner" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De renner</Link></li>
                <li><Link href="/renner-met-plan" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De renner met een plan</Link></li>
                <li><Link href="/ouder" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De ouder</Link></li>
                <li className="pt-4"><Link href="/prijzen/sporters" className="text-foreground font-medium hover:text-accent-cyan">Bekijk de prijzen →</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">Voor professionals</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Training, analyse en de hele clubwereld in één eerlijke app. Voor trainers, clubs en ploegleiders.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <li><Link href="/trainer" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De zelfstandige trainer</Link></li>
                <li><Link href="/club" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De club</Link></li>
                <li><Link href="/clubtrainer" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De clubtrainer</Link></li>
                <li><Link href="/team" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">Het team</Link></li>
                <li><Link href="/ploegleider" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De ploegleider</Link></li>
                <li><Link href="/staf" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De staf</Link></li>
                <li><Link href="/specialist" className="text-foreground hover:text-accent-cyan underline underline-offset-4 decoration-border">De specialisten</Link></li>
                <li className="pt-4 sm:col-span-2"><Link href="/prijzen/professionals" className="text-foreground font-medium hover:text-accent-cyan">Bekijk de prijzen →</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-24 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="type-wordmark text-foreground">Sparki</Link>
            <div className="flex gap-6">
              <Link href="/faq" className="hover:text-foreground">Veelgestelde vragen</Link>
              <Link href="/app" className="hover:text-foreground">Inloggen</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
