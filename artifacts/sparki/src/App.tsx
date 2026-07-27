import { useEffect, useRef, useState, useCallback } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { Zap } from "lucide-react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { DayHome } from "@/components/sparki/day-home";
import { CommercialToday } from "@/components/sparki/commercial-shell";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { CoachHome } from "@/components/sparki/coach-home";
import { ParentHome } from "@/components/sparki/parent-home";
import { OnboardingV2 } from "@/components/sparki/onboarding-v2";
import { ErrorBoundary } from "@/components/sparki/error-boundary";
import { BottomNav } from "@/components/sparki/bottom-nav";
import { ConsentGate } from "@/components/consent-gate";
import NotFound from "@/pages/not-found";
import LegalPage from "@/pages/legal";
import FeedPage from "@/pages/feed";
import TrainPage from "@/pages/train";
import YouPage from "@/pages/you";
import LabPage from "@/pages/lab";
import ActiviteitenPage from "@/pages/activiteiten";
import PhotoLabPage from "@/pages/photo-lab";
import SamenPage from "@/pages/samen";
import ProfielPage from "@/pages/profiel";
import LichaamPage from "@/pages/lichaam";
import MechaniekerPage from "@/pages/mechanieker";
import RoutesPage from "@/pages/routes";
import KalenderPage from "@/pages/kalender";
import RacesPage from "@/pages/races";
import SprintenPage from "@/pages/sprinten";
import WedstrijdRoomPage from "@/pages/wedstrijd-room";
import JourneyPage from "@/pages/journey";
import KnowledgePage from "@/pages/knowledge";
import MeerPage from "@/pages/meer";
import SparkiConnectPage from "@/pages/sparki-connect";
import KlimmenPage from "@/pages/klimmen";
import InvitationsPage from "@/pages/invitations";
import InviteAcceptPage from "@/pages/invite-accept";
import TesterQrPage from "@/pages/tester-qr";
import TesterWelcomePage from "@/pages/tester-welcome";
import CoachAthletePlanPage from "@/pages/coach-athlete-plan";
import CoachCockpitPage from "@/pages/coach-cockpit";
import LandingPage from "@/pages/landing";
import AdminPage from "@/pages/admin";
import { VersionBlockScreen } from "@/components/sparki/version-block-screen";
import AdminHealthDetailPage from "@/pages/admin-health-detail";
import StartPage from "@/pages/start";
import ClubPage from "@/pages/club";
import ClubBeheerPage from "@/pages/club-beheer";
import PaspoortPage from "@/pages/paspoort";
import SupportPage from "@/pages/support";
import { apiFetch } from "@/lib/api";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import { UserProvider, useUserProfile } from "@/contexts/UserContext";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import { DevPreview } from "@/components/sparki/dev-preview";
import { DEV_PREVIEW } from "@/lib/dev";
import { STALE } from "@/lib/query-keys";
import { SoundProvider } from "@/contexts/SoundContext";
import GeluidPage from "@/pages/geluid";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.session,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — copy verbatim
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Strip base from paths Clerk passes to routerPush/routerReplace
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "oklch(0.82 0.16 200)",
    colorForeground: "oklch(0.98 0 0)",
    colorMutedForeground: "oklch(0.60 0 0)",
    colorDanger: "oklch(0.7 0.19 22.2)",
    colorBackground: "oklch(0.10 0 0)",
    colorInput: "oklch(0.16 0 0)",
    colorInputForeground: "oklch(0.98 0 0)",
    colorNeutral: "oklch(0.98 0 0)",
    fontFamily: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl w-[420px] max-w-full overflow-hidden border border-white/8",
    card: "!shadow-none !border-0 !rounded-none",
    footer: "!shadow-none !border-0 !rounded-none",
    headerTitle: "text-white font-semibold",
    headerSubtitle: "text-white/50",
    socialButtonsBlockButtonText: "text-white/80",
    formFieldLabel: "text-white/70 text-xs",
    footerActionLink: "text-[oklch(0.82_0.16_200)] hover:opacity-80",
    footerActionText: "text-white/40",
    dividerText: "text-white/30",
    identityPreviewEditButton: "text-[oklch(0.82_0.16_200)]",
    formFieldSuccessText: "text-[oklch(0.82_0.16_200)]",
    alertText: "text-white/80",
    logoBox: "mb-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-white/10 bg-white/5 hover:bg-white/10",
    formButtonPrimary: "bg-[oklch(0.82_0.16_200)] text-[#040506] hover:opacity-90 font-semibold",
    formFieldInput: "bg-[oklch(0.16_0_0)] border-white/10 text-white placeholder-white/25",
    footerAction: "border-t border-white/8",
    dividerLine: "bg-white/10",
    alert: "border-red-500/20 bg-red-500/10",
    otpCodeFieldInput: "bg-[oklch(0.16_0_0)] border-white/10 text-white",
    formFieldRow: "gap-3",
    main: "gap-4",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Shown when account provisioning (sync) could not complete. We deliberately
