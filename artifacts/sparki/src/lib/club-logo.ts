import { API_BASE } from "@/lib/api"

// A club/team logo saved as a private storage object ("/objects/…") must be
// served via the owner-gated API route; an absolute external URL (legacy or
// club-managed) passes through as-is.
export function clubLogoSrc(logoUrl: string): string {
  return logoUrl.startsWith("/objects/")
    ? `${API_BASE}/api/storage${logoUrl}`
    : logoUrl
}
