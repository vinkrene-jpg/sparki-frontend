// Smoke-test voor de volledige adminpagina: rendert AdminPage met gemockte
// hooks (gevuld met realistische data) en bevestigt dat élke sectie zonder
// crash verschijnt. Zo kan een refactor niet stilletjes een sectie slopen.
//
// Twee scenario's:
//   1. gevulde data → alle secties (gezondheidschecks, geplande taken,
//      datasync, denkkracht, feedback, mislukte imports, kwaliteit, cijfers,
//      testgeschiedenis, release-controles, subsecties) zijn zichtbaar;
//   2. lege data → de pagina rendert nog steeds zonder crash met eerlijke
//      lege staten.
//
// Run with: pnpm --filter @workspace/sparki run test:admin-page-smoke

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Bestuurbare mocks. mock.module moet vóór de (lazy) import van admin.tsx
// staan; statische imports zouden gehesen worden en de echte modules laden.
// ---------------------------------------------------------------------------

let filled = true;

const NOW = new Date().toISOString();

function healthCheck(overrides: Record<string, unknown> = {}) {
  return {
    checkKey: "db_ping",
    category: "infra",
    title: "Databaseverbinding",
    description: "Echte ping naar de database",
    responsibleModule: "api-server",
    statusColor: "green",
    passed: true,
    responseTimeMs: 12,
    lastRunAt: NOW,
    lastSuccessAt: NOW,
    errorMessage: null,
    technicalDetails: null,
    userImpact: "geen",
    urgency: "low",
    remediation: null,
    resolvedAt: null,
    ...overrides,
  };
}

function healthBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    runMode: "manual",
    overallStatus: "green",
    totalChecks: 4,
    greenCount: 3,
    orangeCount: 1,
    redCount: 0,
    greyCount: 0,
    triggeredBy: "scheduler",
    startedAt: NOW,
    finishedAt: NOW,
    ...overrides,
  };
}

function healthData() {
  if (!filled) {
    return {
      overall: "grey",
      lastRunAt: null,
      lastSuccessAt: null,
      checks: [],
      openErrors: [],
      lastBatch: null,
      aggregates: {},
    };
  }
  const broken = healthCheck({
    checkKey: "mail_send",
    category: "meldingen",
    title: "E-mailbezorging",
    statusColor: "red",
    passed: false,
    errorMessage: "SMTP weigert verbinding",
    urgency: "high",
  });
  return {
    overall: "red",
    lastRunAt: NOW,
    lastSuccessAt: NOW,
    checks: [healthCheck(), broken],
    openErrors: [broken],
    lastBatch: healthBatch(),
    aggregates: {
      active_users: 12,
      new_registrations: 3,
      open_bug_reports: 1,
      feedback_messages: 5,
      failed_imports: 2,
      expired_tokens: 0,
    },
  };
}

function scheduledData() {
  if (!filled) return { tasks: [], missing: 0 };
  return {
    missing: 1,
    tasks: [
      {
        key: "goal-review",
        title: "Maandelijkse doelen-review",
        description: "Loopt elke eerste van de maand",
        runCommand: "pnpm --filter @workspace/api-server run job:goal-review",
        schedule: "0 6 1 * *",
        traceLabel: "Laatste spoor",
        lastRunAt: NOW,
        statusColor: "green",
        message: "Laatste run liet een vers dataspoor achter.",
      },
      {
        key: "news-refresh",
        title: "Nieuws verversen",
        description: "Dagelijkse verversing",
        runCommand: "pnpm run job:news",
        schedule: "0 5 * * *",
        traceLabel: "Laatste spoor",
        lastRunAt: null,
        statusColor: "grey",
        message: "Nog geen zichtbare run gevonden.",
      },
    ],
  };
}

function syncDiagData() {
  if (!filled)
    return { providers: [], recentRuns: [], webhooks: [], failedWebhooks: [] };
  return {
    providers: [
      {
        provider: "strava",
        totalRuns: 42,
        failedRuns: 2,
        partialRuns: 1,
        lastRunAt: NOW,
        lastSuccessAt: NOW,
      },
    ],
    recentRuns: [],
    webhooks: [{ provider: "strava", status: "processed", count: 40 }],
    failedWebhooks: [
      {
        id: "wh-1",
        provider: "strava",
        eventId: "evt-1",
        status: "failed",
        attempts: 3,
        lastError: "timeout",
        receivedAt: NOW,
      },
    ],
  };
}

