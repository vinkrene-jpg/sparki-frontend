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
import { nlNL } from "@clerk/localizations";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { Zap } from "lucide-react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { DayHome, DashboardAnalyse } from "@/components/sparki/day-home";
import { CommercialToday } from "@/components/sparki/commercial-shell";
import { KaartLanding } from "@/components/sparki/kaart-landing";
import { CoachHome } from "@/components/sparki/coach-home";
// DASHBOARD_01 Fase B — rol-dashboards (drie-lagen skelet) als eerste scherm.
import { CoachDashboard } from "@/components/sparki/role-dashboards/coach-dashboard";
import { ParentDashboard } from "@/components/sparki/role-dashboards/parent-dashboard";
import { OnboardingV2 } from "@/components/sparki/onboarding-v2";
import { ErrorBoundary } from "@/components/sparki/error-boundary";
import { BottomNav } from "@/components/sparki/bottom-nav";
import { ConsentGate } from "@/components/consent-gate";
import NotFound from "@/pages/not-found";
import LegalPage from "@/pages/legal";
import FeedPage from "@/pages/feed";
import TrainPage from "@/pages/train";
import YouPage from "@/pages/you";
import { AnalyseSwitchPage } from "@/pages/analyse-switch";
import ActiviteitenPage from "@/pages/activiteiten";
import PhotoLabPage from "@/pages/photo-lab";
import SamenPage from "@/pages/samen";
import ProfielPage from "@/pages/profiel";
import LichaamPage from "@/pages/lichaam";
import MechaniekerPage from "@/pages/mechanieker";
import RoutesPage from "@/pages/routes";
import RouteSchermPage from "@/pages/route-scherm";
import KalenderPage from "@/pages/kalender";
import RacesPage from "@/pages/races";
import RaceDetailPage from "@/pages/race-detail";
import WedstrijdRoomPage from "@/pages/wedstrijd-room";
import JourneyPage from "@/pages/journey";
import KnowledgePage from "@/pages/knowledge";
import MeerPage from "@/pages/meer";
import CorePlanPage from "@/pages/core-plan";
import CoreActiviteitenPage from "@/pages/core-activiteiten";
import CoreMeerPage from "@/pages/core-meer";
import CoreAnalysePage from "@/pages/core-analyse";
import SparkiConnectPage from "@/pages/sparki-connect";
import KlimmenPage from "@/pages/klimmen";
import InvitationsPage from "@/pages/invitations";
import InviteAcceptPage from "@/pages/invite-accept";
import TesterQrPage from "@/pages/tester-qr";
import TesterWelcomePage from "@/pages/tester-welcome";
import CoachAthletePlanPage from "@/pages/coach-athlete-plan";
import CoachCockpitPage from "@/pages/coach-cockpit";
import CoachMessagesPage from "@/pages/coach-messages";
import SporterCoachPage from "@/pages/sporter-coach";
import FacturatiePage from "@/pages/facturatie";
import LandingPage from "@/pages/landing";
import AdminPage from "@/pages/admin";
import AdminOpsPage from "@/pages/admin-ops";
import { VersionBlockScreen } from "@/components/sparki/version-block-screen";
import AdminHealthDetailPage from "@/pages/admin-health-detail";
import StartPage from "@/pages/start";
import ClubPage from "@/pages/club";
import ClubBeheerPage from "@/pages/club-beheer";
import PaspoortPage from "@/pages/paspoort";
import SupportPage from "@/pages/support";
import ParentKinderenPage from "@/pages/parent-kinderen";
import ParentMeldingenPage from "@/pages/parent-meldingen";
import NutritionSpecialistHome from "@/pages/nutrition-start";
import RolStartPage from "@/pages/rol-start";
import ParentToestemmingenPage from "@/pages/parent-toestemmingen";
import AiToestemmingPage from "@/pages/ai-toestemming";
import { apiFetch } from "@/lib/api";
import { decideOnboardingOutcome, lsKeyFor } from "@/lib/onboarding-gate";
import { OnboardingCheckFailed } from "@/components/sparki/onboarding-check-failed";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import { UserProvider, useUserProfile } from "@/contexts/UserContext";
import { useMyClubs } from "@/hooks/use-club";
import { clubStartRole } from "@/lib/role-start";
import { FeatureFlagProvider, useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { GoGateSwitch } from "@/components/sparki/go-gate";
import { usePackage } from "@/hooks/use-package";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import { DevPreview } from "@/components/sparki/dev-preview";
import { MotionPreferenceSync } from "@/hooks/use-motion-preference";
import DevMotionPage from "@/pages/dev-motion";
import { UpdateBanner } from "@/components/sparki/update-banner";
import { DEV_PREVIEW } from "@/lib/dev";
import { STALE } from "@/lib/query-keys";
import { SoundProvider } from "@/contexts/SoundContext";
import GeluidPage from "@/pages/geluid";
import AbonnementPage from "@/pages/abonnement";

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

// Volledige officiële Nederlandse Clerk-lokalisatie (defect A-07) — alle
// auth-schermen (inloggen, registreren, verificatie, wachtwoord vergeten,
// foutmeldingen, social login) in het Nederlands. Alleen de start-titels
// krijgen Sparki-eigen copy; de rest komt uit @clerk/localizations, dus geen
// half-vertaalde mix van Engelse defaults en losse overrides.
const clerkLocalization = {
  ...nlNL,
  signIn: {
    ...nlNL.signIn,
    start: {
      ...nlNL.signIn?.start,
      title: "Welkom terug",
      subtitle: "Log in op je Sparki-account",
    },
  },
  signUp: {
    ...nlNL.signUp,
    start: {
      ...nlNL.signUp?.start,
      title: "Maak je Sparki-account",
      subtitle: "Begin met slimmer fietsen en trainen",
    },
  },
};

// LICHT_THEMA_01: de Clerk-authschermen volgen het lichte thema — geen
// baseTheme: dark meer. Kleuren spiegelen de tokens uit index.css (donkere
// tekst op licht, donkerder cyaan accent, subtiele donkergetinte randen).
const AUTH_ACCENT = "oklch(0.58 0.13 205)"; // = --accent-cyan (donker voor licht)
const AUTH_FOREGROUND = "oklch(0.21 0.01 260)";
const clerkAppearance = {
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: AUTH_ACCENT,
    colorForeground: AUTH_FOREGROUND,
    colorMutedForeground: "oklch(0.44 0.01 260)",
    colorDanger: "oklch(0.55 0.2 25)",
    colorBackground: "oklch(1 0 0)",
    colorInput: "oklch(0.985 0.004 95)",
    colorInputForeground: AUTH_FOREGROUND,
    colorNeutral: AUTH_FOREGROUND,
    fontFamily: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl w-[420px] max-w-full overflow-hidden border border-border shadow-card",
    card: "!shadow-none !border-0 !rounded-none",
    footer: "!shadow-none !border-0 !rounded-none",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground/80",
    formFieldLabel: "text-foreground/70 text-xs",
    footerActionLink: "text-accent-cyan hover:opacity-80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-accent-cyan",
    formFieldSuccessText: "text-accent-cyan",
    alertText: "text-foreground/80",
    logoBox: "mb-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-border bg-muted hover:bg-secondary",
    formButtonPrimary: "bg-accent-cyan text-[color:var(--color-on-accent)] hover:opacity-90 font-semibold",
    formFieldInput: "bg-background border-border text-foreground placeholder:text-muted-foreground",
    footerAction: "border-t border-border",
    dividerLine: "bg-border",
    alert: "border-destructive/20 bg-destructive/10",
    otpCodeFieldInput: "bg-background border-border text-foreground",
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-foreground">
          Je account wordt klaargezet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Het lukte niet om je account te laden. Controleer je verbinding en
          probeer het opnieuw.
        </p>
        {error ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{error}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-accent-cyan px-6 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
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
    return <div className="min-h-dvh bg-background" />;
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
    // WP-R1 — echte ouderstart: een account in de ouderrol doorloopt nooit de
    // sporteronboarding. De rol zelf is het bewijs (server-side toegekend via
    // parent-start of een geaccepteerde koppeling); de gate slaat het
    // onboarding-onderzoek volledig over.
    if (profile.activeRole === "parent") {
      setOnboarded(true);
      return;
    }
    // BB-14: de voedingsdeskundige is geen sporter — nooit sporteronboarding.
    if (profile.activeRole === "nutrition_specialist") {
      setOnboarded(true);
      return;
    }
    let cancelled = false;
    const lsKey = lsKeyFor(profile.clerkId);
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
          const outcome = decideOnboardingOutcome(
            { ok: true, isComplete: onboarding.isComplete },
            lsDone,
          );
          if (outcome === "app") {
            localStorage.setItem(lsKey, "true");
            setOnboarded(true);
          } else if (outcome === "migrate-then-app") {
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
          // FAIL-CLOSED (A2-01): alleen de server bewijst een afgeronde
          // onboarding. De lokale waarde is uitsluitend een migratiehint bij
          // een BEREIKBARE server (zie hierboven) — bij een onbereikbare
          // server geven we de app nooit vrij en starten we ook geen nieuwe
          // onboarding; alleen het eerlijke foutscherm met opnieuw proberen.
          // (decideOnboardingOutcome({ok:false}, …) → "check-failed", ongeacht
          // de lokale waarde — zie lib/onboarding-gate.ts.)
          if (decideOnboardingOutcome({ ok: false }, lsDone) === "check-failed") {
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
      <OnboardingCheckFailed
        onRetry={() => {
          setCheckFailed(false);
          setOnboarded(null);
          setCheckNonce((n) => n + 1);
        }}
      />
    );
  }

  // Account ready (guaranteed by AccountGate) — brief flash while resolving
  // onboarding state.
  if (onboarded === null) {
    return <div className="min-h-dvh bg-background" />;
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
// (dagplanning) lives in its own hoofdstuk on /dashboard.
//
// Fail-open patroon: zolang flags laden renderen we CommercialToday (met
// DsMobileNav). ScreenShell heeft nu ook DsMobileNav en een desktop sidebar
// (zelfde COMMERCIAL_DESKTOP_NAV-bron), dus beide paden geven een consistente
// navigatie-ervaring — hetzelfde patroon als alle andere flag-switch-pagina's.
// BB-08 laatste stap (SPARKI_INHAAL_01 §1): een account dat géén sporter is
// (geen "athlete" in profile.roles) maar wél een actieve clubrol heeft, hoort
// bij inloggen op het eigen rolstartscherm te landen — nooit op de
// atleetweergave. De schermen bestonden al (/rol-start/:rol); dit is de
// routering ernaartoe. Zolang de clublidmaatschappen nog laden tonen we
// bewust even niets in plaats van een flitsende (onjuiste) sporterweergave.
function useClubOnlyStartPath(): string | null | "loading" {
  const { profile } = useUserProfile();
  const clubsQuery = useMyClubs();
  const globalRoles = profile?.roles ?? [];
  const needsClubStart =
    !!profile &&
    profile.activeRole === "athlete" &&
    !globalRoles.includes("athlete");
  if (!needsClubStart) return null;
  if (clubsQuery.isLoading) return "loading";
  const activeClubRoles = (clubsQuery.data ?? [])
    .map((row) => row?.membership?.role as string | undefined)
    .filter((r): r is string => typeof r === "string");
  const rol = clubStartRole(activeClubRoles);
  return rol ? `/rol-start/${rol}` : null;
}

function RoleHome() {
  const { profile } = useUserProfile();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const clubStart = useClubOnlyStartPath();
  // DASHBOARD_01 Fase B (DSH-13a): het drie-lagen dashboard is het eerste
  // scherm van elke niet-sporterrol; de bestaande werkomgeving (roster,
  // Kinderen) blijft één doorklik verderop bereikbaar.
  if (profile?.activeRole === "coach") return <CoachDashboard />;
  if (profile?.activeRole === "parent") return <ParentDashboard />;
  // BB-14: eigen startscherm, nooit terugval op de sporterweergave.
  if (profile?.activeRole === "nutrition_specialist")
    return <NutritionSpecialistHome />;
  if (clubStart === "loading") return null;
  if (clubStart) return <Redirect to={clubStart} />;
  // DASHBOARD_01 Fase C: het sporter-startscherm volgt het pakket (DSH-10/12).
  if (flagsLoading || flags.commercial_shell) return <SporterLanding />;
  return <StartPage />;
}

// DASHBOARD_01 Fase C (DSH-10/11/12, DSH-24): de sporter-landing onder de
// commerciële schil volgt het pakket. Compleet landt op het drie-lagen
// dashboard (CommercialToday — hergebruik van de Fase A-opbouw binnen de
// commerciële schil-chrome, GEEN tweede gedaante). Go en Gratis landen op de
// kaart met het onderblad (alleen laag 2). Zolang het pakket nog niet bekend
// is (billing laadt of onleesbaar) kiezen we bewust de kaart — die werkt voor
// élk pakket en vraagt geen data die Gratis niet heeft (DSH-09/22).
function SporterLanding() {
  const { pkg } = usePackage();
  if (pkg === "compleet") return <CommercialToday />;
  return <KaartLanding pkg={pkg === "go" ? "go" : "gratis"} />;
}

// Dashboard — the athlete home (DASHBOARD_01). Athletes get the single
// three-layer dashboard (DayHome → StateDayHome); coach and parent keep their
// role home here too, so "Dashboard" in their navigation always works.
function DashboardPage() {
  const { profile } = useUserProfile();
  // Fail-open: while flags are loading useFeatureFlag returns false, which would
  // briefly render the legacy ScreenShell page (no mobile nav). Instead we read
  // isLoading from the context and default to the commercial shell — it is
  // enabled_globally=true at 100 % rollout so this is always the safe default.
  // Only fall back to the legacy page when flags are confirmed loaded AND the
  // flag is explicitly off.
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const commercialShell = flags.commercial_shell;
  const clubStart = useClubOnlyStartPath();
  // DASHBOARD_01 Fase B (DSH-13a): dashboard = eerste scherm per rol.
  if (profile?.activeRole === "coach") return <CoachDashboard />;
  if (profile?.activeRole === "parent") return <ParentDashboard />;
  if (profile?.activeRole === "nutrition_specialist")
    return <NutritionSpecialistHome />;
  if (clubStart === "loading") return null;
  if (clubStart) return <Redirect to={clubStart} />;
  if (flagsLoading || commercialShell) return <DashboardSporter />;
  return <DayHome />;
}

// DASHBOARD_01 Fase C (DSH-13/14/22): het sporter-dashboard hoort bij Go en
// Compleet. Gratis heeft GEEN dashboard — laag 1 en 3 vragen gegevens die een
// gratis gebruiker niet heeft. Vraagt Gratis toch /dashboard aan (oude link,
// bladwijzer, melding), dan volgt een NETTE doorverwijzing naar de kaart, nooit
// een doodlopende link (DSH-22). Zolang het pakket nog laadt tonen we bewust
// niets in plaats van een dashboard dat straks een verkeerde landing blijkt.
function DashboardSporter() {
  const { isLoading, pkg } = usePackage();
  if (isLoading || pkg == null) return <div className="min-h-dvh bg-background" />;
  if (pkg === "gratis") return <Redirect to="/routes" />;
  return <CommercialToday />;
}

// Dashboard → diepere dagtype-analyse (DSH-07): een doorklik vanaf het
// Dashboard, een eigen scherm — geen tweede gedaante onder dezelfde naam. Alleen
// zinvol voor de sporter; andere rollen keren terug naar hun Dashboard.
function DashboardAnalysePage() {
  const { profile } = useUserProfile();
  if (
    profile?.activeRole === "coach" ||
    profile?.activeRole === "parent" ||
    profile?.activeRole === "nutrition_specialist"
  ) {
    return <Redirect to="/dashboard" />;
  }
  return <DashboardAnalyse />;
}

// DSH-03: /vandaag blijft bestaan als doorverwijzing naar /dashboard. Bestaande
// links, bladwijzers en meldingen (incl. deep-links als
// /vandaag?state=… of ?focus=nutrition/?materiaal=…) mogen niet doodlopen — de
// querystring blijft behouden zodat het deep-link-gedrag equivalent blijft.
function VandaagRedirect() {
  const search = window.location.search;
  return <Redirect to={`/dashboard${search}`} replace />;
}

// Plan/Activiteiten/Meer/Analyse — zelfde flag-switch als Vandaag: met
// commercial_shell aan de nieuwe designsysteem-pagina, uit exact de bestaande
// pagina. Coach en ouder hadden op deze routes nooit een aparte variant; de
// nieuwe Meer-pagina regelt rolgedrag zelf (net als de oude).
//
// Fail-open patroon: zolang flags laden renderen we de CommercialShell-pagina
// (met DsMobileNav). Zonder dit valt useFeatureFlag terug op false — de
// ScreenShell-pagina rendert zonder mobiele ondernavigatie.
// Taak #607 — /coach is rol-bewust: trainers houden hun bestaande
// werkomgeving (roster, CoachHome); sporters krijgen hier hun eigen
// coach-omgeving met het complete plan per week/fase, doellijn en voortgang.
function CoachSwitchPage() {
  const { profile } = useUserProfile();
  if (profile?.activeRole === "coach") return <CoachHome />;
  return <SporterCoachPage />;
}

function TrainSwitchPage() {
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const page =
    flagsLoading || flags.commercial_shell ? <CorePlanPage /> : <TrainPage />;
  // Go-poort (taak 385): de trainingsplan-engine is een Go-onderdeel.
  return (
    <GoGateSwitch feature="autonomous_training" actief="/train" section="Train">
      {page}
    </GoGateSwitch>
  );
}

function ActiviteitenSwitchPage() {
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  if (flagsLoading || flags.commercial_shell) return <CoreActiviteitenPage />;
  return <ActiviteitenPage />;
}

function MeerSwitchPage() {
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  if (flagsLoading || flags.commercial_shell) return <CoreMeerPage />;
  return <MeerPage />;
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 pb-28 text-center">
        <Zap className="h-7 w-7 text-accent-cyan" aria-hidden="true" />
        <p className="font-sans text-base font-semibold text-foreground/80">
          Er ging iets mis op deze pagina
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Kies hieronder een ander onderdeel, of probeer het opnieuw.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan"
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
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center"
    >
      {/* Bij reduced motion draait de ring niet (centrale regel in index.css);
          de statische ring + tekst hieronder blijven de laadstatus dragen. */}
      <div
        aria-hidden="true"
        className="h-7 w-7 animate-spin motion-reduce:animate-none rounded-full border-[3px] border-accent-cyan/25 border-t-accent-cyan/90"
      />
      <p className="text-sm font-semibold text-foreground/75">
        Sparki wordt geladen…
      </p>
      {slow && (
        <>
          <p className="max-w-xs text-sm text-muted-foreground">
            Dit duurt langer dan normaal. Controleer je verbinding of laad de
            app opnieuw.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 rounded-full border border-accent-cyan/40 px-5 py-2 text-sm font-semibold text-accent-cyan"
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
      localization={clerkLocalization}
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
              <MotionPreferenceSync />
              <UpdateBanner />
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
                {/* DSH-07: diepere analyse als doorklik — vóór /dashboard zodat
                    de meer-specifieke route eerst matcht. */}
                <Route path="/dashboard/analyse">
                  <ProtectedPage component={DashboardAnalysePage} />
                </Route>
                <Route path="/dashboard">
                  <ProtectedPage component={DashboardPage} />
                </Route>
                {/* DSH-03: /vandaag blijft als doorverwijzing bestaan
                    (querystring behouden voor deep-links). */}
                <Route path="/vandaag">
                  <VandaagRedirect />
                </Route>
                <Route path="/club/beheer">
                  <ProtectedPage component={ClubBeheerPage} />
                </Route>
                {/* SPARKI_BUILD_04 F14 — facturatiewerkplek van de trainer. */}
                <Route path="/facturatie">
                  <ProtectedPage component={FacturatiePage} />
                </Route>
                <Route path="/club">
                  <ProtectedPage component={ClubPage} />
                </Route>
                <Route path="/paspoort">
                  <ProtectedPage component={PaspoortPage} />
                </Route>
                {/* Dedicated toestemmingenpagina voor de sporter — apart en
                    goed vindbaar; de AI-gateway blijft server-side
                    fail-closed op deze toestemmingen. */}
                <Route path="/ai-toestemming">
                  <ProtectedPage component={AiToestemmingPage} />
                </Route>
                <Route path="/support">
                  <ProtectedPage component={SupportPage} />
                </Route>
                <Route path="/kinderen">
                  <ProtectedPage component={ParentKinderenPage} />
                </Route>
                <Route path="/meldingen">
                  <ProtectedPage component={ParentMeldingenPage} />
                </Route>
                <Route path="/toestemmingen">
                  <ProtectedPage component={ParentToestemmingenPage} />
                </Route>
                {/* F3 (BB-08): eigen startpunt per server-side rolwaarde. */}
                <Route path="/rol-start/:rol">
                  <ProtectedPage component={RolStartPage} />
                </Route>
                <Route path="/train">
                  <ProtectedPage component={TrainSwitchPage} />
                </Route>
                <Route path="/feed">
                  <ProtectedPage component={FeedPage} />
                </Route>
                <Route path="/analyse">
                  <ProtectedPage component={AnalyseSwitchPage} />
                </Route>
                <Route path="/lab">
                  <Redirect to="/analyse" />
                </Route>
                <Route path="/activiteiten">
                  <ProtectedPage component={ActiviteitenSwitchPage} />
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
                {/* Abonnement — prijzen/lagen + up-/downgradepad (productie-
                    bevinding punt 4). Maakt de commerciële laag zichtbaar. */}
                <Route path="/abonnement">
                  <ProtectedPage component={AbonnementPage} />
                </Route>
                {/* MEDIA_UITLEG_01 F1 — testpagina, alleen voor toetsing;
                    nergens gelinkt en achter de flag media_uitleg_motion. */}
                <Route path="/_dev/motion">
                  <ProtectedPage component={DevMotionPage} />
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
                {/* ROUTEPLANNER_MOBIEL_01: nieuw schermvullend routescherm
                    (telefoon), gebouwd NAAST het bevroren oude paneel. */}
                <Route path="/route">
                  <ProtectedPage component={RouteSchermPage} />
                </Route>
                <Route path="/kalender">
                  <ProtectedPage component={KalenderPage} />
                </Route>
                <Route path="/races">
                  <ProtectedPage component={RacesPage} />
                </Route>
                {/* Detail per geplande wedstrijd — bereikbaar vanuit de
                    kalender en de wedstrijdlijst. */}
                <Route path="/races/:id">
                  <ProtectedPage component={RaceDetailPage} />
                </Route>
                {/* /sprinten is bewust NIET meer gerout — Bordjes sprinten is
                    gestopt (veiligheidsrisico op openbare weg, besluit
                    31-07-2026); directe URL valt door naar NotFound. */}
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
                  <ProtectedPage component={MeerSwitchPage} />
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
                <Route path="/admin/ops">
                  <ProtectedPage component={AdminOpsPage} />
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
                {/* DASHBOARD_01 Fase B — de trainerswerkomgeving (roster,
                    planning, berichten). Het dashboard op /dashboard verwijst
                    hierheen door; niets is weggelaten (DSH-13a). */}
                <Route path="/coach">
                  <ProtectedPage component={CoachSwitchPage} />
                </Route>
                <Route path="/coach/athletes/:athleteId/plan">
                  <ProtectedPage component={CoachAthletePlanPage} />
                </Route>
                <Route path="/coach/athletes/:athleteId/cockpit">
                  <ProtectedPage component={CoachCockpitPage} />
                </Route>
                {/* F7 — trainer↔sporter-berichten (coach_link). Ook het
                    landingspad voor de neutrale notificatie die de backend zet:
                    /coach-messages/:coachClerkId/:athleteClerkId. */}
                <Route path="/coach-messages/:coachClerkId/:athleteClerkId">
                  <ProtectedPage component={CoachMessagesPage} />
                </Route>
                {/* F7 — clubnotificatie deep-linkt hierheen; land op de
                    clubomgeving waar de berichten al leven. */}
                <Route path="/clubs/:clubId/berichten">
                  <Redirect to="/club" />
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
