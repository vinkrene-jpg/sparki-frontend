// ── FTP estimate wizard ───────────────────────────────────────────────────────
// "Ik weet mijn FTP niet" → an honest, step-by-step estimate. Asks experience,
// then a real input (20-min test power, a hard ~1h ride, or level+weight), shows
// the estimate WITH its uncertainty range, and saves it flagged as estimated so
// it can be refined later with a real test.

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ACCENT } from "@/components/sparki/ui";
import { useSaveFtpEstimate } from "@/hooks/use-ftp-estimate";
import {
  estimateFtp,
  type FtpExperience,
  type FtpMethod,
  type FtpEstimateResult,
} from "@/lib/ftp-estimate";
import { ChevronLeft, Loader2, Check, Info } from "lucide-react";

const EXPERIENCE_OPTIONS: { value: FtpExperience; label: string; hint: string }[] =
  [
    { value: "beginner", label: "Beginner", hint: "< 1 jaar gestructureerd" },
    {
      value: "intermediate",
      label: "Gevorderd",
      hint: "1–3 jaar, regelmatig",
    },
    { value: "advanced", label: "Ervaren", hint: "3+ jaar, wedstrijden" },
    { value: "elite", label: "Elite", hint: "Competitief op hoog niveau" },
  ];

const METHOD_OPTIONS: { value: FtpMethod; label: string; hint: string }[] = [
  {
    value: "twentyMin",
    label: "Ik heb een 20-minuten test",
    hint: "Meest nauwkeurig",
  },
  {
    value: "recentRide",
    label: "Een recente harde rit (±1 uur)",
    hint: "Redelijk nauwkeurig",
  },
  {
    value: "experience",
    label: "Ik heb geen vermogensdata",
    hint: "Schatting op je niveau",
  },
];

type Step = "experience" | "method" | "input" | "result";

