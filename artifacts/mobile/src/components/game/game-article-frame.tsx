import { useMemo, type RefObject } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { SearchSheetMode } from "@/lib/game-search";

export interface GameArticleFrameProps {
  activeDocumentId: string | null;
  articleLoading: boolean;
  moving: boolean;
  onBlockedTap: () => void;
  onCollapseSearch: () => void;
  onLoadEnd: () => void;
  onMessage: (event: WebViewMessageEvent) => void;
  searchMode: SearchSheetMode;
  shell: string | null;
  webViewRef: RefObject<WebView | null>;
}

export function GameArticleFrame({
  activeDocumentId,
  articleLoading,
  moving,
  onBlockedTap,
  onCollapseSearch,
  onLoadEnd,
  onMessage,
  searchMode,
  shell,
  webViewRef,
}: GameArticleFrameProps) {
  const theme = useAppTheme();
  const { colors, isDark } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.articleFrame}>
      {articleLoading || !shell ? (
        <View style={styles.articleLoading}>
          <ActivityIndicator color={colors.accent} />
          <Text selectable style={styles.centeredText}>
            Loading article...
          </Text>
        </View>
      ) : (
        <WebView
          bounces
          decelerationRate="normal"
          directionalLockEnabled
          ref={webViewRef}
          key={`${activeDocumentId}:${isDark ? "dark" : "light"}`}
          javaScriptEnabled
          nestedScrollEnabled
          originWhitelist={["*"]}
          source={{ html: shell }}
          onLoadEnd={onLoadEnd}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(request) =>
            request.url === "about:blank" ||
            request.url.startsWith("about:srcdoc")
          }
          overScrollMode="always"
          scrollEnabled
          showsVerticalScrollIndicator
          startInLoadingState
          style={styles.webview}
        />
      )}

      {searchMode === "expanded" ? (
        <Pressable
          accessibilityLabel="Hide search results"
          accessibilityRole="button"
          onPress={onCollapseSearch}
          role="button"
          style={styles.searchScrim}
          testID="search-scrim"
        />
      ) : null}

      {moving ? (
        <Pressable
          accessibilityHint="Wait for the current move to finish."
          accessibilityLabel="Move in progress"
          onPress={onBlockedTap}
          style={styles.movingOverlay}
        >
          <ActivityIndicator color={colors.accent} />
          <Text selectable style={styles.movingOverlayText}>
            Moving...
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles({ colors, fonts, isDark }: AppTheme) {
  return StyleSheet.create({
    articleFrame: {
      backgroundColor: colors.surface,
      flex: 1,
      position: "relative",
    },
    webview: {
      backgroundColor: colors.surface,
      flex: 1,
    },
    articleLoading: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
    },
    movingOverlay: {
      alignItems: "center",
      backgroundColor: isDark
        ? "rgba(0, 0, 0, 0.38)"
        : "rgba(250, 247, 240, 0.48)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 20,
    },
    movingOverlayText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      marginTop: 10,
    },
    searchScrim: {
      backgroundColor: colors.overlay,
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 10,
    },
    centeredText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
    },
  });
}
