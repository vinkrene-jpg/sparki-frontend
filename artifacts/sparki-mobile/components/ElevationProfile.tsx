import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

const CHART_HEIGHT = 120;

/**
 * Elevation profile chart drawn from the REAL downsampled elevation series
 * stored at activity ingest. Pure react-native-svg — no web-only chart lib —
 * so it renders in Expo Go on the phone. Callers must only render this when a
 * real profile exists (>= 2 points); this component never fabricates data.
 */
export function ElevationProfile({
  profile,
  distanceKm,
}: {
  profile: number[];
  distanceKm: number | null;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);

  const { linePath, areaPath, minEle, maxEle } = useMemo(() => {
    const min = Math.min(...profile);
    const max = Math.max(...profile);
    // Flat rides still get a visible line: pad the vertical range a little so
    // the path doesn't collapse onto one pixel row.
    const span = Math.max(max - min, 10);
    const pad = 6;
    const innerH = CHART_HEIGHT - pad * 2;
    const w = Math.max(width, 1);
    const pts = profile.map((ele, i) => {
      const x = (i / (profile.length - 1)) * w;
      const y = pad + (1 - (ele - min) / span) * innerH;
      return [x, y] as const;
    });
    const line = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${w},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
    return { linePath: line, areaPath: area, minEle: min, maxEle: max };
  }, [profile, width]);

  return (
    <View>
      <View
        style={styles.chartWrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.primary} stopOpacity={0.3} />
                <Stop offset="1" stopColor={c.primary} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#eleFill)" />
            <Path
              d={linePath}
              stroke={c.primary}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
      </View>
      <View style={styles.axisRow}>
        <Text style={[styles.axisText, { color: c.mutedForeground }]}>
          {Math.round(minEle)}–{Math.round(maxEle)} m hoogte
        </Text>
        {distanceKm != null ? (
          <Text style={[styles.axisText, { color: c.mutedForeground }]}>
            0–{distanceKm.toFixed(1)} km
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    height: CHART_HEIGHT,
    width: "100%",
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  axisText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
});
