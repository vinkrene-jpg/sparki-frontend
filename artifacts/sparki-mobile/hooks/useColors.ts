import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * Returns the design tokens plus scheme-independent values like `radius`.
 *
 * Sparki heeft ÉÉN thema, licht (besluit LICHT_THEMA_01 — geen licht/donker-
 * schakelaar). `colors.light` en `colors.dark` verwijzen daarom naar hetzelfde
 * lichte palet; het device-schema maakt geen verschil. We laten de
 * scheme-lookup staan zodat de vorm gelijk blijft, maar beide takken leveren
 * hetzelfde palet — er is nooit een donkere variant.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette =
    scheme === "dark" && "dark" in colors ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
