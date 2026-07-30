import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { bleSupport } from "@/lib/ble-sensors";
import { batterijHint, openAppInstellingen } from "@/lib/permissions";

/**
 * Golf 28 — Instellingen: machtigingen (echte status + systeeminstellingen),
 * meldingen (bestaande voorkeuren-API), privacy & delen, databronnen,
 * account (export/verwijderen via bestaande routes), juridische documenten,
 * support en appversie. Alles eerlijk: wat hier niet kan, verwijst expliciet
 * naar de webapp in plaats van te doen alsof.
 */

type PermStatus = "granted" | "denied" | "undetermined" | "onbekend";

const PERM_LABEL: Record<PermStatus, string> = {
  granted: "Toegestaan",
  denied: "Geweigerd",
  undetermined: "Nog niet gevraagd",
  onbekend: "Onbekend",
};

type ReminderPrefs = {
  enabled: boolean;
  checkins: boolean;
  followups: boolean;
  training: boolean;
  races: boolean;
  profile: boolean;
  pulse: boolean;
  channelPush: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
};

const REMINDER_LABELS: Array<{ key: keyof ReminderPrefs; label: string }> = [
  { key: "checkins", label: "Dagelijkse check-in" },
  { key: "followups", label: "Vervolgvragen van Sparki" },
  { key: "training", label: "Trainingsherinneringen" },
  { key: "races", label: "Wedstrijdherinneringen" },
  { key: "profile", label: "Profiel bijwerken" },
  { key: "pulse", label: "Wekelijkse terugblik" },
];

type PrivacySettings = {
  shareActivityWithFriends: boolean;
  marketingConsent: boolean;
  dataSharingCoach: string;
  dataSharingParent: string;
  deleteRequestedAt: string | null;
};

type LegalDoc = { title: string; version: string; bodyMd: string };

// Zelfde bron als de web-Koppelingenpagina: het centrale Sparki
// Connect-statusmodel + het `syncStale`-veld uit GET /api/connectors.
// Mobiel leidt hier NIETS zelf af.
type ConnectorItem = {
  id: string;
  displayName: string;
  connect: { status: string; consentExpired: boolean };
  syncStale: boolean;
};

const CONNECT_STATUS_LABELS: Record<string, string> = {
  not_connected: "Niet gekoppeld",
  connecting: "Koppelen gestart",
  connected: "Gekoppeld",
  sync_in_progress: "Bezig met ophalen",
  action_required: "Actie nodig",
  temporarily_unavailable: "Tijdelijk niet beschikbaar",
  permission_revoked: "Toestemming ingetrokken",
  disconnected: "Verbroken",
};

// Waarschuwingstekst per koppeling — exact dezelfde eerlijke boodschap als de
// web-Koppelingenpagina, op basis van hetzelfde statusmodel.
function connectorWarning(conn: ConnectorItem): string | null {
  const cs = conn.connect.status;
  if (cs === "permission_revoked")
    return "Toegang ingetrokken — verbind opnieuw om verder te gaan";
  if (cs === "action_required")
    return conn.connect.consentExpired
      ? "Toestemming verlopen — verbind opnieuw om te blijven synchroniseren"
      : "Er is een actie nodig — verbind opnieuw";
  if (conn.syncStale)
    return "Al meer dan 24 uur geen geslaagde synchronisatie — mogelijk is de koppeling stuk. Synchroniseer handmatig of verbind opnieuw.";
  return null;
}

const DELETE_PHRASE = "VERWIJDER MIJN ACCOUNT";

