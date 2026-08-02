import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  Send,
  LifeBuoy,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { ScreenShell } from "@/components/sparki/screen-shell";
import {
  useAskHelpdesk,
  useHelpdeskFeedback,
  useMyTickets,
  useTicketDetail,
  useSendTicketMessage,
  useSupportArticles,
  type HelpdeskAnswer,
} from "@/hooks/use-support";

// ── Golf 27 — Help & support ────────────────────────────────────────────────
// Eén ingang: stel je vraag, Sparki antwoordt uitsluitend op basis van de
// beheerde kennisbank; wat niet betrouwbaar te beantwoorden is gaat eerlijk
// naar een medewerker (supportticket). Hieronder: eigen tickets + artikelen.

const STATUS_LABEL: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  wacht_op_gebruiker: "Reactie ontvangen",
  opgelost: "Opgelost",
  gesloten: "Gesloten",
  heropend: "Heropend",
  samengevoegd: "Samengevoegd",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnswerCard({ a }: { a: HelpdeskAnswer }) {
  const feedback = useHelpdeskFeedback();
  const [given, setGiven] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent-cyan">
          {a.categoryLabel}
        </span>
        {a.knownIssue && (
          <span className="rounded-full border border-orange-300/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--color-warning)]">
            Bekende storing
          </span>
        )}
      </div>
      {a.answer && (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
          {a.answer}
        </p>
      )}
      {a.sources.length > 0 && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          Bron: {a.sources.map((s) => s.title).join(" · ")}
        </p>
      )}
      {a.ticketId && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {a.ticketAttached
            ? "Je vraag is toegevoegd aan een bestaand supportticket."
            : "Er is een supportticket aangemaakt."}{" "}
          Je vindt het hieronder bij "Mijn supportvragen".
        </p>
      )}
      {given ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Bedankt voor je beoordeling.
          {given !== "opgelost" && " Een medewerker kijkt mee."}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              feedback.mutate({ turnId: a.turnId, feedback: "opgelost" });
              setGiven("opgelost");
            }}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            Dit hielp
          </button>
          <button
            type="button"
            onClick={() => {
              feedback.mutate({ turnId: a.turnId, feedback: "niet_geholpen" });
              setGiven("niet_geholpen");
            }}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-orange-300/40 hover:text-[color:var(--color-warning)]"
          >
            <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            Niet geholpen
          </button>
        </div>
      )}
    </div>
  );
}

function TicketThread({ id, onBack }: { id: number; onBack: () => void }) {
  const { data } = useTicketDetail(id);
  const send = useSendTicketMessage();
  const [msg, setMsg] = useState("");
  if (!data) return <p className="text-[12px] text-muted-foreground">Laden…</p>;
  const { ticket, messages } = data;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-accent-cyan"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Terug naar overzicht
      </button>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground/90">{ticket.summary}</p>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          {STATUS_LABEL[ticket.status] ?? ticket.status}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-3 ${
              m.authorRole === "beheerder"
                ? "border-accent-cyan/20 bg-accent-cyan/[0.04]"
                : "border-border bg-muted"
            }`}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {m.authorRole === "beheerder" ? "Sparki-support" : "Jij"} ·{" "}
              {fmtWhen(m.sentAt ?? m.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">
              {m.body}
            </p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-[12px] text-muted-foreground">Nog geen berichten.</p>
        )}
      </div>
      {ticket.status !== "samengevoegd" && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = msg.trim();
            if (!body) return;
            send.mutate({ ticketId: id, body });
            setMsg("");
          }}
        >
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Schrijf een reactie…"
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:border-accent-cyan/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={send.isPending}
            className="rounded-full border border-accent-cyan/40 p-2 text-accent-cyan transition-colors hover:bg-accent-cyan/10 disabled:opacity-40"
            aria-label="Versturen"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
      )}
    </div>
  );
}

export default function SupportPage() {
  const ask = useAskHelpdesk();
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<HelpdeskAnswer[]>([]);
  const tickets = useMyTickets();
  const [openTicket, setOpenTicket] = useState<number | null>(null);
  const [articleQuery, setArticleQuery] = useState("");
  const articles = useSupportArticles(articleQuery.trim());
  const [openArticle, setOpenArticle] = useState<number | null>(null);

  return (
    <ScreenShell bg={null} section="you" terug={false}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <Link
          href="/you"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-accent-cyan"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Terug
        </Link>
        <div className="mt-3 flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 text-accent-cyan" strokeWidth={1.5} />
          <h1 className="font-sans text-2xl font-extralight text-foreground/95">
            Hulp &amp; ondersteuning
          </h1>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          Stel je vraag. Je krijgt antwoord op basis van de beheerde kennisbank;
          wat niet betrouwbaar te beantwoorden is, gaat naar een medewerker.
        </p>

        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = question.trim();
            if (q.length < 3 || ask.isPending) return;
            ask.mutate(
              { question: q },
              { onSuccess: (a) => setAnswers((prev) => [a, ...prev]) },
            );
            setQuestion("");
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Waar kan ik je bij helpen?"
            className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-[14px] text-foreground/90 placeholder:text-muted-foreground backdrop-blur-md focus:border-accent-cyan/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={ask.isPending}
            className="rounded-full border border-accent-cyan/40 p-2.5 text-accent-cyan transition-colors hover:bg-accent-cyan/10 disabled:opacity-40"
            aria-label="Vraag stellen"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
        {ask.isPending && (
          <p className="mt-3 text-[12px] text-muted-foreground">Bezig met uitzoeken…</p>
        )}
        {ask.isError && (
          <p className="mt-3 text-[12px] text-[color:var(--color-warning)]">
            De helpdesk is nu niet bereikbaar. Probeer het straks opnieuw.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {answers.map((a) => (
            <AnswerCard key={a.turnId} a={a} />
          ))}
        </div>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Mijn supportvragen
            </p>
          </div>
          <div className="mt-3">
            {openTicket != null ? (
              <TicketThread id={openTicket} onBack={() => setOpenTicket(null)} />
            ) : (tickets.data?.tickets ?? []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Je hebt nog geen supportvragen.
              </p>
            ) : (
              <div className="space-y-2">
                {(tickets.data?.tickets ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenTicket(t.id)}
                    className="block w-full rounded-xl border border-border bg-card p-3 text-left backdrop-blur-md transition hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] text-foreground/85">
                        {t.summary}
                      </span>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      {fmtWhen(t.updatedAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Kennisbank
            </p>
          </div>
          <input
            value={articleQuery}
            onChange={(e) => setArticleQuery(e.target.value)}
            placeholder="Zoek in de kennisbank…"
            className="mt-3 w-full rounded-full border border-border bg-transparent px-4 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:border-accent-cyan/50 focus:outline-none"
          />
          <div className="mt-3 space-y-2">
            {(articles.data?.articles ?? []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                {articleQuery.trim()
                  ? "Geen artikelen gevonden voor deze zoekopdracht."
                  : "Er zijn nog geen gepubliceerde artikelen."}
              </p>
            ) : (
              (articles.data?.articles ?? []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-card backdrop-blur-md"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenArticle(openArticle === a.id ? null : a.id)
                    }
                    className="block w-full p-3 text-left"
                  >
                    <span className="text-[13px] text-foreground/85">{a.title}</span>
                  </button>
                  {openArticle === a.id && (
                    <p className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-relaxed text-muted-foreground">
                      {a.body}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}
