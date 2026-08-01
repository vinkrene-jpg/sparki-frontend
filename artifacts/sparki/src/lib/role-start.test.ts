import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import {
  GLOBAL_ROLE_STARTS,
  CLUB_ROLE_STARTS,
  roleStartFor,
} from "./role-start"
import { NUTRITION_SPECIALIST_NAV_ENTRIES, chaptersForRole } from "./chapters"

// SPARKI_BUILD_01 F3 (BB-08/BB-14) — regressietest rolgestuurde startpunten:
// 1. élke server-side rolwaarde (validRoles + clubRoles) heeft een startpunt;
// 2. het registry bevat geen verzonnen rolwaarden die server-side niet bestaan;
// 3. elk startpunt heeft echte ingangen of een volledige eerlijke lege
//    toestand (wat ontbreekt · wie het oplost · één vervolgstap);
// 4. de voedingsdeskundige valt nergens terug op de sporterweergave.

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(here, "..", "..", "..", "..")

function extractRoles(source: string, constName: string): string[] {
  const m = source.match(
    new RegExp(`export const ${constName} = \\[([^\\]]+)\\] as const`),
  )
  assert.ok(m, `${constName} niet gevonden in schema`)
  // Commentaarregels strippen, anders tellen rolnamen in uitlegtekst mee
  // (bijv. '"medic" heet nu "medical_staff"').
  const zonderCommentaar = m[1]!
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n")
  return [...zonderCommentaar.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!)
}

const usersSchema = readFileSync(
  path.join(repoRoot, "lib", "db", "src", "schema", "users.ts"),
  "utf8",
)
const clubSchema = readFileSync(
  path.join(repoRoot, "lib", "db", "src", "schema", "club.ts"),
  "utf8",
)
const serverGlobalRoles = extractRoles(usersSchema, "validRoles")
const serverClubRoles = extractRoles(clubSchema, "clubRoles")

test("BB-14: nutrition_specialist bestaat server-side", () => {
  assert.ok(serverGlobalRoles.includes("nutrition_specialist"))
})

test("elke server-side rolwaarde heeft een eigen startpunt", () => {
  for (const role of serverGlobalRoles) {
    assert.ok(
      GLOBAL_ROLE_STARTS.some((r) => r.role === role),
      `globale rol zonder startpunt: ${role}`,
    )
  }
  for (const role of serverClubRoles) {
    assert.ok(
      CLUB_ROLE_STARTS.some((r) => r.role === role),
      `clubrol zonder startpunt: ${role}`,
    )
  }
})

test("registry bevat geen rolwaarden die server-side niet bestaan", () => {
  for (const r of GLOBAL_ROLE_STARTS) {
    assert.ok(serverGlobalRoles.includes(r.role), `verzonnen globale rol: ${r.role}`)
  }
  for (const r of CLUB_ROLE_STARTS) {
    assert.ok(serverClubRoles.includes(r.role), `verzonnen clubrol: ${r.role}`)
  }
})

test("elk startpunt heeft echte ingangen of een volledige eerlijke lege toestand", () => {
  for (const r of [...GLOBAL_ROLE_STARTS, ...CLUB_ROLE_STARTS]) {
    const heeftFuncties = r.functies.length > 0
    const heeftLeeg =
      !!r.leeg &&
      r.leeg.ontbreekt.length > 0 &&
      r.leeg.wieLostOp.length > 0 &&
      r.leeg.vervolgstap.href.startsWith("/")
    assert.ok(
      heeftFuncties || heeftLeeg,
      `rol ${r.role}: geen ingangen én geen eerlijke lege toestand`,
    )
  }
})

test("onbekende rol levert null (eerlijke melding, geen nagebootst scherm)", () => {
  assert.equal(roleStartFor("tovenaar"), null)
})

test("voedingsdeskundige: Voeding eerst, geen sporter-navigatie of -hoofdstukken", () => {
  assert.equal(NUTRITION_SPECIALIST_NAV_ENTRIES[0]!.label, "Voeding")
  const hrefs = chaptersForRole("nutrition_specialist", false).map((c) => c.href)
  for (const sporterPad of ["/vandaag", "/train", "/routes", "/races"]) {
    assert.ok(!hrefs.includes(sporterPad), `terugval op sporterhoofdstuk ${sporterPad}`)
  }
})
