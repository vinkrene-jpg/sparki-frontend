// AI_COACH §4.2 — Proactieve coach-kaart.
//
// Sparki opent vanuit zichzelf een gesprek op basis van een deterministische
// trigger. Twee acties:
//  - "Reageer op Sparki" → opent de chat-overlay in dezelfde pagina
//  - "Zie de onderbouwing" → toont het adviesdossier inline (§4.3)
//
// Beide acties navigeren NOOIT naar niet-bestaande routes. De chat-overlay
// is ingeborgd met lokale state (patroon uit ride-story.tsx). De dossier-
// weergave haalt de data op via GET /api/ai/dossier/:id en toont hem inline.
//
// Pacing: de server garandeert dat dit nooit tegelijk met de §4.1-
// bevestigingsvraag verschijnt, en hoogstens één keer per dag/episode.

import { useState } from "react"
import { X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { createPortal } from "react-dom"
import { DsButton, DsCard, DsCardTitel, IconChevron } from "@/components/ds"
import { SparkiChatOverlay } from "@/components/sparki/sparki-chat-overlay"
import { useProactiveTrigger, type ProactiveTrigger } from "@/hooks/use-proactive-trigger"
import { apiFetch } from "@/lib/api"

// ── Dossier-types ─────────────────────────────────────────────────────────────

type DossierBasedOn = { kind: string; label: string; value: string; date: string };
type DossierRisk = { risk: string };

type DossierData = {
  id: number;
  title: string;
  adviceText: string;
  confidenceLevel: string;
  basedOn: DossierBasedOn[];
  risks: DossierRisk[];
  whyAlternativeRejected: string;
};

// ── Dossier-panel (inline, via §4.3) ─────────────────────────────────────────

function DossierPanel({ dossierId, onClose }: { dossierId: number; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<DossierData>({
    queryKey: ["ai", "dossier", dossierId],
    queryFn: () => apiFetch<DossierData>(`/api/ai/dossier/${dossierId}`),
    staleTime: Infinity,
    retry: 1,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/70 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Onderbouwing coach-bericht"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground transition hover:text-foreground"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-cyan">
          Onderbouwing · §4.3
        </p>

        {isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Laden…</p>
        )}

        {isError && (
          <p className="mt-4 text-sm text-muted-foreground">
            De onderbouwing kon niet worden geladen.
          </p>
        )}

        {data && (
          <div className="mt-3 space-y-4">
            <h3 className="font-semibold leading-snug text-foreground">{data.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{data.adviceText}</p>

            {data.basedOn.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Gebaseerd op
                </p>
                <ul className="space-y-1">
                  {data.basedOn.map((b, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{b.label}:</span>{" "}
                      {b.value}
                      {b.date && ` (${b.date})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.risks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Begrenzingen
                </p>
                <ul className="space-y-1">
                  {data.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      {r.risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs italic text-muted-foreground/70">
              Zekerheid: {data.confidenceLevel}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Losse weergave-component (voor testen en hergebruik) ─────────────────────

export function ProactiveTriggerCard({ trigger }: { trigger: ProactiveTrigger }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(false);

  return (
    <>
      <DsCard
        className="border-l-4 border-l-[color:var(--accent,#3b82f6)]"
        aria-label={`Coach-bericht: ${trigger.title}`}
      >
        {/* Kleine aanduiding dat Sparki zelf het initiatief neemt */}
        <p className="type-caption mb-2 text-content-tertiary">Coach-bericht van vandaag</p>
        <DsCardTitel>{trigger.title}</DsCardTitel>
        <p className="type-body mt-2 text-content-secondary">{trigger.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <DsButton variant="primair" onClick={() => setChatOpen(true)}>
            Reageer op Sparki
          </DsButton>
          <DsButton variant="tekst" onClick={() => setDossierOpen(true)}>
            Zie de onderbouwing
            <IconChevron aria-hidden="true" />
          </DsButton>
        </div>
      </DsCard>

      {/* Chat-overlay (§4.2 — embedded, niet /ai-route) */}
      <SparkiChatOverlay
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Dossier-panel (§4.3 — inline, ownership-checked door server) */}
      {dossierOpen && (
        <DossierPanel
          dossierId={trigger.dossierId}
          onClose={() => setDossierOpen(false)}
        />
      )}
    </>
  );
}

// ── Samengestelde sectie (laadt zelf de data) ─────────────────────────────────

/**
 * Rendert de proactieve coach-kaart als er een trigger vuurt.
 * Stille null bij fout, laad of geen trigger — nooit een skelet of foutbalk.
 */
export function ProactiveTriggerSection() {
  const { data, isLoading, isError } = useProactiveTrigger();

  if (isLoading || isError || !data?.trigger) return null;

  return (
    <section
      aria-label="Coach-bericht van Sparki"
      className="mx-auto w-full max-w-screen-xl px-5 pt-4 lg:px-10"
    >
      <ProactiveTriggerCard trigger={data.trigger} />
    </section>
  );
}
