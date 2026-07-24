import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { DEV_PREVIEW } from "@/lib/dev";
import { useUserProfile } from "@/contexts/UserContext";
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

// Retry backoff (ms) for transient failures. Right after sign-in the Clerk
// session cookie can still be settling, so the very first /api/flags call may
// 401/403 even though the user IS signed in. Without retries the app would
// silently lock every feature off until a full reload.
const RETRY_DELAYS = [1000, 3000, 8000, 20000];

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const { profile } = useUserProfile();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const clearRetry = () => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };

  const fetchFlags = useCallback(async () => {
    clearRetry();
    setIsLoading(true);
    try {
      const resolved = await apiFetch<FeatureFlags>("/api/flags");
      // Merge with defaults so unknown future keys don't break the type
      setFlags({ ...DEFAULT_FLAGS, ...resolved });
      attemptRef.current = 0;
    } catch {
      // Keep whatever we already resolved (never downgrade working flags on a
      // transient blip) and retry with backoff instead of giving up.
      const attempt = attemptRef.current;
      if (attempt < RETRY_DELAYS.length) {
        attemptRef.current = attempt + 1;
        retryTimer.current = setTimeout(() => {
          void fetchFlags();
        }, RETRY_DELAYS[attempt]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => clearRetry, []);

  useEffect(() => {
    if (DEV_PREVIEW) {
      void fetchFlags();
      return;
    }
    if (!isLoaded) return;
    if (isSignedIn) {
      attemptRef.current = 0;
      void fetchFlags();
    } else {
      clearRetry();
      setFlags(DEFAULT_FLAGS);
    }
  }, [isLoaded, isSignedIn, fetchFlags]);

  // Once the profile sync succeeds the session is proven server-side valid —
  // refetch so a flags call that raced (and lost against) the auth handshake
  // is corrected immediately instead of waiting on the backoff.
  const clerkDbId = profile?.clerkId ?? null;
  useEffect(() => {
    if (!clerkDbId) return;
    attemptRef.current = 0;
    void fetchFlags();
  }, [clerkDbId, fetchFlags]);

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, refetch: fetchFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}
