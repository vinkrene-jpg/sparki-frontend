import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import type { LatLon } from "@/lib/geo";
import type { FriendCluster } from "@/lib/live-share";
import { cameraForLocation } from "@/lib/map-camera";
import { MAPBOX_TILE_URL } from "@/lib/mapbox";
import type { LiveLocation } from "@/hooks/useLiveLocation";

// Native-only map. Metro resolves RouteMap.web.tsx on web, so react-native-maps
// (which imports native-only modules) is never pulled into the web bundle.
export function RouteMap({
  path,
  detourPath,
  location,
  following,
  onUserPan,
  primary,
  background,
  friendClusters,
  onFriendPress,
  nearbyRoutes,
  selectedNearbyKey,
  onNearbyPress,
  centerOn,
}: {
  path: LatLon[];
  /** Echt gerouteerd verbindingsstuk terug naar de lijn (herberekening). */
  detourPath?: LatLon[];
  location: LiveLocation | null;
  following: boolean;
  /** Elke handmatige kaartbeweging (pannen, pinch-zoom, draaien). */
  onUserPan: () => void;
  primary: string;
  background: string;
  /** Kleine vriendmarkers (Opdracht 4) — nooit dominant over navigatie. */
  friendClusters?: FriendCluster[];
  onFriendPress?: (cluster: FriendCluster) => void;
  /**
   * Kaart-eerst routevoorstellen (taak #561): échte routelijnen uit het eigen
   * corpus rond de rijder. Tik op een lijn = selecteren; de selectie wordt
   * dikker getekend, de rest dimt. Alleen lijnen met ≥2 echte punten.
   */
  nearbyRoutes?: { key: string; path: LatLon[] }[];
  selectedNearbyKey?: string | null;
  onNearbyPress?: (key: string) => void;
  /**
   * Actief ontdek-centrum (gezochte plaats of GPS): de kaart centreert hierop
   * zodra het verandert, óók zonder fysieke GPS-positie — een gezochte plaats
   * mag nooit een lijst tonen terwijl de kaart elders blijft hangen.
   */
  centerOn?: LatLon | null;
}) {
  const mapRef = useRef<MapView>(null);

  // Centreer op het ontdek-centrum wanneer dat verspringt (plaats gekozen,
  // "Huidige locatie" getikt). Bewust géén continue follow: één animatie per
  // wijziging, daarna blijft de kaart vrij beweegbaar.
  const centerKey = centerOn ? `${centerOn.latitude},${centerOn.longitude}` : null;
  useEffect(() => {
    if (!mapRef.current || !centerOn) return;
    mapRef.current.animateCamera(
      { center: centerOn, zoom: 11 },
      { duration: 600 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);

  // Vrije modus (following=false): geen enkele animateCamera — de kaart
  // blijft exact waar de gebruiker hem zette (zoom, positie én rotatie).
  useEffect(() => {
    if (!mapRef.current) return;
    const cam = cameraForLocation(following, location);
    if (!cam) return;
    mapRef.current.animateCamera(cam, { duration: 800 });
  }, [location, following]);

  // Hoofdstuk 1 (MOBILE_ROUTE_NAV_AFBOUW_01): het planscherm is kaart-eerst —
  // de kaart moet dus óók zonder gekozen route kunnen renderen, gecentreerd op
  // de rijder. Alleen zonder route én zonder locatie is er niets te tonen.
  // Een expliciet ontdek-centrum (gezochte plaats) maakt de kaart ook zonder
  // route én zonder GPS bruikbaar.
  const center =
    path.length > 0
      ? path[0]
      : centerOn ??
        (location
          ? { latitude: location.latitude, longitude: location.longitude }
          : null);
  if (!center) return null;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      showsUserLocation={!location}
      showsMyLocationButton={false}
      rotateEnabled
      pitchEnabled
      zoomEnabled
      scrollEnabled
      onPanDrag={onUserPan}
      // Pinch-zoom en tweevinger-rotatie geven geen onPanDrag; elke door een
      // GEBAAR veroorzaakte regiowijziging schakelt óók naar vrije modus.
      onRegionChange={(_region, details) => {
        if (details?.isGesture) onUserPan();
      }}
      mapType={Platform.OS === "android" ? "none" : "standard"}
    >
      <UrlTile urlTemplate={MAPBOX_TILE_URL} tileSize={512} zIndex={-1} />
      {/* Routevoorstellen uit de buurt (alleen zonder gekozen routelijn). */}
      {path.length < 2 &&
        (nearbyRoutes ?? [])
          .filter((r) => r.path.length >= 2)
          .map((r) => {
            const actief = r.key === selectedNearbyKey;
            return (
              <Polyline
                key={`nearby-${r.key}`}
                coordinates={r.path}
                strokeColor={actief ? primary : "rgba(56,189,248,0.55)"}
                strokeWidth={actief ? 6 : 3}
                tappable
                onPress={() => onNearbyPress?.(r.key)}
                zIndex={actief ? 3 : 1}
              />
            );
          })}
      {/* Witte omlijning onder de routelijn zodat de lijn op elke ondergrond afsteekt. */}
      {path.length >= 2 && (
        <>
          <Polyline coordinates={path} strokeColor="rgba(255,255,255,0.9)" strokeWidth={10} />
          <Polyline coordinates={path} strokeColor={primary} strokeWidth={6} />
        </>
      )}
      {/* Herberekend verbindingsstuk (gestippeld geel) bovenop de routelijn. */}
      {detourPath && detourPath.length >= 2 && (
        <>
          <Polyline
            coordinates={detourPath}
            strokeColor="rgba(255,255,255,0.9)"
            strokeWidth={9}
          />
          <Polyline
            coordinates={detourPath}
            strokeColor="#facc15"
            strokeWidth={5}
            lineDashPattern={[14, 10]}
          />
        </>
      )}
      {path.length >= 2 && (
        <>
          <Marker coordinate={path[0]} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.pin, { backgroundColor: primary, borderColor: background }]} />
          </Marker>
          <Marker coordinate={path[path.length - 1]} anchor={{ x: 0.5, y: 1 }}>
            <Ionicons name="flag" size={26} color={primary} />
          </Marker>
        </>
      )}
      {/* Grote, felle rijrichting-pijl: draait mee met je echte GPS-koers.
          `flat` laat de pijl met de kaart meedraaien, zodat hij in volgmodus
          (camera-koers = rijkoers) altijd recht vooruit wijst. Zonder echte
          koers (stilstand/opstart) tonen we een neutrale stip — nooit een
          verzonnen richting. */}
      {/* Vrienden live op de kaart: kleine, rustige markers (initialen of
          clusteraantal). Bewust lage zIndex — de navigatie blijft leidend.
          Alleen ECHT ontvangen posities; zonder coördinaten geen marker. */}
      {(friendClusters ?? []).map((cluster, i) => (
        <Marker
          key={`friend-${i}-${cluster.members[0]?.clerkId ?? i}`}
          coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={5}
          tracksViewChanges={false}
          onPress={() => onFriendPress?.(cluster)}
        >
          <View
            style={[
              styles.friendMarker,
              cluster.members.some((m) => m.statusKind !== "live") &&
                styles.friendMarkerStale,
            ]}
          >
            <Text style={styles.friendMarkerText}>
              {cluster.members.length > 1
                ? String(cluster.members.length)
                : cluster.members[0]?.initials ?? "?"}
            </Text>
          </View>
        </Marker>
      ))}
      {location &&
        (location.heading != null ? (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={location.heading}
            flat
            zIndex={10}
          >
            <View style={[styles.riderArrow, { backgroundColor: primary }]}>
              {/* Ionicons "navigate" wijst 45° naar rechtsboven — binnenin
                  teruggedraaid zodat de pijl exact vooruit wijst. */}
              <Ionicons
                name="navigate"
                size={30}
                color="#04070e"
                style={{ transform: [{ rotate: "-45deg" }] }}
              />
            </View>
          </Marker>
        ) : (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <View style={[styles.riderDot, { backgroundColor: primary }]} />
          </Marker>
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  friendMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#38bdf8",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  friendMarkerStale: { opacity: 0.55 },
  friendMarkerText: {
    color: "#04070e",
    fontSize: 10,
    fontWeight: "700",
  },
  riderDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  riderArrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
