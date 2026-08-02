import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ACCENT } from "@/components/sparki/ui";

// ── Golf 27 — Supportbeheer (beheerders) ────────────────────────────────────
// Wachtrij → ticketdetail (berichten, interne notities, AI-concept dat een
// mens ALTIJD controleert en verzendt) → bekende storingen → kennisartikelen.

type AdminTicket = {
  id: number;
  clerkId: string;
  displayName: string | null;
  summary: string;
  category: string;
  status: string;
  priority: string;
  assignee: string | null;
  humanRequiredReason: string | null;
  errorGroupId: number | null;
  knownIssueId: number | null;
  appVersion: string | null;
  updatedAt: string;
};

type AdminMessage = {
  id: number;
  authorRole: string;
  body: string;
  internal: boolean;
  isDraft: boolean;
  sentAt: string | null;
  createdAt: string;
};

type KnownIssue = {
  id: number;
  title: string;
  description: string;
  status: string;
  releaseVersion: string | null;
  createdAt: string;
};

type AdminArticle = {
  id: number;
  title: string;
  body: string;
  category: string;
  status: string;
  version: number;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  wacht_op_gebruiker: "Wacht op gebruiker",
  opgelost: "Opgelost",
  gesloten: "Gesloten",
  heropend: "Heropend",
  samengevoegd: "Samengevoegd",
};

