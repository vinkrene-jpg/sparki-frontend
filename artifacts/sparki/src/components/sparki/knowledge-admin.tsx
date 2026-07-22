// Golf 21 — Kennisbank-beheer (alleen beheerders, sectie op /admin).
// Beheerde kennisitems: concept → actief (publiceren = versie omhoog) →
// verouderd/ingetrokken. Toont conflicten, verouderingssignaal, gebruik per
// engine en foutmeldingen van gebruikers.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const ACCENT = "#22d3ee";

type Item = {
  id: number;
  topic: string;
  domain: string;
  discipline: string | null;
  audience: string;
  body: string;
  limitations: string | null;
  professionalCheck: string | null;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  version: number;
  reliability: string;
  status: string;
  statusReason: string | null;
  updatedAt: string;
};

type Overview = {
  items: Item[];
  conflicts: { topic: string; domain: string; items: { id: number; sourceName: string; reliability: string }[] }[];
  stale: { id: number; topic: string; reviewedAt: string | null; daysSinceReview: number | null }[];
  usage: { engine: string; itemId: number; topic: string; uses: number; lastUsedAt: string | null }[];
  feedback: { id: number; itemId: number; message: string; status: string; createdAt: string }[];
};

const DOMAINS = ["training", "herstel", "voeding", "materiaal", "wedstrijd", "veiligheid"];
const RELIABILITIES = ["hoog", "gemiddeld", "laag"];
const AUDIENCES = ["iedereen", "sporter", "jeugd", "coach", "ouder"];

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  actief: "Actief",
  verouderd: "Verouderd",
  ingetrokken: "Ingetrokken",
};
const STATUS_COLOR: Record<string, string> = {
  concept: "text-white/50",
  actief: "text-emerald-300",
  verouderd: "text-amber-300",
  ingetrokken: "text-red-300",
};

const EMPTY_FORM = {
  topic: "",
  domain: "training",
  discipline: "",
  audience: "iedereen",
  body: "",
  limitations: "",
  professionalCheck: "",
  sourceName: "",
  sourceUrl: "",
  publishedAt: "",
  reviewedAt: "",
  reliability: "gemiddeld",
};

