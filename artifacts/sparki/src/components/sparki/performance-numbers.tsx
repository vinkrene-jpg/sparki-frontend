import { usePowerBests } from "@/hooks/use-power-bests"
import { useStartFix } from "@/hooks/use-missing-input"
import { UitlegDot } from "@/components/viz/uitleg"
import type { UitlegPersoonlijk } from "@/lib/uitleg-content"
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { AthleteProfile, FtpHistoryEntry } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"
import type { Bandbreedte } from "@/lib/core-profile"

// De vaste vermogensvensters die bij bestand-import worden berekend
// (lib/power-bests.ts op de server). Volgorde = kort → lang.
const WINDOWS: Array<{ key: string; label: string }> = [
  { key: "5", label: "5 sec" },
  { key: "10", label: "10 sec" },
  { key: "20", label: "20 sec" },
  { key: "60", label: "1 min" },
  { key: "300", label: "5 min" },
  { key: "1200", label: "20 min" },
]

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-border bg-map-panel/[0.82] p-5 backdrop-blur-md ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

// Compacte lege-grafiek: ghost-balken tonen wáár de data komt, met één korte
// eerlijke regel + eventuele actie. Vervangt lange tekst-lege-states.
const GHOST_BARS = [38, 62, 30, 78, 48, 70, 34, 58, 44, 66]
function EmptyChart({
  caption,
  actionLabel,
  onAction,
}: {
  caption: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="mt-3 flex flex-1 flex-col justify-end">
      <div className="flex h-16 items-end gap-1.5" aria-hidden>
        {GHOST_BARS.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-muted"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {caption}
        {actionLabel && onAction && (
          <>
            {" "}
            <button
              type="button"
              onClick={onAction}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan/80 transition-colors hover:text-accent-cyan"
            >
              {actionLabel} →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </span>
  )
}

// "12 mrt" — korte Nederlandse datum voor tabelregels.
function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

function shortDateYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "2-digit" })
}

// Eén cijfer met micro-label, voor de kerngetallen-strip.
function Stat({
  value,
  unit,
  label,
  accent,
  uitlegKey,
  persoonlijk,
}: {
  value: string
  unit?: string
  label: string
  accent?: boolean
  uitlegKey?: string
  persoonlijk?: UitlegPersoonlijk
}) {
  return (
    <div className="flex-1 text-center">
      <p
        className={`font-sans text-lg font-light tabular-nums ${accent ? "text-accent-cyan" : "text-foreground/90"}`}
      >
        {value}
        {unit && value !== "—" && (
          <span className="ml-0.5 text-[11px] text-muted-foreground">{unit}</span>
        )}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
        {uitlegKey && <UitlegDot uitlegKey={uitlegKey} label={label} persoonlijk={persoonlijk} />}
      </p>
    </div>
  )
}

// WP-K2: kort, eerlijk herkomstlabel bij een kernwaarde. Alleen bij een echte
// waarde: "geschat" of "niet bevestigd" — nooit een kaal getal zonder status.
function herkomstLabel(
  profile: AthleteProfile | undefined,
  veld: string,
): string | null {
  const h = profile?.herkomst?.[veld]
  if (!h) return null
  if (h.origin === "geschat" || h.estimated) return "geschat"
  if (h.origin === "onbekend") return "niet bevestigd"
  return null
}

