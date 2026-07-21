import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

const CHART_HEIGHT = 120;

/**
 * Elevation profile chart drawn from the REAL downsampled elevation series
 * stored at activity ingest. Pure react-native-svg — no web-only chart lib —
 * so it renders in Expo Go on the phone. Callers must only render this when a
 * real profile exists (>= 2 points); this component never fabricates data.
 *
 * Touch/drag over the chart shows a cursor with the elevation (m) at that
 * point and — when the real total distance is known — the interpolated
 * position (km). The km position is linear interpolation over the real total
 * distance; between downsampled points the elevation is interpolated too, so
 * the cursor follows the drawn line exactly.
 */
export function ElevationProfile({
  profile,
  distanceKm,
  onCursorChange,
}: {
  profile: number[];
  distanceKm: number | null;
  /**
   * Optional: notify the parent of the cursor position as a fraction (0..1)
   * of the ride, or null when the cursor is released — e.g. to highlight the
   * matching point on the map. Only real, interpolated positions are emitted.
   */
  onCursorChange?: (fraction: number | null) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  // Cursor as a fraction of the chart width (0..1), null = no cursor shown.
  const [cursor, setCursor] = useState<number | null>(null);

  const { linePath, areaPath, minEle, maxEle, span, pad, innerH } = useMemo(() => {
    const min = Math.min(...profile);
    const max = Math.max(...profile);
    // Flat rides still get a visible line: pad the vertical range a little so
    // the path doesn't collapse onto one pixel row.
    const spanV = Math.max(max - min, 10);
    const padV = 6;
    const innerHV = CHART_HEIGHT - padV * 2;
    const w = Math.max(width, 1);
    const pts = profile.map((ele, i) => {
      const x = (i / (profile.length - 1)) * w;
      const y = padV + (1 - (ele - min) / spanV) * innerHV;
      return [x, y] as const;
    });
    const line = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${w},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
    return {
      linePath: line,
      areaPath: area,
      minEle: min,
      maxEle: max,
      span: spanV,
      pad: padV,
      innerH: innerHV,
    };
  }, [profile, width]);

  // Derived cursor readout: interpolate elevation between the two nearest
  // real (downsampled) points so the dot sits exactly on the drawn line.
  const cursorInfo = useMemo(() => {
    if (cursor == null || width <= 0) return null;
    const t = cursor * (profile.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(i0 + 1, profile.length - 1);
    const frac = t - i0;
    const ele = profile[i0] + (profile[i1] - profile[i0]) * frac;
    const x = cursor * width;
    const y = pad + (1 - (ele - minEle) / span) * innerH;
    const km = distanceKm != null ? cursor * distanceKm : null;
    return { x, y, ele, km };
  }, [cursor, width, profile, pad, minEle, span, innerH, distanceKm]);

  const widthRef = useRef(width);
  widthRef.current = width;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const w = widthRef.current;
        if (w <= 0) return;
        const f = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
        setCursor(f);
        onCursorChangeRef.current?.(f);
      },
      onPanResponderMove: (e) => {
        const w = widthRef.current;
        if (w <= 0) return;
        const f = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
        setCursor(f);
        onCursorChangeRef.current?.(f);
      },
      onPanResponderRelease: () => {
        setCursor(null);
        onCursorChangeRef.current?.(null);
      },
      onPanResponderTerminate: () => {
        setCursor(null);
        onCursorChangeRef.current?.(null);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View>
      {/* Readout row: fixed height so the chart doesn't jump while scrubbing */}
      <View style={styles.readoutRow}>
        {cursorInfo ? (
          <Text style={[styles.readoutText, { color: c.foreground }]}>
            {Math.round(cursorInfo.ele)} m
            {cursorInfo.km != null ? (
              <Text style={{ color: c.mutedForeground }}>
                {"  ·  "}
                {cursorInfo.km.toFixed(1)} km
              </Text>
            ) : null}
          </Text>
        ) : (
          <Text style={[styles.readoutHint, { color: c.mutedForeground }]}>
            Sleep over de grafiek voor hoogte per punt
          </Text>
        )}
      </View>
      <View
        style={styles.chartWrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT} pointerEvents="none">
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
            {cursorInfo ? (
              <>
                <Line
                  x1={cursorInfo.x}
                  y1={0}
                  x2={cursorInfo.x}
                  y2={CHART_HEIGHT}
                  stroke={c.foreground}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                />
                <Circle
                  cx={cursorInfo.x}
                  cy={cursorInfo.y}
                  r={5}
                  fill={c.primary}
                  stroke={c.background}
                  strokeWidth={2}
                />
              </>
            ) : null}
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
  readoutRow: {
    height: 20,
    justifyContent: "center",
    marginBottom: 2,
  },
  readoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  readoutHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
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
