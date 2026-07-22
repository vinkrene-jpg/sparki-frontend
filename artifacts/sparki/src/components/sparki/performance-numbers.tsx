import { usePowerBests } from "@/hooks/use-power-bests"
import { useStartFix } from "@/hooks/use-missing-input"
import { ACCENT } from "@/components/sparki/ui"
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      {children}
    </div>
  )
}

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
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
        className="font-sans text-lg font-light tabular-nums"
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.9)" }}
      >
        {value}
        {unit && value !== "—" && (
          <span className="ml-0.5 text-[11px] text-white/40">{unit}</span>
        )}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
        {label}
        {uitlegKey && <UitlegDot uitlegKey={uitlegKey} label={label} persoonlijk={persoonlijk} />}
      </p>
    </div>
  )
}

export function PerformanceNumbers({
  profile,
  ftpHistory,
  load,
  bandbreedte,
}: {
  profile: AthleteProfile | undefined
  ftpHistory: FtpHistoryEntry[] | undefined
  load: LoadData | undefined
  bandbreedte: Bandbreedte
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
    <div className="flex flex-col gap-2.5">
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
          <div className="border-l border-white/[0.07]" />
          <Stat value={wkg ?? "—"} unit="W/kg" label="Per kilo" />
          <div className="border-l border-white/[0.07]" />
          <Stat
            value={weight != null ? String(Math.round(weight * 10) / 10) : "—"}
            unit="kg"
            label="Gewicht"
          />
        </div>
        {(ftp == null || weight == null) && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/40">
            {ftp == null && weight == null
              ? "FTP en gewicht zijn nog niet bekend."
              : ftp == null
                ? "Je FTP is nog niet bekend."
                : "Je gewicht is nog niet bekend."}{" "}
            <button
              type="button"
              onClick={() => startFix(ftp == null ? "ftp" : "weight")}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 transition-colors hover:text-cyan-300"
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
                  ? "text-cyan-300"
                  : ctlDelta < 0
                    ? "text-amber-300"
                    : "text-white/45"
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
            <div className="border-l border-white/[0.07]" />
            <Stat
              value={String(load.atl)}
              label="Vermoeidheid"
              uitlegKey="vermoeidheid"
              persoonlijk={persoonlijk}
            />
            <div className="border-l border-white/[0.07]" />
            <Stat
              value={load.tsb > 0 ? `+${load.tsb}` : String(load.tsb)}
              label="Vorm"
              uitlegKey="vorm"
              persoonlijk={persoonlijk}
            />
          </div>
        ) : (
          <p className="mt-2.5 text-[13px] leading-relaxed text-white/55">
            Nog geen trainingsbelasting bekend — dit vult zich zodra ritten met
            belastingscore binnenkomen.
          </p>
        )}
      </Card>

      {/* BESTE VERMOGENS — tabel per venster */}
      <Card>
        <span className="inline-flex items-center gap-1">
          <MicroLabel>Beste vermogens</MicroLabel>
          <UitlegDot uitlegKey="records" label="Beste vermogens" persoonlijk={persoonlijk} />
        </span>
        {hasBests && bests ? (
          <>
            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="pb-2 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-white/35">
                    Duur
                  </th>
                  <th className="pb-2 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-white/35">
                    Laatste 6 wkn
                  </th>
                  <th className="pb-2 text-right font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-white/35">
                    Beste ooit
                  </th>
                </tr>
              </thead>
              <tbody>
                {WINDOWS.map((w) => {
                  const all = bests.allTime[w.key]
                  const rec = bests.recent[w.key]
                  return (
                    <tr key={w.key} className="border-b border-white/[0.05] last:border-b-0">
                      <td className="py-2 text-[13px] text-white/70">{w.label}</td>
                      <td className="py-2 text-right text-[14px] tabular-nums text-white/85">
                        {rec ? (
                          <>
                            {rec.watts}
                            <span className="ml-0.5 text-[10px] text-white/35">W</span>
                          </>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-[14px] tabular-nums" style={{ color: all ? ACCENT : undefined }}>
                        {all ? (
                          <>
                            {all.watts}
                            <span className="ml-0.5 text-[10px] text-white/35">W</span>
                            <span className="ml-1.5 text-[10px] tabular-nums text-white/30">
                              {shortDate(all.date)}
                            </span>
                          </>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/40">
              Uit {bests.sessionsWithBests}{" "}
              {bests.sessionsWithBests === 1 ? "rit" : "ritten"} met vermogensmeting
              per seconde. Ontbreekt een duur? Dan zit daar nog geen echte meting
              achter.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2.5 text-[13px] leading-relaxed text-white/65">
              Nog geen beste vermogens bekend.
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              Deze tabel vult zich met je echte piekwaarden (5 seconden tot 20
              minuten) zodra je een rit met vermogensmeting importeert als FIT- of
              TCX-bestand. Eerder geïmporteerde ritten tellen niet mee — importeer
              ze opnieuw als je die erbij wilt. Er wordt niets geschat.
            </p>
            <button
              type="button"
              onClick={() => startFix("sportData")}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-[#05070e] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              Rit importeren
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </>
        )}
      </Card>

      {/* FTP-VERLOOP — metingen als tabel */}
      {ftpRows.length > 0 && (
        <Card>
          <MicroLabel>FTP-verloop</MicroLabel>
          <table className="mt-3 w-full border-collapse text-left">
            <tbody>
              {ftpRows.map((entry, i) => {
                const next = ftpRows[i + 1]
                const delta = next ? entry.ftpWatts - next.ftpWatts : null
                return (
                  <tr key={entry.id} className="border-b border-white/[0.05] last:border-b-0">
                    <td className="py-2 text-[12px] tabular-nums text-white/50">
                      {shortDateYear(entry.measuredAt)}
                    </td>
                    <td className="py-2 text-right text-[14px] tabular-nums text-white/85">
                      {entry.ftpWatts}
                      <span className="ml-0.5 text-[10px] text-white/35">W</span>
                    </td>
                    <td className="w-16 py-2 text-right font-mono text-[11px] tabular-nums">
                      {delta != null ? (
                        <span
                          className={
                            delta > 0
                              ? "text-cyan-300"
                              : delta < 0
                                ? "text-amber-300"
                                : "text-white/40"
                          }
                        >
                          {delta > 0 ? `+${delta}` : String(delta)}
                        </span>
                      ) : (
                        <span className="text-white/25">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* VERWACHTE PROGRESSIE — bandbreedte richting je doel */}
      {bandbreedte.hasData && bandbreedte.current != null && (
        <Card>
          <MicroLabel>Verwachte progressie</MicroLabel>
          <div className="mt-3 flex items-stretch">
            <Stat value={String(bandbreedte.current)} unit={bandbreedte.unit} label="Nu" />
            <div className="border-l border-white/[0.07]" />
            <Stat
              value={String(bandbreedte.expected)}
              unit={bandbreedte.unit}
              label="Verwacht"
              accent
            />
            <div className="border-l border-white/[0.07]" />
            <Stat
              value={`${bandbreedte.low}–${bandbreedte.high}`}
              unit={bandbreedte.unit}
              label="Bandbreedte"
            />
          </div>
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/40">
            Schatting voor {bandbreedte.horizonLabel}, afgewogen tegen je doel. Een
            realistische bandbreedte, geen belofte.
          </p>
        </Card>
      )}
    </div>
  )
}
