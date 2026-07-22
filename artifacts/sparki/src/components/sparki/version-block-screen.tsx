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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070e]/95 p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#070d16]/[0.92] p-6 text-center backdrop-blur-md">
        <div className="text-lg font-semibold text-white">
          Nieuwe versie nodig
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl bg-[oklch(0.82_0.16_200)] px-4 py-3 text-sm font-semibold text-[#05070e]"
        >
          Vernieuw de app
        </button>
      </div>
    </div>,
    document.body,
  );
}
