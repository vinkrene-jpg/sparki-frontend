// Routeopmerkingen-paneel: echte waarschuwingen/bijzonderheden op de route uit
// OpenStreetMap-tags. Elke opmerking heeft een pictogram, km-positie, korte
// uitleg en een uitklapbaar "Details" met de letterlijke bron-tag. Onzekere
// informatie is expliciet als "indicatie" gelabeld; onderaan staat altijd de
// bronvermelding (ODbL). Een lege lijst betekent écht "niets gevonden in de
// kaartgegevens" — een upstream-fout toont een eerlijk foutbeeld.

import { useState } from "react"
import {
  Ship,
  Footprints,
  DoorClosed,
  Ban,
  Trees,
  Droplets,
  Construction,
  Mountain,
  TriangleAlert,
  ChevronDown,
  MapPin,
} from "lucide-react"
import type {
  RouteRemark,
  RouteRemarkKind,
  RouteRemarksResponse,
} from "@/hooks/use-route-remarks"

const KIND_ICON: Record<RouteRemarkKind, typeof Ship> = {
  veerpont: Ship,
  trap: Footprints,
  poort: DoorClosed,
  onverhard: Mountain,
  slecht_wegdek: Construction,
  beperkte_toegang: Ban,
  natuurgebied: Trees,
  doorwaadbare_plaats: Droplets,
}

function fmtKm(v: number): string {
  return v.toFixed(1).replace(".", ",")
}

function RemarkRow({
  remark,
  onShowOnMap,
}: {
  remark: RouteRemark
  onShowOnMap?: (r: RouteRemark) => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = KIND_ICON[remark.kind] ?? TriangleAlert
  return (
    <li className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/85"
          strokeWidth={1.75}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] text-white/85">{remark.label}</span>
            <span className="font-mono text-[10px] tracking-[0.08em] text-white/45">
              km {fmtKm(remark.routeKm)}
              {remark.endKm != null && `–${fmtKm(remark.endKm)}`}
            </span>
            {remark.uncertain && (
              <span className="rounded-full border border-amber-300/30 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-amber-200/75">
                indicatie
              </span>
            )}
          </div>
          {open && (
            <div className="mt-1.5 space-y-1">
              <p className="text-[12px] leading-relaxed text-white/55">
                {remark.detail}
              </p>
              <p className="font-mono text-[10px] tracking-[0.06em] text-white/30">
                bron-tag: {remark.evidence} · {remark.offRouteM} m van de lijn
              </p>
            </div>
          )}
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300/75 transition hover:text-cyan-200"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
              details
            </button>
            {onShowOnMap && (
              <button
                type="button"
                onClick={() => onShowOnMap(remark)}
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45 transition hover:text-cyan-300/80"
              >
                <MapPin className="h-3 w-3" strokeWidth={2} />
                toon op kaart
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export function RouteRemarksPanel({
  data,
  isLoading,
  isError,
  onShowOnMap,
  className = "",
}: {
  data: RouteRemarksResponse | undefined
  isLoading: boolean
  isError: boolean
  onShowOnMap?: (r: RouteRemark) => void
  className?: string
}) {
  const [open, setOpen] = useState(true)
  const remarks = data?.remarks ?? null
  const dataRemarks = data?.dataRemarks ?? []
  const count = (remarks?.length ?? 0) + dataRemarks.length

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80 transition hover:text-cyan-200"
        >
          {open ? "− routeopmerkingen" : "+ routeopmerkingen"}
        </button>
        {!isLoading && !isError && (
          <span className="font-mono text-[10px] tracking-[0.1em] text-white/40">
            {count === 0 ? "geen gevonden" : count}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <p className="text-[12px] text-white/40">
              Routeopmerkingen worden opgehaald uit de kaartgegevens…
            </p>
          )}
          {isError && (
            <p className="text-[12px] text-[rgba(255,140,120,0.85)]">
              Routeopmerkingen konden nu niet opgehaald worden — de kaartbron
              gaf geen antwoord. Er zijn dus mogelijk wél bijzonderheden op de
              route.
            </p>
          )}
          {!isLoading && !isError && data && (
            <>
              {remarks != null && remarks.length === 0 && dataRemarks.length === 0 && (
                <p className="text-[12px] text-white/45">
                  Geen bijzonderheden gevonden in de kaartgegevens langs deze
                  route. Let op: de kaart kan onvolledig zijn — blijf zelf
                  opletten.
                </p>
              )}
              {(remarks?.length ?? 0) > 0 && (
                <ul className="space-y-2">
                  {remarks!.map((r) => (
                    <RemarkRow key={r.id} remark={r} onShowOnMap={onShowOnMap} />
                  ))}
                </ul>
              )}
              {dataRemarks.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {dataRemarks.map((d) => (
                    <li
                      key={d.label}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <TriangleAlert
                          className="mt-0.5 h-4 w-4 shrink-0 text-white/45"
                          strokeWidth={1.75}
                        />
                        <div>
                          <span className="text-[13px] text-white/85">
                            {d.label}
                          </span>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                            {d.detail}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2.5 text-[10px] leading-relaxed text-white/30">
                Bron: {data.source.name} — {data.source.license}.{" "}
                {data.source.note}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
