import type { HealthStatusColor, HealthUrgency } from "@/hooks/use-admin-health";

// Plain-language, colour-coded presentation for the four statuses. Grey is
// honest "not connected yet" — never a fake green.
export const STATUS_META: Record<
  HealthStatusColor,
  { label: string; color: string; dot: string; bg: string }
> = {
  green: {
    label: "Werkt",
    color: "rgba(140,230,170,0.95)",
    dot: "rgba(140,230,170,1)",
    bg: "rgba(140,230,170,0.10)",
  },
  orange: {
    label: "Let op",
    color: "rgba(245,200,110,0.95)",
    dot: "rgba(245,200,110,1)",
    bg: "rgba(245,200,110,0.10)",
  },
  red: {
    label: "Storing",
    color: "rgba(255,120,110,0.95)",
    dot: "rgba(255,120,110,1)",
    bg: "rgba(255,120,110,0.10)",
  },
  grey: {
    label: "Nog niet gekoppeld",
    color: "rgba(180,190,205,0.75)",
    dot: "rgba(180,190,205,0.65)",
    bg: "rgba(180,190,205,0.06)",
  },
};

export const URGENCY_LABEL: Record<HealthUrgency, string> = {
  low: "Laag",
  medium: "Gemiddeld",
  high: "Hoog",
  critical: "Kritiek",
};

export const CATEGORY_LABEL: Record<string, string> = {
  auth: "Inloggen",
  database: "Database",
  storage: "Opslag & uploads",
  connector: "Koppelingen",
  maps: "Kaarten & routes",
  gps: "GPS & locatie",
  gpx: "GPX-export",
  mail: "E-mail",
  notifications: "Meldingen",
  ai: "Sparki-denkkracht",
  nightly: "Nachtelijke taken",
  onboarding: "Onboarding",
  invite: "Uitnodigingen",
  parent: "Ouder-toezicht",
  feedback: "Feedback",
  bugreport: "Bugmeldingen",
  links: "Koppelingen & delen",
};

export function formatWhen(iso: string | null): string {
  if (!iso) return "nog niet uitgevoerd";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
