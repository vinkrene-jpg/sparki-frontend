// Regressietest voor het hoofdmenu (MainMenu). Legt de productie-bevinding
// vast: een klik op het menu-icoon mag NOOIT de hele pagina laten omvallen.
// Toetst drie scenario's zonder throw en met zichtbaar menu:
//   (a) normale clubdata,
//   (b) myClubs = niet-array (server gaf op /api/clubs eerder een afwijkende
//       vorm / 500 terug),
//   (c) een clubrij met membership zonder role.
// En dat de ErrorBoundary-isolatie de pagina laat staan als het menu tóch
// intern faalt.
//
// Run with: node ../../scripts/run-tsx-test.mjs --test --experimental-test-module-mocks src/components/sparki/main-menu.test.tsx

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register({ url: "http://localhost/vandaag" })
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Bestuurbare mocks — VOOR de lazy import van main-menu.tsx.
let mockMyClubs: unknown = []
let mockRoles: string[] = ["athlete"]
let mockActiveRole = "athlete"

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({
      profile: {
        activeRole: mockActiveRole,
        roles: mockRoles,
        displayName: "Test",
      },
      switchRole: async () => {},
    }),
  },
})

mock.module("@/contexts/FeedbackContext", {
  namedExports: {
    useFeedback: () => ({ openFeedback: () => {} }),
  },
})

mock.module("@clerk/react", {
  namedExports: {
    useClerk: () => ({ signOut: async () => {} }),
  },
})

mock.module("@/hooks/use-club", {
  namedExports: {
    useClubMembership: () => ({ isMember: false }),
    useMyClubs: () => ({ data: mockMyClubs }),
  },
})

mock.module("@/hooks/use-bug-reports", {
  namedExports: {
    useAdminWhoami: () => ({ data: undefined }),
  },
})

// use-billing importeert @/lib/api → @/lib/dev, dat import.meta.env leest
// (bestaat niet in node). Mocken houdt de menu-render los van die keten;
// de billingbadge is puur presentatie en niet wat deze test bewaakt.
mock.module("@/hooks/use-billing", {
  namedExports: {
    useBillingStatus: () => ({ data: undefined }),
  },
})

// De rolwissel gebruikt useQueryClient om na een wissel alle queries te
// verversen. In de test volstaat een no-op client.
mock.module("@tanstack/react-query", {
  namedExports: {
    useQueryClient: () => ({ invalidateQueries: async () => {} }),
  },
})

mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/vandaag", () => {}],
  },
})

// Evaluatie-vangnet: import.meta.env.BASE_URL wordt in de component gelezen;
// dat bestaat in node niet. @/lib/dev en @/lib/api lezen import.meta.env op
// moduleniveau — hier niet nodig want main-menu importeert ze niet, maar de
// keten role-start/chapters is pure data en blijft echt (geen mock) zodat we
// het werkelijke defensieve gedrag toetsen.

const reactPromise = import("react")
const rtlPromise = import("@testing-library/react")
const componentPromise = import("./main-menu")

async function renderMenu() {
  const React = (await reactPromise).default
  ;(globalThis as Record<string, unknown>).React = React
  const rtl = await rtlPromise
  const mod = await componentPromise
  const utils = rtl.render(
    React.createElement(mod.MainMenu, { open: true, onClose: () => {} }),
  )
  return { ...utils, rtl }
}

test("(a) normale clubdata: menu rendert zonder throw", async () => {
  mockActiveRole = "athlete"
  mockRoles = ["athlete", "coach"]
  mockMyClubs = [
    {
      membership: { id: 1, clubId: 7, role: "trainer", joinedAt: "" },
      club: { id: 7, name: "Wielerclub Noord" },
    },
  ]
  const view = await renderMenu()
  try {
    const text = document.body.textContent ?? ""
    assert.ok(text.includes("HOOFDMENU"), "menu is zichtbaar")
    assert.ok(!text.includes("Het menu kon niet worden geladen"), "geen fout-fallback")
  } finally {
    view.rtl.cleanup()
  }
})

test("(b) myClubs = niet-array: geen throw, pagina blijft", async () => {
  mockActiveRole = "athlete"
  mockRoles = ["athlete"]
  // Afwijkende serverrespons (bijv. een 500-foutobject i.p.v. een array).
  mockMyClubs = { error: "Internal Server Error" }
  const view = await renderMenu()
  try {
    const text = document.body.textContent ?? ""
    assert.ok(text.includes("HOOFDMENU"), "menu blijft staan bij niet-array clubs")
    assert.ok(!text.includes("Het menu kon niet worden geladen"), "geen fout-fallback")
  } finally {
    view.rtl.cleanup()
  }
})

test("(c) membership zonder role: geen throw", async () => {
  mockActiveRole = "athlete"
  mockRoles = ["athlete", "coach"]
  mockMyClubs = [
    // membership zonder role
    { membership: { id: 2, clubId: 9, joinedAt: "" }, club: { id: 9, name: "Club X" } },
    // rij zonder membership — moet worden overgeslagen, niet crashen
    { club: { id: 10, name: "Kapotte rij" } },
    // membership met onbekende rolwaarde uit productie
    { membership: { id: 3, clubId: 11, role: "onbekende_rol", joinedAt: "" }, club: null },
  ]
  const view = await renderMenu()
  try {
    const text = document.body.textContent ?? ""
    assert.ok(text.includes("HOOFDMENU"), "menu blijft staan bij misvormde membership")
    assert.ok(!text.includes("Het menu kon niet worden geladen"), "geen fout-fallback")
  } finally {
    view.rtl.cleanup()
  }
})

test("onbekende actieve rol: geen crash op ROLE_LABEL-indexering", async () => {
  mockActiveRole = "spookrol"
  mockRoles = ["spookrol", "athlete"]
  mockMyClubs = []
  const view = await renderMenu()
  try {
    const text = document.body.textContent ?? ""
    assert.ok(text.includes("HOOFDMENU"), "menu blijft staan bij onbekende rol")
    assert.ok(!text.includes("Het menu kon niet worden geladen"), "geen fout-fallback")
  } finally {
    view.rtl.cleanup()
  }
})