export function PerformanceNumbers({
  profile,
  ftpHistory,
  load,
  bandbreedte,
  laadt = false,
}: {
  profile: AthleteProfile | undefined
  ftpHistory: FtpHistoryEntry[] | undefined
  load: LoadData | undefined
  bandbreedte: Bandbreedte
  // WP-K3: zolang het profiel laadt tonen we een skeleton — nooit
  // "nog niet bekend" terwijl de data gewoon onderweg is.
  laadt?: boolean
}) {
  const { data: bests } = usePowerBests()
  const startFix = useStartFix()

  const ftp = profile?.ftp ?? null
  const weight = profile?.weightKg != null ? Number(profile.weightKg) : null
  const wkg =
    ftp != null && weight != null && weight > 0 ? (ftp / weight).toFixed(1) : null

  // Fitheidsverloop over de getoonde 6 weken (eerste vs. laatste chartpunt).
  const chart = load?.chartData ?? []
  const first = chart[0]
  const ctlDelta =
    load && first ? Math.round(load.ctl - first.ctl) : null

  const hasBests =
    bests != null &&
    (Object.keys(bests.allTime).length > 0 || Object.keys(bests.recent).length > 0)

  // FTP-metingen, nieuwste eerst (zo komen ze binnen), max 4 regels.
  const ftpRows = (ftpHistory ?? []).slice(0, 4)

  // Persoonlijke waarden voor het "Bij jou"-blok in de uitleg.
  const persoonlijk: UitlegPersoonlijk = {
    ftp,
    ftpEstimated: null,
    weightKg: weight,
    ctl: load?.ctl ?? null,
    atl: load?.atl ?? null,
    tsb: load?.tsb ?? null,
    heeftVermogensdata: bests != null ? hasBests : null,
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
      {/* KERNGETALLEN */}
      <Card>
        <MicroLabel>Kerngetallen</MicroLabel>
        <div className="mt-3 flex items-stretch">
          <Stat
            value={ftp != null ? String(ftp) : "—"}
            unit="W"
            label="FTP"
            accent
            uitlegKey="ftp"
            persoonlijk={persoonlijk}
          />
          <div className="border-l border-border" />
          <Stat value={wkg ?? "—"} unit="W/kg" label="Per kilo" />
          <div className="border-l border-border" />
          <Stat
            value={weight != null ? String(Math.round(weight * 10) / 10) : "—"}
            unit="kg"
            label="Gewicht"
          />
        </div>
        {(herkomstLabel(profile, "ftp") != null && ftp != null) ||
        (herkomstLabel(profile, "weightKg") != null && weight != null) ? (
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {[
              ftp != null && herkomstLabel(profile, "ftp") != null
                ? `FTP ${ftp} W · ${herkomstLabel(profile, "ftp")}`
                : null,
              weight != null && herkomstLabel(profile, "weightKg") != null
                ? `gewicht ${Math.round(weight * 10) / 10} kg · ${herkomstLabel(profile, "weightKg")}`
                : null,
            ]
              .filter(Boolean)
              .join(" — ")}
          </p>
        ) : null}
        {laadt && (ftp == null || weight == null) && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
        {!laadt && (ftp == null || weight == null) && (
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {ftp == null && weight == null
              ? "FTP en gewicht zijn nog niet bekend."
              : ftp == null
                ? "Je FTP is nog niet bekend."
                : "Je gewicht is nog niet bekend."}{" "}
            <button
              type="button"
              onClick={() => startFix(ftp == null ? "ftp" : "weight")}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan/80 transition-colors hover:text-accent-cyan"
            >
              Invullen →
            </button>
          </p>
        )}
      </Card>

      {/* FITHEIDSSCORE — CTL/ATL/TSB in gewone taal */}
      <Card>
        <div className="flex items-center justify-between">
          <MicroLabel>Fitheidsscore</MicroLabel>
          {ctlDelta != null && (
            <span
              className={`flex items-center gap-1 font-mono text-[10px] tabular-nums ${
                ctlDelta > 0
                  ? "text-positive"
                  : ctlDelta < 0
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {ctlDelta > 0 ? (
                <TrendingUp className="h-3 w-3" strokeWidth={2} />
              ) : ctlDelta < 0 ? (
                <TrendingDown className="h-3 w-3" strokeWidth={2} />
              ) : (
                <Minus className="h-3 w-3" strokeWidth={2} />
              )}
              {ctlDelta > 0 ? `+${ctlDelta}` : String(ctlDelta)} in 6 wkn
            </span>
          )}
        </div>
        {load ? (
          <div className="mt-3 flex items-stretch">
            <Stat
              value={String(load.ctl)}
              label="Fitheid"
              accent
              uitlegKey="fitheid"
              persoonlijk={persoonlijk}
            />
            <div className="border-l border-border" />
            <Stat
              value={String(load.atl)}
              label="Vermoeidheid"
              uitlegKey="vermoeidheid"
              persoonlijk={persoonlijk}
            />
            <div className="border-l border-border" />
            <Stat
              value={load.tsb > 0 ? `+${load.tsb}` : String(load.tsb)}
              label="Vorm"
              uitlegKey="vorm"
              persoonlijk={persoonlijk}
            />
          </div>
        ) : (
          <EmptyChart caption="Nog geen trainingsbelasting bekend — dit vult zich zodra ritten met belastingscore binnenkomen." />
        )}
      </Card>

      {/* VERWACHTE PROGRESSIE — bandbreedte richting je doel */}
      <Card>
        <MicroLabel>Verwachte progressie</MicroLabel>
        {bandbreedte.hasData && bandbreedte.current != null ? (
          <>
            <div className="mt-3 flex items-stretch">
              <Stat value={String(bandbreedte.current)} unit={bandbreedte.unit} label="Nu" />
              <div className="border-l border-border" />
              <Stat
                value={String(bandbreedte.expected)}
                unit={bandbreedte.unit}
                label="Verwacht"
                accent
              />
              <div className="border-l border-border" />
              <Stat
                value={`${bandbreedte.low}–${bandbreedte.high}`}
                unit={bandbreedte.unit}
                label="Bandbreedte"
              />
            </div>
            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Schatting voor {bandbreedte.horizonLabel}, afgewogen tegen je doel. Een
              realistische bandbreedte, geen belofte.
            </p>
          </>
        ) : (
          <EmptyChart caption="Nog geen progressie-schatting mogelijk — die ontstaat zodra FTP en trainingsdata er zijn." />
        )}
      </Card>

      {/* BESTE VERMOGENS — tabel per venster */}
      <Card className="lg:col-span-2">
        <span className="inline-flex items-center gap-1">
          <MicroLabel>Beste vermogens</MicroLabel>
          <UitlegDot uitlegKey="records" label="Beste vermogens" persoonlijk={persoonlijk} />
        </span>
        {hasBests && bests ? (
          <>
            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                    Duur
                  </th>
                  <th className="pb-2 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                    Laatste 6 wkn
                  </th>
                  <th className="pb-2 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                    Beste ooit
                  </th>
                </tr>
              </thead>
              <tbody>
                {WINDOWS.map((w) => {
                  const all = bests.allTime[w.key]
                  const rec = bests.recent[w.key]
                  return (
                    <tr key={w.key} className="border-b border-border last:border-b-0">
                      <td className="py-2 text-[13px] text-muted-foreground">{w.label}</td>
                      <td className="py-2 text-right text-[14px] tabular-nums text-foreground/80">
                        {rec ? (
                          <>
                            {rec.watts}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">W</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className={`py-2 text-right text-[14px] tabular-nums ${all ? "text-accent-cyan" : ""}`}>
                        {all ? (
                          <>
                            {all.watts}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">W</span>
                            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
                              {shortDate(all.date)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              Uit {bests.sessionsWithBests}{" "}
              {bests.sessionsWithBests === 1 ? "rit" : "ritten"} met vermogensmeting
              per seconde. Ontbreekt een duur? Dan zit daar nog geen echte meting
              achter.
            </p>
          </>
        ) : (
          <EmptyChart
            caption="Nog geen echte piekwaarden (5 sec–20 min). Vult zich zodra je een rit met vermogensmeting importeert als FIT of TCX — eerder geïmporteerde ritten tellen pas mee na opnieuw importeren. Er wordt niets geschat."
            actionLabel="Rit importeren"
            onAction={() => startFix("sportData")}
          />
        )}
      </Card>

      {/* FTP-VERLOOP — metingen als tabel */}
      <Card>
        <MicroLabel>FTP-verloop</MicroLabel>
        {ftpRows.length > 0 ? (
          <table className="mt-3 w-full border-collapse text-left">
            <tbody>
              {ftpRows.map((entry, i) => {
                const next = ftpRows[i + 1]
                const delta = next ? entry.ftpWatts - next.ftpWatts : null
                return (
                  <tr key={entry.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 text-[12px] tabular-nums text-muted-foreground">
                      {shortDateYear(entry.measuredAt)}
                    </td>
                    <td className="py-2 text-right text-[14px] tabular-nums text-foreground/80">
                      {entry.ftpWatts}
                      <span className="ml-0.5 text-[10px] text-muted-foreground">W</span>
                    </td>
                    <td className="w-16 py-2 text-right font-mono text-[11px] tabular-nums">
                      {delta != null ? (
                        <span
                          className={
                            delta > 0
                              ? "text-positive"
                              : delta < 0
                                ? "text-warning"
                                : "text-muted-foreground"
                          }
                        >
                          {delta > 0 ? `+${delta}` : String(delta)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyChart
            caption="Nog geen FTP-metingen vastgelegd."
            actionLabel="FTP invullen"
            onAction={() => startFix("ftp")}
          />
        )}
      </Card>

    </div>
  )
}
