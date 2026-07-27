// Componenttests voor de designsysteem-fundering: DsCard, DsButton, DsStatus,
// DsState, DsWeek en DsMobileNav. Getest worden de contracten uit
// docs/SPARKI_DESIGN_SYSTEM.md: varianten en staten, het minimale aanraakvlak
// (min-h-11 = 44px), status nooit uitsluitend met kleur (icoon + tekstlabel),
// week-aria-labels en de aandachtstatus in de navigatie.
//
// Run: pnpm --filter @workspace/sparki run test:design-system

import { test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { render, screen, cleanup, fireEvent } =
  await import("@testing-library/react");
const { DsButton, DsCard, DsMobileNav, DsState, DsStatus, DsWeek, IconPlan } =
  await import("./index");

test("DsButton: standaard primair, type=button en aanraakvlak 44px", () => {
  render(<DsButton>Opslaan</DsButton>);
  const knop = screen.getByRole("button", { name: "Opslaan" });
  assert.equal(knop.getAttribute("type"), "button");
  assert.ok(
    knop.className.includes("min-h-11"),
    "knop moet min-h-11 (44px) hebben",
  );
  assert.ok(
    knop.className.includes("bg-accent-cyan"),
    "primair gebruikt accenttoken",
  );
  cleanup();
});

test("DsButton: loading blokkeert en meldt aria-busy met spinner", () => {
  render(<DsButton loading>Bezig</DsButton>);
  const knop = screen.getByRole("button", { name: "Bezig" });
  assert.equal(knop.getAttribute("aria-busy"), "true");
  assert.ok(
    (knop as unknown as HTMLButtonElement).disabled,
    "loading = uitgeschakeld",
  );
  assert.ok(knop.querySelector("svg"), "spinner-icoon aanwezig");
  cleanup();
});

test("DsButton: varianten secundair en tekst renderen", () => {
  render(
    <>
      <DsButton variant="secundair">Terug</DsButton>
      <DsButton variant="tekst">Toon meer</DsButton>
      <DsButton disabled>Uit</DsButton>
    </>,
  );
  assert.ok(
    screen.getByRole("button", { name: "Terug" }).className.includes("border"),
  );
  assert.ok(
    screen
      .getByRole("button", { name: "Toon meer" })
      .className.includes("text-accent-cyan"),
  );
  assert.ok(
    (
      screen.getByRole("button", {
        name: "Uit",
      }) as unknown as HTMLButtonElement
    ).disabled,
  );
  cleanup();
});

test("DsStatus: elke status toont icoon én tekstlabel (nooit alleen kleur)", () => {
  const labels: [React.ComponentProps<typeof DsStatus>["status"], string][] = [
    ["positief", "Synchronisatie gelukt"],
    ["waarschuwing", "Controleer je zadelhoogte"],
    ["fout", "Upload mislukt"],
    ["neutraal", "Nog niet beoordeeld"],
  ];
  for (const [status, label] of labels) {
    render(<DsStatus status={status}>{label}</DsStatus>);
    const tekst = screen.getByText(label);
    const wrapper = tekst.closest("span")?.parentElement;
    assert.ok(
      wrapper?.querySelector("svg"),
      `status "${status}" heeft een icoon`,
    );
    cleanup();
  }
});

test("DsState: toont titel/beschrijving en voert de herstelactie uit", () => {
  let geklikt = 0;
  render(
    <DsState
      soort="leeg"
      titel="Nog geen ritten"
      beschrijving="Zodra je eerste rit binnen is, verschijnt hier je overzicht."
      actie={{ label: "Rit toevoegen", onClick: () => (geklikt += 1) }}
    />,
  );
  assert.ok(screen.getByText("Nog geen ritten"));
  assert.ok(screen.getByText(/eerste rit binnen/));
  fireEvent.click(screen.getByRole("button", { name: "Rit toevoegen" }));
  assert.equal(geklikt, 1);
  cleanup();
});

test("DsWeek: precies 7 dagen, aria-labels en actieve dag", () => {
  const dagen = [
    { label: "Ma", status: "herstel" as const },
    { label: "Di", status: "training" as const },
    { label: "Wo", status: "leeg" as const },
    { label: "Do", status: "training" as const, actief: true },
    { label: "Vr", status: "leeg" as const },
    { label: "Za", status: "training" as const },
    { label: "Zo", status: "herstel" as const },
    { label: "Extra", status: "leeg" as const }, // wordt genegeerd (max 7)
  ];
  render(<DsWeek dagen={dagen} />);
  const items = screen.getAllByRole("listitem");
  assert.equal(items.length, 7, "altijd precies 7 dagen");
  assert.ok(screen.getByLabelText("Di: training"));
  assert.ok(screen.getByLabelText("Ma: hersteldag"));
  assert.ok(screen.getByLabelText("Wo: geen training"));
  const actief = screen.getByLabelText("Do: training (vandaag)");
  assert.equal(actief.getAttribute("aria-current"), "date");
  cleanup();
});

test("DsMobileNav: 5 standaarditems, actieve tab en aandachtstatus", () => {
  let genavigeerd: string | null = null;
  render(
    <DsMobileNav
      vast={false}
      actiefPad="/vandaag"
      onNavigeer={(href) => (genavigeerd = href)}
    />,
  );
  const knoppen = screen.getAllByRole("button");
  assert.equal(knoppen.length, 5, "vijf navigatie-items");
  const actief = screen.getByRole("button", { name: /Vandaag/ });
  assert.equal(actief.getAttribute("aria-current"), "page");
  fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
  assert.equal(genavigeerd, "/plan");
  cleanup();
});

test("DsMobileNav: aandachtstatus is niet alleen een kleurstip", () => {
  render(
    <DsMobileNav
      vast={false}
      actiefPad="/vandaag"
      items={[{ href: "/plan", label: "Plan", icon: IconPlan, aandacht: true }]}
    />,
  );
  assert.ok(
    screen.getByText(/vraagt aandacht/),
    "sr-only-tekst voor de aandachtstatus aanwezig",
  );
  cleanup();
});

test("DsCard: standaard- en compactvariant gebruiken tokenpadding", () => {
  render(
    <>
      <DsCard data-testid="kaart-standaard">Inhoud</DsCard>
      <DsCard variant="compact" data-testid="kaart-compact">
        Inhoud
      </DsCard>
    </>,
  );
  assert.ok(screen.getByTestId("kaart-standaard").className.includes("p-card"));
  assert.ok(
    screen.getByTestId("kaart-compact").className.includes("p-card-compact"),
  );
  assert.ok(
    screen.getByTestId("kaart-standaard").className.includes("rounded-card"),
  );
  cleanup();
});
