// Email delivery channel — backed by Resend (Replit connection "resend").
//
// Integration: the Resend connection is bound to this Repl. We talk to the
// Resend REST API through the Replit connectors proxy, which injects the API
// key automatically (no secret to manage in code). See blueprint id="resend".
//
// Honesty contract: this module never pretends email works when it does not.
// `emailChannelStatus()` reports the REAL state (configured + reachable, or
// limited because no sending domain is verified, or not configured at all) so
// the Health Check can show green/orange/grey honestly. `sendEmail` returns a
// structured result and never throws to the caller.

import { ReplitConnectors } from "@replit/connectors-sdk";

const CONNECTOR = "resend";

// Resend's shared sandbox sender. Works WITHOUT a verified domain, but only
// delivers to the account owner's own verified address — never to athletes.
// Once a domain is verified, set REMINDER_FROM_EMAIL to a sender on it.
const FALLBACK_FROM = "Sparki <onboarding@resend.dev>";

let client: ReplitConnectors | null = null;
function connectors(): ReplitConnectors {
  client ??= new ReplitConnectors();
  return client;
}

// The connection is only reachable from inside Replit (the proxy needs the
// repl identity). When those env vars are absent the channel is "not configured".
function proxyConfigured(): boolean {
  return Boolean(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
      (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL),
  );
}

export function fromAddress(): string {
  return process.env.REMINDER_FROM_EMAIL?.trim() || FALLBACK_FROM;
}

// Extract the bare domain from a sender string ("Name <a@b.nl>" or "a@b.nl").
export function senderDomain(from: string): string | null {
  const angle = from.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : from).trim();
  const at = addr.lastIndexOf("@");
  if (at === -1) return null;
  const domain = addr.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

// The channel is only truly "ready" when the domain we actually send FROM is
// itself verified. A verified domain that the sender does NOT use, or the
// sandbox fallback, must never be reported as ready (it would only reach the
// Resend account owner — a false-positive delivery status).
export function isSenderDomainVerified(
  from: string,
  verified: string[],
): boolean {
  const d = senderDomain(from);
  if (!d) return false;
  return verified.some((v) => v.trim().toLowerCase() === d);
}

export type EmailChannelStatus =
  | { state: "not_configured"; reason: string }
  | {
      state: "limited";
      reason: string;
      from: string;
      verifiedDomains: string[];
    }
  | { state: "ready"; from: string; verifiedDomains: string[] };

// Pure classification once the connection is reachable and verified domains are
// known. Kept separate from the proxy call so it can be unit-tested honestly.
export function classifyVerifiedChannel(
  verified: string[],
  from: string,
): Extract<EmailChannelStatus, { state: "limited" | "ready" }> {
  if (isSenderDomainVerified(from, verified)) {
    return { state: "ready", from, verifiedDomains: verified };
  }
  const reason =
    verified.length === 0
      ? "E-mail is gekoppeld, maar er is nog geen geverifieerd afzenderdomein. Daardoor kan alleen naar het eigen Resend-account worden gemaild, nog niet naar sporters."
      : `E-mail is gekoppeld en er is een geverifieerd domein, maar de ingestelde afzender (${from}) hoort daar niet bij. Stel REMINDER_FROM_EMAIL in op een adres van een geverifieerd domein.`;
  return { state: "limited", reason, from, verifiedDomains: verified };
}

// Probe the real channel: is the connection bound, reachable, and is a sending
// domain verified? Used by the Health Check and before a delivery run.
export async function emailChannelStatus(): Promise<EmailChannelStatus> {
  if (!proxyConfigured()) {
    return {
      state: "not_configured",
      reason:
        "E-mail is nog niet gekoppeld. Herinneringen worden alleen in de app getoond.",
    };
  }
  let domains: Array<{ name?: string; status?: string }> = [];
  try {
    const res = await connectors().proxy(CONNECTOR, "/domains", {
      method: "GET",
    });
    if (!res.ok) {
      return {
        state: "not_configured",
        reason:
          "De e-mailkoppeling (Resend) reageerde onverwacht. Herinneringen worden alleen in de app getoond.",
      };
    }
    const data = (await res.json()) as {
      data?: Array<{ name?: string; status?: string }>;
    };
    domains = data.data ?? [];
  } catch {
    return {
      state: "not_configured",
      reason:
        "De e-mailkoppeling (Resend) is niet bereikbaar. Herinneringen worden alleen in de app getoond.",
    };
  }

  const verified = domains
    .filter((d) => d.status === "verified")
    .map((d) => d.name ?? "")
    .filter(Boolean);

  return classifyVerifiedChannel(verified, fromAddress());
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

// Send a single plain-text email through Resend. Never throws.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!proxyConfigured()) {
    return { ok: false, error: "email-channel-not-configured" };
  }
  try {
    const res = await connectors().proxy(CONNECTOR, "/emails", {
      method: "POST",
      body: {
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
      },
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      return { ok: true, id: data?.id ?? null };
    }
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `resend-${res.status}: ${detail.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
