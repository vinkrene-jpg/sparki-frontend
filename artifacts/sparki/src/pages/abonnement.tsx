// Abonnement — prijzen/lagen-overzicht en het up-/downgradepad (productie-
// bevinding punt 4). De commerciële laag bestond al server-side maar was voor
// gebruikers onzichtbaar; deze pagina maakt de drie lagen (Gratis · Sparki Go ·
// Sparki Compleet) zichtbaar en bedienbaar.
//
// Bindende regels die deze pagina volgt:
//  • De feature-vergelijking is AFGELEID uit de echte entitlement-keys
//    (GO_FEATURE_COPY, gespiegeld uit de server) — geen verzonnen features.
//  • NL-prijzen tonen we alleen als de server echte prijsconfig meestuurt
//    (billing-status.pricing, uit TIER_PRICING). Ontbreekt die → eerlijk
//    "prijs volgt".
//  • De huidige laag van het account is gemarkeerd (uit de billing-status).
//  • Echte betaling bestaat nog niet: het upgradepad loopt tot AAN de
//    betaalstap. Bestaat een echte (test)checkout → die koppelen we; anders
//    een nette "binnenkort beschikbaar"-stap + het vastleggen van de keuze.
//  • Downgrade naar Gratis kan WEL direct (rechten omlaag = geen betaling),
//    met bevestiging en eerlijke uitleg wat je verliest.
import { useState } from "react"
import { Check, Lock, ArrowRight, ShieldCheck } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { GO_FEATURE_COPY } from "@/components/ds/upgrade-nudge"
import {
  useBillingStatus,
  useStartTrial,
  useStartCheckout,
  useOpenPortal,
  useRecordChoice,
  useDowngradeToFree,
  type BillingStatus,
  type PaidTier,
} from "@/hooks/use-billing"

// Klantgerichte laag-namen (bindend): gratis laag, Sparki Go, Sparki Compleet.
type TierId = "FREE" | "GO" | "COMPLETE"

const TIER_LABEL: Record<TierId, string> = {
  FREE: "Gratis",
  GO: "Sparki Go",
  COMPLETE: "Sparki Compleet",
}

// Vaste, gratis onderdelen (Besluit René 31-07-2026, SPARKI-BESLUIT-2026-002):
// routes plannen/aanpassen, export, navigatie, opslaan en je eigen lijst
// bekijken blijven altijd gratis. Dit is geen verzonnen feature-lijst maar de
// expliciet vastgelegde grens; de betaalde onderdelen hieronder komen 1-op-1
// uit de echte entitlement-keys.
const GRATIS_ONDERDELEN = [
  "Routes plannen, genereren en aanpassen",
  "GPX/TCX-export en afslag-voor-afslag navigatie",
  "Routes opslaan en je eigen lijst bekijken",
]

// Feature-keys per laag, AFGELEID uit de echte entitlement-keys via het
// pakketlabel in GO_FEATURE_COPY (gespiegeld uit de server). Go bevat de
// Go-onderdelen; Compleet is de superset (Go + Compleet-onderdelen).
const GO_KEYS = Object.entries(GO_FEATURE_COPY)
  .filter(([, c]) => c.pakket === "Sparki Go")
  .map(([key]) => key)
const COMPLEET_KEYS = Object.entries(GO_FEATURE_COPY)
  .filter(([, c]) => c.pakket === "Sparki Compleet")
  .map(([key]) => key)

function euro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

function priceLabel(status: BillingStatus | undefined, tier: PaidTier): string {
  const p = status?.pricing?.[tier]
  if (!p) return "Prijs volgt"
  return `${euro(p.month)}/mnd · ${euro(p.year)}/jaar`
}

// Huidige laag uit de billing-status. Legacy-accounts ("volledige toegang")
// tonen we eerlijk als zodanig, niet als een van de drie lagen.
function currentTierId(status: BillingStatus | undefined): TierId | "LEGACY" | null {
  if (!status) return null
  if (status.status === "legacy_unrestricted") return "LEGACY"
  if (status.tier === "GO" || status.tier === "COMPLETE") return status.tier
  return "FREE"
}

function FeatureRegel({ featureKey }: { featureKey: string }) {
  const copy = GO_FEATURE_COPY[featureKey]
  if (!copy) return null
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" strokeWidth={2} />
      <span>
        <span className="text-foreground/90">{copy.titel}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {copy.uitleg}
        </span>
      </span>
    </li>
  )
}

