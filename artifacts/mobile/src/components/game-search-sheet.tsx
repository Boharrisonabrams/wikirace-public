import Ionicons from "@expo/vector-icons/Ionicons";
import type { RefObject } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type {
  ArticleFindPresentation,
  FindDirection,
  FindSnippet,
} from "@/lib/article-find";
import {
  linkRowSubtitle,
  splitByRange,
  splitSnippet,
  type LinkMatch,
  type SearchSections,
  type SearchSheetMode,
} from "@/lib/game-search";

type SheetRow =
  | { kind: "link"; match: LinkMatch; key: string }
  | { kind: "snippet"; snippet: FindSnippet; key: string };

interface SheetSection {
  key: "links" | "text";
  title: string;
  count: string;
  hint: string | null;
  data: SheetRow[];
}

export interface GameSearchSheetProps {
  mode: Exclude<SearchSheetMode, "closed">;
  query: string;
  articleTitle: string;
  sections: SearchSections;
  presentation: ArticleFindPresentation;
  navigationDisabled: boolean;
  inputRef: RefObject<TextInput | null>;
  onChangeQuery: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onClose: () => void;
  onExpand: () => void;
  onNavigate: (direction: FindDirection) => void;
  onPickLink: (match: LinkMatch) => void;
  onPickSnippet: (snippet: FindSnippet) => void;
}

function buildSections(sections: SearchSections): SheetSection[] {
  const linkRows: SheetRow[] = sections.links.items.map((match, index) => ({
    kind: "link",
    match,
    key: `link:${index}:${match.link.article}`,
  }));
  const snippetRows: SheetRow[] = sections.text.snippets.map((snippet) => ({
    kind: "snippet",
    snippet,
    key: `snippet:${snippet.index}`,
  }));

  const linkCount =
    sections.links.status === "browse"
      ? `${sections.links.totalLinks}`
      : sections.links.status === "results"
        ? `${sections.links.items.length}`
        : "";
  const textCount =
    sections.text.status === "results" ? `${sections.text.total}` : "";

  const built: SheetSection[] = [];

  if (sections.links.status !== "hidden") {
    built.push({
      key: "links",
      title: "Links on this page",
      count: linkCount,
      hint:
        sections.links.status === "gated" || sections.links.status === "empty"
          ? sections.links.hint
          : sections.links.status === "loading"
            ? "Reading this page’s links…"
            : null,
      data: linkRows,
    });
  }

  const textHint =
    sections.text.status === "idle"
      ? "Type to search the article text."
      : sections.text.status === "searching"
        ? "Searching…"
        : sections.text.status === "empty"
          ? "No matches in the article text."
          : null;

  built.push({
    key: "text",
    title: "In the article",
    count: textCount,
    hint: textHint,
    data: snippetRows,
  });

  return built;
}

