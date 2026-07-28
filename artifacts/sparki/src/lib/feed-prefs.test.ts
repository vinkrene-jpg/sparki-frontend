// Tests voor per-gebruiker gescheiden Ontdekken-voorkeuren (defect A-03).
// Draait als node-test met een minimale localStorage-shim.
import test from "node:test"
import assert from "node:assert/strict"

// ── localStorage-shim ────────────────────────────────────────────────────────
function maakStorage(opts: { geblokkeerd?: boolean } = {}) {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => {
      if (opts.geblokkeerd) throw new Error("storage geblokkeerd")
      return data.has(k) ? data.get(k)! : null
    },
    setItem: (k: string, v: string) => {
      if (opts.geblokkeerd) throw new Error("storage geblokkeerd")
      data.set(k, String(v))
    },
    removeItem: (k: string) => {
      if (opts.geblokkeerd) throw new Error("storage geblokkeerd")
      data.delete(k)
    },
  }
}

let storage = maakStorage()
;(globalThis as Record<string, unknown>).window = { localStorage: storage }
function reset(opts: { geblokkeerd?: boolean } = {}) {
  storage = maakStorage(opts)
  ;(globalThis as { window: { localStorage: unknown } }).window.localStorage = storage
}

const modP = import("./feed-prefs")

const item = (key: string) => ({
  key,
  titel: `Titel ${key}`,
  categorie: "nieuws",
  bewaardOp: "2026-07-28T10:00:00.000Z",
})

test("keys zijn verschillend per user-id", async () => {
  const m = await modP
  assert.notEqual(m.feedPrefsKey("user_a"), m.feedPrefsKey("user_b"))
  assert.equal(m.feedPrefsKey("user_a"), "sparki.ontdekken.prefs.v1.user_a")
})

test("data lekt niet tussen gebruikers (A → B → A)", async () => {
  const m = await modP
  reset()
  // Account A bewaart een item en dempt een bron
  m.toggleBewaard("user_a", item("news-1"))
  m.minderVan("user_a", "nieuws", "WielerFlits")
  // Account B ziet niets van A
  const b = m.leesFeedPrefs("user_b")
  assert.deepEqual(b, { bewaard: [], minderCategorie: [], minderBron: [] })
  // B maakt eigen voorkeur; A blijft intact
  m.minderVan("user_b", "route")
  const a = m.leesFeedPrefs("user_a")
  assert.equal(a.bewaard.length, 1)
  assert.deepEqual(a.minderBron, ["WielerFlits"])
  assert.deepEqual(a.minderCategorie, [])
  const b2 = m.leesFeedPrefs("user_b")
  assert.deepEqual(b2.minderCategorie, ["route"])
  assert.equal(b2.bewaard.length, 0)
})

test("veilige migratie: oude globale sleutel gaat éénmalig naar de eerste gebruiker", async () => {
  const m = await modP
  reset()
  storage.data.set(
    "sparki.ontdekken.prefs.v1",
    JSON.stringify({ bewaard: [item("news-9")], minderCategorie: ["nieuws"], minderBron: [] }),
  )
  const a = m.leesFeedPrefs("user_a")
  assert.equal(a.bewaard.length, 1)
  assert.deepEqual(a.minderCategorie, ["nieuws"])
  // Oude sleutel weg, markering gezet
  assert.equal(storage.data.has("sparki.ontdekken.prefs.v1"), false)
  assert.equal(storage.data.get("sparki.ontdekken.prefs.migrated.v1"), "user_a")
  // Een tweede gebruiker krijgt de oude data NIET
  const b = m.leesFeedPrefs("user_b")
  assert.deepEqual(b, { bewaard: [], minderCategorie: [], minderBron: [] })
})

test("migratie overschrijft nooit een bestaande eigen sleutel", async () => {
  const m = await modP
  reset()
  storage.data.set(
    m.feedPrefsKey("user_a"),
    JSON.stringify({ bewaard: [], minderCategorie: ["eigen"], minderBron: [] }),
  )
  storage.data.set(
    "sparki.ontdekken.prefs.v1",
    JSON.stringify({ bewaard: [], minderCategorie: ["legacy"], minderBron: [] }),
  )
  const a = m.leesFeedPrefs("user_a")
  assert.deepEqual(a.minderCategorie, ["eigen"])
  assert.equal(storage.data.has("sparki.ontdekken.prefs.v1"), false)
})

test("corrupte opslag geeft lege voorkeuren", async () => {
  const m = await modP
  reset()
  storage.data.set(m.feedPrefsKey("user_a"), "{niet-json")
  assert.deepEqual(m.leesFeedPrefs("user_a"), { bewaard: [], minderCategorie: [], minderBron: [] })
  // Corrupte legacy wordt niet doorgegeven aan een gebruiker
  reset()
  storage.data.set("sparki.ontdekken.prefs.v1", "%%%")
  const b = m.leesFeedPrefs("user_b")
  assert.deepEqual(b, { bewaard: [], minderCategorie: [], minderBron: [] })
  assert.equal(storage.data.has("sparki.ontdekken.prefs.v1"), false)
})

test("geen user-id ⇒ geen onveilige globale opslag", async () => {
  const m = await modP
  reset()
  m.toggleBewaard(null, item("news-2"))
  m.minderVan(undefined, "nieuws")
  assert.equal(storage.data.size, 0)
  assert.deepEqual(m.leesFeedPrefs(null), { bewaard: [], minderCategorie: [], minderBron: [] })
})

test("geblokkeerde opslag (incognito) crasht niet en geeft leeg", async () => {
  const m = await modP
  reset({ geblokkeerd: true })
  assert.deepEqual(m.leesFeedPrefs("user_a"), { bewaard: [], minderCategorie: [], minderBron: [] })
  const p = m.toggleBewaard("user_a", item("news-3"))
  // In-memory resultaat klopt wel (sessie-only)
  assert.equal(p.bewaard.length, 1)
})

test("maximaal 200 bewaarde items blijft gehandhaafd", async () => {
  const m = await modP
  reset()
  for (let i = 0; i < 205; i++) m.toggleBewaard("user_a", item(`news-${i}`))
  const a = m.leesFeedPrefs("user_a")
  assert.equal(a.bewaard.length, 200)
})