const HUMAN_REASON_LABEL: Record<string, string> = {
  privacy: "Privacy",
  betaling: "Betaling",
  accountverwijdering: "Accountverwijdering",
  gezondheid_veiligheid: "Gezondheid & veiligheid",
  klacht_juridisch: "Klacht / juridisch",
  minderjarig: "Minderjarige",
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputCls =
  "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:border-accent-cyan focus:outline-none";
const btnCls =
  "rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-accent-cyan hover:text-accent-cyan disabled:opacity-40";

function TicketDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["support-admin", "ticket", id],
    queryFn: () =>
      apiFetch<{
        ticket: AdminTicket;
        messages: AdminMessage[];
        humanSendRequired: boolean;
      }>(`/api/support/beheer/tickets/${id}`),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["support-admin"] });
  };
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/support/beheer/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });
  const note = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/support/beheer/tickets/${id}/notitie`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: invalidate,
  });
  const concept = useMutation({
    mutationFn: () =>
      apiFetch<{ draftId: number; body: string }>(
        `/api/support/beheer/tickets/${id}/concept`,
        { method: "POST" },
      ),
    onSuccess: (d) => {
      setDraftId(d.draftId);
      setReply(d.body);
      invalidate();
    },
  });
  const send = useMutation({
    mutationFn: (input: { body: string; draftId: number | null; status?: string }) =>
      apiFetch(`/api/support/beheer/tickets/${id}/verzend`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setReply("");
      setDraftId(null);
      invalidate();
    },
  });
  const [reply, setReply] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [mergeInto, setMergeInto] = useState("");
  const merge = useMutation({
    mutationFn: () =>
      apiFetch(`/api/support/beheer/tickets/${id}/samenvoegen`, {
        method: "POST",
        body: JSON.stringify({ intoId: Number(mergeInto) }),
      }),
    onSuccess: () => {
      invalidate();
      onBack();
    },
  });
  const toArticle = useMutation({
    mutationFn: () =>
      apiFetch(`/api/support/beheer/tickets/${id}/naar-artikel`, { method: "POST" }),
    onSuccess: invalidate,
  });

  if (!data) return <p className="text-[12px] text-muted-foreground">Laden…</p>;
  const { ticket, messages, humanSendRequired } = data;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-accent-cyan">
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Terug naar wachtrij
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-foreground/90">
          #{ticket.id} · {ticket.summary}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          {STATUS_LABEL[ticket.status] ?? ticket.status}
        </span>
        {ticket.humanRequiredReason && (
          <span className="rounded-full border border-orange-300/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--color-warning)]">
            Mens verplicht: {HUMAN_REASON_LABEL[ticket.humanRequiredReason] ?? ticket.humanRequiredReason}
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {ticket.displayName ?? "Onbekend"} · {ticket.category} · prioriteit {ticket.priority}
        {ticket.appVersion ? ` · versie ${ticket.appVersion}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {["in_behandeling", "opgelost", "gesloten"].map((s) => (
          <button
            key={s}
            type="button"
            disabled={patch.isPending || ticket.status === s}
            onClick={() => patch.mutate({ status: s })}
            className={btnCls}
          >
            Zet op: {STATUS_LABEL[s]}
          </button>
        ))}
        {["laag", "normaal", "hoog", "urgent"].map((p) => (
          <button
            key={p}
            type="button"
            disabled={patch.isPending || ticket.priority === p}
            onClick={() => patch.mutate({ priority: p })}
            className={btnCls}
          >
            {p}
          </button>
        ))}
        {(ticket.status === "opgelost" || ticket.status === "gesloten") && (
          <button type="button" onClick={() => toArticle.mutate()} disabled={toArticle.isPending} className={btnCls}>
            Maak kennisartikel
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-3 ${
              m.internal
                ? "border-yellow-300/20 bg-yellow-300/[0.03]"
                : m.isDraft
                  ? "border-border border-dashed bg-muted"
                  : m.authorRole === "beheerder"
                    ? "border-accent-cyan bg-accent-cyan"
                    : "border-border bg-muted"
            }`}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {m.authorRole}
              {m.internal ? " · interne notitie" : ""}
              {m.isDraft ? " · concept (niet verzonden)" : ""} · {fmtWhen(m.sentAt ?? m.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{m.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Antwoord aan gebruiker {humanSendRequired && (
            <span style={{ color: "#fdba74" }}>— menselijke afhandeling verplicht</span>
          )}
        </p>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          placeholder="Schrijf zelf, of laat eerst een concept opstellen…"
          className={`mt-2 ${inputCls}`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => concept.mutate()} disabled={concept.isPending} className={btnCls}>
            {concept.isPending ? "Concept wordt opgesteld…" : "Stel concept op"}
          </button>
          <button
            type="button"
            disabled={send.isPending || reply.trim() === ""}
            onClick={() => send.mutate({ body: reply.trim(), draftId })}
            className={btnCls}
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Verzend naar gebruiker
          </button>
          <button
            type="button"
            disabled={send.isPending || reply.trim() === ""}
            onClick={() => send.mutate({ body: reply.trim(), draftId, status: "opgelost" })}
            className={btnCls}
          >
            Verzend en los op
          </button>
        </div>
        {concept.isError && (
          <p className="mt-2 text-[12px] text-[color:var(--color-warning)]">Concept opstellen lukte niet.</p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Interne notitie</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} className={`mt-2 ${inputCls}`} />
          <button
            type="button"
            disabled={note.isPending || noteText.trim() === ""}
            onClick={() => {
              note.mutate(noteText.trim());
              setNoteText("");
            }}
            className={`mt-2 ${btnCls}`}
          >
            Notitie toevoegen
          </button>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Samenvoegen met ticket-nr</p>
          <input value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} placeholder="bijv. 12" className={`mt-2 ${inputCls}`} />
          <button
            type="button"
            disabled={merge.isPending || !Number(mergeInto)}
            onClick={() => merge.mutate()}
            className={`mt-2 ${btnCls}`}
          >
            Voeg samen
          </button>
        </div>
      </div>
    </div>
  );
}

function KnownIssuesPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["support-admin", "issues"],
    queryFn: () => apiFetch<{ issues: KnownIssue[] }>("/api/support/beheer/storingen"),
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/support/beheer/storingen", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["support-admin", "issues"] });
    },
  });
  const resolve = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/support/beheer/storingen/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "opgelost" }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["support-admin", "issues"] }),
  });
  return (
    <div className="mt-3 space-y-2">
      {(data?.issues ?? []).map((i) => (
        <div key={i.id} className="rounded-xl border border-border bg-card p-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-foreground/90">{i.title}</span>
            {i.status === "opgelost" ? (
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--color-positive)]">Opgelost</span>
            ) : (
              <button type="button" onClick={() => resolve.mutate(i.id)} disabled={resolve.isPending} className={btnCls}>
                Markeer opgelost
              </button>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{i.description}</p>
        </div>
      ))}
      {(data?.issues ?? []).length === 0 && (
        <p className="text-[12px] text-muted-foreground">Geen bekende storingen geregistreerd.</p>
      )}
      <div className="rounded-xl border border-border p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel van de storing" className={inputCls} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Omschrijving (wat merkt de gebruiker?)"
          className={`mt-2 ${inputCls}`}
        />
        <button
          type="button"
          disabled={create.isPending || !title.trim() || !description.trim()}
          onClick={() => create.mutate()}
          className={`mt-2 ${btnCls}`}
        >
          Storing registreren
        </button>
      </div>
    </div>
  );
}

function ArticlesPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["support-admin", "articles"],
    queryFn: () => apiFetch<{ articles: AdminArticle[] }>("/api/support/beheer/artikelen"),
  });
  const [editing, setEditing] = useState<AdminArticle | null>(null);
  const [body, setBody] = useState("");
  const save = useMutation({
    mutationFn: (a: AdminArticle) =>
      apiFetch(`/api/support/beheer/artikelen/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["support-admin", "articles"] });
    },
  });
  const publish = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/support/beheer/artikelen/${id}/publiceer`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["support-admin", "articles"] }),
  });
  return (
    <div className="mt-3 space-y-2">
      {(data?.articles ?? []).map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-foreground/90">{a.title}</span>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {a.status} · v{a.version}
            </span>
          </div>
          {editing?.id === a.id ? (
            <>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`mt-2 ${inputCls}`} />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => save.mutate(a)} disabled={save.isPending} className={btnCls}>
                  Opslaan
                </button>
                <button type="button" onClick={() => setEditing(null)} className={btnCls}>
                  Annuleren
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(a);
                  setBody(a.body);
                }}
                className={btnCls}
              >
                Bewerken
              </button>
              <button type="button" onClick={() => publish.mutate(a.id)} disabled={publish.isPending} className={btnCls}>
                {a.status === "gepubliceerd" ? "Opnieuw publiceren" : "Publiceren"}
              </button>
            </div>
          )}
        </div>
      ))}
      {(data?.articles ?? []).length === 0 && (
        <p className="text-[12px] text-muted-foreground">
          Nog geen kennisartikelen. Maak er een vanuit een opgelost ticket.
        </p>
      )}
    </div>
  );
}

export function SupportAdminSection() {
  const [statusFilter, setStatusFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["support-admin", "tickets", statusFilter],
    queryFn: () =>
      apiFetch<{ tickets: AdminTicket[] }>(
        `/api/support/beheer/tickets${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
  });
  const { data: groups } = useQuery({
    queryKey: ["support-admin", "groups"],
    queryFn: () =>
      apiFetch<{
        groups: Array<{
          errorGroupId: number | null;
          knownIssueId: number | null;
          category: string;
          ticketCount: number;
          userCount: number;
          appVersions: string[] | null;
          error: { message: string; severity: string } | null;
        }>;
      }>("/api/support/beheer/groepen"),
  });

  return (
    <section className="mt-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Support &amp; helpdesk
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Supportvragen van gebruikers. AI stelt hoogstens een concept op — een
        mens controleert en verzendt ieder antwoord.
      </p>

      {openId != null ? (
        <div className="mt-3">
          <TicketDetail id={openId} onBack={() => setOpenId(null)} />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {["", "nieuw", "in_behandeling", "wacht_op_gebruiker", "heropend", "opgelost"].map((s) => (
              <button
                key={s || "alle"}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={btnCls}
                style={statusFilter === s ? { borderColor: ACCENT, color: ACCENT } : undefined}
              >
                {s === "" ? "Alle" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {(data?.tickets ?? []).length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Geen tickets in deze weergave.</p>
            ) : (
              (data?.tickets ?? []).slice(0, 25).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="block w-full rounded-xl border border-border bg-card p-3 text-left backdrop-blur-md transition hover:border-border"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] text-foreground/90">
                      #{t.id} · {t.summary}
                    </span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                    {t.displayName ?? "Onbekend"} · {t.category} · {t.priority}
                    {t.humanRequiredReason ? " · MENS VERPLICHT" : ""} · {fmtWhen(t.updatedAt)}
                  </p>
                </button>
              ))
            )}
          </div>

          {(groups?.groups ?? []).length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Terugkerende problemen
              </p>
              <div className="mt-2 space-y-2">
                {(groups?.groups ?? []).slice(0, 8).map((g, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-card p-3 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[12px] text-muted-foreground">
                        {g.error?.message ?? `Categorie ${g.category}`}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {g.ticketCount} tickets · {g.userCount} gebruikers
                      </span>
                    </div>
                    {g.appVersions && g.appVersions.length > 0 && (
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        Versies: {g.appVersions.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Bekende storingen</p>
            <KnownIssuesPanel />
          </div>
          <div className="mt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Kennisartikelen</p>
            <ArticlesPanel />
          </div>
        </>
      )}
    </section>
  );
}
