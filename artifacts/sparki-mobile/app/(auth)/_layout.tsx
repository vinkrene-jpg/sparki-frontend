import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import React from "react";

import colors from "@/constants/colors";

export default function AuthLayout() {
  const { isSignedIn } = useAuth();

  // Already signed in → send them straight into the app.
  if (isSignedIn) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.background },
      }}
    />
  );
}
