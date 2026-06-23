// Athlete Profile engine — the hub.
//
// Owns the athlete's identity/profile record and the training zones derived from
// it. Other engines read the profile (FTP, weight, goals, availability) through
// this surface. Profile read/update HTTP shapes live in `routes/athlete.ts`;
// the reusable domain logic (zone derivation) lives here.

/**
 * Derive the 6 cycling power zones from an athlete's FTP (watts).
 * Pure: no I/O. Returned shape is the public contract consumed by the
 * profile/dashboard responses.
 */
export function computeZones(ftp: number) {
  return [
    { zone: 1, label: "Active Recovery", min: 0, max: Math.round(ftp * 0.55) },
    {
      zone: 2,
      label: "Endurance",
      min: Math.round(ftp * 0.56),
      max: Math.round(ftp * 0.75),
    },
    {
      zone: 3,
      label: "Tempo",
      min: Math.round(ftp * 0.76),
      max: Math.round(ftp * 0.9),
    },
    {
      zone: 4,
      label: "Threshold",
      min: Math.round(ftp * 0.91),
      max: Math.round(ftp * 1.05),
    },
    {
      zone: 5,
      label: "VO2 Max",
      min: Math.round(ftp * 1.06),
      max: Math.round(ftp * 1.2),
    },
    {
      zone: 6,
      label: "Anaerobic",
      min: Math.round(ftp * 1.21),
      max: Math.round(ftp * 1.5),
    },
  ];
}
