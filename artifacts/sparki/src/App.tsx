import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "@/components/sparki/bottom-nav";
import { TrainingDayHome } from "@/components/sparki/training-day-home";
import NotFound from "@/pages/not-found";
import FeedPage from "@/pages/feed";
import TrainPage from "@/pages/train";
import YouPage from "@/pages/you";
import LabPage from "@/pages/lab";
import LandingPage from "@/pages/landing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import { UserProvider } from "@/contexts/UserContext";

const queryClient = new QueryClient();

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

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <>
          <TrainingDayHome />
          <BottomNav />
        </>
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
            subtitle: "AI-powered cycling performance",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <UserProvider>
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
            <Route component={NotFound} />
          </Switch>
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
