import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { queryKeys, STALE } from "@/lib/query-keys";
import { fetchConnectors, type ConnectorItem } from "@/lib/connectors";

export function useConnectors() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.connectors.list(),
    queryFn: fetchConnectors,
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

/**
 * Honest "who actually supplies this?" check. Returns the connected connector
 * that *really delivered* the given data type in its last sync (token present
 * in `importedDataTypes`) — NOT a platform that merely *could* provide it
 * (`provides`). Used so Settings only auto-fills/hides a manual field when a
 * connection truly supplies the value; otherwise the manual input stays.
 */
export function connectorSupplying(
  connectors: ConnectorItem[] | undefined,
  token: string,
): ConnectorItem | null {
  if (!connectors) return null;
  return (
    connectors.find(
      (c) => c.status === "connected" && c.importedDataTypes.includes(token),
    ) ?? null
  );
}
