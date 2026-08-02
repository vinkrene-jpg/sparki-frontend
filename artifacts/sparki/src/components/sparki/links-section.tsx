import { useState } from "react"
import { Users, UserCog, X, AlertTriangle, Settings2 } from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useMyLinks,
  useRevokeLink,
  useParentsManage,
  useSetParentPermissions,
  useReconfirmParent,
  type LinkedPerson,
  type ManagedParent,
} from "@/hooks/use-links"
import type { ParentDataCategory } from "@/hooks/use-parent"

const CATEGORY_ORDER: ParentDataCategory[] = [
  "planning",
  "aanwezigheid",
  "herstel",
  "gezondheid",
  "slaap",
  "locatie",
  "wedstrijd",
  "communicatie",
]

function ParentShareRow({
  parent,
  labels,
}: {
  parent: ManagedParent
  labels: Record<ParentDataCategory, string> | undefined
}) {
  const setPerms = useSetParentPermissions()
  const reconfirm = useReconfirmParent()
  const [open, setOpen] = useState(false)
  const access = parent.access
  const [draft, setDraft] = useState<Record<ParentDataCategory, boolean>>(
    () =>
      (access?.permissions ?? {
        planning: false,
        aanwezigheid: false,
        herstel: true,
        gezondheid: true,
        slaap: false,
        locatie: false,
        wedstrijd: false,
        communicatie: false,
      }) as Record<ParentDataCategory, boolean>,
  )
  if (!access) return null
  const isAdult = access.tier === "adult"
  return (
    <div className="border-t border-border py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-[13px] text-foreground/75">
          Delen met {parent.displayName ?? parent.email ?? "ouder"}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:bg-muted"
          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {open ? "Sluiten" : "Instellen"}
        </button>
      </div>
      {access.reconfirmRequired && (
        <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-[color:var(--color-warning)]">
          Je bent in een nieuwe leeftijdscategorie gekomen. Bevestig opnieuw wat
          je met deze ouder deelt — tot die tijd geldt alleen het
          veiligheidsminimum.
          <button
            type="button"
            disabled={reconfirm.isPending}
            onClick={() => reconfirm.mutate(parent.parentClerkId)}
            className="ml-2 underline disabled:opacity-40"
            style={{ color: ACCENT }}
          >
            {reconfirm.isPending ? "Bezig…" : "Nu bevestigen"}
          </button>
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-1.5">
          {isAdult && (
            <p className="text-[11px] text-muted-foreground">
              Je bent volwassen: je bepaalt volledig zelf wat je deelt. Niets
              staat verplicht aan.
            </p>
          )}
          {CATEGORY_ORDER.map((c) => {
            const forced =
              !isAdult && (c === "gezondheid" || c === "herstel" || c === "slaap") &&
              access.tier === "u16" &&
              (c === "gezondheid" || c === "herstel")
            return (
              <label
                key={c}
                className="flex items-center justify-between text-[12px] text-foreground/65"
              >
                <span>
                  {labels?.[c] ?? c}
                  {forced && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      (veiligheidsminimum)
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={forced ? true : draft[c]}
                  disabled={forced}
                  onChange={(e) => setDraft({ ...draft, [c]: e.target.checked })}
                  className="accent-cyan-300"
                />
              </label>
            )
          })}
          <div className="pt-1">
            <button
              type="button"
              disabled={setPerms.isPending}
              onClick={() =>
                setPerms.mutate(
                  { parentClerkId: parent.parentClerkId, permissions: draft },
                  { onSuccess: () => setOpen(false) },
                )
              }
              className="rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:bg-muted disabled:opacity-40"
              style={{ borderColor: "rgba(120,210,230,0.35)", color: ACCENT }}
            >
              {setPerms.isPending ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LinkRow({
  person,
  kind,
  onRevoke,
  busy,
}: {
  person: LinkedPerson
  kind: "coach" | "parent"
  onRevoke: () => void
  busy: boolean
}) {
  const Icon = kind === "coach" ? Users : UserCog
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-muted)",
        }}
      >
        <Icon className="h-4 w-4 text-foreground/55" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] tracking-tight text-foreground/85">
          {person.displayName ?? person.email}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {kind === "coach" ? "Coach" : "Ouder"} ·{" "}
          {person.status === "accepted" ? "Gekoppeld" : "In afwachting"}
        </div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={busy}
        aria-label="Koppeling verwijderen"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70 disabled:opacity-40"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function LinksSection() {
  const { data, isLoading } = useMyLinks()
  const { data: manageData } = useParentsManage()
  const revoke = useRevokeLink()
  const [notice, setNotice] = useState<string | null>(null)
  const coaches = data?.coaches ?? []
  const parents = data?.parents ?? []
  const hasAny = coaches.length > 0 || parents.length > 0

  const handleRevoke = (
    kind: "coach" | "parent",
    person: LinkedPerson,
  ) => {
    setNotice(null)
    const who = person.displayName ?? person.email
    const rol = kind === "coach" ? "coach" : "ouder"
    revoke.mutate(
      { kind, clerkId: person.clerkId },
      {
        onSuccess: (result) => {
          if (!result.removed || result.removed < 1) {
            setNotice(
              `De koppeling met ${who} (${rol}) was al weg — er is niets verwijderd. De lijst is opnieuw geladen.`,
            )
          }
        },
        onError: () => {
          setNotice(
            `Het verwijderen van de koppeling met ${who} (${rol}) is niet gelukt. Probeer het zo nog eens.`,
          )
        },
      },
    )
  }

  return (
    <section className="pt-2">
      <SectionLabel n="08" title="Coaches & ouders" />
      <div className="mt-3 rounded-2xl border border-border bg-card px-4 backdrop-blur-md">
        {isLoading ? (
          <div className="space-y-3 py-6">
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        ) : !hasAny ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Je hebt nog geen gekoppelde coach of ouder.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {coaches.map((c) => (
              <LinkRow
                key={`coach-${c.clerkId}`}
                person={c}
                kind="coach"
                busy={revoke.isPending}
                onRevoke={() => handleRevoke("coach", c)}
              />
            ))}
            {parents.map((p) => (
              <LinkRow
                key={`parent-${p.clerkId}`}
                person={p}
                kind="parent"
                busy={revoke.isPending}
                onRevoke={() => handleRevoke("parent", p)}
              />
            ))}
          </div>
        )}
        {(manageData?.parents ?? [])
          .filter((p) => p.status === "accepted")
          .map((p) => (
            <ParentShareRow
              key={`share-${p.parentClerkId}`}
              parent={p}
              labels={manageData?.categoryLabels}
            />
          ))}
      </div>
      {notice && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--color-warning)]"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
          />
          <span>{notice}</span>
        </div>
      )}
      <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
        Een koppeling verwijderen stopt direct het delen van jouw gegevens met
        die persoon.
      </p>
    </section>
  )
}
