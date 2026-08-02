// Golf 14 — beheer van releases: beheerbord, kill switches, versievereisten,
// pilotbeheer (gebruikers/clubs per releasegroep), foutgroepen, uitrolbewaking,
// releaseberichten en rollback-registratie. Alles praat rechtstreeks met
// /api/release/admin/* — geen verzonnen data; lege staten zijn eerlijk.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ACCENT } from "@/components/sparki/ui";
import { formatWhen } from "@/lib/health-status";

const RELEASE_GROUPS = ["intern", "test", "pilot", "productie"] as const;
const GROUP_LABEL: Record<string, string> = {
  intern: "Intern",
  test: "Test",
  pilot: "Pilot",
  productie: "Productie",
};

type KillSwitch = {
  key: string;
  label: string;
  active: boolean;
  reason: string | null;
  updatedAt?: string | null;
};
type VersionReq = {
  platform: string;
  minVersion: string;
  message: string | null;
  updatedAt: string | null;
};
type Guard = {
  flagKey: string;
  errorThreshold: number;
  windowMinutes: number;
  active: boolean;
  lastTrippedAt: string | null;
};
type ErrorGroup = {
  id: number;
  fingerprint: string;
  message: string;
  severity: string;
  platform: string | null;
  screen: string | null;
  count: number;
  affectedUsers?: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};
type ErrorEvent = {
  id: number;
  at: string;
  appVersion: string | null;
  releaseGroup: string | null;
  screen: string | null;
  stack: string | null;
};
type AdminUser = {
  clerkId: string;
  displayName: string | null;
  email: string | null;
  releaseGroup: string;
  roles: string[];
};
type AdminClub = { id: number; name: string; releaseGroup: string };
type AdminNote = {
  id: number;
  title: string;
  body: string;
  releaseGroups: string[];
  platforms: string[];
  publishedAt: string | null;
  createdAt: string;
};
type Operations = {
  killSwitches: KillSwitch[];
  versions: VersionReq[];
  guards: Guard[];
  releaseGroupCounts: { group: string; users: number }[];
  openErrorGroups: ErrorGroup[];
  criticalEvents24h: number;
  recentAudit: { id: number; event: string; at: string; meta: Record<string, unknown> | null }[];
  latestNotes: AdminNote[];
};

const K = {
  ops: ["release", "admin", "operations"] as const,
  switches: ["release", "admin", "kill-switches"] as const,
  versions: ["release", "admin", "versions"] as const,
  users: (q: string, g: string) => ["release", "admin", "users", q, g] as const,
  clubs: ["release", "admin", "clubs"] as const,
  errors: ["release", "admin", "errors"] as const,
  errorDetail: (id: number) => ["release", "admin", "errors", id] as const,
  guards: ["release", "admin", "guards"] as const,
  notes: ["release", "admin", "notes"] as const,
};

const cardCls =
  "rounded-xl border border-border bg-card p-3.5 backdrop-blur-md";
const labelCls =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputCls =
  "rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 placeholder-white/25 outline-none focus:border-accent-cyan";
const btnCls =
  "rounded-lg border border-accent-cyan px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition hover:bg-accent-cyan disabled:opacity-40";

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <p className={labelCls}>{title}</p>
      {sub && <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

function GroupPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (g: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground outline-none"
    >
      {RELEASE_GROUPS.map((g) => (
        <option key={g} value={g}>
          {GROUP_LABEL[g]}
        </option>
      ))}
    </select>
  );
}

