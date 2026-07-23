// Profielprivacy: per gegevenscategorie (17) kiest de sporter welk publiek
// (6 niveaus) het mag zien. De server (lib/profile-privacy.ts) is de enige
// afdwingende laag; dit is uitsluitend de instelweergave.
import { useState } from "react"
import { Users } from "lucide-react"
import {
  useProfilePrivacy,
  useUpdateProfilePrivacy,
} from "@/hooks/use-social"

const AUDIENCE_LABEL: Record<string, string> = {
  iedereen: "Iedereen",
  sparki: "Sparki-gebruikers",
  volgers: "Volgers",
  vrienden: "Vrienden",
  begeleiders: "Begeleiders",
  alleen_ik: "Alleen ik",
}

export function ProfilePrivacyGrid() {
  const { data, isLoading } = useProfilePrivacy()
  const update = useUpdateProfilePrivacy()
  const [saved, setSaved] = useState(false)

  const onChange = (key: string, audience: string) => {
    if (!data) return
    update.mutate(
      { ...data.categories, [key]: audience },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      },
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-white/50" strokeWidth={1.75} />
        <span className="text-[13px] font-medium text-white/85">
          Wie ziet wat op je profiel
        </span>
        {saved && (
          <span className="ml-auto font-mono text-[10px] text-emerald-300/70">
            Opgeslagen
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-white/40">
        Kies per onderdeel wie het mag zien. "Begeleiders" zijn je gekoppelde
        coach en ouders. Deze keuzes gelden voor je openbare profiel; de
        bestaande coach- en ouderdeelrechten blijven apart gelden.
      </p>
      {isLoading || !data ? (
        <div className="mt-3 h-32 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <div className="mt-2 divide-y divide-white/[0.06]">
          {data.registry.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] text-white/80">{cat.label}</p>
                <p className="truncate text-[11px] text-white/35">
                  {cat.uitleg}
                </p>
              </div>
              <select
                value={data.categories[cat.key] ?? "alleen_ik"}
                disabled={update.isPending}
                onChange={(e) => onChange(cat.key, e.target.value)}
                className="shrink-0 rounded-lg border border-white/12 bg-[#0a1220] px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-cyan-300/40 disabled:opacity-50"
              >
                {data.audiences.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a] ?? a}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
