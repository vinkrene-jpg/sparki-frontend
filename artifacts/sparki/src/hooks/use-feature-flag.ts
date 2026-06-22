import { useFeatureFlags, type FeatureKey } from "@/contexts/FeatureFlagContext";

/**
 * Returns true if the named feature is enabled for the current user.
 * Always returns false while flags are loading or the user is signed out.
 *
 * Usage:
 *   const stravaEnabled = useFeatureFlag("strava");
 */
export function useFeatureFlag(key: FeatureKey): boolean {
  const { flags } = useFeatureFlags();
  return flags[key] ?? false;
}
