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

export type Role = "athlete" | "coach" | "parent";

export interface UserProfile {
  clerkId: string;
  email: string;
  displayName: string | null;
  roles: Role[];
  activeRole: Role;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  switchRole: (role: Role) => Promise<void>;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncAndFetch = useCallback(async () => {
    // Dev Preview: no Clerk session, but the backend resolves a dev user.
    // Skip the Clerk-driven sync and just load the resolved profile.
    if (DEV_PREVIEW && !isSignedIn) {
      setIsLoading(true);
      setError(null);
      try {
        const p = await apiFetch<UserProfile>("/api/auth/me");
        setProfile(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!user || !isSignedIn) {
      setProfile(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const primaryEmail =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? "";
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        null;

      // sync is the single robust provisioning + self-healing call. It returns
      // the ready profile directly (user_profiles + athlete_profiles guaranteed,
      // roles reconciled), so there is no separate /me round-trip that could race.
      const p = await apiFetch<UserProfile>("/api/auth/sync", {
        method: "POST",
        body: JSON.stringify({ email: primaryEmail, displayName }),
      });
      setProfile(p);
    } catch (err) {
      // Log for diagnostics; surface a clear state so the UI can show an error
      // and a retry instead of silently dropping the user into a broken app.
      console.error("[UserContext] account sync failed", err);
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [user, isSignedIn]);

  useEffect(() => {
    if (DEV_PREVIEW && !isSignedIn) {
      void syncAndFetch();
      return;
    }
    if (!isLoaded) return;
    if (isSignedIn) {
      void syncAndFetch();
    } else {
      setProfile(null);
    }
  }, [isLoaded, isSignedIn, syncAndFetch]);

  const switchRole = useCallback(
    async (role: Role) => {
      const updated = await apiFetch<UserProfile>("/api/auth/me/role", {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      setProfile(updated);
    },
    [],
  );

  return (
    <UserContext.Provider
      value={{ profile, isLoading, error, switchRole, refetch: syncAndFetch }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserProfile must be used within UserProvider");
  return ctx;
}
