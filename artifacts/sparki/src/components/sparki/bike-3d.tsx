import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import type { GarageBike, GarageComponentCategory } from "@/hooks/use-garage"

// Herbruikbare 3D-fiets. Parametrisch model (frame, wielen, zadel, stuur,
// aandrijving) — een neutrale weergave van de eigen fiets, ingekleurd op basis
// van het echte fietstype uit de garage. Er worden GEEN fictieve onderdelen,
// slijtage of meetwaarden getoond: het model is puur visueel; alle inhoud
// (specificaties, onderhoud) komt uit de echte garagegegevens van de renner.
//
// Gedrag:
// - draait automatisch langzaam;
// - handmatig roteerbaar (slepen) en zoombaar (scroll/knijpen);
// - pauzeert wanneer het tabblad verborgen is (energiebesparing);
// - respecteert prefers-reduced-motion: geen automatische rotatie.

export type BikePart =
  | "frame"
  | "wielen"
  | "banden"
  | "zadel"
  | "cockpit"
  | "crankstel"
  | "pedalen"
  | "cassette"
  | "ketting"
  | "remmen"

export const BIKE_PART_LABEL: Record<BikePart, string> = {
  frame: "Frame",
  wielen: "Wielen",
  banden: "Banden",
  zadel: "Zadel",
  cockpit: "Stuur & cockpit",
  crankstel: "Crankstel",
  pedalen: "Pedalen",
  cassette: "Cassette",
  ketting: "Ketting",
  remmen: "Remmen",
}

// Welke garage-categorieën horen bij een aanklikbaar 3D-onderdeel.
export const BIKE_PART_CATEGORIES: Record<BikePart, GarageComponentCategory[]> = {
  frame: ["onderdeel", "anders"],
  wielen: ["wielen"],
  banden: ["banden"],
  zadel: ["zadel"],
  cockpit: ["cockpit"],
  crankstel: ["crankstel", "groepset"],
  pedalen: ["pedalen"],
  cassette: ["cassette", "achterderailleur", "voorderailleur", "groepset"],
  ketting: ["ketting", "groepset"],
  remmen: ["remmen"],
}

const FRAME_COLOR: Record<string, number> = {
  race: 0x1a2f3f,
  mtb: 0x24321f,
  gravel: 0x33291d,
  tt: 0x101828,
  baan: 0x2b1d33,
  cyclocross: 0x1f3030,
  stads: 0x2c2c31,
  anders: 0x22303c,
}

function tube(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  const geo = new THREE.CylinderGeometry(radius, radius, len, 14)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.copy(from).add(dir.clone().multiplyScalar(0.5))
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  )
  return mesh
}

