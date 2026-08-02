// ── Privacy en account ────────────────────────────────────────────────────────
// Volledig accountbeheer in het Instellingen-paneel: wie ziet wat, juridische
// documenten (met versie en akkoord), volledige export, sessies beëindigen en
// accountverwijdering met bevestigingszin + hersteltermijn.

import { useState } from "react"
import {
  Eye,
  FileText,
  Download,
  MonitorSmartphone,
  Trash2,
  ChevronDown,
  ShieldAlert,
  Undo2,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { usePrivacySettings } from "@/hooks/use-privacy"
import {
  useAccountOverview,
  useLegalDocument,
  useAcceptLegal,
  useExportAccount,
  useEndSessions,
  useRequestAccountDeletion,
  useCancelAccountDeletion,
  type RoleVisibilityEntry,
} from "@/hooks/use-account"

const CONFIRM_PHRASE = "VERWIJDER MIJN ACCOUNT"

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-4 backdrop-blur-md">
      {children}
    </div>
  )
}

function VisRow({ naam, entry }: { naam: string; entry: RoleVisibilityEntry }) {
  return (
    <div className="py-3">
      <div className="text-[13px] font-medium text-white/85">{naam}</div>
      {entry.ziet.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {entry.ziet.map((z) => (
            <li key={z} className="text-[12px] text-white/55">
              • {z}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[12px] text-white/45">Ziet niets van jouw gegevens.</div>
      )}
      {entry.zietNiet.length > 0 && (
        <div className="mt-1 text-[11px] leading-snug text-white/30">
          Nooit zichtbaar: {entry.zietNiet.join(" · ")}
        </div>
      )}
    </div>
  )
}

function LegalDocBlock({ kind }: { kind: "privacy" | "terms" }) {
  const [open, setOpen] = useState(false)
  const { data: doc, isLoading } = useLegalDocument(kind, open)
  const { data: privacyData } = usePrivacySettings()
  const accept = useAcceptLegal()
  const p = privacyData?.privacy as
    | (Record<string, unknown> & {
        acceptedPrivacyAt: string | null
        acceptedTermsAt: string | null
      })
    | undefined
  const acceptedAt = kind === "privacy" ? p?.acceptedPrivacyAt : p?.acceptedTermsAt
  const acceptedVersion =
    (kind === "privacy"
      ? (p?.acceptedPrivacyVersion as string | null | undefined)
      : (p?.acceptedTermsVersion as string | null | undefined)) ?? null
  const title = kind === "privacy" ? "Privacyverklaring" : "Gebruiksvoorwaarden"

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-[13px] text-white/85">{title}</div>
          <div className="mt-0.5 text-[11px] text-white/40">
            {acceptedAt
              ? `Akkoord gegeven op ${new Date(acceptedAt).toLocaleDateString("nl-NL")}${acceptedVersion ? ` (versie ${acceptedVersion})` : ""}`
              : "Nog geen akkoord vastgelegd"}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-3">
          {isLoading || !doc ? (
            <div className="h-24 animate-pulse rounded bg-white/[0.06]" />
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[12px] leading-relaxed text-white/60">
                {doc.bodyMd}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-white/35">Versie {doc.version}</span>
                <button
                  type="button"
                  disabled={accept.isPending || acceptedVersion === doc.version}
                  onClick={() => accept.mutate(kind)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/80 disabled:opacity-40"
                >
                  {acceptedVersion === doc.version
                    ? "Akkoord vastgelegd"
                    : accept.isPending
                      ? "Bezig…"
                      : "Ik ga akkoord"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function AccountPrivacyPanel() {
  const { data: overview, isLoading } = useAccountOverview()
  const exportAccount = useExportAccount()
  const endSessions = useEndSessions()
  const requestDelete = useRequestAccountDeletion()
  const cancelDelete = useCancelAccountDeletion()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [directDefinitief, setDirectDefinitief] = useState(false)
  const [sessionsMsg, setSessionsMsg] = useState<string | null>(null)

  const pendingDelete = overview?.verwijdering ?? null
  // Termijn komt UITSLUITEND uit de API — geen lokale beleidswaarde. Zolang de
  // overview nog niet geladen is, is dit null en tonen we geen termijntekst.
  const recoveryDays = overview?.hersteltermijnDagen ?? null
  const directDefinitiefMogelijk = overview?.directDefinitiefMogelijk ?? false

  return (
    <section className="pt-2" id="cfg-account">
      <SectionLabel n="08" title="Privacy en account" />
      <div className="mt-3 space-y-3">
        <Card>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-white/50" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-white/85">Wie ziet wat van jou</span>
          </div>
          {isLoading || !overview ? (
            <div className="mt-3 h-24 animate-pulse rounded bg-white/[0.06]" />
          ) : (
            <div className="mt-1 divide-y divide-white/[0.06]">
              <VisRow naam="Coach" entry={overview.wieZietWat.coach} />
              <VisRow naam="Ouder" entry={overview.wieZietWat.ouder} />
              <VisRow naam="Club" entry={overview.wieZietWat.club} />
              <VisRow naam="Vrienden" entry={overview.wieZietWat.vrienden} />
            </div>
          )}
          <p className="mt-2 text-[11px] leading-snug text-white/30">
            Dit volgt live uit jouw deelinstellingen hierboven. Pas je die aan, dan verandert dit direct mee.
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/50" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-white/85">Voorwaarden & privacy</span>
          </div>
          <div className="mt-1 divide-y divide-white/[0.06]">
            <LegalDocBlock kind="privacy" />
            <LegalDocBlock kind="terms" />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-white/50" strokeWidth={1.75} />
                <span className="text-[13px] font-medium text-white/85">Al je gegevens downloaden</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-white/40">
                Eén bestand met alles wat er over jou wordt bewaard. Toegangssleutels van gekoppelde diensten zitten er om veiligheidsredenen niet in.
              </p>
              {exportAccount.isError && (
                <p className="mt-1 text-[12px] text-red-400/80">
                  {(exportAccount.error as Error).message}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={exportAccount.isPending}
              onClick={() => exportAccount.mutate()}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/80 disabled:opacity-40"
            >
              {exportAccount.isPending ? "Bezig…" : "Download"}
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-white/50" strokeWidth={1.75} />
                <span className="text-[13px] font-medium text-white/85">Overal uitloggen</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-white/40">
                Beëindig alle actieve sessies op al je apparaten. Je moet daarna overal opnieuw inloggen.
              </p>
              {sessionsMsg && <p className="mt-1 text-[12px] text-white/55">{sessionsMsg}</p>}
            </div>
            <button
              type="button"
              disabled={endSessions.isPending}
              onClick={() =>
                endSessions.mutate(undefined, {
                  onSuccess: () => setSessionsMsg("Alle sessies zijn beëindigd."),
                  onError: () => setSessionsMsg("Dat lukte niet. Probeer het opnieuw."),
                })
              }
              className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/80 disabled:opacity-40"
            >
              {endSessions.isPending ? "Bezig…" : "Uitloggen"}
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400/70" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-white/85">Account verwijderen</span>
          </div>

          {isLoading || !overview || recoveryDays === null ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-white/[0.06]" />
          ) : pendingDelete ? (
            <div className="mt-2">
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
                <div className="text-[12px] leading-snug text-amber-100/80">
                  Je verwijdering staat gepland. Op{" "}
                  {new Date(pendingDelete.definitiefOp).toLocaleDateString("nl-NL")} worden al je
                  gegevens definitief verwijderd. Tot die tijd kun je dit nog terugdraaien.
                </div>
              </div>
              <button
                type="button"
                disabled={cancelDelete.isPending}
                onClick={() => cancelDelete.mutate()}
                className="mt-3 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/80 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {cancelDelete.isPending ? "Bezig…" : "Verwijdering terugdraaien"}
              </button>
            </div>
          ) : !deleteOpen ? (
            <div className="mt-2">
              <p className="text-[12px] leading-snug text-white/40">
                Al je gegevens worden na een hersteltermijn van {recoveryDays} dagen definitief verwijderd —
                trainingen, gesprekken, koppelingen en je inlogaccount.
              </p>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-3 rounded-lg border border-red-400/30 px-3 py-1.5 text-[12px] text-red-300/90"
              >
                Ik wil mijn account verwijderen
              </button>
            </div>
          ) : (
            <div className="mt-2">
              {/* GF8-04: uitdraai eerst aanbieden, vóór het verwijderen. */}
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-white/50" strokeWidth={1.75} />
                <div className="flex-1">
                  <p className="text-[12px] leading-snug text-white/55">
                    Wil je eerst alles bewaren? Download een volledige uitdraai van je gegevens voordat je verder gaat.
                  </p>
                  <button
                    type="button"
                    disabled={exportAccount.isPending}
                    onClick={() => exportAccount.mutate()}
                    className="mt-2 rounded-lg border border-white/15 px-3 py-1 text-[12px] text-white/80 disabled:opacity-40"
                  >
                    {exportAccount.isPending ? "Bezig…" : "Uitdraai downloaden"}
                  </button>
                </div>
              </div>

              <p className="text-[12px] leading-snug text-white/50">
                Typ ter bevestiging exact: <span className="font-medium text-white/75">{CONFIRM_PHRASE}</span>
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/85 outline-none placeholder:text-white/20"
              />

              {/* GF8-05: direct definitief als expliciete, extra gewaarschuwde keuze.
                  GF8-08: alleen tonen wanneer het accounttype het toestaat. */}
              {directDefinitiefMogelijk && (
                <label className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3">
                  <input
                    type="checkbox"
                    checked={directDefinitief}
                    onChange={(e) => setDirectDefinitief(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-red-400"
                  />
                  <span className="text-[12px] leading-snug text-red-100/80">
                    <span className="font-medium text-red-200/90">Direct definitief verwijderen</span> — sla de hersteltermijn over.
                    Je account en alle gegevens worden meteen verwijderd. Dit is <span className="font-medium">onomkeerbaar</span>:
                    je kunt hierna niet meer inloggen en niets terugdraaien.
                  </span>
                </label>
              )}

              {requestDelete.isError && (
                <p className="mt-1 text-[12px] text-red-400/80">
                  {(requestDelete.error as Error).message}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={confirmText !== CONFIRM_PHRASE || requestDelete.isPending}
                  onClick={() =>
                    requestDelete.mutate(
                      { confirm: confirmText, directDefinitief },
                      {
                        onSuccess: () => {
                          setDeleteOpen(false)
                          setConfirmText("")
                          setDirectDefinitief(false)
                        },
                      },
                    )
                  }
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#05070e] disabled:opacity-40"
                  style={{ background: confirmText === CONFIRM_PHRASE ? "#f87171" : "rgba(255,255,255,0.25)" }}
                >
                  {requestDelete.isPending
                    ? "Bezig…"
                    : directDefinitief
                      ? "Nu definitief verwijderen"
                      : "Definitief aanvragen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false)
                    setConfirmText("")
                    setDirectDefinitief(false)
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70"
                >
                  Annuleren
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-white/30">
                {directDefinitief
                  ? "Zonder hersteltermijn is verwijdering direct definitief en niet terug te draaien."
                  : `Na aanvraag heb je ${recoveryDays} dagen om dit terug te draaien. Daarna is verwijdering definitief.`}{" "}
                Het beveiligingslogboek bewaart alleen het bewijs van je verzoek, zonder persoonlijke inhoud.
              </p>
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}