export function KennisbankAdminSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["knowledge-beheer"],
    queryFn: () => apiFetch<Overview>("/api/knowledge-beheer"),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["knowledge-beheer"] });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(editId == null ? "/api/knowledge-beheer/items" : `/api/knowledge-beheer/items/${editId}`, {
        method: editId == null ? "POST" : "PUT",
        body: JSON.stringify({
          ...form,
          discipline: form.discipline || null,
          limitations: form.limitations || null,
          professionalCheck: form.professionalCheck || null,
          sourceUrl: form.sourceUrl || null,
          publishedAt: form.publishedAt || null,
          reviewedAt: form.reviewedAt || null,
        }),
      }),
    onSuccess: () => {
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const publish = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/knowledge-beheer/items/${id}/publiceer`, { method: "POST" }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const setStatus = useMutation({
    mutationFn: (input: { id: number; status: string; reason?: string }) =>
      apiFetch(`/api/knowledge-beheer/items/${input.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: input.status, reason: input.reason }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });
  const resolveFeedback = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/knowledge-beheer/feedback/${id}/afhandelen`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const data = overview.data;
  const openFeedback = (data?.feedback ?? []).filter((f) => f.status === "open");

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3 text-left backdrop-blur-md"
      >
        <div>
          <h2 className="text-[15px] font-light text-white/90">Kennisbank</h2>
          <p className="mt-0.5 text-[12px] text-white/40">
            Beheerde vakkennis: bronnen, versies, status en gebruik
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          {open ? "Sluiten" : `${data?.items.length ?? 0} items${openFeedback.length > 0 ? ` · ${openFeedback.length} melding(en)` : ""}`}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {error && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {error}
            </p>
          )}

          {(data?.conflicts.length ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3">
              <p className="text-[12px] font-medium text-amber-200">Conflicterende bronnen</p>
              {data!.conflicts.map((c) => (
                <p key={`${c.domain}-${c.topic}`} className="mt-1 text-[12px] text-white/60">
                  „{c.topic}" ({c.domain}): {c.items.map((i) => `#${i.id} ${i.sourceName} (${i.reliability})`).join(" ↔ ")}
                </p>
              ))}
            </div>
          )}

          {(data?.stale.length ?? 0) > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3">
              <p className="text-[12px] font-medium text-white/70">Langer dan een jaar niet gecontroleerd</p>
              {data!.stale.map((s) => (
                <p key={s.id} className="mt-1 text-[12px] text-white/50">
                  #{s.id} {s.topic} — {s.daysSinceReview == null ? "controledatum onbekend" : `${s.daysSinceReview} dagen geleden`}
                </p>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3">
            <p className="text-[12px] font-medium text-white/70">
              {editId == null ? "Nieuw kennisitem (start als concept)" : `Kennisitem #${editId} wijzigen (gaat terug naar concept)`}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                className="col-span-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Onderwerp"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/80"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/80"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>doelgroep: {a}</option>
                ))}
              </select>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Discipline (leeg = alle)"
                value={form.discipline}
                onChange={(e) => setForm({ ...form, discipline: e.target.value })}
              />
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/80"
                value={form.reliability}
                onChange={(e) => setForm({ ...form, reliability: e.target.value })}
              >
                {RELIABILITIES.map((r) => (
                  <option key={r} value={r}>betrouwbaarheid: {r}</option>
                ))}
              </select>
              <textarea
                className="col-span-2 min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Inhoud (de gecontroleerde vaktekst zelf)"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Bronnaam (verplicht)"
                value={form.sourceName}
                onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
              />
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Bron-URL (optioneel)"
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              />
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Publicatiedatum JJJJ-MM-DD"
                value={form.publishedAt}
                onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              />
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Controledatum JJJJ-MM-DD"
                value={form.reviewedAt}
                onChange={(e) => setForm({ ...form, reviewedAt: e.target.value })}
              />
              <input
                className="col-span-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Beperkingen / geldigheid (optioneel)"
                value={form.limitations}
                onChange={(e) => setForm({ ...form, limitations: e.target.value })}
              />
              <input
                className="col-span-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25"
                placeholder="Wanneer professionele controle nodig is (optioneel)"
                value={form.professionalCheck}
                onChange={(e) => setForm({ ...form, professionalCheck: e.target.value })}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                {save.isPending ? "Opslaan…" : editId == null ? "Aanmaken" : "Opslaan"}
              </button>
              {editId != null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm({ ...EMPTY_FORM });
                  }}
                  className="rounded-full border border-white/15 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50"
                >
                  Annuleren
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {(data?.items ?? []).map((item) => {
              const uses = (data?.usage ?? []).filter((u) => u.itemId === item.id);
              const fb = openFeedback.filter((f) => f.itemId === item.id);
              return (
                <div key={item.id} className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] text-white/90">
                        #{item.id} {item.topic}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                          {item.domain}{item.discipline ? ` · ${item.discipline}` : ""} · v{item.version} · {item.reliability}
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-white/45">{item.body}</p>
                      <p className="mt-1 text-[11px] text-white/35">
                        Bron: {item.sourceName}
                        {item.publishedAt ? ` · publicatie ${item.publishedAt}` : ""}
                        {item.reviewedAt ? ` · gecontroleerd ${item.reviewedAt}` : ""}
                      </p>
                      {item.statusReason && (
                        <p className="mt-1 text-[11px] text-amber-200/70">Reden: {item.statusReason}</p>
                      )}
                      {uses.length > 0 && (
                        <p className="mt-1 text-[11px] text-white/35">
                          Gebruik: {uses.map((u) => `${u.engine} (${u.uses}×)`).join(", ")}
                        </p>
                      )}
                      {fb.map((f) => (
                        <p key={f.id} className="mt-1 text-[11px] text-red-200/80">
                          Melding: {f.message}{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => resolveFeedback.mutate(f.id)}
                          >
                            afhandelen
                          </button>
                        </p>
                      ))}
                    </div>
                    <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_COLOR[item.status] ?? "text-white/50"}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.status !== "ingetrokken" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(item.id);
                          setForm({
                            topic: item.topic,
                            domain: item.domain,
                            discipline: item.discipline ?? "",
                            audience: item.audience,
                            body: item.body,
                            limitations: item.limitations ?? "",
                            professionalCheck: item.professionalCheck ?? "",
                            sourceName: item.sourceName,
                            sourceUrl: item.sourceUrl ?? "",
                            publishedAt: item.publishedAt ?? "",
                            reviewedAt: item.reviewedAt ?? "",
                            reliability: item.reliability,
                          });
                        }}
                        className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50"
                      >
                        Wijzig
                      </button>
                    )}
                    {(item.status === "concept" || item.status === "verouderd") && (
                      <button
                        type="button"
                        onClick={() => publish.mutate(item.id)}
                        className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
                        style={{ borderColor: ACCENT, color: ACCENT }}
                      >
                        Publiceer
                      </button>
                    )}
                    {item.status === "actief" && (
                      <button
                        type="button"
                        onClick={() => setStatus.mutate({ id: item.id, status: "verouderd", reason: "Gemarkeerd als verouderd door beheerder" })}
                        className="rounded-full border border-amber-400/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200"
                      >
                        Verouderd
                      </button>
                    )}
                    {item.status !== "ingetrokken" && (
                      <button
                        type="button"
                        onClick={() => setStatus.mutate({ id: item.id, status: "ingetrokken", reason: "Ingetrokken door beheerder" })}
                        className="rounded-full border border-red-400/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-red-200"
                      >
                        Intrekken
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {data && data.items.length === 0 && (
              <p className="text-[12px] text-white/35">
                Nog geen beheerde kennisitems. Voeg hierboven het eerste item toe.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