function buildBike(bikeType: string | null): THREE.Group {
  const g = new THREE.Group()
  const frameColor = FRAME_COLOR[bikeType ?? "anders"] ?? FRAME_COLOR.anders

  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: 0.65,
    roughness: 0.3,
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x14181d,
    metalness: 0.4,
    roughness: 0.55,
  })
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d10,
    metalness: 0.05,
    roughness: 0.95,
  })
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0x8a949e,
    metalness: 0.85,
    roughness: 0.35,
  })

  // Geometrie-referenties (zijaanzicht, x = rijrichting, y = hoogte)
  const rearHub = new THREE.Vector3(-1.05, 0, 0)
  const frontHub = new THREE.Vector3(1.05, 0, 0)
  const bb = new THREE.Vector3(-0.12, 0.08, 0) // trapas
  const seatTop = new THREE.Vector3(-0.62, 1.18, 0)
  const headTop = new THREE.Vector3(0.72, 1.05, 0)
  const headBottom = new THREE.Vector3(0.86, 0.62, 0)

  const wheelR = 0.62

  const addPart = (part: BikePart, ...meshes: THREE.Object3D[]) => {
    for (const m of meshes) {
      m.traverse((o) => {
        o.userData.part = part
      })
      m.userData.part = part
      g.add(m)
    }
  }

  // Wielen + banden + spaken
  for (const hub of [rearHub, frontHub]) {
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR, 0.035, 12, 44),
      rubberMat,
    )
    tire.position.copy(hub)
    addPart("banden", tire)

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR - 0.055, 0.018, 10, 44),
      darkMat,
    )
    rim.position.copy(hub)
    const spokes = new THREE.Group()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const end = new THREE.Vector3(
        hub.x + Math.cos(a) * (wheelR - 0.06),
        hub.y + Math.sin(a) * (wheelR - 0.06),
        0,
      )
      spokes.add(tube(hub, end, 0.006, silverMat))
    }
    const hubMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12),
      silverMat,
    )
    hubMesh.rotation.x = Math.PI / 2
    hubMesh.position.copy(hub)
    addPart("wielen", rim, spokes, hubMesh)
  }

  // Frame (diamant)
  addPart(
    "frame",
    tube(headBottom, headTop, 0.05, frameMat), // balhoofd
    tube(headTop, seatTop, 0.045, frameMat), // bovenbuis
    tube(headBottom, bb, 0.05, frameMat), // onderbuis
    tube(bb, seatTop, 0.045, frameMat), // zitbuis
    tube(bb, rearHub, 0.03, frameMat), // liggende achtervork
    tube(seatTop, rearHub, 0.028, frameMat), // staande achtervork
    tube(headBottom, frontHub, 0.032, frameMat), // voorvork
  )

  // Zadel + zadelpen
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.09), darkMat)
  saddle.position.set(-0.68, 1.3, 0)
  addPart(
    "zadel",
    tube(seatTop, new THREE.Vector3(-0.68, 1.28, 0), 0.022, silverMat),
    saddle,
  )

  // Stuur (drop bar vereenvoudigd)
  const stemEnd = new THREE.Vector3(0.88, 1.14, 0)
  const barL = new THREE.Vector3(0.88, 1.14, -0.22)
  const barR = new THREE.Vector3(0.88, 1.14, 0.22)
  const dropL = new THREE.Vector3(1.0, 0.96, -0.22)
  const dropR = new THREE.Vector3(1.0, 0.96, 0.22)
  addPart(
    "cockpit",
    tube(headTop, stemEnd, 0.026, darkMat),
    tube(barL, barR, 0.022, darkMat),
    tube(barL, dropL, 0.02, darkMat),
    tube(barR, dropR, 0.02, darkMat),
  )

  // Crankstel + pedalen
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 10, 32), silverMat)
  ring.position.copy(bb)
  addPart("crankstel", ring)
  const crankL = tube(bb, new THREE.Vector3(0.05, -0.09, 0.09), 0.018, darkMat)
  const crankR = tube(bb, new THREE.Vector3(-0.29, 0.25, -0.09), 0.018, darkMat)
  const pedL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.12), darkMat)
  pedL.position.set(0.05, -0.09, 0.13)
  const pedR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.12), darkMat)
  pedR.position.set(-0.29, 0.25, -0.13)
  addPart("crankstel", crankL, crankR)
  addPart("pedalen", pedL, pedR)

  // Cassette + ketting (vereenvoudigd)
  const cassette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20),
    silverMat,
  )
  cassette.rotation.x = Math.PI / 2
  cassette.position.set(rearHub.x, rearHub.y, 0.05)
  addPart("cassette", cassette)
  addPart(
    "ketting",
    tube(
      new THREE.Vector3(bb.x, bb.y + 0.16, 0.05),
      new THREE.Vector3(rearHub.x, rearHub.y + 0.09, 0.05),
      0.012,
      darkMat,
    ),
    tube(
      new THREE.Vector3(bb.x, bb.y - 0.16, 0.05),
      new THREE.Vector3(rearHub.x, rearHub.y - 0.09, 0.05),
      0.012,
      darkMat,
    ),
  )

  // Remmen (schijfjes bij de naven)
  for (const hub of [rearHub, frontHub]) {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.008, 24),
      silverMat,
    )
    disc.rotation.x = Math.PI / 2
    disc.position.set(hub.x, hub.y, -0.055)
    addPart("remmen", disc)
  }

  g.position.y = wheelR // wielen op de "grond"
  return g
}

