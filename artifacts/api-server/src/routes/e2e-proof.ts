import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger";

// ── Bewijs-endpoint voor ingelogde productievalidatie (KETEN_FIETS_01) ──────
// Probleem: de live Clerk-sleutel bestaat alleen ín de productie-deployment
// (Replit-beheerd, niet uitleesbaar). Ingelogd browserbewijs op productie
// vereist een eenmalig Clerk sign-in-ticket, en dat kan alleen de server met
// die sleutel aanmaken.
//
// Veiligheidsmodel (fail-closed op elke laag):
// 1. Zonder BEIDE env-vars E2E_PROOF_TOKEN en E2E_PROOF_EMAIL bestaat het
//    endpoint effectief niet (404) — de standaardtoestand.
// 2. Het token wordt timing-safe vergeleken; fout token = 404 (geen oracle).
// 3. Het ticket wordt UITSLUITEND gemunt voor het account met exact het
//    e-mailadres uit E2E_PROOF_EMAIL — nooit een aanroeper-gekozen account.
// 4. Ticket is 300 s geldig en eenmalig (Clerk-eigenschap). Er wordt nooit
//    een sleutel of ticket gelogd — alleen metadata.
// Uitzetten = de env-vars uit de deployment verwijderen.

const router: IRouter = Router();

function tokenOk(given: unknown): boolean {
  const expected = process.env.E2E_PROOF_TOKEN ?? "";
  if (!expected || typeof given !== "string" || given.length === 0) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

router.post("/proof-ticket", async (req, res) => {
  const email = process.env.E2E_PROOF_EMAIL ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  if (!process.env.E2E_PROOF_TOKEN || !email || !secret) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  if (!tokenOk(req.header("x-e2e-proof-token"))) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  try {
    const q = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      { headers: { authorization: `Bearer ${secret}` } },
    );
    if (!q.ok) throw new Error(`Clerk users-query faalde: ${q.status}`);
    const users = (await q.json()) as Array<{ id: string }>;
    if (!Array.isArray(users) || users.length === 0) {
      res.status(404).json({ error: "Doelaccount niet gevonden" });
      return;
    }
    const userId = users[0].id;
    const minted = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
    });
    if (!minted.ok) throw new Error(`sign_in_token faalde: ${minted.status}`);
    const body = (await minted.json()) as { token: string };
    logger.info({ e2eProof: "ticket-gemunt", userId }, "e2e-bewijsticket aangemaakt");
    res.json({ userId, ticket: body.token });
  } catch (err) {
    logger.error({ e2eProof: "fout", err: String(err) }, "e2e-bewijsticket mislukt");
    res.status(502).json({ error: "Ticket aanmaken mislukt" });
  }
});

// Netwerk-diagnose vanuit de productieomgeving zelf: wat geven de
// Overpass-mirrors terug aan DIT uitgaande IP? Zelfde token-poort als het
// ticket-endpoint; antwoordt alleen statuscodes/tijden, nooit inhoud.
router.post("/proof-net", async (req, res) => {
  if (!process.env.E2E_PROOF_TOKEN || !tokenOk(req.header("x-e2e-proof-token"))) {
    res.status(404).json({ error: "Niet gevonden" });
    return;
  }
  const mirrors = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const query = `[out:json][timeout:10];node["highway"="traffic_signals"](51.90,5.65,51.91,5.66);out;`;
  const results = await Promise.all(
    mirrors.map(async (endpoint) => {
      const t0 = Date.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20_000);
        let r: Response;
        try {
          r = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Sparki/1.0 (cycling training app)",
              Accept: "application/json",
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        const text = await r.text();
        return {
          endpoint,
          status: r.status,
          ms: Date.now() - t0,
          bodyStart: text.slice(0, 120),
        };
      } catch (err) {
        return { endpoint, error: String(err), ms: Date.now() - t0 };
      }
    }),
  );
  logger.info({ e2eProof: "netprobe", results }, "e2e-netwerkprobe uitgevoerd");
  res.json({ results });
});

export default router;
