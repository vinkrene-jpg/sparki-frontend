import { useEffect, useRef } from "react"
import { Map as MapLibreMap } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// KAART_VECTOR_01 F1 — proefpagina voor de nieuwe vectorkaartmotor.
// Alleen de kaart, niets anders. Niet in de navigatie opgenomen.
// Stijl: Shortbread-schema (OSMF-tegeldienst) met de Sparki-kleuren.
export default function KaartProefPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: `${import.meta.env.BASE_URL}kaart/sparki-stijl.json`,
      center: [5.3, 52.1],
      zoom: 7,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    // Proefpagina: fouten zichtbaar maken en de kaart bereikbaar voor
    // meetscripts (alleen deze pagina, geen productie-oppervlak).
    map.on("error", (e) => console.error("[kaart-proef] kaartfout:", e.error?.message ?? e))
    ;(window as unknown as { __kaartProef?: unknown }).__kaartProef = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Bewust inline-styles: in de acceptatiebuild bleek de Tailwind-klasse
  // `fixed` hier niet toegepast te worden (computed position "relative",
  // hoogte 0 → kaartcanvas van 300px). Inline is onafhankelijk van CSS-scanning.
  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0 }}
      data-testid="kaart-proef"
    />
  )
}
