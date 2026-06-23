import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";

const PreviewPage = import.meta.env.DEV
  ? lazy(() => import("@/pages/preview"))
  : null;
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
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/sparki/bottom-nav";
import { DayHome } from "@/components/sparki/day-home";
import { CoachHome } from "@/components/sparki/coach-home";
import { ParentHome } from "@/components/sparki/parent-home";
import { QuickStartFlow } from "@/components/sparki/quick-start-flow";
import { ErrorBoundary } from "@/components/sparki/error-boundary";
import NotFound from "@/pages/not-found";
import FeedPage from "@/pages/feed";
import TrainPage from "@/pages/train";
import YouPage from "@/pages/you";
import LabPage from "@/pages/lab";
import RacesPage from "@/pages/races";
import KnowledgePage from "@/pages/knowledge";
import InvitationsPage from "@/pages/invitations";
import InviteAcceptPage from "@/pages/invite-accept";
import TesterQrPage from "@/pages/tester-qr";
import LandingPage from "@/pages/landing";
import { apiFetch } from "@/lib/api";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import { UserProvider, useUserProfile } from "@/contexts/UserContext";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { DevPreview } from "@/components/sparki/dev-preview";
import { DEV_PREVIEW } from "@/lib/dev";
import { STALE } from "@/lib/query-keys";

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

function SignedInHome() {
  const { user } = useUser();
  const qc = useQueryClient();
  const { refetch: refetchUser } = useUserProfile();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const lsKey = `sparki_onboarded_${user.id}`;
    const lsDone = localStorage.getItem(lsKey) === "true";
    // DB is the source of truth. localStorage is only a fast-path cache and a
    // migration bridge for users who completed onboarding before DB persistence.
    void (async () => {
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
      } catch {
        // Never hard-block the app on a network/DB hiccup — fall back to cache.
        if (!cancelled) setOnboarded(lsDone);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleComplete = useCallback(() => {
    if (user) {
      localStorage.setItem(`sparki_onboarded_${user.id}`, "true");
    }
    void apiFetch("/api/onboarding/state", {
      method: "PUT",
      body: JSON.stringify({ isComplete: true }),
    });
    // Refresh UserContext (picks up new displayName) + all athlete queries
    void refetchUser();
    void qc.invalidateQueries();
    setOnboarded(true);
  }, [user, qc, refetchUser]);

  // Brief dark flash while checking localStorage
  if (onboarded === null) {
    return <div className="min-h-dvh bg-[#040506]" />;
  }

  if (!onboarded) {
    return (
      <QuickStartFlow
        clerkUser={{
          firstName: user?.firstName ?? null,
          username: user?.username ?? null,
        }}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <>
      <RoleHome />
      <BottomNav />
    </>
  );
}

// Home is role-aware: coaches see their roster, parents see the wellbeing view,
// athletes see the day-type homepage engine.
function RoleHome() {
  const { profile } = useUserProfile();
  if (profile?.activeRole === "coach") return <CoachHome />;
  if (profile?.activeRole === "parent") return <ParentHome />;
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

function ProtectedPage({ component: Page }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <>
          <Page />
          <BottomNav />
        </>
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
        <>
          <InviteAcceptPage />
          <BottomNav />
        </>
      </Show>
      <Show when="signed-out">
        <Redirect to={redirectTo} />
      </Show>
    </>
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
            <ErrorBoundary>
              {DEV_PREVIEW ? (
                <DevPreview />
              ) : (
              <Switch>
                <Route path="/" component={HomeRedirect} />
                {/* REQUIRED — /*? is the only wouter syntax for Clerk OAuth sub-paths */}
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/train">
                  <ProtectedPage component={TrainPage} />
                </Route>
                <Route path="/feed">
                  <ProtectedPage component={FeedPage} />
                </Route>
                <Route path="/lab">
                  <ProtectedPage component={LabPage} />
                </Route>
                <Route path="/you">
                  <ProtectedPage component={YouPage} />
                </Route>
                <Route path="/races">
                  <ProtectedPage component={RacesPage} />
                </Route>
                <Route path="/kennis">
                  <ProtectedPage component={KnowledgePage} />
                </Route>
                <Route path="/invitations">
                  <ProtectedPage component={InvitationsPage} />
                </Route>
                <Route path="/tester-qr">
                  <ProtectedPage component={TesterQrPage} />
                </Route>
                <Route path="/invite/:token">
                  <InviteRoute />
                </Route>
                {import.meta.env.DEV && PreviewPage && (
                  <Route path="/preview">
                    <Suspense fallback={<div className="min-h-dvh bg-[#040506]" />}>
                      <PreviewPage />
                    </Suspense>
                  </Route>
                )}
                <Route component={NotFound} />
              </Switch>
              )}
            </ErrorBoundary>
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
