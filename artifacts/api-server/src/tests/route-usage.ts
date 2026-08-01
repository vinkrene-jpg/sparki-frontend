// ROUTE_PAKKET_02A (SPARKI-BESLUIT-2026-003) — telling van routegebruik.
//
// Bewijst de productregels van de maandtelling (alleen meten, nooit
// blokkeren):
//   1.  Plannen telt niet.
//   2.  Aanpassen (PUT) telt niet.
//   3.  Bekijken telt niet.
//   4.  Succesvol opslaan telt één keer.
//   5.  Mislukte opslag telt niet.
//   6.  Succesvolle GPX-export telt één keer.
//   7.  Mislukte GPX-export telt niet.
//   10. Opslaan en daarna exporteren = samen één.
//   12. Dubbele API-aanroep telt niet dubbel.
//   13. Gelijktijdige verzoeken leveren samen één registratie op.
//   14. Een nieuwe kalendermaand begint op nul.
//   15. Maandgrens volgt Europe/Amsterdam, ook op een UTC-server.
//   16. Direct in de database gezette (seed-)routes tellen niet mee.
//   17. Go- en Compleet-accounts worden ook geteld; pakket-snapshot wordt
//       nooit herrekend.
//   18. Een gratis account gebruikt 12 routes zonder enige blokkade.
//   19. Een kopie telt afzonderlijk.
//   20. Met de 20%-vlag uit blijven opslaan/export-tests groen; een
//       RIDDEN-registratie wordt eerlijk overgeslagen.
// Tests 8, 9 en 11 (19,9% / 20% gereden) VERVALLEN: de 20%-vlag staat uit
// omdat de werkelijk afgelegde routeafstand server-side nog niet bestaat.
//
// Run: `pnpm --filter @workspace/api-server run test:route-usage`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  routesTable,
  routeUsageRegistrationsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { getCandidate, putCandidate } from "../lib/route-candidates";
import { recordCandidateExportUsage } from "../lib/route-usage-metering";
import {
  amsterdamCalendarMonth,
  isRiddenTriggerEnabled,
  recordRouteUsage,
} from "../lib/route-usage-metering";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

const RUN = `test_rusage_${Date.now()}`;
const gratisUser = `${RUN}_gratis`;
const goUser = `${RUN}_go`;
const proUser = `${RUN}_pro`;
const aanvullingUser = `${RUN}_aanvulling`;
const ALL = [gratisUser, goUser, proUser, aanvullingUser];

async function apiReq(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-dev-clerk-id": actor,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* niet-JSON (bijv. GPX) is prima */
  }
  return { status: res.status, json, text };
}

