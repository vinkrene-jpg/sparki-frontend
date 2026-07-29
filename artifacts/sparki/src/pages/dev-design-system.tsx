import { useState } from "react";
import {
  DsButton,
  DsCard,
  DsCardTitel,
  DsMobileNav,
  DsState,
  DsStatus,
  DsWeek,
  IconAnalyse,
  IconCheck,
  IconChevron,
  IconFout,
  IconHome,
  IconInfo,
  IconMenu,
  IconPlan,
  IconRijden,
  IconWaarschuwing,
  type DsWeekDag,
  type LucideIcon,
} from "@/components/ds";

// ─────────────────────────────────────────────────────────────────────────────
// Interne designsysteem-testpagina — /_dev/design
//
// Alleen bereikbaar in de ontwikkelomgeving (Development Preview Mode); in
// productie bestaat deze route niet. Toont alle tokens, typografiestijlen en
// basiscomponenten met hun varianten en staten. Alle getoonde teksten en
// waarden zijn statische voorbeeldstaten — geen echte sportergegevens.
// ─────────────────────────────────────────────────────────────────────────────

const KLEURTOKENS: {
  naam: string;
  utility: string;
  waarde: string;
  swatch: string;
}[] = [
  {
    naam: "App-achtergrond",
    utility: "bg-app",
    waarde: "#050608",
    swatch: "bg-app",
  },
  {
    naam: "Diepste laag",
    utility: "bg-app-deep",
    waarde: "#040506",
    swatch: "bg-app-deep",
  },
  {
    naam: "Oppervlak / kaart",
    utility: "bg-surface",
    waarde: "wit 5%",
    swatch: "bg-surface",
  },
  {
    naam: "Oppervlak sterk",
    utility: "bg-surface-strong",
    waarde: "wit 8%",
    swatch: "bg-surface-strong",
  },
  {
    naam: "Bedieningsvlak",
    utility: "bg-control",
    waarde: "wit 10%",
    swatch: "bg-control",
  },
  {
    naam: "Standaardrand",
    utility: "border-border",
    waarde: "wit 10%",
    swatch: "border-2 border-border",
  },
  {
    naam: "Positief",
    utility: "text-positive / bg-positive",
    waarde: "oklch(0.845 0.143 165)",
    swatch: "bg-positive",
  },
  {
    naam: "Waarschuwing",
    utility: "text-warning / bg-warning",
    waarde: "oklch(0.879 0.169 92)",
    swatch: "bg-warning",
  },
  {
    naam: "Fout",
    utility: "text-negative / bg-negative",
    waarde: "oklch(0.808 0.114 20)",
    swatch: "bg-negative",
  },
  {
    naam: "Tempo (training)",
    utility: "text-tempo / bg-tempo",
    waarde: "oklch(0.828 0.189 84)",
    swatch: "bg-tempo",
  },
  {
    naam: "Merkaccent",
    utility: "text-accent-cyan / bg-accent-cyan",
    waarde: "oklch(0.82 0.16 200)",
    swatch: "bg-accent-cyan",
  },
  {
    naam: "Tekst óp accent",
    utility: "text-on-accent",
    waarde: "#04121a",
    swatch: "bg-accent-cyan",
  },
];

const TYPOGRAFIE: { klasse: string; spec: string; voorbeeld: string }[] = [
  {
    klasse: "type-display",
    spec: "Display/Page — 38 → 42 · Bold",
    voorbeeld: "Vandaag",
  },
  {
    klasse: "type-metric",
    spec: "Metric/Primary — 58 → 68 · ExtraBold",
    voorbeeld: "247",
  },
  {
    klasse: "type-title-card",
    spec: "Title/Card — 17 → 22 · SemiBold",
    voorbeeld: "Trainingsweek",
  },
  {
    klasse: "type-title-insight",
    spec: "Title/Insight/Mobile — 22 · SemiBold",
    voorbeeld: "Je herstel loopt voor",
  },
  {
    klasse: "type-wordmark",
    spec: "Brand/Wordmark — 20 → 22 · Bold",
    voorbeeld: "SPARKI",
  },
  {
    klasse: "type-body",
    spec: "Body/Default — 14 · Regular",
    voorbeeld: "Lopende tekst voor uitleg en beschrijvingen in kaarten.",
  },
  {
    klasse: "type-body-sm",
    spec: "Body/Small — 12 · Regular",
    voorbeeld: "Secundaire tekst voor bijschriften en toelichtingen.",
  },
  {
    klasse: "type-label",
    spec: "Label/Small — 11 · SemiBold",
    voorbeeld: "Weeklabel",
  },
  {
    klasse: "type-action",
    spec: "Action — 14 → 15 · Medium",
    voorbeeld: "Bekijk analyse",
  },
  {
    klasse: "type-action-inline",
    spec: "Action/Inline — 12 · Medium",
    voorbeeld: "Toon meer",
  },
];

