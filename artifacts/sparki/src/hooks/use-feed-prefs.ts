import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import {
  leesFeedPrefs,
  schrijfFeedPrefs,
  mergeFeedPrefs,
  feedPrefsGelijk,
  type FeedPrefs,
} from "@/lib/feed-prefs";

type ServerPrefs = FeedPrefs & { updatedAt: string };
type PrefsResponse = { prefs: ServerPrefs | null };

const LEEG: FeedPrefs = { bewaard: [], minderCategorie: [], minderBron: [] };

/**
 * Account-brede Ontdekken-feedvoorkeuren met per-gebruiker localStorage als
 * fallback (A-03: lokale opslag is op clerkId gesleuteld, nooit globaal).
 *
 * - Start direct met de lokale voorkeuren van déze gebruiker (geen wachten op
 *   het netwerk); bij accountwissel zonder herladen reset de state direct.
 * - Bij de eerste succesvolle load worden lokaal + account verliesloos
 *   samengevoegd; verschilt de merge van wat het account had, dan wordt die
 *   set eenmalig teruggeschreven (migratie van bestaande localStorage-data).
 * - Elke wijziging schrijft eerst lokaal (fallback blijft altijd kloppen) en
 *   pusht daarna naar het account. `synct` is alleen true als de laatste
 *   server-interactie echt slaagde — de UI mag pas dan de "op dit apparaat"-
 *   copy laten vallen (eerlijkheid: nooit doen alsof het synct als dat niet zo is).
 */
export function useFeedPrefs(userId: string | null) {
  const { isSignedIn } = useUser();
  const enabled = isSignedIn === true || DEV_PREVIEW;

  const [prefs, setPrefs] = useState<FeedPrefs>(() => leesFeedPrefs(userId));
  const [synct, setSynct] = useState(false);
  // Eerste sync is per gebruiker: bij accountwissel opnieuw mergen/migreren.
  const geinitialiseerdVoor = useRef<string | null>(null);

  useEffect(() => {
    setPrefs(leesFeedPrefs(userId));
    setSynct(false);
  }, [userId]);

  const query = useQuery({
    queryKey: queryKeys.feed.prefs(),
    queryFn: () => apiFetch<PrefsResponse>("/api/feed/prefs"),
    enabled,
    staleTime: STALE.session,
  });

  const push = useCallback(async (p: FeedPrefs): Promise<void> => {
    try {
      await apiFetch<PrefsResponse>("/api/feed/prefs", {
        method: "PUT",
        body: JSON.stringify({
          bewaard: p.bewaard,
          minderCategorie: p.minderCategorie,
          minderBron: p.minderBron,
        }),
      });
      setSynct(true);
    } catch {
      // Opslaan op het account mislukt — lokaal staat het al goed; de UI
      // blijft eerlijk "op dit apparaat" tonen tot een volgende push slaagt.
      setSynct(false);
    }
  }, []);

  // Eerste sync: merge lokaal + account, migreer indien nodig.
  useEffect(() => {
    if (!query.isSuccess || !userId) return;
    if (geinitialiseerdVoor.current === userId) return;
    geinitialiseerdVoor.current = userId;
    const server = query.data.prefs;
    const lokaal = leesFeedPrefs(userId);
    const merged = mergeFeedPrefs(lokaal, server ?? LEEG);
    setPrefs(schrijfFeedPrefs(userId, merged));
    if (server && feedPrefsGelijk(server, merged)) {
      setSynct(true);
    } else {
      void push(merged);
    }
  }, [query.isSuccess, query.data, userId, push]);

  // Wijziging vanuit de UI: lokaal is al geschreven (feed-prefs helpers);
  // hier de state bijwerken en naar het account pushen.
  const update = useCallback(
    (next: FeedPrefs) => {
      setPrefs(next);
      if (enabled) void push(next);
    },
    [enabled, push],
  );

  return { prefs, synct, update };
}
