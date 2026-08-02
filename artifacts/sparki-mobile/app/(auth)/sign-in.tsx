import { useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter, type Href } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  const [showPassword, setShowPassword] = React.useState(false);
  const [resetStep, setResetStep] = React.useState<
    "none" | "code" | "new_password"
  >("none");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  // "Client trust": Clerk vraagt bij inloggen op een nieuw apparaat om een
  // extra e-mailcode. trustStep toont het codescherm daarvoor.
  const [trustStep, setTrustStep] = React.useState(false);
  const [trustCode, setTrustCode] = React.useState("");
  const busy = fetchStatus === "fetching";

  const finalizeSignIn = async () => {
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
  };

  const handleForgotPassword = async () => {
    setGeneralError(null);
    const { error: createError } = await signIn.create({
      identifier: emailAddress.trim(),
    });
    if (createError) {
      setGeneralError(clerkErrorMessage(createError));
      return;
    }
    const { error } = await signIn.resetPasswordEmailCode.sendCode();
    if (error) {
      setGeneralError(clerkErrorMessage(error));
      return;
    }
    setResetCode("");
    setNewPassword("");
    setResetStep("code");
  };

  const handleVerifyResetCode = async () => {
    setGeneralError(null);
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({
      code: resetCode.trim(),
    });
    if (error) {
      setGeneralError(clerkErrorMessage(error));
      return;
    }
    setResetStep("new_password");
  };

  const handleSubmitNewPassword = async () => {
    setGeneralError(null);
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: newPassword,
    });
    if (error) {
      setGeneralError(clerkErrorMessage(error));
      return;
    }
    if (signIn.status === "complete") {
      await finalizeSignIn();
    } else {
      setResetStep("none");
      setGeneralError(
        "Je wachtwoord is gewijzigd, maar er is een extra stap nodig. Meld je opnieuw aan.",
      );
    }
  };

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
    } else if (signIn.status === "needs_client_trust") {
      // Clerk beveiligt inloggen met wachtwoord op een nieuw apparaat met een
      // extra e-mailcode ("client trust"). Zonder deze afhandeling bleef de
      // knop eindeloos draaien zonder foutmelding.
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        setGeneralError(clerkErrorMessage(sendError));
        return;
      }
      setTrustCode("");
      setTrustStep(true);
    } else {
      setGeneralError(
        "Inloggen is niet afgerond. Probeer het opnieuw of gebruik 'Wachtwoord vergeten?'.",
      );
    }
  };

  const handleVerifyTrustCode = async () => {
    setGeneralError(null);
    const { error } = await signIn.mfa.verifyEmailCode({ code: trustCode.trim() });
    if (error) {
      setGeneralError(clerkErrorMessage(error));
      return;
    }
    if (signIn.status === "complete") {
      await finalizeSignIn();
    } else {
      setGeneralError(
        "De code is geaccepteerd, maar inloggen is nog niet afgerond. Probeer het opnieuw.",
      );
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
          {resetStep === "code"
            ? "Vul de herstelcode in die we naar je e-mailadres stuurden."
            : resetStep === "new_password"
              ? "Kies een nieuw wachtwoord."
              : "Meld je aan om je routes te navigeren."}
        </Text>

        {trustStep ? (
          <>
            <Text style={[styles.label, { color: c.mutedForeground }]}>
              Bevestigingscode
            </Text>
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
              Je logt in op een nieuw apparaat. We stuurden een code naar je
              e-mailadres — vul die hier in.
            </Text>
            <TextInput
              style={[styles.input, { color: c.foreground, borderColor: c.input, backgroundColor: c.card }]}
              keyboardType="numeric"
              value={trustCode}
              placeholder="123456"
              placeholderTextColor={c.mutedForeground}
              onChangeText={setTrustCode}
            />
            {generalError && (
              <Text style={[styles.error, { color: c.destructive }]}>{generalError}</Text>
            )}
            <PrimaryButton
              label="Code bevestigen"
              onPress={handleVerifyTrustCode}
              loading={busy}
              disabled={!trustCode}
              style={{ marginTop: 20 }}
            />
            <PrimaryButton
              label="Nieuwe code sturen"
              variant="secondary"
              onPress={async () => {
                setGeneralError(null);
                const { error } = await signIn.mfa.sendEmailCode();
                if (error) setGeneralError(clerkErrorMessage(error));
              }}
              style={{ marginTop: 12 }}
            />
            <Pressable
              onPress={() => {
                setTrustStep(false);
                setGeneralError(null);
              }}
              style={{ marginTop: 20, alignSelf: "center" }}
              hitSlop={8}
            >
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
                Terug naar aanmelden
              </Text>
            </Pressable>
          </>
        ) : resetStep === "code" ? (
          <>
            <Text style={[styles.label, { color: c.mutedForeground }]}>Herstelcode</Text>
            <TextInput
              style={[styles.input, { color: c.foreground, borderColor: c.input, backgroundColor: c.card }]}
              keyboardType="numeric"
              value={resetCode}
              placeholder="123456"
              placeholderTextColor={c.mutedForeground}
              onChangeText={setResetCode}
            />
            {generalError && (
              <Text style={[styles.error, { color: c.destructive }]}>{generalError}</Text>
            )}
            <PrimaryButton
              label="Code bevestigen"
              onPress={handleVerifyResetCode}
              loading={busy}
              disabled={!resetCode}
              style={{ marginTop: 20 }}
            />
            <PrimaryButton
              label="Nieuwe code sturen"
              variant="secondary"
              onPress={handleForgotPassword}
              style={{ marginTop: 12 }}
            />
            <Pressable
              onPress={() => {
                setResetStep("none");
                setGeneralError(null);
              }}
              style={{ marginTop: 20, alignSelf: "center" }}
              hitSlop={8}
            >
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium" }}>
                Terug naar aanmelden
              </Text>
            </Pressable>
          </>
        ) : resetStep === "new_password" ? (
          <>
            <Text style={[styles.label, { color: c.mutedForeground }]}>Nieuw wachtwoord</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  { color: c.foreground, borderColor: c.input, backgroundColor: c.card },
                ]}
                secureTextEntry={!showPassword}
                value={newPassword}
                placeholder="Kies een nieuw wachtwoord"
                placeholderTextColor={c.mutedForeground}
                onChangeText={setNewPassword}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={c.mutedForeground}
                />
              </Pressable>
            </View>
            {generalError && (
              <Text style={[styles.error, { color: c.destructive }]}>{generalError}</Text>
            )}
            <PrimaryButton
              label="Wachtwoord opslaan"
              onPress={handleSubmitNewPassword}
              loading={busy}
              disabled={newPassword.length < 8}
              style={{ marginTop: 20 }}
            />
          </>
        ) : (
          <>
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
        <View style={styles.passwordWrap}>
          <TextInput
            style={[
              styles.input,
              styles.passwordInput,
              { color: c.foreground, borderColor: c.input, backgroundColor: c.card },
            ]}
            secureTextEntry={!showPassword}
            value={password}
            placeholder="Je wachtwoord"
            placeholderTextColor={c.mutedForeground}
            onChangeText={setPassword}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
            hitSlop={8}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={c.mutedForeground}
            />
          </Pressable>
        </View>

        {generalError && (
          <Text style={[styles.error, { color: c.destructive }]}>{generalError}</Text>
        )}

        <Pressable
          onPress={handleForgotPassword}
          disabled={!emailAddress || busy}
          style={{ marginTop: 12, alignSelf: "flex-end", opacity: emailAddress ? 1 : 0.5 }}
          hitSlop={8}
        >
          <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
            Wachtwoord vergeten?
          </Text>
        </Pressable>

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
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 46 },
  eyeButton: {
    position: "absolute",
    right: 14,
    height: "100%",
    justifyContent: "center",
  },
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