// never fall through to onboarding or the app without a profile — that is the
// exact failure that bricked onboarding. Clear Dutch copy + a retry, no crash.
function AccountNotReady({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#040506] px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-white">
          Je account wordt klaargezet
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Het lukte niet om je account te laden. Controleer je verbinding en
          probeer het opnieuw.
        </p>
        {error ? (
          <p className="mt-3 font-mono text-[11px] text-white/30">{error}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-[oklch(0.82_0.16_200)] px-6 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}

// Single account-readiness gate shared by EVERY signed-in surface. No signed-in
// route may render app content until the account is provisioned: while sync is
// in flight we show a dark splash; if it failed we show the retry screen; only
// with a real profile do children render. This is what stops a user (via deep
// link or direct navigation to /train, /feed, an invite, etc.) from ever
// reaching the app — or onboarding — without a user_profiles row.
function AccountGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading, error, refetch } = useUserProfile();

  if (isLoading || (!profile && !error)) {
    return <div className="min-h-dvh bg-[#040506]" />;
  }
  if (!profile) {
    return <AccountNotReady error={error} onRetry={() => void refetch()} />;
  }
  // Na accountgereedheid volgt de verplichte juridische acceptatie. De echte
  // blokkade zit server-side (consentGate-middleware); dit is de voorkant.
  return <ConsentGate>{children}</ConsentGate>;
}

// Home is gated by the same AccountGate as every other signed-in surface, so the
// readiness logic (loading splash / AccountNotReady / proceed) lives in exactly
// one place. Once mounted, the account is guaranteed provisioned.
function SignedInHome() {
  return (
    <AccountGate>
      <SignedInHomeReady />
    </AccountGate>
  );
}

function SignedInHomeReady() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { profile, refetch } = useUserProfile();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [checkNonce, setCheckNonce] = useState(0);

  useEffect(() => {
    // Onboarding is evaluated ONLY once the account is provisioned. AccountGate
    // guarantees a profile before this component mounts, so a missing
    // user_profiles row can never slip a user into onboarding. The guard below
    // is purely for type-narrowing.
    if (!profile) return;
    let cancelled = false;
    const lsKey = `sparki_onboarded_${profile.clerkId}`;
    const lsDone = localStorage.getItem(lsKey) === "true";
    // DB is the source of truth. localStorage is only a fast-path cache and a
    // migration bridge for users who completed onboarding before DB persistence.
    void (async () => {
      // A transient failure (flaky mobile network, session cookie still
      // refreshing at cold start) must NEVER look like "new user" — that would
      // restart the full onboarding for someone who already finished it. So:
      // retry a few times, and if the server still can't answer, show an
      // honest retry screen instead of onboarding. Onboarding only renders
      // when the server POSITIVELY says isComplete=false.
      const ATTEMPTS = 3;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          const { onboarding } = await apiFetch<{
            onboarding: { isComplete: boolean };
          }>("/api/onboarding/state");
          if (cancelled) return;
          if (onboarding.isComplete) {
            localStorage.setItem(lsKey, "true");
            setOnboarded(true);
          } else if (lsDone) {
            // Migrate prior localStorage-only completion into the DB.
            void apiFetch("/api/onboarding/state", {
              method: "PUT",
              body: JSON.stringify({ isComplete: true }),
            });
            setOnboarded(true);
          } else {
            setOnboarded(false);
          }
          return;
        } catch {
          if (cancelled) return;
          if (attempt < ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 700 * attempt));
            continue;
          }
          if (lsDone) {
            // Cache says this device completed onboarding before — trust it.
            setOnboarded(true);
          } else {
            setCheckFailed(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.clerkId, checkNonce]);

  const handleComplete = useCallback(() => {
    if (profile) {
      localStorage.setItem(`sparki_onboarded_${profile.clerkId}`, "true");
    }
    void apiFetch("/api/onboarding/state", {
      method: "PUT",
      body: JSON.stringify({ isComplete: true }),
    });
    // Refresh UserContext (picks up new displayName) + all athlete queries
    void refetch();
    void qc.invalidateQueries();
    setOnboarded(true);
  }, [profile, qc, refetch]);

  // The onboarding-status check failed after retries and this device has no
  // cached completion. Show an honest retry screen — NEVER onboarding, which
  // would force an existing athlete to answer everything again.
  if (checkFailed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-8 text-center">
        <p className="text-[15px] font-medium text-white/85">
          Je gegevens konden niet worden geladen
        </p>
        <p className="max-w-xs text-[13px] leading-relaxed text-white/45">
          Waarschijnlijk hapert de verbinding even. Je voortgang is veilig
          opgeslagen — niets gaat verloren.
        </p>
        <button
          type="button"
          onClick={() => {
            setCheckFailed(false);
            setOnboarded(null);
            setCheckNonce((n) => n + 1);
          }}
          className="mt-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-6 py-2.5 text-[13px] font-medium text-cyan-200 transition-colors hover:bg-cyan-300/20"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  // Account ready (guaranteed by AccountGate) — brief flash while resolving
  // onboarding state.
  if (onboarded === null) {
    return <div className="min-h-dvh bg-[#040506]" />;
  }

  if (!onboarded) {
    return (
      <OnboardingV2
        firstName={user?.firstName ?? user?.username ?? null}
        onComplete={handleComplete}
      />
    );
  }

  // First arrival as a head tester (e.g. granted server-side, then signing in
  // fresh) routes once to the premium welcome moment. The page itself records
  // the "seen" flag, so this only ever fires a single time per account.
  if (
    profile?.isHeadTester &&
    localStorage.getItem(`sparki_tester_welcomed_${profile.clerkId}`) !== "true"
  ) {
    return <Redirect to="/welkom-tester" />;
  }

  return <RoleHome />;
}

// Home is role-aware: coaches see their roster, parents see the wellbeing view,
// athletes land on the Startscherm (chapter overview). The day-type engine
// (dagplanning) lives in its own hoofdstuk on /vandaag.
function RoleHome() {
  const { profile } = useUserProfile();
  if (profile?.activeRole === "coach") return <CoachHome />;
  if (profile?.activeRole === "parent") return <ParentHome />;
  return <StartPage />;
}

// Vandaag — the daily-planning chapter. Athletes get the day-type homepage
// engine; coach and parent keep their role home here too, so "Vandaag" in
// their navigation always works.
function VandaagPage() {
  const { profile } = useUserProfile();
  // Commerciële lichte schil (default UIT) — zelfde echte data en acties,
  // alleen een andere presentatie. Uit = exact de huidige donkere Vandaag.
  const commercialShell = useFeatureFlag("commercial_shell");
  if (profile?.activeRole === "coach") return <CoachHome />;
  if (profile?.activeRole === "parent") return <ParentHome />;
  if (commercialShell) return <CommercialToday />;
  return <DayHome />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <SignedInHome />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

// Fallback bij een paginacrash: Nederlandse melding MÉT de onderbalk, zodat
// je altijd naar een ander onderdeel kunt — één kapot menu-item mag nooit de
// navigatie meetrekken.
function PageErrorFallback() {
  return (
    <>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-6 pb-28 text-center">
        <Zap className="h-7 w-7 text-accent-cyan" aria-hidden="true" />
        <p className="font-sans text-base font-semibold text-white/80">
          Er ging iets mis op deze pagina
        </p>
        <p className="max-w-xs text-sm text-white/40">
          Kies hieronder een ander onderdeel, of probeer het opnieuw.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/80"
        >
          Probeer opnieuw
        </button>
      </div>
      <BottomNav />
    </>
  );
}

function ProtectedPage({ component: Page }: { component: React.ComponentType }) {
  const [pathname] = useLocation();
  return (
    <>
      <Show when="signed-in">
        <AccountGate>
          {/* Foutisolatie per pagina: een fout in één menu-item mag nooit de
              hele app (of navigatie) meetrekken. De boundary reset per route
              (key) en de fallback houdt de onderbalk bruikbaar. */}
          <ErrorBoundary key={pathname} fallback={<PageErrorFallback />}>
            <Page />
          </ErrorBoundary>
        </AccountGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

// The invite/QR entry route must survive the sign-in round-trip: a tester who
// scans a QR while signed-out is sent to sign-in carrying a `redirect_url` back
// to the invite page, so the token is never dropped and the role/link is granted
// on return. Clerk honours `redirect_url` over the page's fallbackRedirectUrl.
function InviteRoute() {
  const [location] = useLocation();
  const redirectTo = `/sign-in?redirect_url=${encodeURIComponent(
    `${basePath}${location}`,
  )}`;
  return (
    <>
      <Show when="signed-in">
        <AccountGate>
          <InviteAcceptPage />
        </AccountGate>
      </Show>
      <Show when="signed-out">
        <Redirect to={redirectTo} />
      </Show>
    </>
  );
}

// Wouter keeps the previous scroll position across navigations, so opening a new
// page (e.g. Training) would start halfway down where you last were. Reset to the
// top whenever the path changes. Pages that open with ?focus=... manage their own
// scroll target, so leave those alone.
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("focus")) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

// Zolang Clerk nog laadt, rendert de app anders NIETS (Show-componenten geven
// null terug) — dat was in productie zichtbaar als een zwart scherm. Toon
// daarom altijd een laadindicator, en na lang wachten een eerlijk bericht.
function ClerkStartupGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (isLoaded) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-6 text-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-300/25 border-t-cyan-300/90" />
      <p className="text-sm font-semibold text-white/75">
        Sparki wordt geladen…
      </p>
      {slow && (
        <>
          <p className="max-w-xs text-sm text-white/40">
            Dit duurt langer dan normaal. Controleer je verbinding of laad de
            app opnieuw.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 rounded-full border border-cyan-300/40 px-5 py-2 text-sm font-semibold text-cyan-300/90"
          >
            Opnieuw laden
          </button>
        </>
      )}
    </div>
  );
}

function AppRouter() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Sparki account",
          },
        },
        signUp: {
          start: {
            title: "Join Sparki",
            subtitle: "Sparki-powered cycling performance",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <UserProvider>
          <FeatureFlagProvider>
            <FeedbackProvider>
            <SoundProvider>
            <ErrorBoundary>
              <VersionBlockScreen />
              <ScrollToTop />
              {DEV_PREVIEW ? (
                <DevPreview />
              ) : (
              <ClerkStartupGate>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                {/* REQUIRED — /*? is the only wouter syntax for Clerk OAuth sub-paths */}
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                {/* Publieke juridische pagina's — app-stores vereisen een
                    privacy-URL die zonder inloggen leesbaar is. */}
                <Route path="/privacy">
                  <LegalPage kind="privacy" />
                </Route>
                <Route path="/voorwaarden">
                  <LegalPage kind="terms" />
                </Route>
                <Route path="/vandaag">
                  <ProtectedPage component={VandaagPage} />
                </Route>
                <Route path="/club/beheer">
                  <ProtectedPage component={ClubBeheerPage} />
                </Route>
                <Route path="/club">
                  <ProtectedPage component={ClubPage} />
                </Route>
                <Route path="/paspoort">
                  <ProtectedPage component={PaspoortPage} />
                </Route>
                <Route path="/support">
                  <ProtectedPage component={SupportPage} />
                </Route>
                <Route path="/train">
                  <ProtectedPage component={TrainPage} />
                </Route>
                <Route path="/feed">
                  <ProtectedPage component={FeedPage} />
                </Route>
                <Route path="/lab">
                  <ProtectedPage component={LabPage} />
                </Route>
                <Route path="/activiteiten">
                  <ProtectedPage component={ActiviteitenPage} />
                </Route>
                <Route path="/photo-lab">
                  <ProtectedPage component={PhotoLabPage} />
                </Route>
                <Route path="/you">
                  <ProtectedPage component={YouPage} />
                </Route>
                <Route path="/geluid">
                  <ProtectedPage component={GeluidPage} />
                </Route>
                <Route path="/lichaam">
                  <ProtectedPage component={LichaamPage} />
                </Route>
                <Route path="/mechanieker">
                  <ProtectedPage component={MechaniekerPage} />
                </Route>
                <Route path="/routes">
                  <ProtectedPage component={RoutesPage} />
                </Route>
                <Route path="/kalender">
                  <ProtectedPage component={KalenderPage} />
                </Route>
                <Route path="/races">
                  <ProtectedPage component={RacesPage} />
                </Route>
                <Route path="/sprinten">
                  <ProtectedPage component={SprintenPage} />
                </Route>
                <Route path="/wedstrijd-room">
                  <ProtectedPage component={WedstrijdRoomPage} />
                </Route>
                <Route path="/journey">
                  <ProtectedPage component={JourneyPage} />
                </Route>
                <Route path="/journey/wedstrijd/:raceId">
                  <ProtectedPage component={JourneyPage} />
                </Route>
                <Route path="/profiel/:clerkId">
                  <ProtectedPage component={ProfielPage} />
                </Route>
                <Route path="/samen">
                  <ProtectedPage component={SamenPage} />
                </Route>
                <Route path="/kennis">
                  <ProtectedPage component={KnowledgePage} />
                </Route>
                <Route path="/meer">
                  <ProtectedPage component={MeerPage} />
                </Route>
                <Route path="/connect">
                  <ProtectedPage component={SparkiConnectPage} />
                </Route>
                <Route path="/klimmen">
                  <ProtectedPage component={KlimmenPage} />
                </Route>
                <Route path="/admin">
                  <ProtectedPage component={AdminPage} />
                </Route>
                <Route path="/admin/health/:checkKey">
                  <ProtectedPage component={AdminHealthDetailPage} />
                </Route>
                <Route path="/invitations">
                  <ProtectedPage component={InvitationsPage} />
                </Route>
                <Route path="/tester-qr">
                  <ProtectedPage component={TesterQrPage} />
                </Route>
                <Route path="/welkom-tester">
                  <ProtectedPage component={TesterWelcomePage} />
                </Route>
                <Route path="/coach/athletes/:athleteId/plan">
                  <ProtectedPage component={CoachAthletePlanPage} />
                </Route>
                <Route path="/coach/athletes/:athleteId/cockpit">
                  <ProtectedPage component={CoachCockpitPage} />
                </Route>
                <Route path="/invite/:token">
                  <InviteRoute />
                </Route>
                <Route component={NotFound} />
              </Switch>
              </ClerkStartupGate>
              )}
            </ErrorBoundary>
            </SoundProvider>
            </FeedbackProvider>
          </FeatureFlagProvider>
        </UserProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRouter />
    </WouterRouter>
  );
}

export default App;
