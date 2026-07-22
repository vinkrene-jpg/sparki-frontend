// Golf 21 — compacte bronvermelding onder analyses/adviezen die op beheerde
// vakkennis steunen. Toont bronnaam, versie, betrouwbaarheid en (indien
// aanwezig) beperkingen; met een "klopt dit niet?"-melding naar de beheerder.
// Wordt alleen gerenderd als er echte bronnen zijn — nooit een lege claim.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Bron = {
  itemId: number;
  version: number;
  topic: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  reliability: string;
  limitations: string | null;
  professionalCheck: string | null;
};

export function BronVermelding({ bronnen }: { bronnen?: Bron[] | null }) {
  const [meldOpen, setMeldOpen] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<number[]>([]);

  const melden = useMutation({
    mutationFn: (input: { itemId: number; message: string }) =>
      apiFetch("/api/knowledge/feedback", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_d, vars) => {
      setSent((s) => [...s, vars.itemId]);
      setMeldOpen(null);
      setMessage("");
    },
  });

  if (!bronnen || bronnen.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
        Gebaseerd op
      </p>
      <div className="mt-1.5 space-y-2">
        {bronnen.map((b) => (
          <div key={`${b.itemId}-${b.version}`}>
            <p className="text-[12px] leading-relaxed text-white/60">
              {b.sourceUrl ? (
                <a
                  href={b.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/25 underline-offset-2 hover:text-white/85"
                >
                  {b.sourceName}
                </a>
              ) : (
                b.sourceName
              )}
              <span className="text-white/35">
                {" "}
                — {b.topic}, versie {b.version}, betrouwbaarheid {b.reliability}
                {b.reviewedAt ? `, gecontroleerd ${b.reviewedAt}` : ""}
              </span>
            </p>
            {b.limitations && (
              <p className="text-[11px] text-white/40">Let op: {b.limitations}</p>
            )}
            {b.professionalCheck && (
              <p className="text-[11px] text-amber-200/60">{b.professionalCheck}</p>
            )}
            {sent.includes(b.itemId) ? (
              <p className="text-[11px] text-emerald-300/70">
                Bedankt — je melding is doorgegeven aan de beheerder.
              </p>
            ) : meldOpen === b.itemId ? (
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12px] text-white/85 placeholder:text-white/25"
                  placeholder="Wat klopt er niet?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button
                  type="button"
                  disabled={melden.isPending || message.trim().length < 3}
                  onClick={() => melden.mutate({ itemId: b.itemId, message: message.trim() })}
                  className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 disabled:opacity-40"
                >
                  Verstuur
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMeldOpen(b.itemId)}
                className="text-[11px] text-white/30 underline decoration-white/20 underline-offset-2 hover:text-white/60"
              >
                Klopt dit niet? Meld het
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
