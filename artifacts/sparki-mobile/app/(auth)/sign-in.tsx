import { useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";

function clerkErrorMessage(error: unknown): string {
  const e = error as {
    errors?: { longMessage?: string; message?: string }[];
    message?: string;
  } | null;
  return (
    e?.errors?.[0]?.longMessage ||
    e?.errors?.[0]?.message ||
    e?.message ||
    "Er ging iets mis. Probeer het opnieuw."
  );
}

export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const busy = fetchStatus === "fetching";

  const handleSubmit = async () => {
    setGeneralError(null);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      setGeneralError(clerkErrorMessage(error));
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            if (typeof window !== "undefined") window.location.href = url;
          } else {
            router.replace(url as Href);
          }
        },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.logo, { backgroundColor: c.accent }]}>
          <Ionicons name="flash" size={28} color={c.primary} />
        </View>
        <Text style={[styles.brand, { color: c.foreground }]}>Sparki</Text>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
          Meld je aan om je routes te navigeren.
        </Text>

        <Text style={[styles.label, { color: c.mutedForeground }]}>E-mailadres</Text>
        <TextInput
          style={[styles.input, { color: c.foreground, borderColor: c.input, backgroundColor: c.card }]}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={emailAddress}
          placeholder="jij@voorbeeld.nl"
          placeholderTextColor={c.mutedForeground}
          onChangeText={setEmailAddress}
        />

        <Text style={[styles.label, { color: c.mutedForeground }]}>Wachtwoord</Text>
        <TextInput
          style={[styles.input, { color: c.foreground, borderColor: c.input, backgroundColor: c.card }]}
          secureTextEntry
          value={password}
          placeholder="Je wachtwoord"
          placeholderTextColor={c.mutedForeground}
          onChangeText={setPassword}
        />

        {generalError && (
          <Text style={[styles.error, { color: c.destructive }]}>{generalError}</Text>
        )}

        <PrimaryButton
          label="Aanmelden"
          onPress={handleSubmit}
          loading={busy}
          disabled={!emailAddress || !password}
          style={{ marginTop: 20 }}
        />

        <View style={styles.footer}>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular" }}>
            Nog geen account?{" "}
          </Text>
          <Link href="/sign-up" replace>
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>
              Registreren
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  brand: { fontFamily: "Inter_700Bold", fontSize: 34, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 6, marginBottom: 28 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: {
    height: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  error: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
});
