import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";

import ConsentGate from "@/components/ConsentGate";
import colors from "@/constants/colors";
import { useUploadQueue } from "@/hooks/useUploadQueue";

export default function AppLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // App-brede verwerking van de rit-uploadwachtrij: bij het openen van de app
  // en telkens wanneer hij weer actief wordt, gaan nog niet gesynchroniseerde
  // ritten automatisch alsnog omhoog. Ritten verdwijnen pas lokaal na een
  // echte bevestiging van de backend.
  useUploadQueue({ autoProcess: true });

  // Attach the Clerk bearer token to every shared-API-client request. There is
  // no browser cookie jar on mobile, so this is the auth transport.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  // Verplichte juridische acceptatie — zelfde server-side status als web
  // (/api/legal/status); de server blokkeert persoonlijke routes zelf al.
  return (
    <ConsentGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.light.background },
        }}
      />
    </ConsentGate>
  );
}
