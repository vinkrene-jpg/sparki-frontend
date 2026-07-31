// Sparki World — veilige sociale omgeving. DB-backed route contract test.
//
// Boot de ECHTE Express-app en seedt: volwassen renner A, vriend F,
// buitenstaander S en minderjarige/onbekende-leeftijd M. Bewijst:
//   • bericht delen (tekst verplicht), zichtbaarheid volgers
//   • feed-zichtbaarheid: vriend ziet het, buitenstaander niet
//   • openbaar: expliciete bevestiging verplicht; minderjarig/onbekend
//     fail-closed (403) tenzij oudertoestemming "granted"
//   • whitelist deelbare velden (onbekend veld → 400)
//   • waardering idempotent (unieke index), reactie met tekst
//   • blokkade werkt in beide richtingen en direct in de feed
//   • melden → moderatie: verbergen (met notificatie-pad) en herstellen
//   • intrekken door eigenaar → weg uit de feed
//   • bron verwijderen (wedstrijd) → deel-item automatisch opgeruimd
//   • meldingsvoorkeuren GET-default + PUT-roundtrip
//   • automatisch signaal bij kwetsende taal (alleen melding, niets verwijderd)
//
// Run: `pnpm --filter @workspace/api-server run test:world-social`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  racesTable,
  trainingSessionsTable,
  activityImportsTable,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  friendLinksTable,
  worldSharedItemsTable,
  worldReactionsTable,
  worldBlocksTable,
  worldReportsTable,
  worldNotificationPrefsTable,
  privacyZonesTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  haversineMeters,
  segmentMinDistanceMeters,
} from "../lib/world-social/location";

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

