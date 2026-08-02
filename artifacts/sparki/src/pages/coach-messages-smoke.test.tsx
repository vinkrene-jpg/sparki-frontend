// Smoke-test voor het F7 trainer↔sporter-berichtenscherm (coach_link).
//
// Rendert CoachMessagesPage met een volledig gemockt import-oppervlak en
// bevestigt de drie rollen:
//   1. trainer (role "coach")  → berichten + opstelvak zichtbaar;
//   2. sporter (role "athlete")→ opstelvak zichtbaar;
//   3. ouder (role "parent")   → meelees-banner, GEEN opstelvak (alleen lezen);
//   4. geen toegang (403)      → eerlijke melding, geen crash.
//
// Run: pnpm --filter @workspace/sparki run test:coach-messages-smoke

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── Bestuurbare toestand ────────────────────────────────────────────────────
type Role = "coach" | "athlete" | "parent";
let role: Role = "coach";
let isError = false;
let errStatus: number | undefined = undefined;
let messages: {
  id: number;
  authorClerkId: string;
  body: string;
  allowReplies: boolean;
  read: boolean;
  createdAt: string;
  attachments: unknown[];
}[] = [];

// ── Mocks — volledig import-oppervlak van coach-messages.tsx ─────────────────

mock.module("wouter", {
  namedExports: {
    useParams: () => ({ coachClerkId: "coach_1", athleteClerkId: "atl_1" }),
    Link: (props: Record<string, unknown>) => {
      const React = (globalThis as Record<string, unknown>).React as typeof import("react");
      return React.createElement("a", { href: props.href as string }, props.children as never);
    },
  },
});

mock.module("@/components/sparki/screen-shell", {
  namedExports: {
    ScreenShell: (props: Record<string, unknown>) => {
      const React = (globalThis as Record<string, unknown>).React as typeof import("react");
      return React.createElement("div", null, props.children as never);
    },
  },
});

mock.module("@/components/sparki/ui", {
  namedExports: {
    SectionLabel: (props: Record<string, unknown>) => {
      const React = (globalThis as Record<string, unknown>).React as typeof import("react");
      return React.createElement("h2", null, props.title as string);
    },
    ACCENT: "rgba(120,210,230,1)",
  },
});

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({ profile: { clerkId: "coach_1", activeRole: role } }),
  },
});

mock.module("@/hooks/use-coach-link-messages", {
  namedExports: {
    useCoachLinkThread: () => ({
      data: isError ? undefined : { role, parentReadsAlong: role === "parent", messages },
      isLoading: false,
      isError,
      error: isError ? Object.assign(new Error("nope"), { status: errStatus }) : null,
    }),
    useSendCoachLinkMessage: () => ({ mutate: () => {}, isPending: false, error: null }),
    useMarkCoachLinkRead: () => ({ mutate: () => {} }),
    useRevokeCoachLinkAttachment: () => ({ mutate: () => {} }),
  },
});

mock.module("@/components/sparki/message-thread", {
  namedExports: {
    MessageBubble: (props: Record<string, unknown>) => {
      const React = (globalThis as Record<string, unknown>).React as typeof import("react");
      const m = props.message as { body: string };
      return React.createElement("div", { "data-testid": "bubble" }, m.body);
    },
    MessageComposer: (props: Record<string, unknown>) => {
      const React = (globalThis as Record<string, unknown>).React as typeof import("react");
      return React.createElement(
        "div",
        { "data-testid": "composer" },
        props.placeholder as string,
      );
    },
  },
});

const pagePromise = import("./coach-messages");
const rtlPromise = import("@testing-library/react");
const reactPromise = import("react");

async function renderPage() {
  const page = await pagePromise;
  const rtl = await rtlPromise;
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  return rtl.render(React.createElement(page.default));
}

function oneMessage() {
  return [
    {
      id: 1,
      authorClerkId: "coach_1",
      body: "Hallo, hier je schema.",
      allowReplies: true,
      read: false,
      createdAt: new Date("2026-01-02T10:00:00Z").toISOString(),
      attachments: [],
    },
  ];
}

test("trainer ziet berichten en het opstelvak", async () => {
  role = "coach";
  isError = false;
  messages = oneMessage();
  const view = await renderPage();
  try {
    const text = view.container.textContent!;
    assert.ok(text.includes("Berichten met je trainer"), "koptekst");
    assert.ok(text.includes("Hallo, hier je schema."), "bericht zichtbaar");
    assert.ok(view.container.querySelector('[data-testid="composer"]'), "opstelvak aanwezig");
    assert.equal(
      text.includes("Ouderinzage"),
      false,
      "geen ouderbanner voor de trainer",
    );
  } finally {
    view.unmount();
  }
});

test("sporter ziet het opstelvak (twee richtingen)", async () => {
  role = "athlete";
  isError = false;
  messages = oneMessage();
  const view = await renderPage();
  try {
    assert.ok(view.container.querySelector('[data-testid="composer"]'), "opstelvak aanwezig");
  } finally {
    view.unmount();
  }
});

test("ouder krijgt meelees-banner en géén opstelvak", async () => {
  role = "parent";
  isError = false;
  messages = oneMessage();
  const view = await renderPage();
  try {
    assert.ok(
      view.container.querySelector('[data-testid="ouder-meelees-banner"]'),
      "meelees-banner aanwezig",
    );
    assert.equal(
      view.container.querySelector('[data-testid="composer"]'),
      null,
      "ouder heeft geen opstelvak (alleen lezen)",
    );
  } finally {
    view.unmount();
  }
});

test("geen toegang (403) toont een eerlijke melding zonder crash", async () => {
  role = "coach";
  isError = true;
  errStatus = 403;
  messages = [];
  const view = await renderPage();
  try {
    const text = view.container.textContent!;
    assert.ok(text.includes("Je hebt geen toegang tot dit gesprek."), "403-melding");
  } finally {
    view.unmount();
    isError = false;
    errStatus = undefined;
  }
});
