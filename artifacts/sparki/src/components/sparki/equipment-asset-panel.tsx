import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import {
  useEquipmentAssets,
  useAddEquipmentAsset,
  useDeleteEquipmentAsset,
  assetImageUrl,
  type EquipmentAsset,
} from "@/hooks/use-bike-scan"
import { fileToResizedPhoto } from "@/hooks/use-material"

// Productbeelden bij een onderdeel — met VERPLICHTE herkomst. Alleen bronnen
// met gebruiksrecht: officieel fabrikantmateriaal, distributeur-/persbeeld,
// catalogus met licentie, of een eigen foto. Er wordt nooit van winkels of
// zoekmachines geplukt; zonder herkomst wordt geen beeld opgeslagen.

const SOURCE_LABEL: Record<EquipmentAsset["source"], string> = {
  fabrikant: "Fabrikant (officieel productbeeld)",
  distributeur: "Distributeur / persbeeld",
  catalogus: "Catalogus met licentie",
  upload: "Eigen foto",
}

export function EquipmentAssetPanel({
  componentId,
  brand,
  model,
}: {
  componentId: number
  brand: string | null
  model: string | null
}) {
  const { data } = useEquipmentAssets(componentId)
  const addAsset = useAddEquipmentAsset()
  const deleteAsset = useDeleteEquipmentAsset()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<EquipmentAsset["source"]>("upload")
  const [sourceUrl, setSourceUrl] = useState("")
  const [license, setLicense] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assets = data?.assets ?? []

  async function save() {
    setError(null)
    if (!file) {
      setError("Kies eerst een beeldbestand.")
      return
    }
    if (!license.trim()) {
      setError("Licentie/gebruiksrecht is verplicht — zonder herkomst wordt niets opgeslagen.")
      return
    }
    if (source !== "upload" && !sourceUrl.trim()) {
      setError("Bij een externe bron is de bron-URL verplicht.")
      return
    }
    try {
      const photo = await fileToResizedPhoto(file, 1024)
      await addAsset.mutateAsync({
        componentId,
        brand: brand?.trim() || "Onbekend merk",
        model: model?.trim() || "Onbekend model",
        source,
        sourceUrl: sourceUrl.trim() || undefined,
        license: license.trim(),
        data: photo.data,
        mediaType: photo.mediaType,
      })
      setOpen(false)
      setFile(null)
      setSourceUrl("")
      setLicense("")
    } catch {
      setError("Opslaan is niet gelukt. Controleer de invoer en probeer opnieuw.")
    }
  }

  return (
    <div className="mt-2.5">
      {assets.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {assets.map((a) => (
            <figure key={a.id} className="w-[104px]">
              <div className="relative h-[88px] w-[104px] overflow-hidden rounded-lg bg-muted">
                <img
                  src={assetImageUrl(a.id)}
                  alt={`${a.brand} ${a.model}`}
                  className="h-full w-full object-contain drop-shadow-md"
                  loading="lazy"
                />
                {/* LICHT_THEMA_01-uitzondering: deze verwijderknop ligt ÓP de
                    foto in een donkere ink-chip (bg-foreground/60). De lichte
                    rose-hover blijft daarom bewust licht — leesbaar op de
                    donkere chip over het beeld (vertaalgids uitzondering 1). */}
                <button
                  type="button"
                  aria-label="Beeld verwijderen"
                  onClick={() => deleteAsset.mutate(a.id)}
                  className="absolute right-1 top-1 rounded-full bg-foreground/60 p-1 text-muted-foreground hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <figcaption className="mt-1 text-[9.5px] leading-tight text-muted-foreground">
                {SOURCE_LABEL[a.source]}
                {a.sourceUrl ? " · bron vastgelegd" : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:border-accent-cyan/30 hover:text-accent-cyan"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Productbeeld toevoegen
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-foreground/30 p-3">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Herkomst is verplicht. Gebruik alleen beeld waar je gebruiksrecht
            voor hebt — officieel fabrikantmateriaal, een persbeeld of je eigen
            foto. Zonder herkomst wordt niets opgeslagen.
          </p>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as EquipmentAsset["source"])}
            className="w-full rounded-lg border border-border bg-foreground/40 px-2.5 py-2 text-[12px] text-foreground/80"
            aria-label="Bron van het beeld"
          >
            {(Object.keys(SOURCE_LABEL) as EquipmentAsset["source"][]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          {source !== "upload" && (
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Bron-URL (verplicht bij externe bron)"
              className="w-full rounded-lg border border-border bg-foreground/40 px-2.5 py-2 text-[12px] text-foreground/80 placeholder:text-muted-foreground"
            />
          )}
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="Licentie / gebruiksrecht (bijv. 'officieel persbeeld' of 'eigen foto')"
            className="w-full rounded-lg border border-border bg-foreground/40 px-2.5 py-2 text-[12px] text-foreground/80 placeholder:text-muted-foreground"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[11px] text-muted-foreground file:mr-2 file:rounded-full file:border file:border-border file:bg-transparent file:px-3 file:py-1 file:text-[11px] file:text-muted-foreground"
          />
          {error && <p className="text-[11px] text-[color:var(--color-warning)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={addAsset.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-cyan px-3.5 py-1.5 text-[12px] font-semibold text-[color:var(--color-on-accent)] disabled:opacity-50"
            >
              {addAsset.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Opslaan
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className="rounded-full border border-border px-3.5 py-1.5 text-[12px] text-muted-foreground"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