const RUN = `test_world_${Date.now()}`;
const clerkA = `${RUN}_a`; // volwassen eigenaar
const clerkF = `${RUN}_f`; // vriend van A
const clerkS = `${RUN}_s`; // buitenstaander
const clerkM = `${RUN}_m`; // onbekende leeftijd (fail-closed minderjarig)
const ALL = [clerkA, clerkF, clerkS, clerkM];

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function cleanup() {
  const items = await db
    .select({ id: worldSharedItemsTable.id })
    .from(worldSharedItemsTable)
    .where(inArray(worldSharedItemsTable.clerkId, ALL));
  const itemIds = items.map((i) => i.id);
  if (itemIds.length) {
    await db
      .delete(worldReactionsTable)
      .where(inArray(worldReactionsTable.itemId, itemIds))
      .catch(() => {});
  }
  await db
    .delete(worldReportsTable)
    .where(
      or(
        inArray(worldReportsTable.reporterClerkId, ALL),
        itemIds.length
          ? inArray(
              worldReportsTable.targetId,
              itemIds.map((i) => String(i)),
            )
          : eq(worldReportsTable.id, -1),
      ),
    )
    .catch(() => {});
  for (const c of ALL) {
    await db
      .delete(worldBlocksTable)
      .where(
        or(
          eq(worldBlocksTable.blockerClerkId, c),
          eq(worldBlocksTable.blockedClerkId, c),
        ),
      )
      .catch(() => {});
    await db
      .delete(worldNotificationPrefsTable)
      .where(eq(worldNotificationPrefsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(worldSharedItemsTable)
      .where(eq(worldSharedItemsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(friendLinksTable)
      .where(
        or(
          eq(friendLinksTable.requesterClerkId, c),
          eq(friendLinksTable.addresseeClerkId, c),
        ),
      )
      .catch(() => {});
    await db.delete(racesTable).where(eq(racesTable.clerkId, c)).catch(() => {});
    await db
      .delete(activityImportsTable)
      .where(eq(activityImportsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function feedIds(actor: string): Promise<number[]> {
  const { status, json } = await req("GET", "/api/world-social/feed", actor);
  assert(status === 200, `feed voor ${actor} gaf ${status}`);
  return (json.items as { id: number }[]).map((i) => i.id);
}

async function main() {
  await startServer();

  for (const [c, name] of [
    [clerkA, "Renner A"],
    [clerkF, "Vriend F"],
    [clerkS, "Buitenstaander S"],
    [clerkM, "Renner M"],
  ] as const) {
    await ensureAccount(c, `${c}@example.test`, name, silentLogger);
  }
  // A is aantoonbaar volwassen; M heeft bewust GEEN geboortedatum.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: "1990-05-01", birthYear: 1990 })
    .where(eq(athleteProfilesTable.clerkId, clerkA));
  // A ↔ F zijn vrienden.
  await db.insert(friendLinksTable).values({
    requesterClerkId: clerkA,
    addresseeClerkId: clerkF,
    status: "accepted",
  });

  let itemId = 0;

  await scenario("bericht zonder tekst wordt geweigerd (400)", async () => {
    const r = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      visibility: "volgers",
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await scenario("bericht delen met vrienden lukt (201)", async () => {
    const r = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      message: `${RUN} mooie duurrit vandaag`,
      visibility: "volgers",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    itemId = r.json.id;
    assert(Number.isInteger(itemId) && itemId > 0, "geen item-id terug");
  });

  await scenario("vriend ziet het item in de feed", async () => {
    const ids = await feedIds(clerkF);
    assert(ids.includes(itemId), "vriend ziet het volgers-item niet");
  });

  await scenario("buitenstaander ziet het item NIET", async () => {
    const ids = await feedIds(clerkS);
    assert(!ids.includes(itemId), "buitenstaander ziet een volgers-item");
  });

  await scenario("buitenstaander krijgt 404 op detail (geen lek)", async () => {
    const r = await req("GET", `/api/world-social/items/${itemId}`, clerkS);
    assert(r.status === 404, `verwacht 404, kreeg ${r.status}`);
  });

  await scenario("openbaar zonder bevestiging → 400 met needsConfirmation", async () => {
    const r = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      message: `${RUN} openbaar zonder vinkje`,
      visibility: "openbaar",
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert(r.json?.needsConfirmation === true, "needsConfirmation ontbreekt");
  });

  let publicId = 0;
  await scenario("volwassene deelt openbaar mét bevestiging (201)", async () => {
    const r = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      message: `${RUN} openbare groet`,
      visibility: "openbaar",
      confirmPublic: true,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    publicId = r.json.id;
  });

  await scenario("buitenstaander ziet het openbare item wél", async () => {
    const ids = await feedIds(clerkS);
    assert(ids.includes(publicId), "openbaar item niet zichtbaar voor buitenstaander");
  });

  await scenario("onbekende leeftijd mag NIET openbaar delen (403, fail-closed)", async () => {
    const r = await req("POST", "/api/world-social/items", clerkM, {
      sourceType: "bericht",
      message: `${RUN} minderjarig openbaar`,
      visibility: "openbaar",
      confirmPublic: true,
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  await scenario("met oudertoestemming mag M wél openbaar delen", async () => {
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: clerkM, parentConsentStatus: "granted" })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { parentConsentStatus: "granted" },
      });
    const r = await req("POST", "/api/world-social/items", clerkM, {
      sourceType: "bericht",
      message: `${RUN} met toestemming`,
      visibility: "openbaar",
      confirmPublic: true,
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
  });

  await scenario("niet-deelbaar veld wordt geweigerd (400)", async () => {
    const r = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      message: `${RUN} met fout veld`,
      visibility: "volgers",
      sharedFields: ["afstand", "hartslagzones"],
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await scenario("waardering is idempotent (unieke index)", async () => {
    const r1 = await req(
      "POST",
      `/api/world-social/items/${itemId}/reactions`,
      clerkF,
      { kind: "waardering" },
    );
    assert(r1.status === 201, `eerste waardering gaf ${r1.status}`);
    const r2 = await req(
      "POST",
      `/api/world-social/items/${itemId}/reactions`,
      clerkF,
      { kind: "waardering" },
    );
    assert(
      r2.status === 200 || r2.status === 201,
      `tweede waardering gaf ${r2.status}`,
    );
    const rows = await db
      .select({ id: worldReactionsTable.id })
      .from(worldReactionsTable)
      .where(
        and(
          eq(worldReactionsTable.itemId, itemId),
          eq(worldReactionsTable.clerkId, clerkF),
          eq(worldReactionsTable.kind, "waardering"),
        ),
      );
    assert(rows.length === 1, `verwacht 1 waardering, gevonden ${rows.length}`);
  });

  await scenario("reactie met tekst verschijnt in het detail", async () => {
    const r = await req(
      "POST",
      `/api/world-social/items/${itemId}/reactions`,
      clerkF,
      { kind: "reactie", body: `${RUN} lekker gereden!` },
    );
    assert(r.status === 201, `reactie gaf ${r.status}`);
    const d = await req("GET", `/api/world-social/items/${itemId}`, clerkF);
    assert(d.status === 200, `detail gaf ${d.status}`);
    const bodies = (d.json.reacties as { body: string | null }[]).map((x) => x.body);
    assert(
      bodies.includes(`${RUN} lekker gereden!`),
      "reactie niet zichtbaar in detail",
    );
  });

  await scenario("blokkade verbergt items in BEIDE richtingen", async () => {
    const b = await req("POST", "/api/world-social/blocks", clerkF, {
      blockedClerkId: clerkA,
    });
    assert(b.status === 201, `blokkeren gaf ${b.status}`);
    const idsF = await feedIds(clerkF);
    assert(!idsF.includes(itemId), "geblokkeerd item nog zichtbaar voor blokkeerder");
    assert(!idsF.includes(publicId), "openbaar item van geblokkeerde nog zichtbaar");
    // andere richting: F deelt, A mag het niet zien
    const share = await req("POST", "/api/world-social/items", clerkF, {
      sourceType: "bericht",
      message: `${RUN} bericht van F`,
      visibility: "volgers",
    });
    assert(share.status === 201, `delen door F gaf ${share.status}`);
    const idsA = await feedIds(clerkA);
    assert(!idsA.includes(share.json.id), "item van blokkeerder zichtbaar voor geblokkeerde");
    const un = await req("DELETE", `/api/world-social/blocks/${clerkA}`, clerkF);
    assert(un.status === 200, `deblokkeren gaf ${un.status}`);
    const after = await feedIds(clerkF);
    assert(after.includes(itemId), "item na deblokkeren niet terug");
  });

  await scenario("melden → moderatie verbergt en herstelt", async () => {
    const rep = await req("POST", "/api/world-social/reports", clerkF, {
      targetType: "item",
      targetId: String(itemId),
      reason: `${RUN} testmelding`,
    });
    assert(rep.status === 201, `melden gaf ${rep.status}`);
    const reportId = rep.json.id;
    const list = await req("GET", "/api/world-social/moderation", clerkA);
    assert(list.status === 200, `moderatielijst gaf ${list.status}`);
    assert(
      (list.json as { id: number }[]).some((r) => r.id === reportId),
      "melding niet in moderatielijst",
    );
    const hide = await req(
      "POST",
      `/api/world-social/moderation/${reportId}/besluit`,
      clerkA,
      { action: "verborgen", note: `${RUN} verborgen voor test` },
    );
    assert(hide.status === 200, `verbergen gaf ${hide.status}`);
    const idsF = await feedIds(clerkF);
    assert(!idsF.includes(itemId), "verborgen item nog in feed");
    // herstel via nieuwe melding
    const rep2 = await req("POST", "/api/world-social/reports", clerkF, {
      targetType: "item",
      targetId: String(itemId),
      reason: `${RUN} herstelverzoek`,
    });
    const fix = await req(
      "POST",
      `/api/world-social/moderation/${rep2.json.id}/besluit`,
      clerkA,
      { action: "hersteld" },
    );
    assert(fix.status === 200, `herstellen gaf ${fix.status}`);
    const back = await feedIds(clerkF);
    assert(back.includes(itemId), "hersteld item niet terug in feed");
  });

  await scenario("eigenaar trekt item in → weg uit de feed", async () => {
    const del = await req("DELETE", `/api/world-social/items/${publicId}`, clerkA);
    assert(del.status === 200, `intrekken gaf ${del.status}`);
    const ids = await feedIds(clerkS);
    assert(!ids.includes(publicId), "ingetrokken item nog zichtbaar");
  });

  await scenario("bron verwijderen ruimt het deel-item op", async () => {
    const [race] = await db
      .insert(racesTable)
      .values({ clerkId: clerkA, name: `${RUN} koers`, raceDate: "2026-08-01" })
      .returning();
    const share = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "race",
      sourceId: race!.id,
      visibility: "volgers",
      sharedFields: ["uitslag"],
    });
    assert(share.status === 201, `wedstrijd delen gaf ${share.status}`);
    const del = await req("DELETE", `/api/races/${race!.id}`, clerkA);
    assert(del.status === 200, `wedstrijd verwijderen gaf ${del.status}`);
    const [row] = await db
      .select()
      .from(worldSharedItemsTable)
      .where(eq(worldSharedItemsTable.id, share.json.id))
      .limit(1);
    assert(
      !row || row.status === "verwijderd",
      `deel-item niet opgeruimd (status ${row?.status})`,
    );
  });

  await scenario("meldingsvoorkeuren: default + roundtrip", async () => {
    const get = await req("GET", "/api/world-social/prefs", clerkA);
    assert(get.status === 200, `prefs GET gaf ${get.status}`);
    assert(get.json.notifyReactions === true, "default notifyReactions onwaar");
    const put = await req("PUT", "/api/world-social/prefs", clerkA, {
      notifyReactions: false,
      muteDuringRide: false,
    });
    assert(put.status === 200, `prefs PUT gaf ${put.status}`);
    const again = await req("GET", "/api/world-social/prefs", clerkA);
    assert(again.json.notifyReactions === false, "PUT niet bewaard");
    assert(again.json.muteDuringRide === false, "muteDuringRide niet bewaard");
    assert(again.json.notifyRequests === true, "onaangeraakte voorkeur veranderd");
  });

  await scenario("kwetsende taal geeft automatisch signaal (geen verwijdering)", async () => {
    const share = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "bericht",
      message: `${RUN} die klootzak reed me eraf`,
      visibility: "volgers",
    });
    assert(share.status === 201, `delen gaf ${share.status}`);
    const [signal] = await db
      .select()
      .from(worldReportsTable)
      .where(
        and(
          eq(worldReportsTable.reporterClerkId, "sparki-signaal"),
          eq(worldReportsTable.targetId, String(share.json.id)),
        ),
      )
      .limit(1);
    assert(signal, "geen automatisch signaal aangemaakt");
    const [row] = await db
      .select({ status: worldSharedItemsTable.status })
      .from(worldSharedItemsTable)
      .where(eq(worldSharedItemsTable.id, share.json.id))
      .limit(1);
    assert(row?.status === "actief", "signaal heeft item ten onrechte verwijderd/verborgen");
  });

  await scenario("routeprivacy: eigenaar origineel, vriend getransformeerd, buitenstaander 404", async () => {
    // Rit van ~4,3 km in een rechte lijn (punten om de ~110 m); huis ver weg
    // zodat alleen start/eind-trimmen en vereenvoudiging spelen.
    const coords: [number, number][] = [];
    for (let i = 0; i < 40; i++) coords.push([5.0, 52.0 + i * 0.001]);
    const [session] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: clerkA,
        sessionDate: "2026-07-20",
        title: `${RUN} duurrit`,
        durationMin: 90,
      })
      .returning();
    await db.insert(activityImportsTable).values({
      clerkId: clerkA,
      fileName: `${RUN}.gpx`,
      fileType: "gpx",
      status: "linked",
      linkedTrainingSessionId: session!.id,
      parsedSummary: { route: { geometry: { type: "LineString", coordinates: coords } } },
    });
    const share = await req("POST", "/api/world-social/items", clerkA, {
      sourceType: "session",
      sourceId: session!.id,
      visibility: "volgers",
      sharedFields: ["afstand", "route"],
    });
    assert(share.status === 201, `rit delen gaf ${share.status}`);
    const id = share.json.id;

    const own = await req("GET", `/api/world-social/items/${id}/track`, clerkA);
    assert(own.status === 200, `eigenaar-track gaf ${own.status}`);
    assert(own.json.origineel === true, "eigenaar krijgt geen origineel");
    assert(own.json.track.length === 40, `eigenaar mist punten (${own.json.track.length})`);

    const friend = await req("GET", `/api/world-social/items/${id}/track`, clerkF);
    assert(friend.status === 200, `vriend-track gaf ${friend.status}`);
    assert(friend.json.origineel === false, "vriend krijgt origineel-vlag");
    assert(Array.isArray(friend.json.track), "vriend krijgt geen track");
    assert(
      friend.json.track.length < 40,
      `vriend-track niet getrimd/vereenvoudigd (${friend.json.track.length})`,
    );
    const first = friend.json.track[0];
    assert(
      Math.abs(first.lat - 52.0) > 0.003,
      "startpunt niet verborgen voor kijker",
    );

    const stranger = await req("GET", `/api/world-social/items/${id}/track`, clerkS);
    assert(stranger.status === 404, `buitenstaander-track gaf ${stranger.status}`);

    // Taak #513: een zelf beheerde privacyzone (bijv. werk) midden op de rit
    // maskeert óók punten in de World Social-rittenweergave — niet alleen in
    // de routebibliotheek.
    const zoneCenter = { lat: 52.02, lon: 5.0 };
    const zoneRadiusM = 800;
    await db.insert(privacyZonesTable).values({
      clerkId: clerkA,
      label: "Werk",
      kind: "werk",
      lat: zoneCenter.lat,
      lon: zoneCenter.lon,
      radiusM: zoneRadiusM,
    });
    const friend2 = await req("GET", `/api/world-social/items/${id}/track`, clerkF);
    assert(friend2.status === 200, `vriend-track (met zone) gaf ${friend2.status}`);
    assert(Array.isArray(friend2.json.track), "vriend krijgt geen track met zone");
    const track2 = friend2.json.track as { lat: number; lon: number }[];
    for (const p of track2) {
      const d = haversineMeters(p, zoneCenter);
      assert(
        d > zoneRadiusM,
        `punt op ${Math.round(d)} m binnen de werkzone gelekt`,
      );
    }
    for (let i = 1; i < track2.length; i++) {
      assert(
        segmentMinDistanceMeters(track2[i - 1]!, track2[i]!, zoneCenter) >
          zoneRadiusM,
        "lijnstuk snijdt de werkzone in de rittenweergave",
      );
    }

    // Zones zijn niet-optioneel: zelfs wanneer de eigenaar het item met
    // privacyZone:false bijwerkt, krijgt een kijker nooit punten binnen huis-
    // of werkzone. Huis ligt hier ver weg, dus we zetten hem eerst midden op
    // de rit om ook de impliciete huiszone te bewijzen.
    const homeOnRoute = { lat: 52.03, lon: 5.0 };
    await db
      .update(athleteProfilesTable)
      .set({ homeLat: String(homeOnRoute.lat), homeLon: String(homeOnRoute.lon) })
      .where(eq(athleteProfilesTable.clerkId, clerkA));
    const relaxed = await req("PUT", `/api/world-social/items/${id}`, clerkA, {
      locationPrivacy: { hideStartEnd: false, privacyZone: false, simplify: false },
    });
    assert(relaxed.status === 200, `privacy versoepelen gaf ${relaxed.status}`);
    const friend3 = await req("GET", `/api/world-social/items/${id}/track`, clerkF);
    assert(friend3.status === 200, `vriend-track (privacyZone:false) gaf ${friend3.status}`);
    assert(Array.isArray(friend3.json.track), "vriend krijgt geen track (privacyZone:false)");
    const track3 = friend3.json.track as { lat: number; lon: number }[];
    for (const p of track3) {
      const dWork = haversineMeters(p, zoneCenter);
      const dHome = haversineMeters(p, homeOnRoute);
      assert(dWork > zoneRadiusM, `werkzone gelekt ondanks privacyZone:false (${Math.round(dWork)} m)`);
      assert(dHome > 750, `huiszone gelekt ondanks privacyZone:false (${Math.round(dHome)} m)`);
    }
    for (let i = 1; i < track3.length; i++) {
      assert(
        segmentMinDistanceMeters(track3[i - 1]!, track3[i]!, zoneCenter) > zoneRadiusM &&
          segmentMinDistanceMeters(track3[i - 1]!, track3[i]!, homeOnRoute) > 750,
        "lijnstuk snijdt een zone ondanks privacyZone:false",
      );
    }
    await db
      .update(athleteProfilesTable)
      .set({ homeLat: null, homeLon: null })
      .where(eq(athleteProfilesTable.clerkId, clerkA));
    await db
      .delete(privacyZonesTable)
      .where(eq(privacyZonesTable.clerkId, clerkA));
  });

  await cleanup();
  await stopServer();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test run failed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
