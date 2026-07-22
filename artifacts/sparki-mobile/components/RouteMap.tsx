import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import type { LatLon } from "@/lib/geo";
import { MAPBOX_TILE_URL } from "@/lib/mapbox";
import type { LiveLocation } from "@/hooks/useLiveLocation";

// Native-only map. Metro resolves RouteMap.web.tsx on web, so react-native-maps
// (which imports native-only modules) is never pulled into the web bundle.
export function RouteMap({
  path,
  location,
  following,
  onUserPan,
  primary,
  background,
}: {
  path: LatLon[];
  location: LiveLocation | null;
  following: boolean;
  onUserPan: () => void;
  primary: string;
  background: string;
}) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!following || !location || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: { latitude: location.latitude, longitude: location.longitude },
        heading: location.heading ?? 0,
        pitch: 45,
        zoom: 16,
      },
      { duration: 800 },
    );
  }, [location, following]);

  if (path.length < 2) return null;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: path[0].latitude,
        longitude: path[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
      showsUserLocation={!location}
      showsMyLocationButton={false}
      onPanDrag={onUserPan}
      mapType={Platform.OS === "android" ? "none" : "standard"}
    >
      <UrlTile urlTemplate={MAPBOX_TILE_URL} tileSize={512} zIndex={-1} />
      {/* Witte omlijning onder de routelijn zodat de lijn op elke ondergrond afsteekt. */}
      <Polyline coordinates={path} strokeColor="rgba(255,255,255,0.9)" strokeWidth={10} />
      <Polyline coordinates={path} strokeColor={primary} strokeWidth={6} />
      <Marker coordinate={path[0]} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={[styles.pin, { backgroundColor: primary, borderColor: background }]} />
      </Marker>
      <Marker coordinate={path[path.length - 1]} anchor={{ x: 0.5, y: 1 }}>
        <Ionicons name="flag" size={26} color={primary} />
      </Marker>
      {/* Grote, felle rijrichting-pijl: draait mee met je echte GPS-koers.
          `flat` laat de pijl met de kaart meedraaien, zodat hij in volgmodus
          (camera-koers = rijkoers) altijd recht vooruit wijst. Zonder echte
          koers (stilstand/opstart) tonen we een neutrale stip — nooit een
          verzonnen richting. */}
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
