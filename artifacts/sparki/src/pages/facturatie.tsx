// SPARKI_BUILD_04 F14 — facturatiewerkplek (`/facturatie`).
//
// 3b-A: startscherm met de TWAALF blokken in vaste volgorde en ÉÉN primaire
// actie (de eerstvolgende factuur afhandelen). De volgorde komt 1-op-1 van de
// server (dashboard.blocks) en wordt hier nooit hergesorteerd.
//
// UX-regels uit het pakket:
// - Desktop: volledige werkplek (blokken + factuurlijst + opvolging +
//   klanthistorie + rapportage).
// - Mobiel: alleen factuur bekijken, herinnering versturen en betaald
//   markeren — NIET samenstellen (verzenden/crediteren/oninbaar zijn
//   desktop-only en verborgen op kleine schermen via `hidden sm:`).
// - Geen automatische aanmaning, geen incasso, geen betaalscore: elke actie
//   hier is een expliciete klik van de trainer; betaalgedrag toont feiten.
// - Rechten: server-side uitsluitend de eigen trainer (geen client-check nodig).

import { useState } from "react"
import { Loader2, Send, Bell, Check, FileText, CalendarClock, Ban } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import {
  useBillingDashboard,
  useBillingInvoices,
  useClientHistory,
  useBillingReports,
  useSendInvoice,
  useSendReminder,
  useMarkPaid,
  usePaymentAgreement,
  useMarkUncollectible,
  type TrainerInvoice,
  type DashboardBlock,
} from "@/hooks/use-trainer-billing"

const CARD =
  "rounded-2xl border border-border bg-card p-4 backdrop-blur-md"

function euro(cents: number | undefined): string {
  return typeof cents === "number" ? `€ ${(cents / 100).toFixed(2)}` : "—"
}

const BLOCK_LABELS: Record<string, string> = {
  openstaand_bedrag: "Openstaand bedrag",
  te_laat: "Te laat",
  deze_maand_gefactureerd: "Deze maand gefactureerd",
  concepten: "Concepten",
  verstuurd: "Verstuurd",
  betaald: "Betaald",
  gecrediteerd: "Gecrediteerd",
  eerstvolgend_facturatiemoment: "Eerstvolgend facturatiemoment",
  klanten_zonder_actieve_afspraak: "Klanten zonder actieve afspraak",
  ontbrekende_gegevens: "Ontbrekende gegevens",
  exportstatus: "Exportstatus",
  laatste_wijzigingen: "Laatste wijzigingen",
}

const STATUS_LABELS: Record<string, string> = {
  concept: "concept",
  verzonden: "verstuurd",
  betaald: "betaald",
  te_laat: "te laat",
  gecrediteerd: "gecrediteerd",
  ingetrokken: "ingetrokken",
  deels_betaald: "deels betaald",
  oninbaar: "oninbaar",
}

