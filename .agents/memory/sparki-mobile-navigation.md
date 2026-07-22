---
name: Sparki mobile turn-by-turn navigation
description: Device-only config + architecture for the react-native-maps navigate screen
---
# Sparki mobile navigation (navigate/[id])

- Map is NATIVE-only: `react-native-maps` UrlTile with Mapbox raster (Expo Go compatible; @rnmapbox/maps is not). `RouteMap.web.tsx` is a null stub that keeps react-native-maps out of the web bundle — the navigate screen shows an honest MapFallback (route facts + full turn list) on web/no-token/no-geometry. Do not delete the web stub or the web bundle breaks.
- Mapbox token comes from secret `MAPBOX_ACCESS_TOKEN` → injected as `EXPO_PUBLIC_MAPBOX_TOKEN` by the expo dev script. `hasMapbox` handles absence honestly (grey fallback), never a blank map.

**Why (device-only fix):** GPS via expo-location needs OS permission declarations. In Expo Go it works because Expo Go's own Info.plist has the location usage string, but any standalone/dev build silently fails to prompt → no camera-follow, no off-route. app.json must carry the `expo-location` plugin (locationWhenInUsePermission), ios.infoPlist NSLocationWhenInUseUsageDescription, and android ACCESS_FINE/COARSE_LOCATION permissions.

**How to apply:** any expo-location / camera / other permission-gated native API needs its config-plugin + permission strings in app.json even if Expo Go masks the gap.
- Rider direction arrow: custom flat Marker rotated by GPS heading (Ionicons "navigate" needs -45° inner rotate); heading==null (standstill/startup) MUST fall back to a neutral dot — never a north-pointing fabricated direction. White casing polyline under the route line keeps it visible on any surface.
