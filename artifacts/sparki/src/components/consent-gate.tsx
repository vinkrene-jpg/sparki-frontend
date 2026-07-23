// Verplicht acceptatiescherm voor juridische documenten.
//
// De server (consentGate-middleware) blokkeert persoonlijke functies al
// server-side; dit scherm is de nette voorkant daarvan. Zolang de server zegt
// dat er documenten openstaan, komt een ingelogde gebruiker hier niet omheen.
// Geen enkel vakje staat vooraf aangevinkt; elk document is vóór het aanvinken
// volledig te lezen.

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  useConsentStatus,
  useAcceptLegal,
  useLegalDocument,
  type ConsentDocumentStatus,
  type LegalKind,
} from "@/hooks/use-account";

function DocumentViewer({ kind }: { kind: LegalKind }) {
  const { data, isLoading } = useLegalDocument(kind);
  if (isLoading) {
    return <p className="py-4 text-sm text-white/50">Document wordt geladen…</p>;
  }
  if (!data) {
    return (
      <p className="py-4 text-sm text-red-300/80">
        Document kon niet geladen worden. Probeer opnieuw.
      </p>
    );
  }
  return (
    <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/70 whitespace-pre-wrap">
      {data.bodyMd}
    </div>
  );
}

function DocumentRow({
  doc,
  checked,
  onToggle,
}: {
  doc: ConsentDocumentStatus;
  checked: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={`consent-${doc.kind}`}
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-5 w-5 shrink-0 accent-[oklch(0.82_0.16_200)]"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`consent-${doc.kind}`}
            className="block cursor-pointer text-sm font-semibold text-white/90"
          >
            Ik heb de {doc.title.toLowerCase()} (versie {doc.requiredVersion})
            gelezen en ga akkoord.
          </label>
          {doc.acceptedVersion && doc.acceptedVersion !== doc.requiredVersion ? (
            <p className="mt-1 text-xs text-amber-300/80">
              Er is een nieuwe versie. Je eerdere akkoord gold voor versie{" "}
              {doc.acceptedVersion}.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[oklch(0.82_0.16_200)] hover:brightness-110"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {open ? "Document sluiten" : "Volledig document lezen"}
          </button>
          {open ? <DocumentViewer kind={doc.kind} /> : null}
        </div>
      </div>
    </div>
  );
}

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error, refetch } = useConsentStatus();
  const accept = useAcceptLegal();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="min-h-dvh bg-[#040506]" />;
  }
  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#040506] px-6 text-center">
        <p className="text-sm text-white/70">
          De acceptatiestatus kon niet worden geladen.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full bg-[oklch(0.82_0.16_200)] px-6 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }
  if (data.complete) return <>{children}</>;

  const missing = data.documents.filter((d) => !d.accepted);
  const allChecked = missing.every((d) => checked[d.kind]);

  const onSubmit = async () => {
    setSubmitError(null);
    try {
      for (const doc of missing) {
        await accept.mutateAsync(doc.kind);
      }
      await refetch();
    } catch {
      setSubmitError(
        "Je akkoord kon niet worden vastgelegd. Controleer je verbinding en probeer opnieuw.",
      );
    }
  };

  return (
    <div className="min-h-dvh bg-[#040506] px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-xl font-semibold text-white">
          Eerst even akkoord
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Voordat je Sparki kunt gebruiken, vragen we je akkoord op de
          onderstaande documenten. Lees ze rustig door — zonder akkoord blijven
          persoonlijke functies gesloten.
        </p>
        <div className="mt-6 space-y-3">
          {missing.map((doc) => (
            <DocumentRow
              key={doc.kind}
              doc={doc}
              checked={!!checked[doc.kind]}
              onToggle={() =>
                setChecked((prev) => ({ ...prev, [doc.kind]: !prev[doc.kind] }))
              }
            />
          ))}
        </div>
        {submitError ? (
          <p className="mt-4 text-sm text-red-300/80">{submitError}</p>
        ) : null}
        <button
          type="button"
          disabled={!allChecked || accept.isPending}
          onClick={() => void onSubmit()}
          className="mt-6 w-full rounded-full bg-[oklch(0.82_0.16_200)] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {accept.isPending ? "Bezig…" : "Akkoord en verder"}
        </button>
        <p className="mt-3 text-center text-xs text-white/40">
          Je akkoord wordt vastgelegd met versie en datum. Bij een nieuwe versie
          vragen we opnieuw je akkoord.
        </p>
      </div>
    </div>
  );
}
