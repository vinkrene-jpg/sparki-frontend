import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';

// Components
import NotFound from '@/pages/not-found';
import { Home } from '@/pages/home';
import { Sporters } from '@/pages/sporters';
import { Professionals } from '@/pages/professionals';
import { PrijzenSporters } from '@/pages/prijzen-sporters';
import { PrijzenProfessionals } from '@/pages/prijzen-professionals';
import { FAQ } from '@/pages/faq';

// Doelgroepen Sporters
import { Renner, RennerMetPlan, Ouder } from '@/pages/doelgroepen-sporters';
// Doelgroepen Professionals
import { Trainer, Club, Clubtrainer, Team, Ploegleider, Staf, Specialist } from '@/pages/doelgroepen-professionals';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      {/* Entrances */}
      <Route path="/sporters" component={Sporters} />
      <Route path="/professionals" component={Professionals} />

      {/* Target Groups - Sporters */}
      <Route path="/renner" component={Renner} />
      <Route path="/renner-met-plan" component={RennerMetPlan} />
      <Route path="/ouder" component={Ouder} />

      {/* Target Groups - Professionals */}
      <Route path="/trainer" component={Trainer} />
      <Route path="/club" component={Club} />
      <Route path="/clubtrainer" component={Clubtrainer} />
      <Route path="/team" component={Team} />
      <Route path="/ploegleider" component={Ploegleider} />
      <Route path="/staf" component={Staf} />
      <Route path="/specialist" component={Specialist} />

      {/* Pricing */}
      <Route path="/prijzen/sporters" component={PrijzenSporters} />
      <Route path="/prijzen/professionals" component={PrijzenProfessionals} />

      {/* FAQ */}
      <Route path="/faq" component={FAQ} />

      <Route component={NotFound} />
    </Switch>
  );
}

// ssrPath: alleen gebruikt door de prerender-stap (entry-server) om per route
// statische HTML te renderen — de browser gebruikt gewoon de echte locatie.
function App({ ssrPath }: { ssrPath?: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter
        base={import.meta.env.BASE_URL.replace(/\/$/, '')}
        ssrPath={ssrPath}
      >
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