const ICONEN: { icon: LucideIcon; naam: string; betekenis: string }[] = [
  { icon: IconHome, naam: "IconHome", betekenis: "Home / Vandaag" },
  { icon: IconPlan, naam: "IconPlan", betekenis: "Kalender / Plan" },
  { icon: IconRijden, naam: "IconRijden", betekenis: "Fiets / Rijden" },
  { icon: IconAnalyse, naam: "IconAnalyse", betekenis: "Analyse" },
  { icon: IconMenu, naam: "IconMenu", betekenis: "Menu / Meer" },
  { icon: IconCheck, naam: "IconCheck", betekenis: "Bevestiging" },
  { icon: IconInfo, naam: "IconInfo", betekenis: "Informatie" },
  {
    icon: IconWaarschuwing,
    naam: "IconWaarschuwing",
    betekenis: "Waarschuwing",
  },
  { icon: IconFout, naam: "IconFout", betekenis: "Fout" },
  { icon: IconChevron, naam: "IconChevron", betekenis: "Navigatiepijl" },
];

const DEMO_WEEK: DsWeekDag[] = [
  { label: "Ma", status: "herstel" },
  { label: "Di", status: "training" },
  { label: "Wo", status: "leeg" },
  { label: "Do", status: "training", actief: true },
  { label: "Vr", status: "leeg" },
  { label: "Za", status: "training" },
  { label: "Zo", status: "herstel" },
];

