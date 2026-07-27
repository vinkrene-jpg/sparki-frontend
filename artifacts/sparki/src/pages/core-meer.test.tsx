// Regressietests voor de Meer-pagina in de commerciële schil. Legt vast:
// alle atleet-links aanwezig met juiste href; groepskoppen in vaste volgorde
// in de DOM; admin-rij alleen bij admin; coach-variant toont coach-items;
// iconen renderen als svg (lucide), geen emoji-tekst.
//
// Run with: node ../../scripts/run-tsx-test.mjs --test --experimental-test-module-mocks src/pages/core-meer.test.tsx

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Bestuurbare mocks — VOOR de lazy import van core-meer.tsx.
let mockRole: "athlete" | "coach" | "parent" = "athlete"
let mockIsMember = false
let mockIsAdmin = false

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({
      profile: { activeRole: mockRole },
    }),
  },
})

mock.module("@/hooks/use-club", {
  namedExports: {
    useClubMembership: () => ({ isMember: mockIsMember }),
  },
})

mock.module("@/hooks/use-bug-reports", {
  namedExports: {
    useAdminWhoami: () => ({
      data: mockIsAdmin ? { isAdmin: true } : undefined,
    }),
  },
})

mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/meer", () => {}],
    Link: (props: { href?: string; children?: unknown; className?: string }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement(
          "a",
          { href: props.href, className: props.className },
          props.children as never,
        ),
  },
})

// Evaluatie-vangnet (zelfde aanpak als de groene core-activiteiten.test.tsx):
// core-meer laadt via CommercialShell de keten use-sparki-state → @/lib/dev,
// dat op moduleniveau import.meta.env.DEV leest — dat bestaat niet in node.
// @/lib/api leest net zo import.meta.env; echte react-query/clerk-hooks
// eisen providers.
mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false, useDevPreview: () => false, getDevAthleteId: () => 1 },
})

mock.module("@/lib/api", {
  namedExports: { apiFetch: async () => ({}), API_BASE: "" },
})

mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({}),
    useMutation: () => ({}),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    QueryClient: class {},
    QueryClientProvider: ({ children }: { children?: unknown }) => children,
  },
})

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isSignedIn: true, user: { id: "user_1" } }),
  },
})

const reactPromise = import("react")
const rtlPromise = import("@testing-library/react")
const libPromise = import("@/lib/core-meer")
const chapterPromise = import("@/lib/chapters")
const componentPromise = import("./core-meer")

async function renderMeer() {
  const React = (await reactPromise).default
  ;(globalThis as Record<string, unknown>).React = React
  const rtl = await rtlPromise
  const mod = await componentPromise
  const Page = mod.default
  const utils = rtl.render(React.createElement(Page))
  return { ...utils, rtl, React }
}

// Vaste groepsvolgorde (harde eis).
const VASTE_VOLGORDE_ATLEET = [
  "Profiel & account",
  "Veelgebruikt",
  "Sport & materiaal",
  "Koppelingen & gegevens",
  "Ondersteuning & kennis",
]

const VASTE_VOLGORDE_ATLEET_ADMIN = [
  ...VASTE_VOLGORDE_ATLEET,
  "Beheer, instellingen & privacy",
]

test("atleet: alle links aanwezig met juiste href", async () => {
  mockRole = "athlete"
  mockIsMember = false
  mockIsAdmin = false

  const { ATHLETE_MEER_CHAPTERS } = await chapterPromise
  const view = await renderMeer()
  try {
    const links = Array.from(view.container.querySelectorAll("a"))
    const hrefs = links.map((a) => a.getAttribute("href"))
    const verwacht = [
      ...ATHLETE_MEER_CHAPTERS.map((ch) => ch.href),
      "/connect",
      "/support",
    ]
    for (const h of verwacht) {
      assert.ok(hrefs.includes(h), `link naar ${h} aanwezig`)
    }
  } finally {
    view.rtl.cleanup()
  }
})

test("atleet: groepskoppen in vaste volgorde in de DOM", async () => {
  mockRole = "athlete"
  mockIsMember = false
  mockIsAdmin = false

  const view = await renderMeer()
  try {
    // textContent i.p.v. innerHTML: HTML serialiseert "&" als "&amp;",
    // waardoor indexOf op titels met "&" in innerHTML altijd -1 gaf.
    // textContent behoudt de DOM-volgorde én de letterlijke titels.
    const text = view.container.textContent ?? ""
    const posities = VASTE_VOLGORDE_ATLEET.map((titel) => text.indexOf(titel))
    for (const pos of posities) {
      assert.ok(pos >= 0, "groep aanwezig")
    }
    for (let i = 1; i < posities.length; i++) {
      assert.ok(
        posities[i]! > posities[i - 1]!,
        `volgorde: ${VASTE_VOLGORDE_ATLEET[i - 1]} < ${VASTE_VOLGORDE_ATLEET[i]}`,
      )
    }
  } finally {
    view.rtl.cleanup()
  }
})