export function FtpEstimateWizard({
  open,
  onOpenChange,
  weightKg,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weightKg: number | null;
  onSaved?: () => void;
}) {
  const save = useSaveFtpEstimate();
  const [step, setStep] = useState<Step>("experience");
  const [experience, setExperience] = useState<FtpExperience>("intermediate");
  const [method, setMethod] = useState<FtpMethod>("twentyMin");
  const [watts, setWatts] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [showTestInfo, setShowTestInfo] = useState(false);
  const [result, setResult] = useState<FtpEstimateResult | null>(null);

  const reset = () => {
    setStep("experience");
    setExperience("intermediate");
    setMethod("twentyMin");
    setWatts("");
    setWeightInput("");
    setShowTestInfo(false);
    setResult(null);
    save.reset();
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 250);
  };

  const effectiveWeight =
    weightKg ?? (weightInput ? Number(weightInput) : undefined);
  const wattsNum = watts ? Number(watts) : undefined;

  const canCompute =
    method === "experience"
      ? !!(effectiveWeight && effectiveWeight > 0) || true // level fallback always works
      : !!(wattsNum && wattsNum > 0);

  const compute = () => {
    const r = estimateFtp({
      method,
      experience,
      watts: wattsNum,
      weightKg: effectiveWeight,
    });
    setResult(r);
    setStep("result");
  };

  const handleSave = () => {
    if (!result) return;
    save.mutate(
      { ftp: result.ftp, experienceLevel: experience },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTimeout(reset, 250);
          onSaved?.();
        },
      },
    );
  };

  const back = () => {
    if (step === "method") setStep("experience");
    else if (step === "input") setStep("method");
    else if (step === "result") setStep("input");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto border-white/[0.08] bg-[#070d16]/95 backdrop-blur-xl"
      >
        <SheetHeader className="flex flex-row items-center gap-3 space-y-0">
          {step !== "experience" ? (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1 rounded-lg px-2 py-1 font-sans text-[12px] text-white/55 transition-colors hover:text-white/85"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              Terug
            </button>
          ) : (
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2 py-1 font-sans text-[12px] text-white/55 transition-colors hover:text-white/85"
            >
              Sluiten
            </button>
          )}
          <SheetTitle className="font-sans text-[14px] font-light text-white/85">
            FTP inschatten
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 pb-2">
          {step === "experience" && (
            <>
              <p className="text-[13px] leading-relaxed text-white/50">
                Hoe ervaren ben je op de fiets? Dit helpt Sparki een eerste
                inschatting maken.
              </p>
              <div className="flex flex-col gap-2">
                {EXPERIENCE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setExperience(o.value)}
                    className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor:
                        experience === o.value
                          ? "rgba(120,210,230,0.45)"
                          : "rgba(255,255,255,0.1)",
                      background:
                        experience === o.value
                          ? "rgba(120,210,230,0.08)"
                          : "transparent",
                    }}
                  >
                    <div>
                      <p className="font-sans text-[14px] text-white/85">
                        {o.label}
                      </p>
                      <p className="text-[11px] text-white/40">{o.hint}</p>
                    </div>
                    {experience === o.value && (
                      <Check
                        className="h-4 w-4"
                        style={{ color: ACCENT }}
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep("method")}
                className="mt-1 rounded-2xl py-3 font-sans text-[13px] font-semibold"
                style={{ background: ACCENT, color: "#040506" }}
              >
                Volgende
              </button>
            </>
          )}

          {step === "method" && (
            <>
              <p className="text-[13px] leading-relaxed text-white/50">
                Welke gegevens heb je? Hoe beter de bron, hoe nauwkeuriger de
                schatting.
              </p>
              <div className="flex flex-col gap-2">
                {METHOD_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setMethod(o.value)}
                    className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor:
                        method === o.value
                          ? "rgba(120,210,230,0.45)"
                          : "rgba(255,255,255,0.1)",
                      background:
                        method === o.value
                          ? "rgba(120,210,230,0.08)"
                          : "transparent",
                    }}
                  >
                    <div>
                      <p className="font-sans text-[14px] text-white/85">
                        {o.label}
                      </p>
                      <p className="text-[11px] text-white/40">{o.hint}</p>
                    </div>
                    {method === o.value && (
                      <Check
                        className="h-4 w-4"
                        style={{ color: ACCENT }}
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowTestInfo((s) => !s)}
                className="flex items-center gap-1.5 text-[12px] text-cyan-300/70"
              >
                <Info className="h-3.5 w-3.5" strokeWidth={2} />
                Zo doe je een echte 20-minuten test
              </button>
              {showTestInfo && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-white/55">
                  Warm 15 minuten in. Rijd daarna 20 minuten zo hard als je
                  constant volhoudt — vlak parcours of op de trainer. Je
                  gemiddelde vermogen over die 20 minuten × 0,95 is je FTP. Doe de
                  test uitgerust voor het beste resultaat.
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep("input")}
                className="mt-1 rounded-2xl py-3 font-sans text-[13px] font-semibold"
                style={{ background: ACCENT, color: "#040506" }}
              >
                Volgende
              </button>
            </>
          )}

          {step === "input" && (
            <>
              {method !== "experience" ? (
                <>
                  <p className="text-[13px] leading-relaxed text-white/50">
                    {method === "twentyMin"
                      ? "Wat was je gemiddelde vermogen over je 20-minuten test?"
                      : "Wat was je gemiddelde vermogen tijdens die harde rit van ongeveer een uur?"}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="number"
                      inputMode="numeric"
                      value={watts}
                      onChange={(e) => setWatts(e.target.value)}
                      placeholder="bijv. 250"
                      min={50}
                      max={700}
                      className="w-32 rounded-xl border border-cyan-300/30 bg-white/[0.04] px-3.5 py-2.5 font-sans text-[15px] text-white/90 placeholder:text-white/25 focus:outline-none"
                    />
                    <span className="font-mono text-[12px] text-white/40">
                      watt
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-white/50">
                    {weightKg
                      ? "FTP-schatting op basis van niveau en gewicht. Verfijn dit later met een echte test."
                      : "Vul je gewicht in zodat Sparki een betere inschatting kan maken op basis van je niveau."}
                  </p>
                  {!weightKg && (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="number"
                        inputMode="numeric"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        placeholder="bijv. 70"
                        min={30}
                        max={150}
                        className="w-32 rounded-xl border border-cyan-300/30 bg-white/[0.04] px-3.5 py-2.5 font-sans text-[15px] text-white/90 placeholder:text-white/25 focus:outline-none"
                      />
                      <span className="font-mono text-[12px] text-white/40">
                        kg
                      </span>
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={compute}
                disabled={!canCompute}
                className="mt-1 rounded-2xl py-3 font-sans text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT, color: "#040506" }}
              >
                Bereken schatting
              </button>
            </>
          )}

          {step === "result" && result && (
            <>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] px-6 py-7 text-center">
                <p className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                  GESCHATTE FTP
                </p>
                <p
                  className="font-sans text-4xl font-extralight"
                  style={{ color: ACCENT }}
                >
                  {result.ftp}
                  <span className="text-lg text-white/40"> W</span>
                </p>
                <p className="text-[12px] text-white/45">
                  Bereik {result.low}–{result.high} W (±{result.marginPct}%)
                </p>
              </div>
              <p className="text-[12px] leading-relaxed text-white/45">
                {result.basis} Dit is een inschatting — doe een 20-minuten test
                wanneer je kunt om je FTP exact vast te leggen.
              </p>
              {save.isError && (
                <p className="text-[12px] text-red-300/70">
                  Opslaan lukte niet. Probeer het opnieuw.
                </p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={save.isPending}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
                style={{ background: ACCENT, color: "#040506" }}
              >
                {save.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opslaan…
                  </>
                ) : (
                  "Schatting opslaan"
                )}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
