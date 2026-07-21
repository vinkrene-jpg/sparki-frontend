import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

import type { LatLon } from "@/lib/geo";
import { MAPBOX_TILE_URL } from "@/lib/mapbox";

// Static (non-live) map showing a RIDDEN track: the whole line fitted in view,
// start pin + finish flag, no live location. Native-only — Metro resolves
// TrackMap.web.tsx on web so react-native-maps never enters the web bundle.
export function TrackMap({
  path,
  primary,
  background,
  highlight,
}: {
  path: LatLon[];
  primary: string;
  background: string;
  /** Optional real point on the ridden track to highlight (elevation cursor). */
  highlight?: LatLon | null;
}) {
  const mapRef = useRef<MapView>(null);

  const fitTrack = useCallback(() => {
    mapRef.current?.fitToCoordinates(path, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  }, [path]);

  if (path.length < 2) return null;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      onMapReady={fitTrack}
      initialRegion={{
        latitude: path[0].latitude,
        longitude: path[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      mapType={Platform.OS === "android" ? "none" : "standard"}
    >
      <UrlTile urlTemplate={MAPBOX_TILE_URL} tileSize={512} zIndex={-1} />
      <Polyline coordinates={path} strokeColor={primary} strokeWidth={5} />
      <Marker coordinate={path[0]} anchor={{ x: 0.5, y: 0.5 }}>
        <View
          style={[styles.pin, { backgroundColor: primary, borderColor: background }]}
        />
      </Marker>
      <Marker coordinate={path[path.length - 1]} anchor={{ x: 0.5, y: 1 }}>
        <Ionicons name="flag" size={26} color={primary} />
      </Marker>
      {highlight ? (
        <Marker coordinate={highlight} anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
          <View
            style={[
              styles.cursorDot,
              { backgroundColor: primary, borderColor: background },
            ]}
          />
        </Marker>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  cursorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
});
