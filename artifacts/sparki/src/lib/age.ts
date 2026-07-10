// Shared age computation. Age must account for whether the birthday has already
// passed this year — computing `currentYear - birthYear` overshoots by up to a
// full year for anyone whose birthday is still ahead. When a full date of birth
// is known we derive the exact age; otherwise we fall back to the year-only
// approximation (honest, but coarser).

function parseYmd(
  v: string | Date | null | undefined,
): { y: number; m: number; d: number } | null {
  if (v == null) return null
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }
  }
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v.trim())
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/**
 * Exact age when `birthDate` is known, else a year-only fallback from
 * `birthYear`. Returns null when neither is usable or the result is implausible.
 */
export function computeAge(
  birthDate: string | Date | null | undefined,
  birthYear: number | null | undefined,
  now: Date = new Date(),
): number | null {
  const parts = parseYmd(birthDate)
  if (parts) {
    let age = now.getFullYear() - parts.y
    const nowMonth = now.getMonth() + 1
    const beforeBirthday =
      nowMonth < parts.m || (nowMonth === parts.m && now.getDate() < parts.d)
    if (beforeBirthday) age -= 1
    if (age >= 0 && age <= 120) return age
  }
  if (birthYear != null) {
    const age = now.getFullYear() - birthYear
    return age >= 0 && age <= 120 ? age : null
  }
  return null
}
