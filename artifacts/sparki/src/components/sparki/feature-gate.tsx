import type { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import type { FeatureKey } from "@/contexts/FeatureFlagContext";

interface FeatureGateProps {
  flag: FeatureKey;
  children: ReactNode;
  /**
   * Optional fallback rendered when the flag is disabled.
   * Defaults to null (renders nothing).
   */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on a feature flag.
 *
 * Usage:
 *   <FeatureGate flag="strava">
 *     <StravaConnectButton />
 *   </FeatureGate>
 *
 *   <FeatureGate flag="ai_observations" fallback={<PlaceholderCard />}>
 *     <AiDailyBrief />
 *   </FeatureGate>
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
