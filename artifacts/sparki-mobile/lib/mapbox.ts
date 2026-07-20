// Mapbox raster tiles rendered through react-native-maps' UrlTile so the map
// stays Expo Go compatible (@rnmapbox/maps is NOT). The token is a public
// pk.* token exposed via EXPO_PUBLIC_MAPBOX_TOKEN — safe to ship in the bundle.
//
// Honest availability: when the token is absent, hasMapbox is false and the UI
// says so plainly rather than showing a blank/broken map.

export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export const hasMapbox = MAPBOX_TOKEN.length > 0;

// Dark style to match the Sparki look. 512px @2x tiles for crisp retina output.
export const MAPBOX_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
