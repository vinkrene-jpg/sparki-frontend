// Wattage-lab — deterministische vuistregels, eerlijke grenzen.
import { computeWattageLab, LAB_DUREN } from "./wattage-lab"

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error(`✗ ${msg}`)
  } else {
    console.log(`✓ ${msg}`)
  }
}
function scenario(naam: string, fn: () => void) {
  console.log(`\n— ${naam}`)
  fn()
}

const ftp = LAB_DUREN.find((d) => d.key === "ftp")!
const sprint = LAB_DUREN.find((d) => d.key === "5")!
const vijfMin = LAB_DUREN.find((d) => d.key === "300")!

scenario("1000 W over 60 min is voor niemand haalbaar", () => {
  const zonderGewicht = computeWattageLab({
    duur: ftp,
    doelWatts: 1000,
    huidigWatts: 250,
    weightKg: null,
  })
  assert(zonderGewicht.oordeel === "onhaalbaar", "zonder gewicht: onhaalbaar via ruime aanname")
  assert(zonderGewicht.plafondBron === "aanname", "plafondbron is de aanname")

  const metGewicht = computeWattageLab({
    duur: ftp,
    doelWatts: 500,
    huidigWatts: 250,
    weightKg: 70,
  })
  assert(metGewicht.oordeel === "onhaalbaar", "500 W FTP bij 70 kg (7,1 W/kg) > wereldtop-plafond")
  assert(metGewicht.plafondWatts === Math.round(6.4 * 70), "plafond = 6,4 W/kg × eigen gewicht")
  assert(metGewicht.uitleg.includes("voor niemand haalbaar"), "uitleg zegt het eerlijk")
})

scenario("zonder eigen basiswaarde geen oordeel", () => {
  const r = computeWattageLab({ duur: vijfMin, doelWatts: 300, huidigWatts: null, weightKg: 70 })
  assert(r.oordeel === "geen_basis", "geen basis → geen_basis")
  assert(r.aanpak.length === 0, "geen aanpak zonder basis")
  assert(r.uitleg.includes("vermogensmeter"), "uitleg vertelt wat er mist")
})

scenario("doel op of onder je huidige beste = al bereikt", () => {
  const r = computeWattageLab({ duur: sprint, doelWatts: 800, huidigWatts: 900, weightKg: null })
  assert(r.oordeel === "al_bereikt", "lager doel → al_bereikt")
})

scenario("kleine verbetering is binnen bereik, met weken en aanpak", () => {
  const r = computeWattageLab({ duur: ftp, doelWatts: 262, huidigWatts: 250, weightKg: 70 })
  assert(r.oordeel === "binnen_bereik", "+4,8% FTP is binnen bereik")
  assert(r.weken != null && r.weken >= 4 && r.weken <= 40, "wekenschatting aanwezig en begrensd")
  assert(r.aanpak.length > 0, "concrete trainingsaanpak aanwezig")
  assert(r.doelWkg === Math.round((262 / 70) * 10) / 10, "doel in W/kg bij bekend gewicht")
})

scenario("grotere sprong is ambitieus (seizoensdoel)", () => {
  const r = computeWattageLab({ duur: ftp, doelWatts: 285, huidigWatts: 250, weightKg: 70 })
  assert(r.oordeel === "ambitieus", "+14% FTP = ambitieus")
  assert(r.aanpak.length > 0, "aanpak blijft aanwezig")
})

scenario("te grote sprong: buiten bereik met eerlijke tussenstap", () => {
  const r = computeWattageLab({ duur: ftp, doelWatts: 330, huidigWatts: 250, weightKg: 70 })
  assert(r.oordeel === "buiten_bereik", "+32% FTP = buiten bereik")
  assert(r.tussenstapWatts === Math.round(250 * 1.08), "tussenstap = huidig + kortetermijn%")
  assert(r.aanpak.length === 0, "geen aanpak bij onbereikbaar doel — eerst de tussenstap")
})

scenario("plafond respecteert eigen gewicht boven de aanname", () => {
  // 5 sec: 24 W/kg. Bij 60 kg is 1500 W onhaalbaar, bij aanname (110 kg) niet.
  const licht = computeWattageLab({ duur: sprint, doelWatts: 1500, huidigWatts: 1000, weightKg: 60 })
  assert(licht.oordeel === "onhaalbaar", "1500 W sprint bij 60 kg > 24 W/kg")
  const onbekend = computeWattageLab({ duur: sprint, doelWatts: 1500, huidigWatts: 1000, weightKg: null })
  assert(onbekend.oordeel !== "onhaalbaar", "zonder gewicht valt 1500 W binnen de ruime aanname")
})

scenario("ongeldige invoer geeft nooit NaN", () => {
  const nan = computeWattageLab({ duur: ftp, doelWatts: NaN, huidigWatts: 250, weightKg: 70 })
  assert(!nan.uitleg.includes("NaN"), "NaN-doel → geen NaN in uitleg")
  assert(nan.oordeel === "al_bereikt", "NaN clamp naar minimum → onder huidig beste")
  const inf = computeWattageLab({ duur: ftp, doelWatts: Infinity, huidigWatts: 250, weightKg: 70 })
  assert(!inf.uitleg.includes("NaN") && !inf.uitleg.includes("Infinity"), "geen rare waarden in uitleg")
  const extreem = computeWattageLab({ duur: ftp, doelWatts: 999999, huidigWatts: 250, weightKg: 70 })
  assert(extreem.oordeel === "onhaalbaar", "extreem (eindig) doel blijft eerlijk onhaalbaar")
})

console.log("")
if (failures > 0) {
  console.error(`${failures} assertie(s) gefaald`)
  process.exit(1)
}
console.log("Alle wattage-lab-scenario's geslaagd")
