// Golf 20 — Sportpaspoort: één herleidbaar overzicht van je kernwaarden.
// Herkomst-chips (gemeten/handmatig/berekend/geschat + bron + datum),
// verouderd-markering, open voorstellen met bevestigen/afwijzen,
// ontwikkelingsbeeld (alleen bij genoeg echte meetpunten) en een
// exportsamensteller waarin gezondheid/locatie/notities standaard UIT staan.
import { useState } from "react";
import {
  BadgeCheck,
  PencilLine,
  Cpu,
  HelpCircle,
  Clock,
  ChevronDown,
  Download,
  Check,
  X,
} from "lucide-react";
import {
  usePassport,
  usePassportOntwikkeling,
  useDecideProposal,
  useExportPassport,
  type PassportFieldView,
} from "@/hooks/use-passport";

const ORIGIN_META: Record<
  string,
  { label: string; cls: string; Icon: typeof BadgeCheck }
> = {
  gemeten: { label: "Gemeten", cls: "text-emerald-300/90 border-emerald-300/25 bg-emerald-400/10", Icon: BadgeCheck },
  handmatig: { label: "Handmatig", cls: "text-sky-300/90 border-sky-300/25 bg-sky-400/10", Icon: PencilLine },
  berekend: { label: "Berekend", cls: "text-violet-300/90 border-violet-300/25 bg-violet-400/10", Icon: Cpu },
  geschat: { label: "Geschat", cls: "text-amber-300/90 border-amber-300/25 bg-amber-400/10", Icon: HelpCircle },
  onbekend: { label: "Herkomst onbekend", cls: "text-white/45 border-white/15 bg-white/5", Icon: HelpCircle },
};

function OriginChip({ f }: { f: PassportFieldView }) {
  const meta = ORIGIN_META[f.origin] ?? ORIGIN_META.onbekend;
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {meta.label}
      {f.source ? ` · ${f.source}` : ""}
      {f.since ? ` · ${f.since}` : ""}
    </span>
  );
}

const FIELD_LABELS_NL: Record<string, string> = {
  ok: "gezond",
  sick: "ziek",
  injured: "geblesseerd",
};

function displayValue(f: PassportFieldView): string {
  if (f.value == null) return "—";
  const v = FIELD_LABELS_NL[f.value] ?? f.value;
  return f.unit ? `${v} ${f.unit}` : v;
}

const EXPORT_OPTIONS: Array<{ key: string; label: string; defaultOn: boolean; warn?: string }> = [
  { key: "identiteit", label: "Sportidentiteit (discipline, ervaring, doel)", defaultOn: true },
  { key: "prestaties", label: "Prestatiewaarden (FTP, gewicht, weekuren)", defaultOn: true },
  { key: "historie", label: "Waardegeschiedenis", defaultOn: true },
  { key: "ontwikkeling", label: "Ontwikkelingsbeeld", defaultOn: true },
  { key: "gezondheid", label: "Gezondheid & blessures", defaultOn: false, warn: "gevoelig" },
  { key: "locatie", label: "Thuislocatie", defaultOn: false, warn: "gevoelig" },
  { key: "notities", label: "Privé-notities & motivatie", defaultOn: false, warn: "gevoelig" },
];

