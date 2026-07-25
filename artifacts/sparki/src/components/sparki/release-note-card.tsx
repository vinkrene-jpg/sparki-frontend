// Golf 14 — rustige releasekaart, alleen op Vandaag. Toont het nieuwste
// ongelezen releasebericht (nooit een stapel) en, voor pilotdeelnemers die de
// voorwaarden nog niet bevestigden, één keer de pilotbevestiging. Wegklikken
// markeert het bericht als gelezen; daarna verschijnt het nooit meer.
//
// Aandacht-rotatie: een releasebericht dat een paar dagen genegeerd wordt,
// pauzeert een paar dagen (het blijft ongelezen en komt daarna terug, of het
// volgende ongelezen bericht krijgt de ruimte). De pilotbevestiging rouleert
// bewust NIET — dat is een echte toestemmingsstap, geen nieuwtje.
import { X, Sparkles } from "lucide-react";
import {
  useReleaseNotes,
  useMarkReleaseNoteRead,
  usePilotStatus,
  useAcceptPilotConsent,
} from "@/hooks/use-release";
import {
  useSuppressedAttentionKeys,
  useReportAttentionSeen,
} from "@/hooks/use-attention";

export function ReleaseNoteCard() {
  const notes = useReleaseNotes();
  const markRead = useMarkReleaseNoteRead();
  const pilot = usePilotStatus();
  const acceptConsent = useAcceptPilotConsent();
  const { suppressed, ready: attentionReady } = useSuppressedAttentionKeys();

  const needsConsent =
    pilot.data?.inPilot === true && pilot.data.consentGiven === false;

  const unread = (notes.data?.notes ?? []).filter((n) => !n.read);
  const note = attentionReady
    ? (unread.find((n) => !suppressed.has(`release:${n.id}`)) ?? null)
    : null;

  useReportAttentionSeen(note ? `release:${note.id}` : null);

  if (!needsConsent && !note) return null;

  return (
    <section className="mt-4 space-y-3">
      {needsConsent && (
        <div className="rounded-2xl border border-cyan-300/25 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-white/80">
            Je doet mee aan de proefperiode van Sparki. Nieuwe onderdelen kunnen
            nog veranderen en soms haperen; jouw meldingen helpen om ze goed te
            krijgen.
          </p>
          <button
            type="button"
            onClick={() => acceptConsent.mutate()}
            disabled={acceptConsent.isPending}
            className="mt-3 rounded-lg border border-cyan-300/40 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300 transition hover:bg-cyan-300/10 disabled:opacity-50"
          >
            {acceptConsent.isPending ? "Bezig…" : "Begrepen, ik doe mee"}
          </button>
        </div>
      )}

      {note && (
        <div className="rounded-2xl border border-white/[0.1] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/80" strokeWidth={1.75} />
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-300/60">
                  Nieuw in Sparki
                </span>
                <h3 className="mt-0.5 text-[14px] font-medium text-white/90">
                  {note.title}
                </h3>
                <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-white/60">
                  {note.body}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Gelezen"
              onClick={() => markRead.mutate(note.id)}
              className="rounded-full border border-white/15 p-1 text-white/50 transition hover:border-cyan-300/40 hover:text-cyan-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