export function Bike3D({
  bike,
  height = 240,
  selectable = false,
  selectedPart = null,
  onSelectPart,
  className,
}: {
  bike: GarageBike | null
  height?: number
  selectable?: boolean
  selectedPart?: BikePart | null
  onSelectPart?: (part: BikePart) => void
  className?: string
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const selectRef = useRef(onSelectPart)
  selectRef.current = onSelectPart
  const selectedRef = useRef<BikePart | null>(selectedPart)
  const [webglOk, setWebglOk] = useState(true)

  // Houd de geselecteerde markering in sync zonder de scene te herbouwen.
  useEffect(() => {
    selectedRef.current = selectedPart
  }, [selectedPart])

  const bikeType = bike?.bikeType ?? null

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setWebglOk(false)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)

    scene.add(new THREE.AmbientLight(0xdfefff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(3, 4, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x7ed2e6, 0.8)
    rim.position.set(-3, 2, -3)
    scene.add(rim)

    const bikeGroup = buildBike(bikeType)
    scene.add(bikeGroup)

    // Camera-baan
    let yaw = 0.6
    let pitch = 0.18
    let dist = 3.4
    const target = new THREE.Vector3(0, 0.72, 0)
    const applyCamera = () => {
      pitch = Math.max(-0.1, Math.min(0.9, pitch))
      dist = Math.max(2.1, Math.min(6, dist))
      camera.position.set(
        target.x + dist * Math.cos(pitch) * Math.sin(yaw),
        target.y + dist * Math.sin(pitch),
        target.z + dist * Math.cos(pitch) * Math.cos(yaw),
      )
      camera.lookAt(target)
    }

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = "none"
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    // Interactie: slepen = roteren, scroll/knijpen = zoomen, tik = onderdeel.
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0
    let pinchDist = 0
    let idleSince = 0

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastX = e.clientX
      lastY = e.clientY
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      lastX = e.clientX
      lastY = e.clientY
      yaw -= dx * 0.008
      pitch += dy * 0.005
      idleSince = performance.now()
      needsRender = true
    }
    const raycaster = new THREE.Raycaster()
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      if (moved || !selectable || !selectRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      const p = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(p, camera)
      const hits = raycaster.intersectObjects(bikeGroup.children, true)
      const part = hits.find((h) => h.object.userData.part)?.object.userData
        .part as BikePart | undefined
      if (part) selectRef.current(part)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dist += e.deltaY * 0.0025
      idleSince = performance.now()
      needsRender = true
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        dist *= pinchDist / d
        pinchDist = d
        idleSince = performance.now()
        needsRender = true
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown)
    renderer.domElement.addEventListener("pointermove", onPointerMove)
    renderer.domElement.addEventListener("pointerup", onPointerUp)
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false })
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true })
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: true })

    // Markering van het geselecteerde onderdeel (cyaan gloed).
    const baseEmissive = new Map<THREE.Mesh, number>()
    const applySelection = () => {
      bikeGroup.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        const mat = o.material as THREE.MeshStandardMaterial
        if (!baseEmissive.has(o)) baseEmissive.set(o, mat.emissive?.getHex() ?? 0)
        const isSel =
          selectable && selectedRef.current && o.userData.part === selectedRef.current
        if (isSel) {
          if (mat.emissive.getHex() !== 0x2aa5c0) {
            o.material = mat.clone()
            ;(o.material as THREE.MeshStandardMaterial).emissive.setHex(0x2aa5c0)
            ;(o.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55
          }
        }
      })
    }

    // Renderlus: langzame auto-rotatie; pauzeert bij verborgen tabblad en bij
    // reduced-motion; na handmatige interactie hervat de rotatie pas na 4 s.
    let raf = 0
    let needsRender = true
    let lastSelected = selectedRef.current
    let prev = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const autoAllowed =
        !reducedMotion.matches && !document.hidden && !dragging &&
        now - idleSince > 4000
      if (autoAllowed) {
        yaw += dt * 0.25 // langzaam: één omwenteling per ~25 s
        needsRender = true
      }
      if (selectedRef.current !== lastSelected) {
        lastSelected = selectedRef.current
        applySelection()
        needsRender = true
      }
      if (needsRender) {
        applyCamera()
        renderer.render(scene, camera)
        needsRender = false
      }
    }
    applySelection()
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.remove()
      renderer.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
    }
  }, [bikeType, selectable])

  if (!webglOk) {
    // Eerlijke terugval: geen 3D beschikbaar op dit toestel.
    return (
      <div
        className={className}
        style={{ height }}
      >
        <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-[#070d16]/60 text-[12px] text-white/45">
          3D-weergave is op dit toestel niet beschikbaar.
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        ref={mountRef}
        style={{ height }}
        role="img"
        aria-label={
          bike
            ? `3D-weergave van ${bike.name}`
            : "3D-weergave van een fiets"
        }
        className="w-full cursor-grab active:cursor-grabbing"
      />
    </div>
  )
}
