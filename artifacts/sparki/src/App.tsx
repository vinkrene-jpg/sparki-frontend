import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomNav } from "@/components/sparki/bottom-nav";
import { TrainingDayHome } from "@/components/sparki/training-day-home";
import NotFound from "@/pages/not-found";
import FeedPage from "@/pages/feed";
import TrainPage from "@/pages/train";
import YouPage from "@/pages/you";
import LabPage from "@/pages/lab";

const queryClient = new QueryClient();

function Router() {
  return (
    <>
      <Switch>
        <Route path="/" component={TrainingDayHome} />
        <Route path="/train" component={TrainPage} />
        <Route path="/feed" component={FeedPage} />
        <Route path="/lab" component={LabPage} />
        <Route path="/you" component={YouPage} />
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