test("atleet: admin-rij alleen bij admin", async () => {
  mockRole = "athlete"
  mockIsMember = false
  mockIsAdmin = false

  const zonder = await renderMeer()
  try {
    const text = zonder.container.textContent ?? ""
    assert.ok(!text.includes("Beheer"), "zonder admin geen Beheer-groep")
    assert.ok(
      !Array.from(zonder.container.querySelectorAll("a")).some(
        (a) => a.getAttribute("href") === "/admin",
      ),
      "geen /admin-link",
    )
  } finally {
    zonder.rtl.cleanup()
  }

  mockIsAdmin = true
  const met = await renderMeer()
  try {
    const text = met.container.textContent ?? ""
    assert.ok(text.includes("Beheer, instellingen & privacy"), "admin-groep aanwezig")
    const adminLink = Array.from(met.container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/admin",
    )
    assert.ok(adminLink, "/admin-link aanwezig")
    assert.ok(adminLink!.textContent!.includes("Beheer"), "Beheer-label zichtbaar")

    // Admin-groep komt als laatste (na Ondersteuning). textContent i.p.v.
    // innerHTML: "&" wordt in innerHTML als "&amp;" geserialiseerd.
    const posOndersteuning = text.indexOf("Ondersteuning & kennis")
    const posBeheer = text.indexOf("Beheer, instellingen & privacy")
    assert.ok(posBeheer > posOndersteuning, "Beheer komt na Ondersteuning")
  } finally {
    met.rtl.cleanup()
  }
})

test("coach: toont coach-items", async () => {
  mockRole = "coach"
  mockIsMember = false
  mockIsAdmin = false

  const { COACH_CHAPTERS } = await chapterPromise
  const view = await renderMeer()
  try {
    const links = Array.from(view.container.querySelectorAll("a"))
    const hrefs = links.map((a) => a.getAttribute("href"))
    const verwacht = [...COACH_CHAPTERS.map((ch) => ch.href), "/support"]
    for (const h of verwacht) {
      assert.ok(hrefs.includes(h), `coach-link naar ${h} aanwezig`)
    }
    // Coach heeft geen /lichaam, /mechanieker, etc.
    assert.ok(!hrefs.includes("/lichaam"), "coach heeft geen /lichaam")
  } finally {
    view.rtl.cleanup()
  }
})

test("iconen: renderen als svg (lucide), geen emoji-tekst", async () => {
  mockRole = "athlete"
  mockIsMember = false
  mockIsAdmin = false

  const { ATHLETE_MEER_CHAPTERS } = await chapterPromise
  const view = await renderMeer()
  try {
    // Alleen de Meer-rijen zelf (de groepssecties): de desktopnav van de
    // schil is bewust tekst-zonder-icoon en valt buiten deze eis; happy-dom
    // rendert die lg:-nav gewoon mee. Vangnet op het aantal, zodat de
    // selector nooit stilletjes leeg kan raken.
    const links = Array.from(
      view.container.querySelectorAll('section[aria-labelledby] a'),
    )
    assert.ok(
      links.length >= ATHLETE_MEER_CHAPTERS.length + 2,
      `alle meer-rijen gevonden (${links.length})`,
    )
    for (const link of links) {
      const svg = link.querySelector("svg")
      assert.ok(svg, `link naar ${link.getAttribute("href")} heeft een svg-icoon`)
      // Geen emoji of Unicode-symbolen in de tekst (alleen echte labels).
      const text = link.textContent ?? ""
      const heeftSymbool = /[⚡✓✕🔔🏠📅🚴]/.test(text)
      assert.ok(
        !heeftSymbool,
        `link naar ${link.getAttribute("href")} bevat geen emoji`,
      )
    }
  } finally {
    view.rtl.cleanup()
  }
})

test("club-conditie: Club verschijnt alleen bij clublid", async () => {
  mockRole = "athlete"
  mockIsMember = false
  mockIsAdmin = false

  const zonder = await renderMeer()
  try {
    const hrefs = Array.from(zonder.container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    )
    assert.ok(!hrefs.includes("/club"), "zonder club geen /club-link")
  } finally {
    zonder.rtl.cleanup()
  }

  mockIsMember = true
  const met = await renderMeer()
  try {
    const hrefs = Array.from(met.container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    )
    assert.ok(hrefs.includes("/club"), "met club wel /club-link")
    const clubLink = Array.from(met.container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/club",
    )
    assert.ok(clubLink!.textContent!.includes("Club"), "Club-label zichtbaar")
  } finally {
    met.rtl.cleanup()
  }
})