// ── Beheerbord ────────────────────────────────────────────────────────────────
function OperationsBoard() {
  const ops = useQuery({
    queryKey: K.ops,
    queryFn: () => apiFetch<Operations>("/api/release/admin/operations"),
    staleTime: 30_000,
  });
  if (ops.isLoading)
    return <p className="text-[12px] text-muted-foreground">Beheerbord laden…</p>;
  if (ops.isError || !ops.data)
    return (
      <p className="text-[12px] text-[color:var(--color-negative)]">
        Het beheerbord kon niet geladen worden.
      </p>
    );
  const d = ops.data;
  const activeSwitches = d.killSwitches.filter((s) => s.active);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {d.releaseGroupCounts.map((c) => (
          <div key={c.group} className={cardCls}>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {GROUP_LABEL[c.group] ?? c.group}
            </p>
            <p className="mt-0.5 font-sans text-lg font-extralight tabular-nums text-muted-foreground">
              {c.users}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={cardCls}>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            Kritieke fouten (24 uur)
          </p>
          <p
            className="mt-0.5 font-sans text-lg font-extralight tabular-nums"
            style={{ color: d.criticalEvents24h > 0 ? "rgb(255,150,130)" : "rgba(255,255,255,0.7)" }}
          >
            {d.criticalEvents24h}
          </p>
        </div>
        <div className={cardCls}>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            Actieve kill switches
          </p>
          <p
            className="mt-0.5 font-sans text-lg font-extralight tabular-nums"
            style={{ color: activeSwitches.length > 0 ? "rgb(255,190,110)" : "rgba(255,255,255,0.7)" }}
          >
            {activeSwitches.length}
          </p>
        </div>
      </div>
      {d.recentAudit.length > 0 && (
        <div className={cardCls}>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            Recente beheeracties
          </p>
          <div className="mt-2 space-y-1.5">
            {d.recentAudit.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-[10px] text-muted-foreground">
                  {a.event.replace(/_/g, " ")}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                  {formatWhen(a.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kill switches ─────────────────────────────────────────────────────────────
function KillSwitches() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: K.switches,
    queryFn: () => apiFetch<{ switches: KillSwitch[] }>("/api/release/admin/kill-switches"),
  });
  const toggle = useMutation({
    mutationFn: (input: { key: string; active: boolean; reason?: string }) =>
      apiFetch(`/api/release/admin/kill-switches/${input.key}`, {
        method: "PUT",
        body: JSON.stringify({ active: input.active, reason: input.reason }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.switches });
      void qc.invalidateQueries({ queryKey: K.ops });
    },
  });
  if (list.isLoading) return <p className="text-[12px] text-muted-foreground">Laden…</p>;
  return (
    <div className="space-y-2">
      {(list.data?.switches ?? []).map((s) => (
        <div key={s.key} className={`${cardCls} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground/90">{s.label}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {s.key}
              {s.active && s.reason ? ` · ${s.reason}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => {
              if (!s.active) {
                const reason = window.prompt(
                  "Waarom wordt dit onderdeel uitgeschakeld? (zichtbaar in het auditlog)",
                );
                if (reason == null) return;
                toggle.mutate({ key: s.key, active: true, reason });
              } else {
                toggle.mutate({ key: s.key, active: false });
              }
            }}
            className="shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40"
            style={
              s.active
                ? { borderColor: "rgba(255,140,120,0.5)", color: "rgb(255,150,130)", background: "rgba(255,140,120,0.08)" }
                : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }
            }
          >
            {s.active ? "Uitgeschakeld — zet aan" : "Actief — schakel uit"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Versievereisten ───────────────────────────────────────────────────────────
function Versions() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: K.versions,
    queryFn: () => apiFetch<{ versions: VersionReq[] }>("/api/release/admin/versions"),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (input: { platform: string; minVersion: string }) =>
      apiFetch(`/api/release/admin/versions/${input.platform}`, {
        method: "PUT",
        body: JSON.stringify({ minVersion: input.minVersion }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: K.versions }),
  });
  const platforms = ["web", "mobiel"];
  const rows = platforms.map((p) => ({
    platform: p,
    current: list.data?.versions.find((v) => v.platform === p) ?? null,
  }));
  return (
    <div className="space-y-2">
      {rows.map(({ platform, current }) => (
        <div key={platform} className={`${cardCls} flex flex-wrap items-center gap-3`}>
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {platform}
          </span>
          <span className="text-[12px] text-muted-foreground">
            Minimaal: {current?.minVersion ?? "geen eis"}
          </span>
          <input
            className={`${inputCls} w-28`}
            placeholder="bijv. 1.2.0"
            value={drafts[platform] ?? ""}
            onChange={(e) => setDrafts((d) => ({ ...d, [platform]: e.target.value }))}
          />
          <button
            type="button"
            className={btnCls}
            disabled={save.isPending || !(drafts[platform] ?? "").trim()}
            onClick={() =>
              save.mutate({ platform, minVersion: (drafts[platform] ?? "").trim() })
            }
          >
            Opslaan
          </button>
        </div>
      ))}
      {save.isError && (
        <p className="text-[12px] text-[color:var(--color-negative)]">
          {save.error instanceof Error ? save.error.message : "Opslaan mislukt."}
        </p>
      )}
    </div>
  );
}

// ── Pilotbeheer ───────────────────────────────────────────────────────────────
function PilotManagement() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const users = useQuery({
    queryKey: K.users(q, groupFilter),
    queryFn: () =>
      apiFetch<{ users: AdminUser[] }>(
        `/api/release/admin/users?q=${encodeURIComponent(q)}&group=${encodeURIComponent(groupFilter)}`,
      ),
  });
  const clubs = useQuery({
    queryKey: K.clubs,
    queryFn: () => apiFetch<{ clubs: AdminClub[] }>("/api/release/admin/clubs"),
  });
  const setUserGroup = useMutation({
    mutationFn: (input: { clerkId: string; group: string }) =>
      apiFetch(`/api/release/admin/users/${encodeURIComponent(input.clerkId)}/group`, {
        method: "PUT",
        body: JSON.stringify({ group: input.group }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["release", "admin", "users"] });
      void qc.invalidateQueries({ queryKey: K.ops });
    },
  });
  const setClubGroup = useMutation({
    mutationFn: (input: { id: number; group: string }) =>
      apiFetch(`/api/release/admin/clubs/${input.id}/group`, {
        method: "PUT",
        body: JSON.stringify({ group: input.group }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: K.clubs }),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Zoek op naam of e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground outline-none"
        >
          <option value="">Alle groepen</option>
          {RELEASE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {users.isLoading ? (
          <p className="text-[12px] text-muted-foreground">Gebruikers laden…</p>
        ) : (users.data?.users ?? []).length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Geen gebruikers gevonden.</p>
        ) : (
          (users.data?.users ?? []).slice(0, 25).map((u) => (
            <div key={u.clerkId} className={`${cardCls} flex items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-foreground/90">
                  {u.displayName ?? u.email ?? u.clerkId}
                </p>
                <p className="truncate font-mono text-[9px] text-muted-foreground">
                  {u.email ?? ""} · {u.roles.join(", ")}
                </p>
              </div>
              <GroupPicker
                value={u.releaseGroup}
                disabled={setUserGroup.isPending}
                onChange={(g) => setUserGroup.mutate({ clerkId: u.clerkId, group: g })}
              />
            </div>
          ))
        )}
      </div>
      {(clubs.data?.clubs ?? []).length > 0 && (
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Clubs
          </p>
          <div className="mt-2 space-y-2">
            {(clubs.data?.clubs ?? []).map((c) => (
              <div key={c.id} className={`${cardCls} flex items-center justify-between gap-3`}>
                <p className="truncate text-[13px] text-foreground/90">{c.name}</p>
                <GroupPicker
                  value={c.releaseGroup}
                  disabled={setClubGroup.isPending}
                  onChange={(g) => setClubGroup.mutate({ id: c.id, group: g })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Foutgroepen ───────────────────────────────────────────────────────────────
function ErrorGroups() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useQuery({
    queryKey: K.errors,
    queryFn: () => apiFetch<{ groups: ErrorGroup[] }>("/api/release/admin/errors"),
  });
  const detail = useQuery({
    queryKey: K.errorDetail(openId ?? 0),
    queryFn: () =>
      apiFetch<{ group: ErrorGroup; events: ErrorEvent[] }>(
        `/api/release/admin/errors/${openId}`,
      ),
    enabled: openId != null,
  });
  const resolve = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/release/admin/errors/${id}/resolve`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: K.errors });
      void qc.invalidateQueries({ queryKey: K.ops });
      setOpenId(null);
    },
  });
  if (list.isLoading) return <p className="text-[12px] text-muted-foreground">Laden…</p>;
  const groups = list.data?.groups ?? [];
  if (groups.length === 0)
    return <p className="text-[12px] text-muted-foreground">Nog geen fouten geregistreerd.</p>;
  return (
    <div className="space-y-2">
      {groups.slice(0, 20).map((g) => (
        <div key={g.id} className={cardCls}>
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => setOpenId(openId === g.id ? null : g.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">
                {g.message}
              </p>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                style={
                  g.resolvedAt
                    ? { color: "rgb(140,220,170)", background: "rgba(140,220,170,0.1)" }
                    : g.severity === "kritiek"
                      ? { color: "rgb(255,150,130)", background: "rgba(255,140,120,0.1)" }
                      : { color: "rgb(255,200,120)", background: "rgba(255,190,110,0.1)" }
                }
              >
                {g.resolvedAt ? "Opgelost" : g.severity}
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {g.count}× · {g.affectedUsers ?? 0} gebruikers · {g.platform ?? "?"} ·{" "}
              {g.screen ?? "onbekend scherm"} · laatst {formatWhen(g.lastSeenAt)}
            </p>
          </button>
          {openId === g.id && (
            <div className="mt-3 border-t border-border pt-3">
              {detail.isLoading ? (
                <p className="text-[12px] text-muted-foreground">Details laden…</p>
              ) : (
                <>
                  {(detail.data?.events ?? []).slice(0, 5).map((e) => (
                    <div key={e.id} className="mb-2">
                      <p className="font-mono text-[9px] text-muted-foreground">
                        {formatWhen(e.at)} · versie {e.appVersion ?? "?"} · groep{" "}
                        {e.releaseGroup ?? "?"}
                      </p>
                      {e.stack && (
                        <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 font-mono text-[9px] leading-snug text-muted-foreground">
                          {e.stack}
                        </pre>
                      )}
                    </div>
                  ))}
                  {!g.resolvedAt && (
                    <button
                      type="button"
                      className={btnCls}
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate(g.id)}
                    >
                      Markeer als opgelost
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Uitrolbewaking ────────────────────────────────────────────────────────────
function RolloutGuards() {
  const list = useQuery({
    queryKey: K.guards,
    queryFn: () => apiFetch<{ guards: Guard[] }>("/api/release/admin/guards"),
  });
  if (list.isLoading) return <p className="text-[12px] text-muted-foreground">Laden…</p>;
  const guards = list.data?.guards ?? [];
  if (guards.length === 0)
    return (
      <p className="text-[12px] text-muted-foreground">
        Nog geen uitrolbewaking ingesteld. Een bewaking stopt een uitrol
        automatisch wanneer te veel kritieke fouten binnenkomen.
      </p>
    );
  return (
    <div className="space-y-2">
      {guards.map((g) => (
        <div key={g.flagKey} className={`${cardCls} flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="text-[13px] text-foreground/90">{g.flagKey}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              Stop bij {g.errorThreshold} kritieke fouten in {g.windowMinutes} min
              {g.lastTrippedAt ? ` · laatst gestopt ${formatWhen(g.lastTrippedAt)}` : ""}
            </p>
          </div>
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: g.active ? "rgb(140,220,170)" : "rgba(255,255,255,0.3)" }}
          >
            {g.active ? "Actief" : "Uit"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Releaseberichten (beheer) ────────────────────────────────────────────────
function ReleaseNotesAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: K.notes,
    queryFn: () => apiFetch<{ notes: AdminNote[] }>("/api/release/admin/notes"),
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/release/admin/notes", {
        method: "POST",
        body: JSON.stringify({ title, body, publish: true }),
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      void qc.invalidateQueries({ queryKey: K.notes });
    },
  });
  const publish = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/release/admin/notes/${id}/publish`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: K.notes }),
  });
  return (
    <div className="space-y-3">
      <div className={cardCls}>
        <input
          className={`${inputCls} w-full`}
          placeholder="Titel (bijv. Nieuw: routeplanner verbeterd)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={`${inputCls} mt-2 min-h-[70px] w-full resize-none`}
          placeholder="Korte, rustige uitleg voor op Vandaag…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className={`${btnCls} mt-2`}
          disabled={create.isPending || !title.trim() || !body.trim()}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Bezig…" : "Publiceer bericht"}
        </button>
        {create.isError && (
          <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
            {create.error instanceof Error ? create.error.message : "Mislukt."}
          </p>
        )}
      </div>
      {(list.data?.notes ?? []).slice(0, 8).map((n) => (
        <div key={n.id} className={`${cardCls} flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <p className="truncate text-[13px] text-foreground/90">{n.title}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {n.publishedAt ? `Gepubliceerd ${formatWhen(n.publishedAt)}` : "Concept"}
            </p>
          </div>
          {!n.publishedAt && (
            <button
              type="button"
              className={btnCls}
              disabled={publish.isPending}
              onClick={() => publish.mutate(n.id)}
            >
              Publiceer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Rollback-registratie ─────────────────────────────────────────────────────
function RollbackLog() {
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);
  const record = useMutation({
    mutationFn: () =>
      apiFetch("/api/release/admin/rollback", {
        method: "POST",
        body: JSON.stringify({ description }),
      }),
    onSuccess: () => {
      setDescription("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
  return (
    <div className={cardCls}>
      <p className="text-[12px] leading-snug text-muted-foreground">
        Terugdraaien gebeurt door het vorige, werkende checkpoint opnieuw te
        publiceren. Leg het besluit hier vast zodat de geschiedenis klopt.
      </p>
      <textarea
        className={`${inputCls} mt-2 min-h-[60px] w-full resize-none`}
        placeholder="Wat is teruggedraaid en waarom?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        type="button"
        className={`${btnCls} mt-2`}
        disabled={record.isPending || description.trim().length < 5}
        onClick={() => record.mutate()}
      >
        {record.isPending ? "Bezig…" : "Leg rollback vast"}
      </button>
      {saved && <p className="mt-2 text-[12px]" style={{ color: ACCENT }}>Vastgelegd.</p>}
      {record.isError && (
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
          {record.error instanceof Error ? record.error.message : "Mislukt."}
        </p>
      )}
    </div>
  );
}

const TABS = [
  { key: "board", label: "Beheerbord" },
  { key: "switches", label: "Kill switches" },
  { key: "versions", label: "Versies" },
  { key: "pilot", label: "Pilotbeheer" },
  { key: "errors", label: "Fouten" },
  { key: "guards", label: "Uitrolbewaking" },
  { key: "notes", label: "Releaseberichten" },
  { key: "rollback", label: "Rollback" },
] as const;

export function ReleaseAdminSection() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("board");
  return (
    <section className="mt-8">
      <SectionHead
        title="Releases & uitrol"
        sub="Releasegroepen, kill switches, versievereisten, foutregistratie en gefaseerde uitrol met automatische stop."
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition"
            style={
              tab === t.key
                ? { borderColor: "rgba(120,210,230,0.5)", color: ACCENT, background: "rgba(120,210,230,0.08)" }
                : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "board" && <OperationsBoard />}
        {tab === "switches" && <KillSwitches />}
        {tab === "versions" && <Versions />}
        {tab === "pilot" && <PilotManagement />}
        {tab === "errors" && <ErrorGroups />}
        {tab === "guards" && <RolloutGuards />}
        {tab === "notes" && <ReleaseNotesAdmin />}
        {tab === "rollback" && <RollbackLog />}
      </div>
    </section>
  );
}