export function GameSearchSheet({
  mode,
  query,
  articleTitle,
  sections,
  presentation,
  navigationDisabled,
  inputRef,
  onChangeQuery,
  onSubmit,
  onClear,
  onClose,
  onExpand,
  onNavigate,
  onPickLink,
  onPickSnippet,
}: GameSearchSheetProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = makeStyles(theme);
  const { height: windowHeight } = useWindowDimensions();
  const expanded = mode === "expanded";
  const findOnly = sections.links.status === "hidden";
  const sheetSections = buildSections(sections);

  const input = (
    <View style={styles.inputShell}>
      {expanded ? (
        <Ionicons color={colors.inkMuted} name="search-outline" size={19} />
      ) : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={
          findOnly
            ? `Find text in ${articleTitle}`
            : `Search links and text in ${articleTitle}`
        }
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeQuery}
        onSubmitEditing={onSubmit}
        placeholder={
          expanded
            ? findOnly
              ? `Find in ${articleTitle}`
              : `Search ${articleTitle}`
            : findOnly
              ? "Find"
              : "Search"
        }
        placeholderTextColor={colors.inkMuted}
        returnKeyType="search"
        style={styles.input}
        testID="search-input"
        value={query}
      />
      {query.length > 0 ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={4}
          onPress={onClear}
          role="button"
          style={({ pressed }) => [
            styles.inputIconButton,
            pressed && styles.pressed,
          ]}
          testID="search-clear"
        >
          <Ionicons color={colors.inkMuted} name="close-circle" size={20} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View
      accessibilityRole="search"
      style={
        expanded
          ? [styles.sheet, { maxHeight: Math.round(windowHeight * 0.58) }]
          : styles.sheetMini
      }
      testID="search-sheet"
    >
      {expanded ? <View style={styles.grabber} /> : null}
      {/* The list stays mounted (display:none) in mini mode: remounting it
          on the first keystroke's mini→expanded flip dropped trailing
          characters under fast typing. */}
      <SectionList
        contentContainerStyle={styles.listContent}
        initialNumToRender={16}
        keyboardShouldPersistTaps="always"
        keyExtractor={(row) => row.key}
        renderItem={({ item }) =>
          item.kind === "link" ? (
            <LinkRow match={item.match} onPress={onPickLink} styles={styles} />
          ) : (
            <SnippetRow
              onPress={onPickSnippet}
              snippet={item.snippet}
              styles={styles}
            />
          )
        }
        renderSectionFooter={({ section }) =>
          section.hint ? (
            <View style={styles.sectionHintRow}>
              {section.key === "links" && sections.links.status === "gated" ? (
                <Ionicons
                  color={colors.inkMuted}
                  name="lock-closed-outline"
                  size={13}
                />
              ) : null}
              <Text
                style={styles.sectionHintText}
                testID={`search-${section.key}-hint`}
              >
                {section.hint}
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.count ? (
              <Text style={styles.sectionCount}>{section.count}</Text>
            ) : null}
          </View>
        )}
        sections={sheetSections}
        stickySectionHeadersEnabled={false}
        style={[styles.list, expanded ? null : styles.listHidden]}
        testID="search-results"
      />
      <View
        style={expanded ? styles.inputRow : styles.miniRow}
        testID={expanded ? undefined : "search-mini-bar"}
      >
        {expanded ? null : (
          <Pressable
            accessibilityLabel="Show search results"
            accessibilityRole="button"
            accessibilityState={{ expanded: false }}
            onPress={onExpand}
            role="button"
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
            ]}
            testID="search-mini-expand"
          >
            <Ionicons color={colors.ink} name="chevron-up" size={18} />
          </Pressable>
        )}
        {input}
        {!expanded && presentation.counterLabel ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.counter}
            testID="search-count"
          >
            {presentation.counterLabel}
          </Text>
        ) : null}
        {expanded ? null : (
          <Pressable
            accessibilityLabel="Previous match"
            accessibilityRole="button"
            disabled={navigationDisabled}
            onPress={() => onNavigate("previous")}
            role="button"
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
              navigationDisabled && styles.disabled,
            ]}
            testID="search-previous"
          >
            <Ionicons color={colors.ink} name="chevron-back" size={18} />
          </Pressable>
        )}
        {expanded ? null : (
          <Pressable
            accessibilityLabel="Next match"
            accessibilityRole="button"
            disabled={navigationDisabled}
            onPress={() => onNavigate("next")}
            role="button"
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
              navigationDisabled && styles.disabled,
            ]}
            testID="search-next"
          >
            <Ionicons color={colors.ink} name="chevron-forward" size={18} />
          </Pressable>
        )}
        {expanded ? (
          <Pressable
            accessibilityLabel="Close search"
            accessibilityRole="button"
            onPress={onClose}
            role="button"
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.pressed,
            ]}
            testID="search-done"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Close search"
            accessibilityRole="button"
            onPress={onClose}
            role="button"
            style={({ pressed }) => [
              styles.roundButton,
              pressed && styles.pressed,
            ]}
            testID="search-close"
          >
            <Ionicons color={colors.ink} name="close" size={19} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LinkRow({
  match,
  onPress,
  styles,
}: {
  match: LinkMatch;
  onPress: (match: LinkMatch) => void;
  styles: SheetStyles;
}) {
  const theme = useAppTheme();
  const [before, marked, after] = splitByRange(
    match.link.text,
    match.textRange,
  );
  const subtitle = linkRowSubtitle(match.link);
  return (
    <Pressable
      accessibilityHint="Moves to this article. Counts as a click."
      accessibilityLabel={`Go to ${match.link.article}`}
      accessibilityRole="button"
      onPress={() => onPress(match)}
      role="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={`search-link-${match.link.article}`}
    >
      <Ionicons
        color={theme.colors.link}
        name="arrow-forward-circle-outline"
        size={20}
      />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {before}
          {marked ? <Text style={styles.rowTitleMark}>{marked}</Text> : null}
          {after}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.rowSnippet}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SnippetRow({
  snippet,
  onPress,
  styles,
}: {
  snippet: FindSnippet;
  onPress: (snippet: FindSnippet) => void;
  styles: SheetStyles;
}) {
  const theme = useAppTheme();
  const [before, marked, after] = splitSnippet(snippet);
  return (
    <Pressable
      accessibilityHint="Scrolls the article to this match."
      accessibilityLabel={`Jump to match ${snippet.index + 1}`}
      accessibilityRole="button"
      onPress={() => onPress(snippet)}
      role="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={`search-snippet-${snippet.index}`}
    >
      <Ionicons color={theme.colors.inkMuted} name="text-outline" size={18} />
      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={styles.rowSnippetBody}>
          {before}
          <Text style={styles.rowSnippetMark}>{marked}</Text>
          {after}
        </Text>
      </View>
    </Pressable>
  );
}

type SheetStyles = ReturnType<typeof makeStyles>;

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.chrome,
      borderColor: colors.borderSoft,
      borderTopLeftRadius: radius.large,
      borderTopRightRadius: radius.large,
      borderWidth: StyleSheet.hairlineWidth,
      paddingBottom: 6,
      paddingHorizontal: 10,
    },
    grabber: {
      alignSelf: "center",
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      height: 4,
      marginBottom: 4,
      marginTop: 7,
      opacity: 0.55,
      width: 40,
    },
    list: {
      flexGrow: 0,
    },
    listHidden: {
      display: "none",
    },
    listContent: {
      paddingBottom: 4,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 7,
      paddingBottom: 3,
      paddingHorizontal: 4,
      paddingTop: 10,
    },
    sectionTitle: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    sectionCount: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.small,
      color: colors.accent,
      fontFamily: fonts.mono,
      fontSize: 10,
      fontVariant: ["tabular-nums"],
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    sectionHintRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      paddingBottom: 6,
      paddingHorizontal: 4,
      paddingTop: 2,
    },
    sectionHintText: {
      color: colors.inkMuted,
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 16,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 6,
      paddingVertical: 7,
    },
    rowPressed: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.small,
    },
    rowBody: {
      flex: 1,
      gap: 1,
    },
    rowTitle: {
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 20,
    },
    rowTitleMark: {
      backgroundColor: colors.accentSoft,
      fontFamily: fonts.sansSemiBold,
    },
    rowSnippet: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 16,
    },
    rowSnippetBody: {
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 18,
    },
    rowSnippetMark: {
      backgroundColor: colors.accentSoft,
      fontFamily: fonts.sansSemiBold,
    },
    inputRow: {
      alignItems: "center",
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 8,
      paddingTop: 8,
    },
    sheetMini: {
      backgroundColor: colors.chrome,
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    miniRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 8,
      paddingTop: 7,
      paddingBottom: 7,
    },
    inputShell: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.small,
      flex: 1,
      flexDirection: "row",
      minHeight: 44,
      paddingLeft: 12,
    },
    input: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 16,
      height: 44,
      minWidth: 60,
      paddingHorizontal: 10,
      paddingVertical: 0,
    },
    inputIconButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 40,
    },
    counter: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.small,
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
      minWidth: 50,
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 5,
      textAlign: "center",
    },
    roundButton: {
      alignItems: "center",
      borderRadius: radius.small,
      height: 44,
      justifyContent: "center",
      width: 36,
    },
    doneButton: {
      alignItems: "center",
      borderRadius: radius.small,
      height: 44,
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    doneText: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.35,
    },
  });
}
