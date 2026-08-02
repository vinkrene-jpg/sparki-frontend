import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

/**
 * Help & support — dezelfde helpdesk als op web: stel je vraag, Sparki
 * antwoordt alleen op basis van de beheerde kennisbank; wat niet betrouwbaar
 * te beantwoorden is gaat eerlijk naar een medewerker (supportticket).
 */

type HelpdeskAnswer = {
  turnId: number;
  categoryLabel: string;
  status: string;
  answer: string | null;
  sources: Array<{ title: string }>;
  ticketId: number | null;
  ticketAttached: boolean;
};

type Ticket = {
  id: number;
  summary: string;
  status: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  wacht_op_gebruiker: "Reactie ontvangen",
  opgelost: "Opgelost",
  gesloten: "Gesloten",
  heropend: "Heropend",
  samengevoegd: "Samengevoegd",
};

export default function SupportScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<HelpdeskAnswer[]>([]);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, string>>({});

  const loadTickets = useCallback(async () => {
    try {
      const r = await customFetch<{ tickets: Ticket[] }>("/api/support/tickets", {
        method: "GET",
      });
      setTickets(r.tickets);
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await customFetch<HelpdeskAnswer>("/api/support/helpdesk/ask", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setAnswers((prev) => [a, ...prev]);
      setQuestion("");
      void loadTickets();
    } catch {
      setError("De helpdesk is nu niet bereikbaar. Probeer het straks opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  const giveFeedback = async (turnId: number, feedback: string) => {
    setFeedbackGiven((p) => ({ ...p, [turnId]: feedback }));
    try {
      await customFetch(`/api/support/helpdesk/${turnId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ feedback }),
      });
      void loadTickets();
    } catch {
      // Beoordeling is best-effort; de vraag zelf is al bewaard.
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
    >
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: c.foreground }]}>Help &amp; support</Text>
      </View>
      <Text style={[styles.sub, { color: c.mutedForeground }]}>
        Stel je vraag. Wat niet betrouwbaar te beantwoorden is, gaat naar een
        medewerker.
      </Text>

      <View style={[styles.askRow, { borderColor: c.border, backgroundColor: c.card }]}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Waar kan ik je bij helpen?"
          placeholderTextColor={c.mutedForeground}
          style={[styles.input, { color: c.foreground }]}
          multiline
        />
        <Pressable onPress={() => void ask()} hitSlop={10} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Ionicons name="send" size={20} color={c.primary} />
          )}
        </Pressable>
      </View>
      {/* LICHT_THEMA_01: foutmelding in het donkerder destructief-token,
          leesbaar op het lichte thema (was #fb923c). */}
      {error && <Text style={[styles.error, { color: c.destructive }]}>{error}</Text>}

      {answers.map((a) => (
        <View
          key={a.turnId}
          style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Text style={[styles.cardLabel, { color: c.primary }]}>{a.categoryLabel}</Text>
          {a.answer && (
            <Text style={[styles.cardBody, { color: c.foreground }]}>{a.answer}</Text>
          )}
          {a.sources.length > 0 && (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              Bron: {a.sources.map((s) => s.title).join(" · ")}
            </Text>
          )}
          {a.ticketId != null && (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              {a.ticketAttached
                ? "Toegevoegd aan een bestaand supportticket."
                : "Er is een supportticket aangemaakt."}
            </Text>
          )}
          {feedbackGiven[a.turnId] ? (
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              Bedankt voor je beoordeling.
            </Text>
          ) : (
            <View style={styles.feedbackRow}>
              <Pressable
                onPress={() => void giveFeedback(a.turnId, "opgelost")}
                style={[styles.feedbackBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.feedbackText, { color: c.foreground }]}>Dit hielp</Text>
              </Pressable>
              <Pressable
                onPress={() => void giveFeedback(a.turnId, "niet_geholpen")}
                style={[styles.feedbackBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.feedbackText, { color: c.foreground }]}>
                  Niet geholpen
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
        Mijn supportvragen
      </Text>
      {tickets === null ? (
        <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 12 }} />
      ) : tickets.length === 0 ? (
        <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
          Je hebt nog geen supportvragen.
        </Text>
      ) : (
        tickets.map((t) => (
          <View
            key={t.id}
            style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
          >
            <Text style={[styles.cardBody, { color: c.foreground }]} numberOfLines={2}>
              {t.summary}
            </Text>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              {STATUS_LABEL[t.status] ?? t.status} — volledige afhandeling vind je in de
              Sparki-webapp.
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "300" },
  sub: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  askRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingTop: 0 },
  error: { marginTop: 10, fontSize: 12 },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardBody: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  cardMeta: { marginTop: 8, fontSize: 11, lineHeight: 15 },
  feedbackRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  feedbackBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feedbackText: { fontSize: 12 },
  sectionTitle: {
    marginTop: 24,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
});
