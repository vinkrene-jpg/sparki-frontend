// Server-side toegangspoort voor verplichte juridische acceptatie.
//
// Elke ingelogde gebruiker moet de actieve versie van álle verplichte
// documenten (gebruiksvoorwaarden, privacyverklaring, gezondheidsdisclaimer)
// geaccepteerd hebben vóór persoonlijke functies bereikbaar zijn. Ontbrekend
// bewijs = geblokkeerd (fail-closed). De blokkade zit hier, server-side —
// web, mobiel en PWA kunnen er niet omheen door de UI-check over te slaan.
//
// Bereikbaar zónder acceptatie (allowlist, bewust minimaal):
// - health/liveness (deploy-probes)
// - /auth/*  (inloggen, uitloggen, sync, rolinfo — anders kom je nergens)
// - /legal/* (documenten lezen, status opvragen, accepteren, intrekken)
// - /webhooks/* (machine-naar-machine, geen gebruikerssessie)
// - /release/* (versie-/uitrolcontrole en foutmeldingen van clients)
//
// Dev-preview: bij de dev-auth-bypass (geen echte Clerk-sessie) wordt de gate
// alleen afgedwongen met het test-header `x-consent-enforce: 1`. Zonder die
// uitzondering zou élke bestaande test en de dev-preview direct doodlopen op
// een acceptatiescherm. Voor échte Clerk-sessies geldt de gate ALTIJD, ook in
// dev — er is geen productie-uitzondering.

import type { Request, Response, NextFunction } from "express";
import { getClerkUserId, hasRealSession } from "../lib/auth";
import { getConsentStatus } from "../lib/consent";

const OPEN_PREFIXES = ["/auth", "/legal", "/webhooks", "/release"];
const OPEN_EXACT = new Set(["/", "", "/healthz", "/health"]);

function isOpenPath(path: string): boolean {
  if (OPEN_EXACT.has(path)) return true;
  return OPEN_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export async function consentGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isOpenPath(req.path)) return next();

  const clerkId = getClerkUserId(req);
  // Geen gebruiker: requireAuth op de route zelf geeft 401. De gate voegt daar
  // niets aan toe en mag anonieme publieke routes niet breken.
  if (!clerkId) return next();

  // Dev-bypass-gebruiker: alleen afdwingen met expliciet test-header, zodat de
  // dev-preview en bestaande tests blijven werken. Echte sessies: altijd.
  if (!hasRealSession(req) && req.get("x-consent-enforce") !== "1") {
    return next();
  }

  try {
    const status = await getConsentStatus(clerkId);
    if (status.complete) return next();
    res.status(403).json({
      error: "Akkoord vereist voordat je verder kunt.",
      code: "consent_required",
      missing: status.documents
        .filter((d) => !d.accepted)
        .map((d) => ({ kind: d.kind, requiredVersion: d.requiredVersion })),
    });
  } catch (err) {
    // Fail-closed: als de status niet bepaald kan worden, geen toegang.
    req.log?.error({ err }, "consentGate failed");
    res.status(503).json({
      error: "Acceptatiestatus kon niet worden gecontroleerd. Probeer opnieuw.",
      code: "consent_check_failed",
    });
  }
}
