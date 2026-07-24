// Entitlement-fundament — beheer van commerciële rechten, gescheiden van de
// operationele feature-flags. Alles praat rechtstreeks met
// /api/admin/entitlements/* — geen verzonnen data; lege staten zijn eerlijk.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const MODES = ["legacy_unrestricted", "subscription"] as const;
const MODE_LABEL: Record<string, string> = {
  legacy_unrestricted: "Bestaande toegang (onbeperkt)",
  subscription: "Abonnement",
};
const VARIANTS = [
  "sparki_go",
  "sparki_basic",
  "sparki_performance",
  "sparki_pro",
] as const;
const VARIANT_LABEL: Record<string, string> = {
  sparki_go: "Sparki Go",
  sparki_basic: "Sparki Basic",
  sparki_performance: "Sparki Performance",
  sparki_pro: "Sparki Pro",
};
const TYPES = [
  "permanent_addon",
  "temporary_addon",
  "trial",
  "route_content",
  "temporary_package",
] as const;
const TYPE_LABEL: Record<string, string> = {
  base_variant: "Basisvariant",
  permanent_addon: "Permanente uitbreiding",
  temporary_addon: "Tijdelijke uitbreiding",
  trial: "Proefrecht",
  route_content: "Route/content",
  temporary_package: "Tijdelijk pakket",
};

type UserRow = {
  clerk_id: string;
  email: string | null;
  display_name: string | null;
  entitlement_mode: string;
  product_variant: string | null;
};
type EntitlementRow = {
  id: number;
  entitlementKey: string;
  entitlementType: string;
  status: string;
  source: string;
  startsAt: string;
  endsAt: string | null;
};
type Detail = {
  entitlement_mode: string;
  product_variant: string | null;
  commercial_features: Record<string, { source: string; expiresAt: string | null }>;
  entitlements: EntitlementRow[];
};

const cardCls =
  "rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md";
const labelCls =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-white/40";
const inputCls =
  "rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40";
const btnCls =
  "rounded-lg border border-cyan-300/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-300/10 disabled:opacity-40";
const selectCls =
  "rounded-lg border border-white/[0.1] bg-[#070d16] px-2 py-1.5 text-[12px] text-white/85 outline-none focus:border-cyan-300/40";

