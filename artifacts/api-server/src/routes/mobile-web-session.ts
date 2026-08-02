// MOBIEL_ROLLEN_01 F1 — sessiebrug voor de ingebedde webweergave in de app.
//
// De native app is ingelogd via Clerk met Bearer-tokens; de webapp gebruikt
// Clerk-cookies. Deze route munt voor de AANVRAGER ZELF een kortlevend,
// éénmalig Clerk sign-in-ticket waarmee de webweergave in de app dezelfde
// sessie krijgt — zonder tweede login en zonder wachtwoorden of langlevende
// tokens richting de webview.
//
// Veiligheidsregels:
// - Alleen met een ECHTE Clerk-sessie (nooit via de dev-bypass): het ticket
//   logt écht in, dus de identiteitsbron moet Clerk zelf zijn.
// - Het ticket is voor de eigen userId — er is geen invoer waarmee een ander
//   account gekozen kan worden.
// - Kort geldig en éénmalig (Clerk dwingt beide af); wij loggen het nooit.

import { Router } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/security/rate-limit";

const router = Router();

const TICKET_EXPIRES_SEC = 300;

router.post(
  "/session",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10, scope: "mobile-web-session" }),
  async (req, res) => {
    const auth = getAuth(req);
    const userId = auth?.userId ?? null;
    if (!userId) {
      // Dev-bypass of sessieloze aanroep: eerlijk weigeren — een ticket zou
      // een echte login zijn en die kan alleen op een echte Clerk-sessie.
      res.status(403).json({
        error:
          "De webweergave kan alleen worden ingelogd met een echte sessie. Log opnieuw in en probeer het nog eens.",
      });
      return;
    }
    try {
      const token = await clerkClient.signInTokens.createSignInToken({
        userId,
        expiresInSeconds: TICKET_EXPIRES_SEC,
      });
      res.json({ ticket: token.token, expiresInSeconds: TICKET_EXPIRES_SEC });
    } catch {
      res.status(502).json({
        error:
          "Het aanmelden van de webweergave is niet gelukt. Controleer je verbinding en probeer het opnieuw.",
      });
    }
  },
);

export default router;
