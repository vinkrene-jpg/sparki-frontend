// Email-channel readiness classification test.
//
// Verifies the honesty contract of the email channel: it is only "ready" when
// the domain we actually send FROM is verified. A verified domain the sender
// does not use, an unverified custom sender, and the sandbox fallback must all
// stay "limited" (which the Health Check shows as orange, never green).
//
// Pure unit test — no DB, no network. Run:
//   `pnpm --filter @workspace/api-server run test:email-channel`
// Exits non-zero on any failure.

import {
  classifyVerifiedChannel,
  isSenderDomainVerified,
  senderDomain,
} from "../lib/email";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

scenario("senderDomain parses both formats", () => {
  assert(senderDomain("Sparki <a@team.nl>") === "team.nl", "angle form");
  assert(senderDomain("a@team.nl") === "team.nl", "bare form");
  assert(senderDomain("a@Team.NL") === "team.nl", "lowercased");
  assert(senderDomain("not-an-email") === null, "no @ → null");
});

scenario("no verified domains → limited (sandbox only)", () => {
  const s = classifyVerifiedChannel([], "Sparki <onboarding@resend.dev>");
  assert(s.state === "limited", `expected limited, got ${s.state}`);
});

scenario("verified domain but sender NOT on it → limited", () => {
  // The historical false-positive: a domain is verified, but REMINDER_FROM_EMAIL
  // points elsewhere (or is unset → sandbox fallback). Must NOT be ready.
  const s = classifyVerifiedChannel(
    ["team.nl"],
    "Sparki <onboarding@resend.dev>",
  );
  assert(s.state === "limited", `expected limited, got ${s.state}`);
});

scenario("unverified custom sender → limited", () => {
  const s = classifyVerifiedChannel(["team.nl"], "Sparki <noreply@other.nl>");
  assert(s.state === "limited", `expected limited, got ${s.state}`);
});

scenario("verified domain matching sender → ready", () => {
  const s = classifyVerifiedChannel(["team.nl"], "Sparki <reminders@team.nl>");
  assert(s.state === "ready", `expected ready, got ${s.state}`);
});

scenario("isSenderDomainVerified is case-insensitive", () => {
  assert(
    isSenderDomainVerified("Sparki <reminders@Team.NL>", ["team.nl"]),
    "case-insensitive match",
  );
  assert(
    !isSenderDomainVerified("Sparki <reminders@team.nl>", ["other.nl"]),
    "non-match",
  );
});

const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