function gpxContent(seed: number): string {
  // Klein maar geldig GPX-spoor; seed maakt elke route uniek.
  const lat = 52.09 + seed * 0.001;
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Testroute ${seed}</name><trkseg><trkpt lat="${lat}" lon="5.12"><ele>10</ele></trkpt><trkpt lat="${lat + 0.002}" lon="5.13"><ele>12</ele></trkpt><trkpt lat="${lat + 0.004}" lon="5.14"><ele>11</ele></trkpt></trkseg></trk></gpx>`;
}

async function teller(actor: string): Promise<{ used: number; regs: any[] }> {
  const r = await apiReq("GET", "/api/route-usage", actor);
  assert(r.status === 200, `teller gaf ${r.status}`);
  return { used: r.json.used as number, regs: r.json.registrations as any[] };
}

async function directRoute(
  clerkId: string,
  opts: { geometry?: boolean; name: string },
): Promise<number> {
  // Simuleert een bestaande/seed-route: rechtstreeks in de DB, buiten de API
  // om. Mag NOOIT zelf een registratie opleveren (geen terugwerkende kracht).
  const [row] = await db
    .insert(routesTable)
    .values({
      clerkId,
      name: opts.name,
      status: "ready",
      visibility: "private",
      source: "manual",
      geometry:
        opts.geometry === false
          ? null
          : ([
              [52.1, 5.1],
              [52.105, 5.11],
              [52.11, 5.12],
            ] as never),
    })
    .returning({ id: routesTable.id });
  return row!.id;
}

async function cleanup() {
  await db
    .delete(routeUsageRegistrationsTable)
    .where(inArray(routeUsageRegistrationsTable.clerkId, ALL));
  await db.delete(routesTable).where(inArray(routesTable.clerkId, ALL));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  await startServer();
  try {
    for (const u of ALL) {
      await ensureAccount(u, `${u}@example.test`, "Teller", silentLogger);
    }
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription", productVariant: null })
      .where(eq(userProfilesTable.clerkId, gratisUser));
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription", productVariant: "sparki_go" })
      .where(eq(userProfilesTable.clerkId, goUser));
    await db
      .update(userProfilesTable)
      .set({ entitlementMode: "subscription", productVariant: "sparki_pro" })
      .where(eq(userProfilesTable.clerkId, proUser));

    let savedRouteId = 0;

    await scenario("15. maandgrens volgt Europe/Amsterdam (UTC-server)", () => {
      // 31 juli 23:30 Amsterdamse tijd = 21:30 UTC ⇒ juli.
      assert(
        amsterdamCalendarMonth(new Date("2026-07-31T21:30:00Z")) === "2026-07",
        "23:30 Ams op 31 juli moet in 2026-07 vallen",
      );
      // 1 augustus 00:30 Amsterdamse tijd = 31 juli 22:30 UTC ⇒ augustus.
      assert(
        amsterdamCalendarMonth(new Date("2026-07-31T22:30:00Z")) === "2026-08",
        "00:30 Ams op 1 aug moet in 2026-08 vallen",
      );
      assert(
        amsterdamCalendarMonth(new Date("2026-01-15T12:00:00Z")) === "2026-01",
        "normale dag valt in eigen maand",
      );
    });

    await scenario("20a. 20%-vlag staat uit en RIDDEN wordt overgeslagen", async () => {
      assert(!isRiddenTriggerEnabled(), "vlag hoort uit te staan in deze omgeving");
      const rid = await directRoute(gratisUser, { name: "ridden-vlag-test" });
      const r = await recordRouteUsage({
        clerkId: gratisUser,
        routeId: rid,
        usageType: "RIDDEN_20_PERCENT",
        source: "test",
      });
      assert(!r.registered && r.reason === "ridden_vlag_uit", "RIDDEN moet eerlijk geskipt worden");
      const t = await teller(gratisUser);
      assert(t.used === 0, `teller hoort 0 te zijn, is ${t.used}`);
    });

    await scenario("1. plannen telt niet", async () => {
      const before = (await teller(gratisUser)).used;
      // Plan-aanvraag (welke uitkomst dan ook — 200/4xx/503): nooit een registratie.
      await apiReq("POST", "/api/routes/generate", gratisUser, {
        distanceKm: 40,
        surface: "asfalt",
      });
      const after = (await teller(gratisUser)).used;
      assert(after === before, `plannen veranderde teller ${before}→${after}`);
    });

    await scenario("4. succesvol opslaan telt één keer", async () => {
      const r = await apiReq("POST", "/api/routes", gratisUser, {
        content: gpxContent(1),
        name: "Opslaan-test",
      });
      assert(r.status === 201, `opslaan gaf ${r.status}: ${r.text.slice(0, 120)}`);
      savedRouteId = r.json.route.id as number;
      const t = await teller(gratisUser);
      assert(t.used === 1, `teller hoort 1 te zijn, is ${t.used}`);
      assert(t.regs[0].usageType === "SAVED", "registratie hoort SAVED te zijn");
    });

    await scenario("5. mislukte opslag telt niet", async () => {
      const r = await apiReq("POST", "/api/routes", gratisUser, {
        content: "geen gpx",
      });
      assert(r.status >= 400, `ongeldige opslag hoort te falen, gaf ${r.status}`);
      const t = await teller(gratisUser);
      assert(t.used === 1, `teller hoort 1 te blijven, is ${t.used}`);
    });

    await scenario("3. bekijken telt niet", async () => {
      const a = await apiReq("GET", `/api/routes/${savedRouteId}`, gratisUser);
      assert(a.status === 200, `bekijken gaf ${a.status}`);
      await apiReq("GET", "/api/routes", gratisUser);
      const t = await teller(gratisUser);
      assert(t.used === 1, `bekijken veranderde de teller naar ${t.used}`);
    });

    await scenario("2. aanpassen telt niet", async () => {
      // Bewerken is een Go-beheer-extra: de Go-gebruiker past een eigen route
      // aan (inhoudelijk, versie-bump) — teller van Go blijft op zijn stand.
      const s = await apiReq("POST", "/api/routes", goUser, {
        content: gpxContent(2),
        name: "Go-route",
      });
      assert(s.status === 201, `Go-opslag gaf ${s.status}`);
      const goRoute = s.json.route.id as number;
      const before = (await teller(goUser)).used;
      const p = await apiReq("PUT", `/api/routes/${goRoute}`, goUser, {
        name: "Go-route hernoemd",
      });
      assert(p.status === 200, `aanpassen gaf ${p.status}: ${p.text.slice(0, 120)}`);
      const after = (await teller(goUser)).used;
      assert(after === before, `aanpassen veranderde teller ${before}→${after}`);
    });

    await scenario("10. opslaan en daarna exporteren = samen één", async () => {
      const e = await apiReq("GET", `/api/routes/${savedRouteId}/gpx`, gratisUser);
      assert(e.status === 200, `export gaf ${e.status}`);
      const t = await teller(gratisUser);
      assert(t.used === 1, `opslaan+export hoort samen 1 te zijn, is ${t.used}`);
    });

    await scenario("16+6. seed-route telt niet; succesvolle export telt één keer", async () => {
      const seedRoute = await directRoute(gratisUser, { name: "seed-route" });
      let t = await teller(gratisUser);
      assert(t.used === 1, `directe DB-rij mag niet tellen (teller ${t.used})`);
      const e = await apiReq("GET", `/api/routes/${seedRoute}/gpx`, gratisUser);
      assert(e.status === 200, `export gaf ${e.status}`);
      t = await teller(gratisUser);
      assert(t.used === 2, `na export hoort teller 2 te zijn, is ${t.used}`);
      const reg = t.regs.find((r) => r.routeId === seedRoute);
      assert(reg?.usageType === "GPX_EXPORTED", "registratie hoort GPX_EXPORTED te zijn");
    });

    await scenario("7. mislukte GPX-export telt niet", async () => {
      const bare = await directRoute(gratisUser, { geometry: false, name: "leeg" });
      const e = await apiReq("GET", `/api/routes/${bare}/gpx`, gratisUser);
      assert(e.status === 422, `export zonder geometrie hoort 422 te geven, gaf ${e.status}`);
      const t = await teller(gratisUser);
      assert(t.used === 2, `mislukte export veranderde teller naar ${t.used}`);
    });

    await scenario("12. dubbele API-aanroep telt niet dubbel", async () => {
      await apiReq("GET", `/api/routes/${savedRouteId}/gpx`, gratisUser);
      await apiReq("GET", `/api/routes/${savedRouteId}/gpx`, gratisUser);
      const t = await teller(gratisUser);
      assert(t.used === 2, `dubbele export veranderde teller naar ${t.used}`);
    });

    await scenario("13. gelijktijdige verzoeken ⇒ samen één registratie", async () => {
      const rid = await directRoute(gratisUser, { name: "concurrent" });
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          recordRouteUsage({
            clerkId: gratisUser,
            routeId: rid,
            usageType: "SAVED",
            source: "test:concurrent",
          }),
        ),
      );
      const wins = results.filter((r) => r.registered).length;
      assert(wins === 1, `precies één registratie hoort te winnen, won ${wins}`);
      const rows = await db
        .select()
        .from(routeUsageRegistrationsTable)
        .where(
          and(
            eq(routeUsageRegistrationsTable.clerkId, gratisUser),
            eq(routeUsageRegistrationsTable.routeId, rid),
          ),
        );
      assert(rows.length === 1, `database hoort 1 rij te hebben, heeft ${rows.length}`);
    });

    await scenario("14. nieuwe kalendermaand begint op nul", async () => {
      const rid = await directRoute(gratisUser, { name: "vorige-maand" });
      const r = await recordRouteUsage({
        clerkId: gratisUser,
        routeId: rid,
        usageType: "SAVED",
        source: "test:vorige-maand",
        occurredAt: new Date("2026-06-10T10:00:00Z"),
      });
      assert(r.registered && r.calendarMonth === "2026-06", "registratie hoort in 2026-06 te vallen");
      const t = await teller(gratisUser);
      // De teller toont alleen de huidige maand: juni-gebruik telt daar niet in.
      assert(t.used === 3, `huidige maand hoort 3 te zijn (excl. juni), is ${t.used}`);
    });

    await scenario("17. Go en Compleet worden geteld; snapshot wordt nooit herrekend", async () => {
      const go = await teller(goUser);
      assert(go.used === 1, `Go-teller hoort 1 te zijn, is ${go.used}`);
      assert(
        go.regs[0].subscriptionTier === "sparki_go",
        `Go-snapshot hoort sparki_go te zijn, is ${go.regs[0].subscriptionTier}`,
      );
      const s = await apiReq("POST", "/api/routes", proUser, {
        content: gpxContent(3),
        name: "Compleet-route",
      });
      assert(s.status === 201, `Compleet-opslag gaf ${s.status}`);
      let pro = await teller(proUser);
      assert(pro.used === 1 && pro.regs[0].subscriptionTier === "sparki_pro",
        `Compleet hoort 1×sparki_pro te zijn (${pro.used}×${pro.regs[0]?.subscriptionTier})`);
      // Downgrade ná registratie: de vastgelegde tier verandert NIET mee.
      await db
        .update(userProfilesTable)
        .set({ productVariant: null })
        .where(eq(userProfilesTable.clerkId, proUser));
      pro = await teller(proUser);
      assert(
        pro.regs[0].subscriptionTier === "sparki_pro",
        "snapshot mag na downgrade niet herrekend worden",
      );
    });

    await scenario("19. een kopie telt afzonderlijk", async () => {
      // Dupliceren is een Go-beheer-extra; de Go-gebruiker kopieert zijn route.
      const goRoutes = await apiReq("GET", "/api/routes", goUser);
      const original = (goRoutes.json.routes ?? goRoutes.json)[0];
      const before = (await teller(goUser)).used;
      const d = await apiReq("POST", `/api/routes/${original.id}/duplicate`, goUser);
      assert(d.status === 201, `dupliceren gaf ${d.status}: ${d.text.slice(0, 120)}`);
      const after = await teller(goUser);
      assert(after.used === before + 1, `kopie hoort apart te tellen (${before}→${after.used})`);
    });

    await scenario("18. gratis account gebruikt 12 routes zonder blokkade", async () => {
      const before = (await teller(gratisUser)).used;
      let needed = 12 - before;
      for (let i = 0; i < needed; i++) {
        const r = await apiReq("POST", "/api/routes", gratisUser, {
          content: gpxContent(100 + i),
          name: `Bulk ${i}`,
        });
        assert(
          r.status === 201,
          `opslag ${i + 1} hoort 201 te geven (nooit blokkeren), gaf ${r.status}: ${r.text.slice(0, 120)}`,
        );
      }
      const t = await teller(gratisUser);
      assert(t.used === 12, `gratis teller hoort 12 te zijn, is ${t.used}`);
    });

    await scenario("20b. met de vlag uit zijn opslaan/export gewoon geteld", async () => {
      // Impliciet bewezen door alle voorgaande scenario's mét vlag uit; hier
      // de expliciete eindcontrole dat er alleen SAVED/GPX_EXPORTED-rijen zijn.
      const rows = await db
        .select({ t: routeUsageRegistrationsTable.usageType })
        .from(routeUsageRegistrationsTable)
        .where(inArray(routeUsageRegistrationsTable.clerkId, ALL));
      assert(rows.length > 0, "er horen registraties te bestaan");
      assert(
        rows.every(
          (r) =>
            r.t === "SAVED" || r.t === "GPX_EXPORTED" || r.t === "TCX_EXPORTED",
        ),
        "alleen SAVED/GPX_EXPORTED/TCX_EXPORTED zijn toegestaan met de vlag uit",
      );
    });

    // ── AANVULLING 02a (besluit René 31-07-2026): elk exportformaat telt; ──
    // ── ook export van een niet-opgeslagen voorstel; samen max 1×/maand.  ──

    const cand = (name: string) =>
      putCandidate({
        clerkId: aanvullingUser,
        name,
        surface: "verhard",
        distanceKm: 25,
        durationSec: 3600,
        elevationGainM: 120,
        profile: [10, 12, 11, 14],
        climbs: [],
        nav: [],
        geometry: [
          [52.09, 5.12],
          [52.095, 5.13],
          [52.1, 5.14],
        ],
        waypoints: [],
        rationale: "testvoorstel",
        plannedWorkoutId: null,
        engineSurface: null,
    sport: "cycling",
      });

    await scenario("A2. succesvolle TCX-export telt", async () => {
      const rid = await directRoute(aanvullingUser, { name: "tcx-route" });
      const e = await apiReq("GET", `/api/routes/${rid}/tcx`, aanvullingUser);
      assert(e.status === 200, `tcx-export gaf ${e.status}`);
      const t = await teller(aanvullingUser);
      assert(t.used === 1, `tcx-export hoort 1 te tellen, is ${t.used}`);
      assert(
        t.regs.find((r) => r.routeId === rid)?.usageType === "TCX_EXPORTED",
        "registratie hoort TCX_EXPORTED te zijn",
      );
    });

    await scenario("A3. GPX en TCX van dezelfde route tellen samen één keer", async () => {
      const rid = await directRoute(aanvullingUser, { name: "beide-formaten" });
      const g = await apiReq("GET", `/api/routes/${rid}/gpx`, aanvullingUser);
      const x = await apiReq("GET", `/api/routes/${rid}/tcx`, aanvullingUser);
      assert(g.status === 200 && x.status === 200, "beide exports horen te slagen");
      const t = await teller(aanvullingUser);
      assert(t.used === 2, `gpx+tcx horen samen 1 extra te tellen (totaal 2), is ${t.used}`);
    });

    await scenario("A4. export van een niet-opgeslagen voorstel telt", async () => {
      const id = cand("voorstel-export");
      const e = await apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser);
      assert(e.status === 200, `voorstel-export gaf ${e.status}`);
      const t = await teller(aanvullingUser);
      assert(t.used === 3, `voorstel-export hoort te tellen (totaal 3), is ${t.used}`);
    });

    await scenario("A5. herhaalde export van hetzelfde voorstel telt niet dubbel", async () => {
      const id = cand("voorstel-herhaald");
      const g1 = await apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser);
      const g2 = await apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser);
      const x1 = await apiReq("GET", `/api/routes/candidate/${id}/tcx`, aanvullingUser);
      assert(
        g1.status === 200 && g2.status === 200 && x1.status === 200,
        "alle exports horen te slagen",
      );
      const t = await teller(aanvullingUser);
      assert(t.used === 4, `herhaald voorstel hoort 1× te tellen (totaal 4), is ${t.used}`);
    });

    await scenario("A6. mislukte export telt niet (TCX zonder geometrie)", async () => {
      const bare = await directRoute(aanvullingUser, { geometry: false, name: "leeg-tcx" });
      const e = await apiReq("GET", `/api/routes/${bare}/tcx`, aanvullingUser);
      assert(e.status === 422, `tcx zonder geometrie hoort 422 te geven, gaf ${e.status}`);
      const t = await teller(aanvullingUser);
      assert(t.used === 4, `mislukte export veranderde teller naar ${t.used}`);
    });

    await scenario("A7. voorstel exporteren en daarna opslaan = samen één (promotie)", async () => {
      const id = cand("voorstel-dan-opslaan");
      const e = await apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser);
      assert(e.status === 200, `voorstel-export gaf ${e.status}`);
      const s = await apiReq("POST", "/api/routes", aanvullingUser, {
        source: "generated",
        candidateId: id,
        name: "voorstel-dan-opslaan",
      });
      assert(s.status === 201, `opslaan gaf ${s.status}`);
      const t = await teller(aanvullingUser);
      assert(t.used === 5, `export+opslaan hoort samen 1 te tellen (totaal 5), is ${t.used}`);
      const reg = t.regs.find((r) => r.routeId === s.json.route.id);
      assert(reg, "registratie hoort gepromoveerd te zijn naar de route-id");
      assert(reg.usageType === "GPX_EXPORTED", "eerste tellende gebeurtenis (export) blijft staan");
    });

    await scenario("A9. export ná opslaan van hetzelfde voorstel telt niet dubbel", async () => {
      const id = cand("opslaan-dan-export");
      const s = await apiReq("POST", "/api/routes", aanvullingUser, {
        source: "generated",
        candidateId: id,
        name: "opslaan-dan-export",
      });
      assert(s.status === 201, `opslaan gaf ${s.status}`);
      const before = (await teller(aanvullingUser)).used;
      const e = await apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser);
      assert(e.status === 200, `kandidaat-export ná opslaan gaf ${e.status}`);
      const t = await teller(aanvullingUser);
      assert(t.used === before, `export ná opslaan telde dubbel (${before} → ${t.used})`);
      const [dangling] = await db
        .select({ id: routeUsageRegistrationsTable.id })
        .from(routeUsageRegistrationsTable)
        .where(
          and(
            eq(routeUsageRegistrationsTable.clerkId, aanvullingUser),
            eq(routeUsageRegistrationsTable.candidateKey, id),
          ),
        );
      assert(
        !dangling,
        "er mag geen losse kandidaatregistratie naast de route bestaan",
      );
    });

    await scenario("A10. gelijktijdige exports + opslaan ⇒ samen precies één", async () => {
      const id = cand("gelijktijdig");
      const before = (await teller(aanvullingUser)).used;
      const [g, x, s] = await Promise.all([
        apiReq("GET", `/api/routes/candidate/${id}/gpx`, aanvullingUser),
        apiReq("GET", `/api/routes/candidate/${id}/tcx`, aanvullingUser),
        apiReq("POST", "/api/routes", aanvullingUser, {
          source: "generated",
          candidateId: id,
          name: "gelijktijdig",
        }),
      ]);
      assert(
        g.status === 200 && x.status === 200 && s.status === 201,
        `verwacht 200/200/201, kreeg ${g.status}/${x.status}/${s.status}`,
      );
      // Verreken eventueel nog levende kandidaatrij expliciet nogmaals via een
      // tweede export (die onder de route-identiteit valt) — daarna hoort er
      // exact één registratie bij te zijn gekomen.
      const t = await teller(aanvullingUser);
      assert(
        t.used === before + 1,
        `gelijktijdig exporteren+opslaan hoort samen 1 te tellen (${before} → ${t.used})`,
      );
    });

    await scenario("A11. verouderde export-momentopname kan niet dubbel tellen", async () => {
      // Deterministische naspeling van de race: de export leest de kandidaat
      // (savedRouteId nog null — de verouderde momentopname), daarna wint het
      // opslaan de lock, en pas dán registreert de export. Omdat de
      // identiteitskeuze BINNEN de lock via een verse lezing gebeurt, hoort
      // de export onder de route-identiteit te vallen: precies één routerij,
      // nul kandidaatrijen.
      const id = cand("verouderde-momentopname");
      const stale = getCandidate(id, aanvullingUser);
      assert(stale && stale.savedRouteId == null, "momentopname hoort nog niet opgeslagen te zijn");
      const s = await apiReq("POST", "/api/routes", aanvullingUser, {
        source: "generated",
        candidateId: id,
        name: "verouderde-momentopname",
      });
      assert(s.status === 201, `opslaan gaf ${s.status}`);
      const before = (await teller(aanvullingUser)).used;
      // De "hervatte" export: verse lezing binnen de lock, niet de momentopname.
      await recordCandidateExportUsage({
        clerkId: aanvullingUser,
        candidateKey: id,
        resolveSavedRouteId: () =>
          getCandidate(id, aanvullingUser)?.savedRouteId ?? null,
        usageType: "GPX_EXPORTED",
        source: "gpx-export:voorstel",
      });
      const t = await teller(aanvullingUser);
      assert(t.used === before, `export na opslaan telde dubbel (${before} → ${t.used})`);
      const candRows = await db
        .select({ id: routeUsageRegistrationsTable.id })
        .from(routeUsageRegistrationsTable)
        .where(
          and(
            eq(routeUsageRegistrationsTable.clerkId, aanvullingUser),
            eq(routeUsageRegistrationsTable.candidateKey, id),
          ),
        );
      assert(candRows.length === 0, "er hoort geen kandidaatrij te bestaan");
    });

    await scenario("A8. planner-analoge route telt pas bij opslaan/exporteren", async () => {
      // Genereren door de planner schrijft rechtstreeks (buiten opslaan/
      // export om) — dat telt niet (zie ook 16); daarna exporteren telt wél.
      const before = (await teller(aanvullingUser)).used;
      const rid = await directRoute(aanvullingUser, { name: "planner-route" });
      let t = await teller(aanvullingUser);
      assert(t.used === before, `alleen genereren mag niet tellen (${before} → ${t.used})`);
      const e = await apiReq("GET", `/api/routes/${rid}/tcx`, aanvullingUser);
      assert(e.status === 200, `export gaf ${e.status}`);
      t = await teller(aanvullingUser);
      assert(t.used === before + 1, `na export hoort teller ${before + 1} te zijn, is ${t.used}`);
    });
  } finally {
    await cleanup();
    await stopServer();
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(
    `\n${results.length - failed}/${results.length} scenario's geslaagd. ` +
      "Tests 8/9/11 (20% gereden) vervallen: 20%-vlag staat uit (geen betrouwbare server-side routedekking).",
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
