// Golf 14 — blokkeerscherm bij een verouderde appversie (server antwoordt 426).
// Web: de nieuwste versie staat al klaar op de server, dus verversen volstaat.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VERSION_BLOCKED_EVENT, getVersionBlockMessage } from "@/lib/api";

export function VersionBlockScreen() {
  // Init vanuit de vergrendelde module-state: ook als de 426 al binnenkwam
  // vóórdat dit scherm gemount was, neemt het de blokkade over.
  const [message, setMessage] = useState<string | null>(getVersionBlockMessage);

  useEffect(() => {
    const onBlocked = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(
        detail?.message ??
          "Deze versie van Sparki is verouderd. Ververs de pagina om verder te gaan.",
      );
    };
    window.addEventListener(VERSION_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(VERSION_BLOCKED_EVENT, onBlocked);
  }, []);

  if (!message) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-card p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
        <div className="text-lg font-semibold text-foreground">
          Nieuwe versie nodig
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl bg-accent-cyan px-4 py-3 text-sm font-semibold text-[color:var(--color-on-accent)]"
        >
          Vernieuw de app
        </button>
      </div>
    </div>,
    document.body,
  );
}
