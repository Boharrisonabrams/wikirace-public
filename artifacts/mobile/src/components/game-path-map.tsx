import { Fragment, useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { buildGamePathMap } from "@/lib/game-path";

export function GamePathMap({
  compact = false,
  onTargetPress,
  path,
  targetDescription,
  target,
}: {
  compact?: boolean;
  onTargetPress?: () => void;
  path: readonly string[];
  targetDescription?: string | null;
  target: string;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const model = buildGamePathMap(path, target);
  const routeLabel = path.length > 0 ? path.join(" to ") : model.start;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!model.hasMoved) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [model.current, model.hasMoved, model.hiddenHopCount]);

  return (
    <View
      accessible
      accessibilityLabel={`Current path: ${routeLabel}. Current article: ${model.current}. Target: ${model.target}.`}
      accessibilityRole="text"
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.path}>
        <PathNode
          current={!model.hasMoved}
          kind={model.hasMoved ? "start" : "current"}
          label={model.start}
        />
        <Connector dashed={!model.hasMoved} />

        {model.hasMoved ? (
          <>
            {model.hiddenHopCount > 0 ? (
              <Fragment>
                <View style={styles.ellipsisChip}>
                  <View style={styles.ellipsisDot} />
                  <View style={styles.ellipsisDot} />
                  <View style={styles.ellipsisDot} />
                </View>
                <Connector />
              </Fragment>
            ) : null}
            <PathNode current kind="current" label={model.current} />
            <Connector dashed />
          </>
        ) : null}

          <PathNode
            kind="target"
            label={model.target}
            onPress={targetDescription ? onTargetPress : undefined}
          />
        </View>
      </ScrollView>
    </View>
  );

  function Connector({ dashed }: { dashed?: boolean }) {
    if (!dashed) {
      return <View style={[styles.connector, styles.connectorSolid]} />;
    }

    return (
      <View style={[styles.connector, styles.connectorDashed]}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={styles.connectorDash} />
        ))}
      </View>
    );
  }

  function PathNode({
    current,
    kind,
    label,
    onPress,
  }: {
    current?: boolean;
    kind: "start" | "current" | "target";
    label: string;
    onPress?: () => void;
  }) {
    const content = (
      <View style={styles.node}>
        <View style={styles.markerFrame}>
          {kind === "start" ? <View style={styles.startDot} /> : null}
          {kind === "current" ? (
            <View style={styles.currentRing}>
              <View style={styles.currentDot} />
            </View>
          ) : null}
          {kind === "target" ? (
            <View style={styles.targetRing}>
              <View style={styles.targetDot} />
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={compact ? 1 : 2}
          style={[
            styles.label,
            kind === "current" && styles.currentLabel,
            kind === "target" && styles.targetLabel,
          ]}
        >
          {label}
        </Text>
        {current && !compact ? (
          <Text style={styles.youAreHere}>you are here</Text>
        ) : null}
      </View>
    );

    if (!onPress) return content;

    return (
      <Pressable
        accessibilityHint="Shows the exact target page description."
        accessibilityLabel={`Exact page: ${label}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressedTarget]}
      >
        {content}
      </Pressable>
    );
  }
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 14,
    },
    path: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "center",
      minWidth: 332,
      paddingBottom: 2,
      paddingTop: 3,
    },
    node: {
      alignItems: "center",
      width: 78,
    },
    markerFrame: {
      alignItems: "center",
      height: 18,
      justifyContent: "center",
      width: 18,
    },
    startDot: {
      backgroundColor: colors.ink,
      borderColor: colors.chrome,
      borderRadius: 6,
      borderWidth: 2,
      height: 12,
      width: 12,
    },
    currentRing: {
      alignItems: "center",
      borderColor: colors.accent,
      borderRadius: 9,
      borderWidth: 1.5,
      height: 18,
      justifyContent: "center",
      width: 18,
    },
    currentDot: {
      backgroundColor: colors.accent,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    targetRing: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      borderColor: colors.link,
      borderRadius: 8,
      borderWidth: 2.5,
      height: 16,
      justifyContent: "center",
      width: 16,
    },
    targetDot: {
      backgroundColor: colors.link,
      borderRadius: 2,
      height: 4,
      width: 4,
    },
    connector: {
      alignItems: "center",
      flexDirection: "row",
      height: 2,
      justifyContent: "space-between",
      marginTop: 8,
      width: 52,
    },
    connectorSolid: {
      backgroundColor: colors.ink,
      opacity: 0.85,
    },
    connectorDashed: {
      opacity: 0.36,
    },
    connectorDash: {
      backgroundColor: colors.ink,
      borderRadius: 1,
      height: 2,
      width: 6,
    },
    label: {
      color: colors.ink,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      lineHeight: 12,
      marginTop: 6,
      textAlign: "center",
    },
    currentLabel: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
    },
    targetLabel: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
    },
    youAreHere: {
      color: colors.accent,
      fontFamily: fonts.sans,
      fontSize: 9,
      lineHeight: 11,
      marginTop: 1,
      textAlign: "center",
    },
    ellipsisChip: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      flexDirection: "row",
      gap: 4,
      marginTop: 4,
      paddingHorizontal: 7,
      zIndex: 2,
    },
    ellipsisDot: {
      backgroundColor: colors.inkMuted,
      borderRadius: 2,
      height: 4,
      opacity: 0.6,
      width: 4,
    },
    pressedTarget: {
      opacity: 0.72,
    },
  });
}