export function EntitlementsAdminSection() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("legacy_unrestricted");
  const [variant, setVariant] = useState<string>("");
  const [grantKey, setGrantKey] = useState("");
  const [grantType, setGrantType] = useState<string>("permanent_addon");
  const [grantEnds, setGrantEnds] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const usersQ = useQuery({
    queryKey: ["admin", "entitlements", "users", query],
    queryFn: () =>
      apiFetch<{ users: UserRow[] }>(
        `/api/admin/entitlements/users?query=${encodeURIComponent(query)}`,
      ),
  });

  const detailQ = useQuery({
    queryKey: ["admin", "entitlements", "detail", selected],
    enabled: !!selected,
    queryFn: () => apiFetch<Detail>(`/api/admin/entitlements/${selected}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "entitlements"] });
  };

  const modeMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/admin/entitlements/${selected}/mode`, {
        method: "PUT",
        body: JSON.stringify({
          entitlementMode: mode,
          productVariant: variant || null,
        }),
      }),
    onSuccess: () => {
      setMessage("Modus bijgewerkt.");
      refresh();
    },
    onError: (e: Error) => setMessage(e.message || "Wijzigen mislukt."),
  });

  const grantMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/admin/entitlements/${selected}`, {
        method: "POST",
        body: JSON.stringify({
          entitlementKey: grantKey.trim(),
          entitlementType: grantType,
          source: "admin",
          endsAt: grantEnds || null,
        }),
      }),
    onSuccess: () => {
      setMessage("Recht toegekend.");
      setGrantKey("");
      setGrantEnds("");
      refresh();
    },
    onError: (e: Error) => setMessage(e.message || "Toekennen mislukt."),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/admin/entitlements/${selected}/${id}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      setMessage("Recht ingetrokken.");
      refresh();
    },
    onError: (e: Error) => setMessage(e.message || "Intrekken mislukt."),
  });

  const selectUser = (u: UserRow) => {
    setSelected(u.clerk_id);
    setMode(u.entitlement_mode);
    setVariant(u.product_variant ?? "");
    setMessage(null);
  };

  return (
    <div className={cardCls}>
      <p className={labelCls}>Rechtenbeheer (abonnementsfundament)</p>
      <p className="mt-1 text-[12px] leading-snug text-white/40">
        Commerciële rechten staan los van de operationele functieschakelaars.
        Bestaande gebruikers houden hun huidige toegang; de abonnementsmodus is
        pas bruikbaar zodra varianten bewust gevuld worden.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Zoek op e-mail, naam of account-id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {usersQ.isLoading && (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-white/40">
          <Loader2 className="h-3 w-3 animate-spin" /> Bezig…
        </p>
      )}
      {usersQ.data && (
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {usersQ.data.users.length === 0 && (
            <p className="text-[12px] text-white/40">Geen gebruikers gevonden.</p>
          )}
          {usersQ.data.users.map((u) => (
            <button
              key={u.clerk_id}
              onClick={() => selectUser(u)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                selected === u.clerk_id
                  ? "border-cyan-300/40 bg-cyan-300/10 text-white/90"
                  : "border-white/[0.06] text-white/60 hover:bg-white/[0.04]"
              }`}
            >
              <span className="font-medium">
                {u.display_name || u.email || u.clerk_id}
              </span>{" "}
              <span className="text-white/35">
                — {MODE_LABEL[u.entitlement_mode] ?? u.entitlement_mode}
                {u.product_variant
                  ? ` · ${VARIANT_LABEL[u.product_variant] ?? u.product_variant}`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 space-y-4 border-t border-white/[0.08] pt-3">
          <div>
            <p className={labelCls}>Modus en variant</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className={selectCls}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </select>
              <select
                className={selectCls}
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
              >
                <option value="">Geen variant</option>
                {VARIANTS.map((v) => (
                  <option key={v} value={v}>
                    {VARIANT_LABEL[v]}
                  </option>
                ))}
              </select>
              <button
                className={btnCls}
                disabled={modeMut.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Modus wijzigen naar "${MODE_LABEL[mode]}"${
                        variant ? ` met variant ${VARIANT_LABEL[variant]}` : ""
                      }? Dit verandert de commerciële toegang van deze gebruiker.`,
                    )
                  )
                    modeMut.mutate();
                }}
              >
                Opslaan
              </button>
            </div>
          </div>

          <div>
            <p className={labelCls}>Recht toekennen</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} w-44`}
                placeholder="Functiesleutel of content-id"
                value={grantKey}
                onChange={(e) => setGrantKey(e.target.value)}
              />
              <select
                className={selectCls}
                value={grantType}
                onChange={(e) => setGrantType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={selectCls}
                value={grantEnds}
                onChange={(e) => setGrantEnds(e.target.value)}
                title="Einddatum (verplicht bij tijdelijke rechten)"
              />
              <button
                className={btnCls}
                disabled={grantMut.isPending || !grantKey.trim()}
                onClick={() => {
                  if (
                    window.confirm(
                      `Recht "${grantKey.trim()}" (${TYPE_LABEL[grantType]}) toekennen?`,
                    )
                  )
                    grantMut.mutate();
                }}
              >
                Toekennen
              </button>
            </div>
          </div>

          <div>
            <p className={labelCls}>Toegekende rechten</p>
            {detailQ.isLoading && (
              <p className="mt-2 flex items-center gap-2 text-[12px] text-white/40">
                <Loader2 className="h-3 w-3 animate-spin" /> Bezig…
              </p>
            )}
            {detailQ.data && detailQ.data.entitlements.length === 0 && (
              <p className="mt-2 text-[12px] text-white/40">
                Nog geen persoonlijke rechten.
              </p>
            )}
            {detailQ.data && detailQ.data.entitlements.length > 0 && (
              <div className="mt-2 space-y-1">
                {detailQ.data.entitlements.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-[12px]"
                  >
                    <span className="text-white/70">
                      {e.entitlementKey}{" "}
                      <span className="text-white/35">
                        · {TYPE_LABEL[e.entitlementType] ?? e.entitlementType} ·{" "}
                        {e.status === "active"
                          ? e.endsAt && new Date(e.endsAt) <= new Date()
                            ? "verlopen"
                            : "actief"
                          : "ingetrokken"}
                        {e.endsAt
                          ? ` · t/m ${new Date(e.endsAt).toLocaleDateString("nl-NL")}`
                          : ""}
                      </span>
                    </span>
                    {e.status === "active" &&
                      !(e.endsAt && new Date(e.endsAt) <= new Date()) && (
                        <button
                          className={btnCls}
                          disabled={revokeMut.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Recht "${e.entitlementKey}" intrekken?`,
                              )
                            )
                              revokeMut.mutate(e.id);
                          }}
                        >
                          Intrekken
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && (
            <p className="text-[12px] text-cyan-300/80">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}
