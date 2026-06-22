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
import { DEV_PREVIEW } from "@/lib/dev";
import {
  FEATURE_KEYS,
  type FeatureKey,
} from "@workspace/feature-flags";

export type { FeatureKey };
export { FEATURE_KEYS };

export type FeatureFlags = Record<FeatureKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = Object.fromEntries(
  FEATURE_KEYS.map((k) => [k, false]),
) as FeatureFlags;

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
    if (DEV_PREVIEW) {
      void fetchFlags();
      return;
    }
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
