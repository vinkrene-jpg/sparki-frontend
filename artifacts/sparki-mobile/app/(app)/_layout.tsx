import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";

import colors from "@/constants/colors";

export default function AppLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Attach the Clerk bearer token to every shared-API-client request. There is
  // no browser cookie jar on mobile, so this is the auth transport.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.background },
      }}
    />
  );
}