function aiInsightsData() {
  if (!filled) return undefined;
  return {
    purposes: [
      {
        purpose: "daily_briefing",
        label: "Dagelijkse briefing",
        provider: "anthropic",
        model: "claude",
        promptVersion: "v3",
        inputCategories: ["training"],
        consent: "training",
        sensitive: false,
        minorBlocked: false,
        timeoutMs: 30000,
        maxRetries: 1,
      },
    ],
    usage: [
      {
        purpose: "daily_briefing",
        totalCalls: 10,
        okCalls: 8,
        blockedCalls: 1,
        failedCalls: 1,
        avgLatencyMs: 900,
        inputTokens: "1000",
        outputTokens: "400",
        costMicroUsd: "125000",
        redactedCalls: 2,
        lastCallAt: NOW,
      },
    ],
    statuses: [{ status: "ok", count: 8 }],
    recentProblems: [
      {
        id: 1,
        purpose: "daily_briefing",
        provider: "anthropic",
        model: "claude",
        status: "failed",
        errorCode: "timeout",
        retries: 1,
        latencyMs: 30000,
        createdAt: NOW,
      },
    ],
    last24h: { calls: 10, costMicroUsd: "125000" },
  };
}

function qualityData() {
  if (!filled)
    return { totals: {}, byEngine: [], byRule: [], recentIncorrect: [] };
  return {
    totals: { nuttig: 7, onjuist: 2 },
    byEngine: [
      {
        engine: "observation",
        engine_version: "v2",
        total: 9,
        onjuist: 2,
        nuttig: 7,
        opvolging: 1,
        opgevolgd: 1,
      },
    ],
    byRule: [],
    recentIncorrect: [
      {
        id: 5,
        subjectType: "observatie",
        subjectKey: "obs-5",
        actorRole: "athlete",
        reasonCode: "klopt_niet",
        reasonText: "Dit klopt niet met mijn gevoel",
        context: { engine: "observation", ruleKey: "r1", engineVersion: "v2" },
        updatedAt: NOW,
      },
    ],
  };
}

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({
      profile: {
        clerkId: "clerk_own_123",
        email: "eigen@sparki.test",
        displayName: "Eigen Tester",
      },
    }),
  },
});

mock.module("@/hooks/use-admin-health", {
  namedExports: {
    useAdminHealth: () => ({ data: healthData(), isLoading: false }),
    useRunHealthChecks: () => ({ mutate: () => {}, isPending: false }),
    useAdminHealthBatches: () => ({
      data: filled
        ? {
            batches: [healthBatch()],
            releaseChecks: [healthBatch({ id: 2, runMode: "release" })],
          }
        : { batches: [], releaseChecks: [] },
    }),
    useAdminScheduledTasks: () => ({ data: scheduledData() }),
    useAdminFeedback: () => ({
      data: filled
        ? {
            feedback: [
              {
                id: 1,
                feedback_type: "too_hard",
                note: "Interval was echt te zwaar vandaag",
                createdAt: NOW,
                reporterName: "Test Sporter",
              },
            ],
          }
        : { feedback: [] },
    }),
    useAdminFailedImports: () => ({
      data: filled
        ? {
            imports: [
              {
                id: 1,
                fileName: "rit-zondag.fit",
                fileType: "fit",
                status: "failed",
                errorMessage: "Bestand is beschadigd",
                uploadedAt: NOW,
                reporterName: "Test Sporter",
              },
            ],
          }
        : { imports: [] },
    }),
    useAdminSyncDiagnostics: () => ({ data: syncDiagData() }),
    useAdminAiInsights: () => ({ data: aiInsightsData() }),
    useAdminQuality: () => ({ data: qualityData() }),
    useAdminProvenance: () => ({
      data: undefined,
      isError: false,
      isFetching: false,
    }),
    useAdminDataTrustCleanup: () => ({
      data: undefined,
      isPending: false,
      isError: false,
      mutate: () => {},
    }),
  },
});

mock.module("@/hooks/use-bug-reports", {
  namedExports: {
    useAdminWhoami: () => ({ data: { isAdmin: true }, isLoading: false }),
    useAdminStatus: () => ({
      data: filled ? { status: { gebruikers: 12, sessies: 340 } } : { status: {} },
    }),
    useAdminBugReports: () => ({
      data: filled ? { reports: [{ id: 1 }] } : { reports: [] },
    }),
  },
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  },
});

mock.module("wouter", {
  namedExports: {
    Link: (props: { children?: unknown }) => props.children ?? null,
    Redirect: () => {
      throw new Error("Redirect mag niet renderen in dit scenario");
    },
  },
});

mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false },
});

mock.module("@/components/sparki/ui", {
  namedExports: { ACCENT: "oklch(0.82 0.16 200)" },
});