export default function InstellingenScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ---------- Machtigingen (echte status, stil uitgelezen — nooit gevraagd) ----------
  const [locStatus, setLocStatus] = useState<PermStatus>("onbekend");
  const [bgStatus, setBgStatus] = useState<PermStatus>("onbekend");
  const ble = bleSupport();

  const refreshPermissions = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      setLocStatus(fg.granted ? "granted" : fg.canAskAgain ? "undetermined" : "denied");
    } catch {
      setLocStatus("onbekend");
    }
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      setBgStatus(bg.granted ? "granted" : bg.canAskAgain ? "undetermined" : "denied");
    } catch {
      setBgStatus("onbekend");
    }
  }, []);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  // ---------- Meldingen ----------
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    customFetch<{ preferences: ReminderPrefs }>("/api/notifications/preferences", {
      method: "GET",
    })
      .then((r) => setPrefs(r.preferences))
      .catch(() => setPrefsError("Voorkeuren konden niet geladen worden."));
  }, []);

  const patchPrefs = async (patch: Partial<ReminderPrefs>) => {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      const r = await customFetch<{ preferences: ReminderPrefs }>(
        "/api/notifications/preferences",
        { method: "PUT", body: JSON.stringify(patch) },
      );
      setPrefs(r.preferences);
    } catch {
      setPrefs(prev);
      setPrefsError("Opslaan is niet gelukt. Probeer het opnieuw.");
    }
  };

  // ---------- Privacy & delen ----------
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const loadPrivacy = useCallback(async () => {
    try {
      const r = await customFetch<{ privacy: PrivacySettings }>("/api/privacy", {
        method: "GET",
      });
      setPrivacy(r.privacy);
    } catch {
      setPrivacyError("Privacy-instellingen konden niet geladen worden.");
    }
  }, []);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  const patchPrivacy = async (patch: Partial<PrivacySettings>) => {
    if (!privacy) return;
    const prev = privacy;
    setPrivacy({ ...privacy, ...patch });
    try {
      await customFetch("/api/privacy", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    } catch {
      setPrivacy(prev);
      setPrivacyError("Opslaan is niet gelukt. Probeer het opnieuw.");
    }
  };

  // ---------- Account verwijderen ----------
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const requestDelete = async () => {
    if (deleteInput.trim() !== DELETE_PHRASE || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteMsg(null);
    try {
      const r = await customFetch<{ hersteltermijnDagen: number }>(
        "/api/account/delete",
        { method: "POST", body: JSON.stringify({ confirm: DELETE_PHRASE }) },
      );
      setDeleteMsg(
        `Verwijderverzoek geregistreerd. Je kunt dit nog ${r.hersteltermijnDagen} dagen ongedaan maken.`,
      );
      setShowDelete(false);
      setDeleteInput("");
      void loadPrivacy();
    } catch (e) {
      setDeleteMsg(
        e instanceof Error ? e.message : "Er ging iets mis. Probeer het opnieuw.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const cancelDelete = async () => {
    setDeleteBusy(true);
    try {
      await customFetch("/api/account/delete/cancel", { method: "POST" });
      setDeleteMsg("Verwijderverzoek ingetrokken. Je account blijft bestaan.");
      void loadPrivacy();
    } catch {
      setDeleteMsg("Intrekken is niet gelukt. Probeer het opnieuw.");
    } finally {
      setDeleteBusy(false);
    }
  };

  // ---------- Databronnen (koppelingen) ----------
  const [connectors, setConnectors] = useState<ConnectorItem[] | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [syncBusyId, setSyncBusyId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadConnectors = useCallback(async () => {
    try {
      const r = await customFetch<{ connectors: ConnectorItem[] }>(
        "/api/connectors",
        { method: "GET" },
      );
      setConnectors(r.connectors);
      setConnError(null);
    } catch {
      setConnError(
        "De status van je koppelingen kon niet geladen worden. Probeer het straks opnieuw.",
      );
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const syncNow = async (id: string) => {
    if (syncBusyId) return;
    setSyncBusyId(id);
    setSyncMsg(null);
    try {
      await customFetch(`/api/connectors/${id}/sync`, { method: "POST" });
      setSyncMsg("Synchronisatie gestart. De status wordt zo bijgewerkt.");
      await loadConnectors();
    } catch {
      setSyncMsg("Synchroniseren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setSyncBusyId(null);
    }
  };

  // Alleen koppelingen waar de gebruiker iets mee heeft (ooit gekoppeld of
  // bezig) — een lange lijst niet-gekoppelde platforms hoort in de webapp.
  const activeConnectors = (connectors ?? []).filter(
    (x) => x.connect.status !== "not_connected",
  );

  // ---------- Juridische documenten ----------
  const [openDoc, setOpenDoc] = useState<"privacy" | "terms" | null>(null);
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const showDoc = async (kind: "privacy" | "terms") => {
    if (openDoc === kind) {
      setOpenDoc(null);
      return;
    }
    setOpenDoc(kind);
    setDoc(null);
    setDocError(null);
    try {
      const r = await customFetch<LegalDoc>(`/api/legal/${kind}`, { method: "GET" });
      setDoc(r);
    } catch {
      setDocError("Het document kon niet geladen worden. Probeer het straks opnieuw.");
    }
  };

  const appVersion = Constants.expoConfig?.version ?? "onbekend";
  const buildNr =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Platform.OS === "android"
        ? Constants.expoConfig?.android?.versionCode?.toString()
        : null;
  const batterij = batterijHint();

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
        <Text style={[styles.title, { color: c.foreground }]}>Instellingen</Text>
      </View>

      {/* ---------- Machtigingen ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
        Machtigingen
      </Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        {Platform.OS === "web" ? (
          <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
            Machtigingen beheer je in de app op je telefoon.
          </Text>
        ) : (
          <>
            <PermRow c={c} label="Locatie" status={locStatus} />
            <PermRow c={c} label="Locatie op de achtergrond" status={bgStatus} />
            <View style={styles.permRow}>
              <Text style={[styles.rowLabel, { color: c.foreground }]}>Bluetooth</Text>
              <Text style={[styles.rowValue, { color: c.mutedForeground }]}>
                {ble.available ? "Gevraagd bij eerste koppeling" : "Niet beschikbaar"}
              </Text>
            </View>
            {!ble.available && ble.reason && (
              <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                {ble.reason}
              </Text>
            )}
            <Pressable
              style={[styles.btn, { borderColor: c.border }]}
              onPress={() => void openAppInstellingen()}
            >
              <Ionicons name="settings-outline" size={16} color={c.foreground} />
              <Text style={[styles.btnText, { color: c.foreground }]}>
                Open systeeminstellingen
              </Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => void refreshPermissions()}>
              <Text style={[styles.linkText, { color: c.primary }]}>
                Status opnieuw controleren
              </Text>
            </Pressable>
            {batterij && (
              <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                {batterij}
              </Text>
            )}
          </>
        )}
      </View>

      {/* ---------- Meldingen ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Meldingen</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        {prefs === null ? (
          prefsError ? (
            <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{prefsError}</Text>
          ) : (
            <ActivityIndicator size="small" color={c.primary} />
          )
        ) : (
          <>
            <ToggleRow
              c={c}
              label="Herinneringen aan"
              value={prefs.enabled}
              onChange={(v) => void patchPrefs({ enabled: v })}
            />
            {prefs.enabled &&
              REMINDER_LABELS.map(({ key, label }) => (
                <ToggleRow
                  key={key}
                  c={c}
                  label={label}
                  value={Boolean(prefs[key])}
                  onChange={(v) => void patchPrefs({ [key]: v })}
                />
              ))}
            {prefsError && (
              <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{prefsError}</Text>
            )}
          </>
        )}
      </View>

      {/* ---------- Privacy & delen ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
        Privacy &amp; delen
      </Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        {privacy === null ? (
          privacyError ? (
            <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{privacyError}</Text>
          ) : (
            <ActivityIndicator size="small" color={c.primary} />
          )
        ) : (
          <>
            <ToggleRow
              c={c}
              label="Activiteiten delen met vrienden"
              value={privacy.shareActivityWithFriends}
              onChange={(v) => void patchPrivacy({ shareActivityWithFriends: v })}
            />
            <ToggleRow
              c={c}
              label="Nieuws over Sparki ontvangen"
              value={privacy.marketingConsent}
              onChange={(v) => void patchPrivacy({ marketingConsent: v })}
            />
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              Wat je coach of ouder ziet, stel je in via de Sparki-webapp
              (Jij → Privacy). Daar staan ook alle deelniveaus uitgelegd.
            </Text>
            {privacyError && (
              <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{privacyError}</Text>
            )}
          </>
        )}
      </View>

      {/* ---------- Databronnen ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
        Databronnen
      </Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        {connectors === null ? (
          connError ? (
            <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{connError}</Text>
          ) : (
            <ActivityIndicator size="small" color={c.primary} />
          )
        ) : (
          <>
            {activeConnectors.map((conn) => {
              const warning = connectorWarning(conn);
              const needsReconnect =
                conn.connect.status === "action_required" ||
                conn.connect.status === "permission_revoked";
              return (
                <View key={conn.id} style={{ paddingVertical: 4 }}>
                  <View style={styles.permRow}>
                    <Text style={[styles.rowLabel, { color: c.foreground }]}>
                      {conn.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.rowValue,
                        {
                          color:
                            warning != null
                              ? "#fb923c"
                              : conn.connect.status === "connected" ||
                                  conn.connect.status === "sync_in_progress"
                                ? "#4ade80"
                                : c.mutedForeground,
                        },
                      ]}
                    >
                      {CONNECT_STATUS_LABELS[conn.connect.status] ??
                        conn.connect.status}
                    </Text>
                  </View>
                  {warning && (
                    <>
                      <Text style={[styles.cardMeta, { color: "#fb923c" }]}>
                        {warning}
                      </Text>
                      {!needsReconnect && (
                        <Pressable
                          style={[styles.btn, { borderColor: c.border }]}
                          disabled={syncBusyId !== null}
                          onPress={() => void syncNow(conn.id)}
                        >
                          {syncBusyId === conn.id ? (
                            <ActivityIndicator size="small" color={c.primary} />
                          ) : (
                            <Ionicons
                              name="refresh-outline"
                              size={16}
                              color={c.foreground}
                            />
                          )}
                          <Text style={[styles.btnText, { color: c.foreground }]}>
                            Nu synchroniseren
                          </Text>
                        </Pressable>
                      )}
                      <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                        Opnieuw verbinden doe je in de Sparki-webapp (Data Hub).
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
            {syncMsg && (
              <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                {syncMsg}
              </Text>
            )}
            {connError && (
              <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{connError}</Text>
            )}
            <Text style={[styles.cardBody, { color: c.foreground }]}>
              Koppelingen met Strava en andere platforms beheer je in de
              Sparki-webapp (Data Hub). Ritten die je hier opneemt, verschijnen
              automatisch bij je activiteiten.
            </Text>
          </>
        )}
      </View>

      {/* ---------- Account ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Account</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={[styles.cardBody, { color: c.foreground }]}>
          Een volledige export van je gegevens (JSON) download je via de
          Sparki-webapp (Jij → Account → Export).
        </Text>
        {privacy?.deleteRequestedAt ? (
          <>
            <Text style={[styles.cardMeta, { color: "#fb923c" }]}>
              Er staat een verwijderverzoek open. Je account wordt na de
              hersteltermijn definitief verwijderd.
            </Text>
            <Pressable
              style={[styles.btn, { borderColor: c.border }]}
              disabled={deleteBusy}
              onPress={() => void cancelDelete()}
            >
              <Text style={[styles.btnText, { color: c.foreground }]}>
                Verwijderverzoek intrekken
              </Text>
            </Pressable>
          </>
        ) : showDelete ? (
          <>
            <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
              Dit verwijdert je account en gegevens na een hersteltermijn.
              Typ ter bevestiging exact: {DELETE_PHRASE}
            </Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder={DELETE_PHRASE}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.input,
                { color: c.foreground, borderColor: c.border },
              ]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={[styles.btn, { borderColor: "#ef4444", flex: 1 }]}
                disabled={deleteInput.trim() !== DELETE_PHRASE || deleteBusy}
                onPress={() => void requestDelete()}
              >
                {deleteBusy ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Text style={[styles.btnText, { color: "#ef4444" }]}>
                    Definitief aanvragen
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, { borderColor: c.border, flex: 1 }]}
                onPress={() => {
                  setShowDelete(false);
                  setDeleteInput("");
                }}
              >
                <Text style={[styles.btnText, { color: c.foreground }]}>Annuleren</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            style={[styles.btn, { borderColor: c.border }]}
            onPress={() => setShowDelete(true)}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.btnText, { color: "#ef4444" }]}>
              Account verwijderen
            </Text>
          </Pressable>
        )}
        {deleteMsg && (
          <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>{deleteMsg}</Text>
        )}
      </View>

      {/* ---------- Juridisch ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Juridisch</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        {(["privacy", "terms"] as const).map((kind) => (
          <Pressable key={kind} hitSlop={6} onPress={() => void showDoc(kind)}>
            <View style={styles.permRow}>
              <Text style={[styles.rowLabel, { color: c.foreground }]}>
                {kind === "privacy" ? "Privacyverklaring" : "Gebruiksvoorwaarden"}
              </Text>
              <Ionicons
                name={openDoc === kind ? "chevron-up" : "chevron-down"}
                size={16}
                color={c.mutedForeground}
              />
            </View>
          </Pressable>
        ))}
        {openDoc && (
          <View style={{ marginTop: 8 }}>
            {doc ? (
              <>
                <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
                  {doc.title} — versie {doc.version}
                </Text>
                <Text style={[styles.docBody, { color: c.foreground }]}>
                  {doc.bodyMd}
                </Text>
              </>
            ) : docError ? (
              <Text style={[styles.cardMeta, { color: "#fb923c" }]}>{docError}</Text>
            ) : (
              <ActivityIndicator size="small" color={c.primary} />
            )}
          </View>
        )}
      </View>

      {/* ---------- Support & app ---------- */}
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Over</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <Pressable
          style={[styles.btn, { borderColor: c.border }]}
          onPress={() => router.push("/support" as Href)}
        >
          <Ionicons name="help-buoy-outline" size={16} color={c.foreground} />
          <Text style={[styles.btnText, { color: c.foreground }]}>
            Help &amp; support
          </Text>
        </Pressable>
        <Text style={[styles.cardMeta, { color: c.mutedForeground }]}>
          Sparki versie {appVersion}
          {buildNr ? ` (build ${buildNr})` : ""}
        </Text>
      </View>
    </ScrollView>
  );
}

function PermRow({
  c,
  label,
  status,
}: {
  c: ReturnType<typeof useColors>;
  label: string;
  status: PermStatus;
}) {
  const color =
    status === "granted" ? "#4ade80" : status === "denied" ? "#fb923c" : c.mutedForeground;
  return (
    <View style={styles.permRow}>
      <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{PERM_LABEL[status]}</Text>
    </View>
  );
}

function ToggleRow({
  c,
  label,
  value,
  onChange,
}: {
  c: ReturnType<typeof useColors>;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.permRow}>
      <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "300" },
  sectionTitle: {
    marginTop: 24,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 14, flex: 1, paddingRight: 12 },
  rowValue: { fontSize: 12 },
  cardBody: { fontSize: 13, lineHeight: 19 },
  cardMeta: { marginTop: 6, fontSize: 11, lineHeight: 16 },
  docBody: { marginTop: 8, fontSize: 12, lineHeight: 18 },
  btn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnText: { fontSize: 13, fontWeight: "500" },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  linkText: { marginTop: 10, fontSize: 12 },
});
