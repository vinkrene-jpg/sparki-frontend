// Verplicht acceptatiescherm (mobiel) voor juridische documenten.
//
// Zelfde server-side waarheid als op web: /api/legal/status bepaalt of de
// gebruiker verder mag; de server blokkeert persoonlijke functies zelf al
// (consentGate-middleware). Geen vakje staat vooraf aangevinkt; elk document
// is vóór het aanvinken volledig te lezen.

import { customFetch } from "@workspace/api-client-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import colors from "@/constants/colors";

type LegalKind = "terms" | "privacy" | "gezondheid";

type ConsentDocumentStatus = {
  kind: LegalKind;
  title: string;
  requiredVersion: string;
  accepted: boolean;
  acceptedVersion: string | null;
};

type ConsentStatus = {
  complete: boolean;
  documents: ConsentDocumentStatus[];
};

// LICHT_THEMA_01: één licht thema, dezelfde tokens als de web-app. Dit scherm
// gebruikt het centrale palet uit constants/colors.ts (geen eigen kleuren meer).
const c = colors.light;
const ACCENT = c.tint; // merkaccent (donkerder cyaan, leesbaar op licht)

function DocumentBody({ kind }: { kind: LegalKind }) {
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    customFetch<{ bodyMd: string }>(`/api/legal/${kind}`)
      .then((doc) => {
        if (!cancelled) setBody(doc.bodyMd);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  if (failed) {
    return <Text style={styles.docError}>Document kon niet geladen worden.</Text>;
  }
  if (body === null) {
    return <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />;
  }
  return (
    <ScrollView style={styles.docBody} nestedScrollEnabled>
      <Text style={styles.docText}>{body}</Text>
    </ScrollView>
  );
}

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openDoc, setOpenDoc] = useState<LegalKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    customFetch<ConsentStatus>("/api/legal/status")
      .then(setStatus)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadFailed) {
    return (
      <View style={styles.screenCenter}>
        <Text style={styles.subtle}>
          De acceptatiestatus kon niet worden geladen.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={load}>
          <Text style={styles.primaryBtnText}>Opnieuw proberen</Text>
        </Pressable>
      </View>
    );
  }
  if (!status) {
    return (
      <View style={styles.screenCenter}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  if (status.complete) return <>{children}</>;

  const missing = status.documents.filter((d) => !d.accepted);
  const allChecked = missing.every((d) => checked[d.kind]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const doc of missing) {
        await customFetch(`/api/legal/${doc.kind}/accept`, { method: "POST" });
      }
      const fresh = await customFetch<ConsentStatus>("/api/legal/status");
      setStatus(fresh);
    } catch {
      setSubmitError(
        "Je akkoord kon niet worden vastgelegd. Controleer je verbinding en probeer opnieuw.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Eerst even akkoord</Text>
      <Text style={styles.subtle}>
        Voordat je Sparki kunt gebruiken, vragen we je akkoord op de
        onderstaande documenten. Zonder akkoord blijven persoonlijke functies
        gesloten.
      </Text>
      {missing.map((doc) => (
        <View key={doc.kind} style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() =>
              setChecked((prev) => ({ ...prev, [doc.kind]: !prev[doc.kind] }))
            }
          >
            <View style={[styles.checkbox, checked[doc.kind] && styles.checkboxOn]}>
              {checked[doc.kind] ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.cardLabel}>
              Ik heb de {doc.title.toLowerCase()} (versie {doc.requiredVersion})
              gelezen en ga akkoord.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setOpenDoc(openDoc === doc.kind ? null : doc.kind)}
          >
            <Text style={styles.link}>
              {openDoc === doc.kind ? "Document sluiten" : "Volledig document lezen"}
            </Text>
          </Pressable>
          {openDoc === doc.kind ? <DocumentBody kind={doc.kind} /> : null}
        </View>
      ))}
      {submitError ? <Text style={styles.docError}>{submitError}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, (!allChecked || submitting) && styles.btnDisabled]}
        disabled={!allChecked || submitting}
        onPress={() => void submit()}
      >
        <Text style={styles.primaryBtnText}>
          {submitting ? "Bezig…" : "Akkoord en verder"}
        </Text>
      </Pressable>
      <Text style={styles.footnote}>
        Je akkoord wordt vastgelegd met versie en datum. Bij een nieuwe versie
        vragen we opnieuw je akkoord.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  screenCenter: {
    flex: 1,
    backgroundColor: c.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48, gap: 12 },
  title: { color: c.foreground, fontSize: 22, fontWeight: "700" },
  subtle: {
    color: c.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.input,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkmark: { color: c.card, fontWeight: "800", fontSize: 14 },
  cardLabel: { color: c.foreground, fontSize: 14, flex: 1, lineHeight: 20 },
  link: { color: ACCENT, fontSize: 13, fontWeight: "600" },
  docBody: {
    maxHeight: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.muted,
    padding: 12,
  },
  docText: { color: c.mutedForeground, fontSize: 13, lineHeight: 19 },
  docError: { color: c.destructive, fontSize: 13 },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.4 },
  // Tekst óp het accent-vlak = licht (on-accent), gelijk aan web.
  primaryBtnText: { color: c.background, fontWeight: "700", fontSize: 15 },
  footnote: {
    color: c.mutedForeground,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