// Subsecties met eigen data-lagen: mock met een herkenbare marker zodat de
// smoke-test bevestigt dat AdminPage ze daadwerkelijk opneemt.
mock.module("@/components/sparki/feedback-inbox", {
  namedExports: {
    FeedbackInbox: (props: { reports?: unknown[] }) =>
      `[feedback-inbox:${props.reports?.length ?? 0}]`,
  },
});
mock.module("@/components/sparki/release-admin", {
  namedExports: { ReleaseAdminSection: () => "[release-admin]" },
});
mock.module("@/components/sparki/knowledge-admin", {
  namedExports: { KennisbankAdminSection: () => "[kennisbank-admin]" },
});
mock.module("@/components/sparki/support-admin", {
  namedExports: { SupportAdminSection: () => "[support-admin]" },
});

mock.module("@/lib/health-status", {
  namedExports: {
    STATUS_META: {
      green: { color: "#0f0", dot: "#0f0", bg: "#010", label: "Werkt" },
      orange: { color: "#fa0", dot: "#fa0", bg: "#110", label: "Aandacht" },
      red: { color: "#f00", dot: "#f00", bg: "#100", label: "Kapot" },
      grey: { color: "#888", dot: "#888", bg: "#111", label: "Onbekend" },
    },
    CATEGORY_LABEL: { infra: "Infrastructuur" },
    formatWhen: () => "zojuist",
  },
});

// Lazy imports ná de mocks (geen top-level await: tsx transformeert naar CJS).
const adminPromise = import("./admin");
const rtlPromise = import("@testing-library/react");
const reactPromise = import("react");

async function renderPage() {
  const admin = await adminPromise;
  const rtl = await rtlPromise;
  const React = (await reactPromise).default;
  // tsx compileert de JSX in admin.tsx hier met de klassieke runtime
  // (React.createElement) — maak React dus global vóór het renderen.
  (globalThis as Record<string, unknown>).React = React;
  return rtl.render(React.createElement(admin.default));
}

test("adminpagina rendert álle secties zonder crash bij gevulde data", async () => {
  filled = true;
  const view = await renderPage();
  try {
    const text = view.container.textContent!;
    const expected = [
      // Kop & banner
      "Beheer & gezondheid",
      "Er is een storing",
      // Geplande taken
      "Geplande taken",
      "Maandelijkse doelen-review",
      "1 nog opzetten",
      // Datasync
      "Automatische datasync",
      "strava",
      "Mislukte webhook-meldingen",
      // Denkkracht-gateway
      "Sparki-denkkracht (gateway)",
      "Dagelijkse briefing",
      "Recente niet-geslaagde aanroepen",
      // Aandachtspunten + checks per categorie
      "Aandachtspunten (1)",
      "E-mailbezorging",
      "In één oogopslag",
      "Infrastructuur",
      "Databaseverbinding",
      // Testgeschiedenis & release-controles
      "Testgeschiedenis",
      "Release-controles",
      // Feedback-inbox (gemockte subsectie met echte reports-prop)
      "[feedback-inbox:1]",
      // Feedback van sporters
      "Feedback van sporters (1)",
      "Te zwaar",
      // Mislukte imports
      "Mislukte imports (1)",
      "rit-zondag.fit",
      // Gegevensbroncontrole + opschoning (echte secties, eigen account)
      "Dit is jouw huidige account",
      // Kwaliteit van analyses
      "Kwaliteit van analyses",
      "Recent als onjuist gemeld",
      // Subsecties
      "[support-admin]",
      "[release-admin]",
      "[kennisbank-admin]",
      // Cijfers
      "Cijfers",
    ];
    for (const needle of expected) {
      assert.ok(text.includes(needle), `sectie/inhoud ontbreekt: "${needle}"`);
    }
    // Controleer-knop aanwezig.
    const btn = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Controleer nu",
    );
    assert.ok(btn, "Controleer nu-knop aanwezig");
  } finally {
    view.unmount();
  }
});

test("adminpagina rendert zonder crash bij lege data (eerlijke lege staten)", async () => {
  filled = false;
  const view = await renderPage();
  try {
    const text = view.container.textContent!;
    for (const needle of [
      "Beheer & gezondheid",
      "Nog niet gecontroleerd",
      "Nog geen controles uitgevoerd.",
      "Nog geen release-controles uitgevoerd",
      "Nog geen feedback ontvangen.",
      "Geen mislukte imports. Alle uploads zijn goed verwerkt.",
      "[support-admin]",
      "[release-admin]",
      "[kennisbank-admin]",
      "Cijfers",
    ]) {
      assert.ok(text.includes(needle), `lege staat ontbreekt: "${needle}"`);
    }
    // Secties die alleen bij data verschijnen, ontbreken netjes (geen crash).
    assert.equal(text.includes("Geplande taken"), false);
    assert.equal(text.includes("Automatische datasync"), false);
    assert.equal(text.includes("Sparki-denkkracht (gateway)"), false);
  } finally {
    view.unmount();
  }
});