function GratisRegel({ tekst }: { tekst: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="text-foreground/80">{tekst}</span>
    </li>
  )
}

function LaagKaart({
  tier,
  huidig,
  children,
  actie,
}: {
  tier: TierId
  huidig: boolean
  children: React.ReactNode
  actie: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl border p-5 backdrop-blur-md"
      style={{
        borderColor: huidig ? "rgba(120,210,230,0.45)" : "rgba(255,255,255,0.10)",
        background: huidig ? "rgba(120,210,230,0.06)" : "rgba(7,13,22,0.82)",
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-foreground/90">
          {TIER_LABEL[tier]}
        </h2>
        {huidig && (
          <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent-cyan">
            Jouw laag
          </span>
        )}
      </div>
      {children}
      <div className="mt-4">{actie}</div>
    </section>
  )
}

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-[13px] font-medium text-accent-cyan transition hover:bg-cyan-300/20 disabled:opacity-40"
const btnRustig =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-[13px] text-foreground/80 transition hover:bg-muted disabled:opacity-40"

// Betaalstap voor een betaalde laag. Echte checkout wanneer die beschikbaar is;
// anders keuze vastleggen + eerlijke "binnenkort beschikbaar"-melding.
function BetaalActie({
  status,
  tier,
}: {
  status: BillingStatus
  tier: PaidTier
}) {
  const checkout = useStartCheckout()
  const trial = useStartTrial()
  const record = useRecordChoice()
  const { available, choice } = status
  const gekozen = choice?.desiredTier === tier && choice.status === "in_afwachting"

  if (available.checkout) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          disabled={checkout.isPending}
          onClick={() => checkout.mutate({ tier, interval: "month" })}
        >
          Kies {TIER_LABEL[tier]} <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>
        {available.trial && (
          <button
            type="button"
            className={btnRustig}
            disabled={trial.isPending}
            onClick={() => trial.mutate(tier)}
          >
            Eerst gratis proberen
          </button>
        )}
        {checkout.isError && (
          <p className="w-full text-[11px] text-[color:var(--color-negative)]">
            {checkout.error?.message ?? "Er ging iets mis"}
          </p>
        )}
      </div>
    )
  }

  // Geen echte checkout: het pad loopt tot aan de betaalstap. We leggen de
  // keuze vast (testbaar) en zijn eerlijk dat betalen nog niet kan.
  return (
    <div>
      <button
        type="button"
        className={btn}
        disabled={record.isPending}
        onClick={() => record.mutate({ tier, interval: "month" })}
      >
        {gekozen ? "Keuze vastgelegd" : `Kies ${TIER_LABEL[tier]}`}
        {!gekozen && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
      </button>
      <p className="mt-2 text-[11px] leading-snug text-[color:var(--color-warning)]">
        Online betalen is nog niet beschikbaar. Je keuze wordt bewaard; zodra
        betalen live is nemen we hierop contact met je op.
      </p>
      {gekozen && (
        <p className="mt-1 text-[11px] text-accent-cyan">
          Je koos {TIER_LABEL[tier]}. Wijzigen kan door een andere laag te kiezen.
        </p>
      )}
      {record.isError && (
        <p className="mt-1 text-[11px] text-[color:var(--color-negative)]">
          {record.error?.message ?? "Er ging iets mis"}
        </p>
      )}
    </div>
  )
}

// Downgrade naar Gratis — direct (rechten omlaag), met bevestiging en eerlijke
// uitleg over wat je verliest.
function GratisActie({ status }: { status: BillingStatus }) {
  const downgrade = useDowngradeToFree()
  const portal = useOpenPortal()
  const [bevestig, setBevestig] = useState(false)

  if (!status.available.downgrade) {
    return (
      <p className="text-[12px] text-muted-foreground">Je zit al op de gratis laag.</p>
    )
  }

  // Een lopend betaald abonnement zeg je op via de betaalinstellingen (portal),
  // niet door hier de rechten weg te halen.
  if (status.hasStripeSubscription && status.available.portal) {
    return (
      <button
        type="button"
        className={btnRustig}
        disabled={portal.isPending}
        onClick={() => portal.mutate()}
      >
        Abonnement opzeggen via betaalinstellingen
      </button>
    )
  }

  if (!bevestig) {
    return (
      <button type="button" className={btnRustig} onClick={() => setBevestig(true)}>
        Terug naar Gratis
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <p className="text-[13px] font-medium text-foreground/80">
        Terug naar Gratis — weet je het zeker?
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Je verliest direct toegang tot de betaalde onderdelen (o.a.
        trainingsplan-engine, race-intelligentie, coach-observaties, Performance
        Lab, course points en de live-kaart). Een lopende proefperiode stopt
        meteen. Je gegevens, ritten en routes blijven volledig bewaard — je kunt
        later altijd weer upgraden.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnRustig}
          disabled={downgrade.isPending}
          onClick={() => downgrade.mutate(undefined, { onSuccess: () => setBevestig(false) })}
        >
          Ja, zet me op Gratis
        </button>
        <button
          type="button"
          className={btnRustig}
          onClick={() => setBevestig(false)}
        >
          Toch niet
        </button>
      </div>
      {downgrade.isError && (
        <p className="mt-2 text-[11px] text-[color:var(--color-negative)]">
          {downgrade.error?.message ?? "Er ging iets mis"}
        </p>
      )}
    </div>
  )
}

export default function AbonnementPage() {
  const { data: status, isLoading, isError } = useBillingStatus()
  const huidig = currentTierId(status)

  return (
    <ScreenShell bg={null} section="Abonnement">
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
        <SectionLabel title="Abonnement" />
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          Drie lagen, van gratis tot alles. Kies wat bij je past — routes
          plannen, opslaan en navigeren blijft altijd gratis.
        </p>

        {isLoading && (
          <p className="mt-6 text-[13px] text-muted-foreground">Bezig met laden…</p>
        )}
        {isError && (
          <p className="mt-6 text-[13px] text-[color:var(--color-negative)]">
            Kon je abonnementsgegevens niet laden. Probeer het later opnieuw.
          </p>
        )}

        {status && (
          <>
            {huidig === "LEGACY" && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" strokeWidth={1.75} />
                <p className="text-[12px] leading-snug text-muted-foreground">
                  Je account heeft volledige toegang (bestaand account). Alle
                  onderdelen hieronder zijn voor jou al beschikbaar.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {/* Gratis */}
              <LaagKaart
                tier="FREE"
                huidig={huidig === "FREE"}
                actie={<GratisActie status={status} />}
              >
                <p className="mt-1 text-[13px] text-muted-foreground">Altijd gratis</p>
                <ul className="mt-3 space-y-2.5">
                  {GRATIS_ONDERDELEN.map((t) => (
                    <GratisRegel key={t} tekst={t} />
                  ))}
                </ul>
              </LaagKaart>

              {/* Sparki Go */}
              <LaagKaart
                tier="GO"
                huidig={huidig === "GO"}
                actie={
                  huidig === "GO" ? (
                    <p className="text-[12px] text-accent-cyan">Dit is je huidige laag.</p>
                  ) : (
                    <BetaalActie status={status} tier="GO" />
                  )
                }
              >
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {priceLabel(status, "GO")}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Alles van Gratis, plus
                </p>
                <ul className="mt-2 space-y-2.5">
                  {GO_KEYS.map((key) => (
                    <FeatureRegel key={key} featureKey={key} />
                  ))}
                </ul>
              </LaagKaart>

              {/* Sparki Compleet */}
              <LaagKaart
                tier="COMPLETE"
                huidig={huidig === "COMPLETE"}
                actie={
                  huidig === "COMPLETE" ? (
                    <p className="text-[12px] text-accent-cyan">Dit is je huidige laag.</p>
                  ) : (
                    <BetaalActie status={status} tier="COMPLETE" />
                  )
                }
              >
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {priceLabel(status, "COMPLETE")}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Alles van Sparki Go, plus
                </p>
                <ul className="mt-2 space-y-2.5">
                  {COMPLEET_KEYS.map((key) => (
                    <FeatureRegel key={key} featureKey={key} />
                  ))}
                </ul>
              </LaagKaart>
            </div>

            <p className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              Je rechten worden altijd server-side bepaald. Deze pagina toont
              alleen wat er echt voor je account geldt.
            </p>
          </>
        )}
      </div>
    </ScreenShell>
  )
}
