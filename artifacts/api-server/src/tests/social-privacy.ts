// Sociale omgeving & profielprivacy — DB-backed route contract test.
//
// Dekt de complete nieuwe sociale laag: netwerkoverzicht (vrienden/volgers/
// gevolgd), volgen/ontvolgen, per-categorie privacy (17 categorieën × 6
// publieksniveaus), profielweergave met server-side filtering, blokkeren
// (verbreekt relaties, neutrale weigering), rapporteren, weigering-zonder-
// herverzoek en privacyvriendelijke contactmatching (sha256).
//
// Kernprincipes die dit bewijst:
//   • Fail-closed: afgeschermd, geblokkeerd en niet-bestaand zijn voor de
//     kijker NIET te onderscheiden (zelfde neutrale 404 / weigertekst).
//   • De rechtenlaag (lib/profile-privacy.ts) is de enige waarheid; de
//     profielprojectie lekt geen afgeschermde velden.
//   • Na een geweigerd vriendschapsverzoek kan de afgewezene NIET opnieuw
//     sturen; alleen de weigeraar mag heropenen.
//
// Run: `node ./scripts/run-test.mjs social-privacy` (vanuit artifacts/api-server)
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  friendLinksTable,
  followLinksTable,
  profilePrivacyTable,
  socialReportsTable,
  worldBlocksTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { sha256Hex } from "../engines/social/network";

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

