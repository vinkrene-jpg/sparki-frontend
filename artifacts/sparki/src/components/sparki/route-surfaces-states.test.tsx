// Kalibratie-regressietest (vondst René 30-07-2026, hoofdstuk D):
// tijdens een trage kaartbron toonde het wegdekscherm TWEE tegenstrijdige
// boodschappen tegelijk: "de wegdekmeting loopt nog" én "geen bruikbare
// geometrie beschikbaar". Afkeurregel: de meting-loopt-nog-toestand (pending)
// en de geen-geometrie-melding sluiten elkaar uit — nooit allebei tonen.
//
// Run: pnpm --filter @workspace/sparki run test:route-surface-states

import { test } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot, type Root } from "react-dom/client"

// Componenten gebruiken classic JSX — zonder globale React faalt de render.
;(globalThis as Record<string, unknown>).React = React
import { act } from "react"

const PENDING_TEXT = "De wegdekmeting loopt nog"
const NO_GEOMETRY_TEXT = "geen bruikbare geometrie"
const ERROR_TEXT = "konden nu niet opgehaald worden"

async function render(props: {
  data: unknown
  isLoading: boolean
  isError: boolean
}): Promise<{ html: string; cleanup: () => void }> {
  const { RouteSurfacesPanel } = await import("./route-surfaces")
  const el = document.createElement("div")
  document.body.appendChild(el)
  let root: Root
  await act(async () => {
    root = createRoot(el)
    root.render(
      React.createElement(RouteSurfacesPanel, {
        data: props.data as never,
        isLoading: props.isLoading,
        isError: props.isError,
      }),
    )
  })
  return {
    html: el.textContent ?? "",
    cleanup: () => {
      act(() => root!.unmount())
      el.remove()
    },
  }
}

test("pending (202, meting loopt) toont NOOIT ook 'geen bruikbare geometrie'", async () => {
  const { html, cleanup } = await render({
    data: { pending: true, surfaces: null },
    isLoading: false,
    isError: false,
  })
  assert.ok(html.includes(PENDING_TEXT), "pending-melding hoort zichtbaar te zijn")
  assert.ok(
    !html.includes(NO_GEOMETRY_TEXT),
    "TEGENSTRIJDIG: 'geen bruikbare geometrie' mag niet tegelijk met de pending-melding staan",
  )
  assert.ok(!html.includes(ERROR_TEXT))
  cleanup()
})

test("echt geometrie-loos (geen pending) toont de geometrie-melding wél", async () => {
  const { html, cleanup } = await render({
    data: { surfaces: null },
    isLoading: false,
    isError: false,
  })
  assert.ok(html.includes(NO_GEOMETRY_TEXT))
  assert.ok(!html.includes(PENDING_TEXT))
  cleanup()
})

test("fout-toestand toont alleen de eerlijke foutmelding", async () => {
  const { html, cleanup } = await render({
    data: undefined,
    isLoading: false,
    isError: true,
  })
  assert.ok(html.includes(ERROR_TEXT))
  assert.ok(!html.includes(PENDING_TEXT))
  assert.ok(!html.includes(NO_GEOMETRY_TEXT))
  cleanup()
})