function Sectie({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="label-sm text-white/40">{titel}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function DevDesignSystemPage() {
  const [navPad, setNavPad] = useState("/vandaag");
  const [actieDemo, setActieDemo] = useState(false);

  return (
    <div className="min-h-dvh bg-app pb-24 text-white">
      <div className="mx-auto w-full max-w-3xl px-4 pt-16">
        <p className="label-sm text-accent-cyan/70">Designsysteem</p>
        <h1 className="type-display mt-2">Sparki-fundering</h1>
        <p className="type-body mt-2 max-w-xl text-white/55">
          Interne testpagina — alleen zichtbaar in de ontwikkelomgeving. Alle
          tokens, typografie en basiscomponenten met hun staten. Alles hieronder
          is een statische voorbeeldweergave, geen echte sportergegevens.
        </p>

        <Sectie titel="Kleurtokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {KLEURTOKENS.map((t) => (
              <div
                key={t.naam}
                className="rounded-card border border-border bg-surface p-card-compact"
              >
                <div
                  className={`h-9 w-full rounded-lg border border-white/5 ${t.swatch} ${
                    t.naam === "Tekst óp accent"
                      ? "flex items-center justify-center"
                      : ""
                  }`}
                >
                  {t.naam === "Tekst óp accent" && (
                    <span className="type-label text-on-accent">Aa</span>
                  )}
                </div>
                <p className="type-body-sm mt-2 font-medium text-white/80">
                  {t.naam}
                </p>
                <p className="type-label mt-0.5 break-all text-white/40">
                  {t.utility}
                </p>
                <p className="type-label text-white/30">{t.waarde}</p>
              </div>
            ))}
          </div>
          <p className="type-body-sm mt-3 text-white/40">
            Radius: <code className="text-white/60">rounded-card</code> (16px
            kaarten) · <code className="text-white/60">rounded-control</code>{" "}
            (volledig ronde knoppen). Spacing:{" "}
            <code className="text-white/60">p-card</code> (20px) ·{" "}
            <code className="text-white/60">p-card-compact</code> (12px), verder
            de 4px-basisschaal. Breekpunt desktop: 1024px (
            <code className="text-white/60">lg:</code>). Schaduwen: geen
            schaduwtoken — het donkere ontwerp werkt met randen en
            glasoppervlakken; de icoon-gloed gebruikt{" "}
            <code className="text-white/60">var(--accent-cyan)</code>.
          </p>
        </Sectie>

        <Sectie titel="Typografie — Inter">
          <div className="space-y-5 rounded-card border border-border bg-surface p-card">
            {TYPOGRAFIE.map((t) => (
              <div
                key={t.klasse}
                className="border-b border-white/5 pb-4 last:border-0 last:pb-0"
              >
                <p className="type-label text-white/35">
                  {t.klasse} · {t.spec}
                </p>
                <p
                  className={`${t.klasse} mt-1.5 ${t.klasse === "type-metric" ? "num" : ""}`}
                >
                  {t.voorbeeld}
                </p>
              </div>
            ))}
          </div>
        </Sectie>

        <Sectie titel="Iconen — lucide (enige productie-iconenbron)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ICONEN.map(({ icon: Icon, naam, betekenis }) => (
              <div
                key={naam}
                className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-3 text-center"
              >
                <Icon className="h-5 w-5 text-white/75" aria-hidden="true" />
                <span className="type-label text-white/60">{naam}</span>
                <span className="type-label text-white/30">{betekenis}</span>
              </div>
            ))}
          </div>
          <p className="type-body-sm mt-2 text-white/40">
            Unicode-tekens en emoji zijn geen productie-iconen.
          </p>
        </Sectie>

        <Sectie titel="Kaartcontainer">
          <div className="grid gap-3 sm:grid-cols-2">
            <DsCard>
              <DsCardTitel>Standaardkaart</DsCardTitel>
              <p className="type-body mt-1.5 text-white/60">
                Glasoppervlak, standaardrand en kaartradius uit de tokenlaag,
                padding <code>p-card</code>.
              </p>
            </DsCard>
            <DsCard variant="compact">
              <DsCardTitel>Compacte kaart</DsCardTitel>
              <p className="type-body-sm mt-1 text-white/60">
                Dichtere padding (<code>p-card-compact</code>) voor lijsten en
                detailregels.
              </p>
            </DsCard>
          </div>
        </Sectie>

        <Sectie titel="Knop — alle varianten, aanraakvlak ≥ 44px">
          <DsCard className="flex flex-wrap items-center gap-3">
            <DsButton>Primair</DsButton>
            <DsButton variant="secundair">Secundair</DsButton>
            <DsButton variant="tekst">
              Tekstactie <IconChevron aria-hidden="true" />
            </DsButton>
            <DsButton disabled>Uitgeschakeld</DsButton>
            <DsButton loading>Bezig met opslaan</DsButton>
          </DsCard>
        </Sectie>

        <Sectie titel="Actiebalk (.ds-actiebalk)">
          <DsCard className="flex flex-col gap-4">
            <p className="type-body text-content-secondary">
              Actiebalken (knoppenrijen) moeten op mobiel de volle breedte gebruiken (gestapeld), maar op desktop begrensd en gecentreerd worden zodat ze niet over de hele pagina uitsmeren. Gebruik de <code>.ds-actiebalk</code> utility class op een container die <code>flex flex-col sm:flex-row gap-2</code> of vergelijkbaar heeft.
            </p>
            <div className="ds-actiebalk flex flex-col sm:flex-row gap-2">
              <DsButton variant="primair">Opslaan</DsButton>
              <DsButton variant="secundair">Annuleren</DsButton>
            </div>
          </DsCard>
        </Sectie>

        <Sectie titel="Statusindicator — nooit alleen kleur">
          <DsCard className="flex flex-wrap items-center gap-2.5">
            <DsStatus status="positief">Synchronisatie gelukt</DsStatus>
            <DsStatus status="waarschuwing">Controleer je zadelhoogte</DsStatus>
            <DsStatus status="fout">Upload mislukt</DsStatus>
            <DsStatus status="neutraal">Nog niet beoordeeld</DsStatus>
          </DsCard>
        </Sectie>

        <Sectie titel="Compacte toestanden — eerlijk, nooit nepdata">
          <div className="grid gap-3 sm:grid-cols-3">
            <DsState
              soort="info"
              titel="Rustdag gepland"
              beschrijving="Vandaag staat er bewust geen training op het programma."
            />
            <DsState
              soort="leeg"
              titel="Nog geen ritten"
              beschrijving="Zodra je eerste rit binnen is, verschijnt hier je overzicht."
              actie={{
                label: actieDemo ? "Actie uitgevoerd (demo)" : "Rit toevoegen",
                onClick: () => setActieDemo(true),
              }}
            />
            <DsState
              soort="nietBeschikbaar"
              titel="Weer niet beschikbaar"
              beschrijving="De weerdienst gaf geen antwoord. Er wordt niets geschat."
            />
          </div>
        </Sectie>

        <Sectie titel="Weekcomponent — 7 dagen binnen 358px">
          <div className="mx-auto w-[358px] max-w-full rounded-card border border-dashed border-white/15 p-2">
            <p className="type-label mb-2 text-white/35">
              Frame 358px — voorbeeldstaten (training · herstel · leeg · actief)
            </p>
            <DsWeek dagen={DEMO_WEEK} />
          </div>
        </Sectie>

        <Sectie titel="Mobiele hoofdnavigatie — 44px, safe-area, aandachtstatus">
          <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-card border border-border bg-app-deep">
            <div className="px-4 py-6">
              <p className="type-body-sm text-white/40">
                Demo in een 390px-frame. Actief:{" "}
                <span className="text-white/70">{navPad}</span> — tik op een tab
                om te wisselen. "Plan" toont de aandachtstatus.
              </p>
            </div>
            <DsMobileNav
              vast={false}
              actiefPad={navPad}
              onNavigeer={setNavPad}
              items={[
                { href: "/vandaag", label: "Vandaag", icon: IconHome },
                {
                  href: "/plan",
                  label: "Plan",
                  icon: IconPlan,
                  aandacht: true,
                },
                { href: "/rijden", label: "Rijden", icon: IconRijden },
                { href: "/analyse", label: "Analyse", icon: IconAnalyse },
                { href: "/meer", label: "Meer", icon: IconMenu },
              ]}
            />
          </div>
        </Sectie>
      </div>
    </div>
  );
}