// ── Server boot ──────────────────────────────────────────────────────────────
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

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_socpriv_${Date.now()}`;
const A = `${RUN}_a`; // eigenaar wiens profiel bekeken wordt
const B = `${RUN}_b`; // vreemde / later vriend
const C = `${RUN}_c`; // volger
const D = `${RUN}_d`; // geblokkeerde
const ALL = [A, B, C, D];

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
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

async function seed() {
  for (const id of ALL) {
    await ensureAccount(
      id,
      `${id}@example.test`,
      `Sporter ${id.slice(-1).toUpperCase()}`,
      silentLogger,
    );
  }
}

async function befriend(x: string, y: string) {
  await db
    .insert(friendLinksTable)
    .values({ requesterClerkId: x, addresseeClerkId: y, status: "accepted" })
    .onConflictDoUpdate({
      target: [friendLinksTable.requesterClerkId, friendLinksTable.addresseeClerkId],
      set: { status: "accepted" },
    });
}

async function cleanup() {
  await db
    .delete(friendLinksTable)
    .where(
      or(
        inArray(friendLinksTable.requesterClerkId, ALL),
        inArray(friendLinksTable.addresseeClerkId, ALL),
      ),
    );
  await db
    .delete(followLinksTable)
    .where(
      or(
        inArray(followLinksTable.followerClerkId, ALL),
        inArray(followLinksTable.followeeClerkId, ALL),
      ),
    );
  await db
    .delete(worldBlocksTable)
    .where(
      or(
        inArray(worldBlocksTable.blockerClerkId, ALL),
        inArray(worldBlocksTable.blockedClerkId, ALL),
      ),
    );
  await db
    .delete(socialReportsTable)
    .where(
      or(
        inArray(socialReportsTable.reporterClerkId, ALL),
        inArray(socialReportsTable.reportedClerkId, ALL),
      ),
    );
  await db
    .delete(profilePrivacyTable)
    .where(inArray(profilePrivacyTable.clerkId, ALL));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ALL));
}

// ── Scenario's ───────────────────────────────────────────────────────────────
async function main() {
  await seed();
  await startServer();

  // 1. Privacy-defaults: 17 categorieën, 6 publieksniveaus
  await scenario("privacy GET geeft 17 categorieën + 6 niveaus met defaults", async () => {
    const r = await req("GET", "/api/social/privacy", A);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.json.registry?.length === 17, `registry ${r.json.registry?.length}`);
    assert(r.json.audiences?.length === 6, `audiences ${r.json.audiences?.length}`);
    assert(r.json.categories?.gezondheid === "alleen_ik", "gezondheid default niet alleen_ik");
    assert(r.json.categories?.trainingen === "vrienden", "trainingen default niet vrienden");
  });

  // 2. PUT valideert
  await scenario("privacy PUT weigert onbekende categorie en ongeldig niveau", async () => {
    const bad1 = await req("PUT", "/api/social/privacy", A, { categories: { nep: "iedereen" } });
    assert(bad1.status === 400, `onbekende categorie: status ${bad1.status}`);
    const bad2 = await req("PUT", "/api/social/privacy", A, { categories: { naam: "wereld" } });
    assert(bad2.status === 400, `ongeldig niveau: status ${bad2.status}`);
  });

  // 3. PUT slaat op en merge't
  await scenario("privacy PUT slaat wijziging op zonder andere categorieën te raken", async () => {
    const r = await req("PUT", "/api/social/privacy", A, {
      categories: { trainingen: "iedereen" },
    });
    assert(r.status === 200, `status ${r.status}`);
    const after = await req("GET", "/api/social/privacy", A);
    assert(after.json.categories.trainingen === "iedereen", "trainingen niet opgeslagen");
    assert(after.json.categories.gezondheid === "alleen_ik", "gezondheid mag niet wijzigen");
    // Terugzetten naar default voor de rest van de test
    await req("PUT", "/api/social/privacy", A, { categories: { trainingen: "vrienden" } });
  });

  // 4. Vreemde ziet profiel (default sparki) maar géén vrienden-categorieën
  await scenario("vreemde ziet profiel maar trainingen/wedstrijden blijven verborgen", async () => {
    const r = await req("GET", `/api/social/profile/${A}`, B);
    assert(r.status === 200, `status ${r.status}`);
    const p = r.json.profile;
    assert(p.displayName !== null, "naam moet zichtbaar zijn op sparki-niveau");
    assert(p.zichtbaar.trainingen === false, "trainingen zichtbaar voor vreemde");
    assert(p.trainingSummary === null, "trainingSummary lekt naar vreemde");
    assert(p.zichtbaar.gezondheid === false, "gezondheid zichtbaar voor vreemde");
  });

  // 5. Vriend ziet vrienden-categorieën
  await scenario("vriend ziet trainingen-samenvatting (vrienden-niveau)", async () => {
    await befriend(A, B);
    const r = await req("GET", `/api/social/profile/${A}`, B);
    assert(r.status === 200, `status ${r.status}`);
    const p = r.json.profile;
    assert(p.zichtbaar.trainingen === true, "vriend ziet trainingen niet");
    assert(p.trainingSummary !== null, "trainingSummary ontbreekt voor vriend");
    assert(p.isVriend === true, "isVriend moet true zijn");
    assert(p.zichtbaar.gezondheid === false, "gezondheid mag óók voor vriend dicht zijn");
  });

  // 6. profiel=alleen_ik ⇒ neutrale 404 voor iedereen behalve eigenaar
  await scenario("afgeschermd profiel geeft neutrale 404, eigenaar blijft self", async () => {
    await req("PUT", "/api/social/privacy", A, { categories: { profiel: "alleen_ik" } });
    const rB = await req("GET", `/api/social/profile/${A}`, B);
    assert(rB.status === 404, `vriend: status ${rB.status}`);
    const rSelf = await req("GET", `/api/social/profile/${A}`, A);
    assert(rSelf.status === 200 && rSelf.json.profile.relation === "self", "eigenaar geblokkeerd");
    await req("PUT", "/api/social/privacy", A, { categories: { profiel: "sparki" } });
  });

  // 7. Niet-bestaand profiel = zelfde neutrale 404 (geen onderscheid)
  await scenario("niet-bestaand profiel geeft dezelfde neutrale 404", async () => {
    const r = await req("GET", `/api/social/profile/${RUN}_bestaat_niet`, B);
    assert(r.status === 404, `status ${r.status}`);
  });

  // 8. Volgen + overzichtstellingen
  await scenario("volgen werkt en overzicht telt volgers/gevolgd correct", async () => {
    const f = await req("POST", `/api/social/follow/${A}`, C);
    assert(f.status === 200 || f.status === 201, `follow status ${f.status}`);
    const ovA = await req("GET", "/api/social/overview", A);
    assert(ovA.json.counts.volgers === 1, `volgers ${ovA.json.counts.volgers}`);
    assert(ovA.json.volgers[0]?.clerkId === C, "volger C ontbreekt in lijst");
    const ovC = await req("GET", "/api/social/overview", C);
    assert(ovC.json.counts.gevolgd === 1, `gevolgd ${ovC.json.counts.gevolgd}`);
  });

  // 9. Jezelf volgen kan niet
  await scenario("jezelf volgen wordt geweigerd", async () => {
    const r = await req("POST", `/api/social/follow/${A}`, A);
    assert(r.status >= 400, `status ${r.status}`);
  });

  // 10. Ontvolgen
  await scenario("ontvolgen verwijdert de volgrelatie", async () => {
    const r = await req("DELETE", `/api/social/follow/${A}`, C);
    assert(r.status === 200, `status ${r.status}`);
    const ov = await req("GET", "/api/social/overview", A);
    assert(ov.json.counts.volgers === 0, `volgers ${ov.json.counts.volgers}`);
  });

  // 11. Volgers-niveau: volger ziet, vreemde niet
  await scenario("categorie op 'volgers' is zichtbaar voor volger maar niet voor vreemde", async () => {
    await req("PUT", "/api/social/privacy", A, { categories: { wedstrijden: "volgers" } });
    await req("POST", `/api/social/follow/${A}`, C);
    const rVolger = await req("GET", `/api/social/profile/${A}`, C);
    assert(rVolger.json.profile.zichtbaar.wedstrijden === true, "volger ziet wedstrijden niet");
    // D is vreemde (geen vriend/volger)
    const rVreemde = await req("GET", `/api/social/profile/${A}`, D);
    assert(rVreemde.json.profile.zichtbaar.wedstrijden === false, "vreemde ziet wedstrijden");
    await req("PUT", "/api/social/privacy", A, { categories: { wedstrijden: "vrienden" } });
  });

  // 12. Blokkeren verbreekt vriendschap én volgen, beide kanten
  await scenario("blokkeren verbreekt bestaande vriend- en volgrelaties", async () => {
    await befriend(A, D);
    await req("POST", `/api/social/follow/${A}`, D);
    const b = await req("POST", `/api/social/blocks/${D}`, A);
    assert(b.status === 200 || b.status === 201, `block status ${b.status}`);
    const friendRows = await db
      .select()
      .from(friendLinksTable)
      .where(
        or(
          and(eq(friendLinksTable.requesterClerkId, A), eq(friendLinksTable.addresseeClerkId, D)),
          and(eq(friendLinksTable.requesterClerkId, D), eq(friendLinksTable.addresseeClerkId, A)),
        ),
      );
    assert(friendRows.length === 0, "vriendlink overleeft blokkade");
    const followRows = await db
      .select()
      .from(followLinksTable)
      .where(
        or(
          and(eq(followLinksTable.followerClerkId, D), eq(followLinksTable.followeeClerkId, A)),
          and(eq(followLinksTable.followerClerkId, A), eq(followLinksTable.followeeClerkId, D)),
        ),
      );
    assert(followRows.length === 0, "volglink overleeft blokkade");
  });

  // 13. Geblokkeerde krijgt neutrale 404 + neutrale weigering op acties
  await scenario("geblokkeerde ziet neutrale 404 en krijgt neutrale weigering bij volgen/verzoek", async () => {
    const prof = await req("GET", `/api/social/profile/${A}`, D);
    assert(prof.status === 404, `profiel status ${prof.status}`);
    const follow = await req("POST", `/api/social/follow/${A}`, D);
    assert(follow.status >= 400, `follow status ${follow.status}`);
    assert(
      String(follow.json?.error ?? "").includes("niet mogelijk"),
      `weigering niet neutraal: ${JSON.stringify(follow.json)}`,
    );
    const fr = await req("POST", "/api/social/requests", D, { addresseeClerkId: A });
    assert(fr.status >= 400, `verzoek status ${fr.status}`);
    assert(
      String(fr.json?.error ?? "").includes("kan niet worden verstuurd"),
      `verzoek-weigering niet neutraal: ${JSON.stringify(fr.json)}`,
    );
  });

  // 14. Blokkadelijst + deblokkeren
  await scenario("blokkadelijst toont D; deblokkeren maakt profiel weer zichtbaar", async () => {
    const list = await req("GET", "/api/social/blocks", A);
    assert(list.json.blocked?.some((p: any) => p.clerkId === D), "D niet in blokkadelijst");
    const un = await req("DELETE", `/api/social/blocks/${D}`, A);
    assert(un.status === 200, `unblock status ${un.status}`);
    const prof = await req("GET", `/api/social/profile/${A}`, D);
    assert(prof.status === 200, `profiel na deblokkade status ${prof.status}`);
  });

  // 15. Rapporteren maakt een rij
  await scenario("rapporteren slaat een melding op", async () => {
    const r = await req("POST", "/api/social/reports", B, {
      clerkId: A,
      reason: "Testmelding",
    });
    assert(r.status === 200 || r.status === 201, `status ${r.status}`);
    const rows = await db
      .select()
      .from(socialReportsTable)
      .where(
        and(
          eq(socialReportsTable.reporterClerkId, B),
          eq(socialReportsTable.reportedClerkId, A),
        ),
      );
    assert(rows.length === 1, `report rows ${rows.length}`);
  });

  // 16. Weigering: geen herverzoek door de afgewezene; weigeraar mag heropenen
  await scenario("na weigering kan afgewezene niet opnieuw; weigeraar wel", async () => {
    // C stuurt verzoek aan D, D weigert
    const send = await req("POST", "/api/social/requests", C, { addresseeClerkId: D });
    assert(send.status === 200 || send.status === 201, `send status ${send.status}`);
    const reqs = await req("GET", "/api/social/requests", D);
    const incoming = (reqs.json.requests ?? []).find(
      (x: any) => x.direction === "incoming" && x.clerkId === C,
    );
    assert(incoming, "inkomend verzoek niet gevonden");
    const decline = await req("POST", `/api/social/requests/${incoming.id}/respond`, D, {
      accept: false,
    });
    assert(decline.status === 200, `decline status ${decline.status}`);
    // C opnieuw ⇒ neutrale weigering
    const again = await req("POST", "/api/social/requests", C, { addresseeClerkId: D });
    assert(again.status >= 400, `herverzoek status ${again.status}`);
    // D (de weigeraar) mag zelf wél een verzoek sturen (heropenen)
    const reopen = await req("POST", "/api/social/requests", D, { addresseeClerkId: C });
    assert(reopen.status === 200 || reopen.status === 201, `heropenen status ${reopen.status}`);
  });

  // 17. verzoekMogelijk in de profielprojectie volgt de weigerlogica
  await scenario("verzoekMogelijk is false voor de afgewezene, true voor de weigeraar", async () => {
    // Reset de C↔D-link naar declined (requester C)
    await db
      .delete(friendLinksTable)
      .where(
        or(
          and(eq(friendLinksTable.requesterClerkId, C), eq(friendLinksTable.addresseeClerkId, D)),
          and(eq(friendLinksTable.requesterClerkId, D), eq(friendLinksTable.addresseeClerkId, C)),
        ),
      );
    await db.insert(friendLinksTable).values({
      requesterClerkId: C,
      addresseeClerkId: D,
      status: "declined",
    });
    const asC = await req("GET", `/api/social/profile/${D}`, C);
    assert(asC.json.profile.verzoekMogelijk === false, "afgewezene mag geen verzoekknop zien");
    const asD = await req("GET", `/api/social/profile/${C}`, D);
    assert(asD.json.profile.verzoekMogelijk === true, "weigeraar moet kunnen heropenen");
  });

  // 18. Contactmatching: hash van geregistreerd e-mailadres matcht
  await scenario("contactmatching vindt geregistreerde gebruiker via sha256-hash", async () => {
    const hash = sha256Hex(`${B}@example.test`.toLowerCase());
    const r = await req("POST", "/api/social/contacts/match", A, { hashes: [hash] });
    assert(r.status === 200, `status ${r.status}`);
    assert(
      (r.json.matches ?? []).some((m: any) => m.clerkId === B),
      "B niet gevonden via contact-hash",
    );
  });

  // 19. Contactmatching: onbekende hash + ongeldige input eerlijk leeg/afgewezen
  await scenario("contactmatching geeft geen resultaat voor onbekende hash en weigert rommel", async () => {
    const unknown = sha256Hex("niemand@example.test");
    const r = await req("POST", "/api/social/contacts/match", A, { hashes: [unknown] });
    assert(r.status === 200 && (r.json.matches ?? []).length === 0, "onbekende hash gaf match");
    const bad = await req("POST", "/api/social/contacts/match", A, { hashes: ["geen-hash"] });
    assert(bad.status >= 400, `rommel-status ${bad.status}`);
  });

  // 20. Contactmatching respecteert blokkades en afgeschermde profielen
  await scenario("contactmatching verzwijgt geblokkeerde en afgeschermde gebruikers", async () => {
    await req("POST", `/api/social/blocks/${B}`, A);
    const hashB = sha256Hex(`${B}@example.test`.toLowerCase());
    const r1 = await req("POST", "/api/social/contacts/match", A, { hashes: [hashB] });
    assert((r1.json.matches ?? []).length === 0, "geblokkeerde B toch gematcht");
    await req("DELETE", `/api/social/blocks/${B}`, A);
    // C schermt profiel af ⇒ niet vindbaar
    await req("PUT", "/api/social/privacy", C, { categories: { profiel: "alleen_ik" } });
    const hashC = sha256Hex(`${C}@example.test`.toLowerCase());
    const r2 = await req("POST", "/api/social/contacts/match", A, { hashes: [hashC] });
    assert((r2.json.matches ?? []).length === 0, "afgeschermde C toch vindbaar");
  });

  // 21. Zoeken lekt geen afgeschermde of geblokkeerde profielen
  await scenario("zoeken verzwijgt afgeschermde en geblokkeerde profielen", async () => {
    // C staat nog op profiel=alleen_ik (scenario 20)
    const r1 = await req("GET", `/api/social/search?q=Sporter%20C`, A);
    assert(
      !(r1.json.results ?? []).some((x: any) => x.clerkId === C),
      "afgeschermde C verschijnt in zoekresultaten",
    );
    await req("PUT", "/api/social/privacy", C, { categories: { profiel: "sparki" } });
    const r2 = await req("GET", `/api/social/search?q=Sporter%20C`, A);
    assert(
      (r2.json.results ?? []).some((x: any) => x.clerkId === C),
      "zichtbare C ontbreekt in zoekresultaten (positieve controle)",
    );
    await req("POST", `/api/social/blocks/${C}`, A);
    const r3 = await req("GET", `/api/social/search?q=Sporter%20C`, A);
    assert(
      !(r3.json.results ?? []).some((x: any) => x.clerkId === C),
      "geblokkeerde C verschijnt in zoekresultaten",
    );
    await req("DELETE", `/api/social/blocks/${C}`, A);
  });

  // 22. Vriendschapsverzoek naar afgeschermd profiel = neutrale weigering
  await scenario("verzoek naar afgeschermd profiel krijgt neutrale weigering", async () => {
    await req("PUT", "/api/social/privacy", B, { categories: { profiel: "alleen_ik" } });
    // A en B zijn nog vrienden uit scenario 5 — verbreek eerst zodat A een vreemde is
    await db
      .delete(friendLinksTable)
      .where(
        or(
          and(eq(friendLinksTable.requesterClerkId, A), eq(friendLinksTable.addresseeClerkId, B)),
          and(eq(friendLinksTable.requesterClerkId, B), eq(friendLinksTable.addresseeClerkId, A)),
        ),
      );
    const r = await req("POST", "/api/social/requests", A, { addresseeClerkId: B });
    assert(r.status >= 400, `status ${r.status}`);
    assert(
      String(r.json?.error ?? "").includes("kan niet worden verstuurd"),
      `weigering niet neutraal: ${JSON.stringify(r.json)}`,
    );
    await req("PUT", "/api/social/privacy", B, { categories: { profiel: "sparki" } });
  });

  await stopServer();
  await cleanup();

  // ── Rapport ────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test run crashed:", err);
  try {
    await stopServer();
    await cleanup();
  } catch {
    /* leeg */
  }
  process.exit(1);
});