export function SportPassport() {
  const { data: passport, isLoading } = usePassport();
  const [showOntwikkeling, setShowOntwikkeling] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [sections, setSections] = useState<Set<string>>(
    () => new Set(EXPORT_OPTIONS.filter((o) => o.defaultOn).map((o) => o.key)),
  );
  const ontwikkeling = usePassportOntwikkeling(showOntwikkeling);
  const decide = useDecideProposal();
  const exportMut = useExportPassport();

  if (isLoading || !passport) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <p className="text-[12px] text-white/40">Paspoort wordt samengesteld…</p>
      </div>
    );
  }

  const doExport = () => {
    exportMut.mutate(Array.from(sections), {
      onSuccess: (res) => {
        const blob = new Blob([JSON.stringify(res.export, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sportpaspoort.json";
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  return (
    <div className="space-y-3">
      {/* Open voorstellen — automatische wijzigingen die zones raken. */}
      {passport.proposals.length > 0 && (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
            Voorstel — bevestiging nodig
          </p>
          {passport.proposals.map((p) => (
            <div key={p.id} className="mt-3 space-y-2">
              <p className="text-[13px] leading-relaxed text-white/80">{p.reason}</p>
              <p className="text-[11px] text-white/45">
                {p.currentValue ?? "—"} → <span className="font-semibold text-white/80">{p.proposedValue}</span>
                {" · "}dit past je trainingszones aan
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: p.id, besluit: "geaccepteerd" })}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-medium text-emerald-200"
                >
                  <Check className="h-3.5 w-3.5" /> Overnemen
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: p.id, besluit: "afgewezen" })}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/60"
                >
                  <X className="h-3.5 w-3.5" /> Niet overnemen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kernwaarden met herkomst */}
      <div className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <ul className="divide-y divide-white/[0.06]">
          {passport.fields.map((f) => (
            <li key={f.field} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-[12px] text-white/45">{f.label}</p>
                <p className="text-[15px] font-semibold text-white/90">
                  {displayValue(f)}
                  {f.estimated && f.value != null && (
                    <span className="ml-1.5 text-[10px] font-normal text-amber-300/80">schatting</span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {f.value != null ? <OriginChip f={f} /> : (
                  <span className="text-[10px] text-white/35">nog niet ingevuld</span>
                )}
                {f.stale && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300/80">
                    <Clock className="h-3 w-3" /> langer dan {passport.quality.staleAfterDays} dagen niet bevestigd
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Waardegeschiedenis */}
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3 text-left backdrop-blur-md"
      >
        <span className="text-[13px] font-medium text-white/75">Waardegeschiedenis</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showHistory ? "rotate-180" : ""}`} />
      </button>
      {showHistory && (
        <div className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          {passport.history.length === 0 ? (
            <p className="text-[12px] text-white/40">
              Nog geen geregistreerde wijzigingen. Vanaf nu wordt iedere aanpassing van een kernwaarde hier herleidbaar bewaard.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {passport.history.slice(0, 25).map((e) => (
                <li key={e.id} className="text-[12px] leading-relaxed text-white/60">
                  <span className="text-white/80">{ORIGIN_META[e.origin]?.label ?? e.origin}</span>
                  {" · "}
                  {e.field}: {e.oldValue ?? "—"} → {e.newValue ?? "—"}
                  {e.source ? ` · ${e.source}` : ""}
                  {" · "}
                  {new Date(e.createdAt).toLocaleDateString("nl-NL")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Ontwikkeling over de tijd — betrouwbaarheidsgate */}
      <button
        type="button"
        onClick={() => setShowOntwikkeling((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3 text-left backdrop-blur-md"
      >
        <span className="text-[13px] font-medium text-white/75">Ontwikkeling over de tijd</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showOntwikkeling ? "rotate-180" : ""}`} />
      </button>
      {showOntwikkeling && (
        <div className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          {ontwikkeling.isLoading ? (
            <p className="text-[12px] text-white/40">Laden…</p>
          ) : !ontwikkeling.data ? (
            <p className="text-[12px] text-white/40">Kon het ontwikkelingsbeeld niet laden.</p>
          ) : !ontwikkeling.data.reliable ? (
            <p className="text-[12px] leading-relaxed text-white/50">{ontwikkeling.data.reliableReason}</p>
          ) : (
            <div className="space-y-3 text-[12px] text-white/70">
              {ontwikkeling.data.ftpSeries.length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-white/80">FTP-verloop</p>
                  <ul className="space-y-1">
                    {ontwikkeling.data.ftpSeries.slice(-6).map((f, i) => (
                      <li key={i}>
                        {f.measuredAt}: <span className="font-semibold">{f.ftpWatts} watt</span>
                        <span className="text-white/40"> · {f.testType === "manual" ? "handmatig/test" : f.testType === "derived" ? "berekende ondergrens" : f.testType}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Object.keys(ontwikkeling.data.powerBests).length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-white/80">Beste vermogens (ooit gemeten)</p>
                  <ul className="space-y-1">
                    {Object.entries(ontwikkeling.data.powerBests).map(([win, b]) => (
                      <li key={win}>
                        {win}: <span className="font-semibold">{b.watts} watt</span>
                        <span className="text-white/40"> · {b.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-white/40">Gebaseerd op {ontwikkeling.data.sessionCount} geregistreerde ritten.</p>
            </div>
          )}
        </div>
      )}

      {/* Export — door jou samengesteld */}
      <button
        type="button"
        onClick={() => setShowExport((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3 text-left backdrop-blur-md"
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-white/75">
          <Download className="h-4 w-4 text-white/40" /> Paspoort delen of exporteren
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${showExport ? "rotate-180" : ""}`} />
      </button>
      {showExport && (
        <div className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <p className="text-[12px] leading-relaxed text-white/50">
            Jij bepaalt wat erin zit. Gezondheid, locatie en privé-notities staan standaard uit.
          </p>
          <ul className="mt-3 space-y-2">
            {EXPORT_OPTIONS.map((o) => (
              <li key={o.key}>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/75">
                  <input
                    type="checkbox"
                    checked={sections.has(o.key)}
                    onChange={(e) => {
                      setSections((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(o.key);
                        else next.delete(o.key);
                        return next;
                      });
                    }}
                    className="h-4 w-4 accent-cyan-400"
                  />
                  {o.label}
                  {o.warn && (
                    <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-200/80">
                      {o.warn}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={sections.size === 0 || exportMut.isPending}
            onClick={doExport}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/15 px-4 py-2 text-[12px] font-semibold text-cyan-100 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            {exportMut.isPending ? "Bezig…" : "Download als bestand"}
          </button>
          {sections.size === 0 && (
            <p className="mt-2 text-[11px] text-white/40">Kies eerst minstens één onderdeel.</p>
          )}
          {exportMut.isError && (
            <p className="mt-2 text-[11px] text-rose-300/80">Export mislukt. Probeer het opnieuw.</p>
          )}
        </div>
      )}
    </div>
  );
}
