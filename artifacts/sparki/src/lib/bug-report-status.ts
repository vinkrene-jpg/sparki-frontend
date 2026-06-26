// Shared source of truth for tester-feedback status & kind labels (plain Dutch).
// Used by both the admin inbox (triage) and the tester's own "Jouw meldingen"
// view so the submitter sees the exact same Dutch labels as the admin.

import type {
  BugReport,
  BugReportStatus,
  BugReportKind,
} from "@/hooks/use-bug-reports";

// Triage states in the order an admin walks a report through.
export const STATUS_ORDER: BugReportStatus[] = [
  "new",
  "triaged",
  "fixed",
  "rejected",
];

export const STATUS_META: Record<
  BugReportStatus,
  { label: string; color: string; bg: string }
> = {
  new: {
    label: "Nieuw",
    color: "rgba(120,210,230,1)",
    bg: "rgba(120,210,230,0.12)",
  },
  triaged: {
    label: "In behandeling",
    color: "rgba(245,190,90,1)",
    bg: "rgba(245,190,90,0.12)",
  },
  fixed: {
    label: "Opgelost",
    color: "rgba(110,220,150,1)",
    bg: "rgba(110,220,150,0.12)",
  },
  rejected: {
    label: "Afgewezen",
    color: "rgba(255,255,255,0.5)",
    bg: "rgba(255,255,255,0.06)",
  },
};

export const KIND_META: Record<BugReportKind, { label: string }> = {
  bug: { label: "Bug" },
  idea: { label: "Idee" },
  other: { label: "Overig" },
};

export function kindOf(r: BugReport): BugReportKind {
  return r.kind ?? "bug";
}

export function statusOf(r: BugReport): BugReportStatus {
  return (STATUS_ORDER as string[]).includes(r.status) ? r.status : "new";
}
