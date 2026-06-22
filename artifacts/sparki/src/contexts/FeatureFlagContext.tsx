import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export const FEATURE_KEYS = [
  "ai_observations",
  "strava",
  "garmin",
  "route_planner",
  "coach_portal",
  "parent_portal",
  "testing_tools",
  "premium",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureFlags = Record<FeatureKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  ai_observations: false,
  strava: false,
  garmin: false,
  route_planner: false,
  coach_portal: false,
  parent_portal: false,
  testing_tools: false,
  premium: false,
};

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: DEFAULT_FLAGS,
  isLoading: false,
  refetch: async () => {},
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFlags = useCallback(async () => {
    setIsLoading(true);
    try {
      const resolved = await apiFetch<FeatureFlags>("/api/flags");
      // Merge with defaults so unknown future keys don't break the type
      setFlags({ ...DEFAULT_FLAGS, ...resolved });
    } catch {
      setFlags(DEFAULT_FLAGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      void fetchFlags();
    } else {
      setFlags(DEFAULT_FLAGS);
    }
  }, [isLoaded, isSignedIn, fetchFlags]);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, refetch: fetchFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}