function BlockCard({ block }: { block: DashboardBlock }) {
  return (
    <div className={CARD} data-block={block.key}>
      <p className="type-caption text-muted-foreground">{BLOCK_LABELS[block.key] ?? block.key}</p>
      {block.amountCents !== undefined && (
        <p className="type-title mt-1 text-foreground">{euro(block.amountCents)}</p>
      )}
      {block.count !== undefined && block.amountCents === undefined && (
        <p className="type-title mt-1 text-foreground">{block.count}</p>
      )}
      {block.key === "eerstvolgend_facturatiemoment" && (
        <p className="type-title mt-1 text-foreground">{block.date ?? "geen gepland"}</p>
      )}
      {block.items && (
        <ul className="mt-1 space-y-0.5">
          {block.items.length === 0 && <li className="type-caption text-muted-foreground">alles compleet</li>}
          {block.items.map((it) => (
            <li key={it} className="type-caption text-[color:var(--color-warning)]">{it}</li>
          ))}
        </ul>
      )}
      {block.clients && block.clients.length > 0 && (
        <p className="type-caption mt-1 text-muted-foreground">
          {block.clients.map((c) => c.name).join(", ")}
        </p>
      )}
      {block.note && <p className="type-caption mt-1 text-muted-foreground">{block.note}</p>}
      {block.events && (
        <ul className="mt-1 space-y-0.5">
          {block.events.length === 0 && <li className="type-caption text-muted-foreground">nog geen</li>}
          {block.events.map((e, i) => (
            <li key={i} className="type-caption text-muted-foreground">{e.body}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InvoiceRow({ inv }: { inv: TrainerInvoice }) {
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementDate, setAgreementDate] = useState("")
  const [agreementNote, setAgreementNote] = useState("")
  const [showUncollectible, setShowUncollectible] = useState(false)
  const [reason, setReason] = useState("")
  const send = useSendInvoice()
  const remind = useSendReminder()
  const markPaid = useMarkPaid()
  const agreement = usePaymentAgreement()
  const uncollectible = useMarkUncollectible()
  const open = ["verzonden", "te_laat", "deels_betaald"].includes(inv.status)
  const rest = inv.amountInclCents - inv.paidCents

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="type-body text-foreground">
            {inv.invoiceNumber ?? "concept"} · {euro(inv.amountInclCents)}
            {inv.paidCents > 0 && inv.paidCents < inv.amountInclCents && (
              <span className="text-muted-foreground"> (nog {euro(rest)})</span>
            )}
          </p>
          <p className="type-caption text-muted-foreground">
            {STATUS_LABELS[inv.status] ?? inv.status}
            {inv.isOverdue && " · te laat"}
            {inv.dueDate && ` · vervalt ${inv.dueDate}`}
            {inv.paymentAgreementDate && ` · betaalafspraak ${inv.paymentAgreementDate}`}
            {inv.uncollectibleReason && ` · oninbaar: ${inv.uncollectibleReason}`}
          </p>
          {inv.description && <p className="type-caption text-muted-foreground">{inv.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Mobiel toegestaan: herinneren en betaald markeren. */}
          {open && (
            <button
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 type-caption text-foreground/80"
              onClick={() => remind.mutate({ invoiceId: inv.id })}
              disabled={remind.isPending}
            >
              <Bell className="h-3.5 w-3.5" /> Herinner
            </button>
          )}
          {open && (
            <button
              className="flex items-center gap-1 rounded-full border border-emerald-400/40 px-3 py-1.5 type-caption text-[color:var(--color-positive)]"
              onClick={() => markPaid.mutate({ invoiceId: inv.id, body: { amountCents: rest } })}
              disabled={markPaid.isPending}
            >
              <Check className="h-3.5 w-3.5" /> Betaald
            </button>
          )}
          {/* Desktop-only (samenstellen/afwikkelen): verzenden, betaalafspraak, oninbaar. */}
          {inv.status === "concept" && (
            <button
              className="hidden sm:flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 type-caption text-foreground"
              onClick={() => send.mutate({ invoiceId: inv.id })}
              disabled={send.isPending}
            >
              <Send className="h-3.5 w-3.5" /> Controleer & verzend
            </button>
          )}
          {open && (
            <button
              className="hidden sm:flex items-center gap-1 rounded-full border border-border px-3 py-1.5 type-caption text-foreground/80"
              onClick={() => setShowAgreement((v) => !v)}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Betaalafspraak
            </button>
          )}
          {open && (
            <button
              className="hidden sm:flex items-center gap-1 rounded-full border border-red-400/30 px-3 py-1.5 type-caption text-[color:var(--color-negative)]"
              onClick={() => setShowUncollectible((v) => !v)}
            >
              <Ban className="h-3.5 w-3.5" /> Oninbaar
            </button>
          )}
        </div>
      </div>
      {showAgreement && (
        <div className="mt-3 hidden sm:flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-border bg-transparent px-2 py-1 type-caption text-foreground"
            value={agreementDate}
            onChange={(e) => setAgreementDate(e.target.value)}
          />
          <input
            type="text"
            placeholder="Afspraak (bijv. betaalt na salarisdatum)"
            className="min-w-48 flex-1 rounded-lg border border-border bg-transparent px-2 py-1 type-caption text-foreground"
            value={agreementNote}
            onChange={(e) => setAgreementNote(e.target.value)}
          />
          <button
            className="rounded-full bg-muted px-3 py-1.5 type-caption text-foreground disabled:opacity-40"
            disabled={!agreementDate || agreement.isPending}
            onClick={() => {
              agreement.mutate({
                invoiceId: inv.id,
                body: { date: agreementDate, note: agreementNote || undefined },
              })
              setShowAgreement(false)
            }}
          >
            Vastleggen
          </button>
        </div>
      )}
      {showUncollectible && (
        <div className="mt-3 hidden sm:flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Reden (verplicht)"
            className="min-w-48 flex-1 rounded-lg border border-border bg-transparent px-2 py-1 type-caption text-foreground"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="rounded-full border border-red-400/40 px-3 py-1.5 type-caption text-[color:var(--color-negative)] disabled:opacity-40"
            disabled={!reason.trim() || uncollectible.isPending}
            onClick={() => {
              uncollectible.mutate({ invoiceId: inv.id, body: { reason: reason.trim() } })
              setShowUncollectible(false)
            }}
          >
            Oninbaar markeren
          </button>
        </div>
      )}
    </div>
  )
}

export default function FacturatiePage() {
  const dashboard = useBillingDashboard()
  const invoices = useBillingInvoices()
  const year = String(new Date().getFullYear())
  const reports = useBillingReports(year)
  const [historyClientId, setHistoryClientId] = useState<number | null>(null)
  const history = useClientHistory(historyClientId)

  const primary = dashboard.data?.primaryAction ?? null

  return (
    <ScreenShell section="meer">
      <div className="space-y-5 pb-24">
        {dashboard.isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {primary && (
          <div className={`${CARD} border-border`} data-testid="primary-action">
            <SectionLabel title="Eerstvolgende actie" />
            <p className="type-body mt-1 text-foreground">{primary.label}</p>
          </div>
        )}

        {dashboard.data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {dashboard.data.blocks.map((b) => (
              <BlockCard key={b.key} block={b} />
            ))}
          </div>
        )}

        <section>
          <SectionLabel title="Facturen" />
          <div className="mt-2 space-y-3">
            {invoices.data?.length === 0 && (
              <p className="type-caption text-muted-foreground">
                Nog geen facturen. Samenstellen doe je op een groter scherm.
              </p>
            )}
            {invoices.data?.map((inv) => (
              <div key={inv.id}>
                <InvoiceRow inv={inv} />
                <button
                  className="mt-1 flex items-center gap-1 type-caption text-muted-foreground hover:text-foreground/80"
                  onClick={() =>
                    setHistoryClientId((cur) => (cur === inv.clientId ? null : inv.clientId))
                  }
                >
                  <FileText className="h-3.5 w-3.5" /> Klanthistorie
                </button>
              </div>
            ))}
          </div>
        </section>

        {historyClientId != null && history.data && (
          <section className={CARD}>
            <SectionLabel title={`Historie · ${history.data.client.name}`} />
            <p className="type-caption mt-1 text-muted-foreground">
              Gemiddelde betaaltermijn:{" "}
              {history.data.paymentBehavior.avgPaymentDays != null
                ? `${history.data.paymentBehavior.avgPaymentDays} dagen`
                : "nog onbekend"}{" "}
              · {history.data.paymentBehavior.timesLate}× te laat
            </p>
            <p className="type-caption text-muted-foreground">{history.data.paymentBehavior.note}</p>
            <ul className="mt-2 space-y-1">
              {history.data.events.map((e) => (
                <li key={e.id} className="type-caption text-muted-foreground">
                  <span className="text-muted-foreground">{e.createdAt.slice(0, 10)}</span> · {e.body}
                  {e.channel === "e-mail" && " (per e-mail)"}
                </li>
              ))}
              {history.data.events.length === 0 && (
                <li className="type-caption text-muted-foreground">Nog geen gebeurtenissen.</li>
              )}
            </ul>
          </section>
        )}

        {/* Rapportage — desktop-werkplek. */}
        {reports.data && (
          <section className={`${CARD} hidden sm:block`}>
            <SectionLabel title={`Rapportage ${reports.data.year}`} />
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <p className="type-caption text-muted-foreground">Omzet</p>
                <p className="type-body text-foreground">{euro(reports.data.totalCents)}</p>
              </div>
              <div>
                <p className="type-caption text-muted-foreground">Openstaand</p>
                <p className="type-body text-foreground">{euro(reports.data.openAmountCents)}</p>
              </div>
              <div>
                <p className="type-caption text-muted-foreground">Gem. betaaltermijn</p>
                <p className="type-body text-foreground">
                  {reports.data.avgPaymentDays != null ? `${reports.data.avgPaymentDays} dagen` : "—"}
                </p>
              </div>
              <div>
                <p className="type-caption text-muted-foreground">Facturen</p>
                <p className="type-body text-foreground">{reports.data.invoiceCount}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="type-caption text-muted-foreground">Per kwartaal</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {Object.entries(reports.data.perQuarter).map(([q, cents]) => (
                  <span key={q} className="type-caption text-foreground/80">
                    {q}: {euro(cents)}
                  </span>
                ))}
              </div>
            </div>
            <p className="type-caption mt-3 text-muted-foreground">{reports.data.vatOverview.note}</p>
          </section>
        )}
      </div>
    </ScreenShell>
  )
}
