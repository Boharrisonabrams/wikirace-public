import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EditorialCard, PrimaryAction } from "@/components/editorial-ui";
import { editorialType } from "@/constants/theme";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { createCustomChallenge, getWikipediaSuggestions } from "@/lib/api";
import {
  createArticleSuggestionController,
  selectedPrivateChallengeDraft,
  type ArticleSuggestionState,
  type WikipediaSuggestion,
} from "@/lib/article-suggestions";
import {
  createPrivateChallengeController,
  privateChallengePreviewRoute,
  type PrivateChallengeErrors,
} from "@/lib/private-challenge";
import type { SearchTier } from "@/lib/types";

export default function CreatePrivateChallengeScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const targetInput = useRef<TextInput>(null);
  const [startLookup, setStartLookup] = useState<ArticleSuggestionState>({
    error: null,
    query: "",
    selected: null,
    status: "idle",
    suggestions: [],
  });
  const [endLookup, setEndLookup] = useState<ArticleSuggestionState>({
    error: null,
    query: "",
    selected: null,
    status: "idle",
    suggestions: [],
  });
  const startController = useMemo(
    () =>
      createArticleSuggestionController({
        onChange: setStartLookup,
        search: getWikipediaSuggestions,
      }),
    [],
  );
  const endController = useMemo(
    () =>
      createArticleSuggestionController({
        onChange: setEndLookup,
        search: getWikipediaSuggestions,
      }),
    [],
  );
  const [errors, setErrors] = useState<PrivateChallengeErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchTier, setSearchTier] = useState<SearchTier>("find");

  useEffect(
    () => () => {
      startController.dispose();
      endController.dispose();
    },
    [endController, startController],
  );

  async function submit() {
    if (creating) return;
    setCreating(true);
    setErrors({});
    setRequestError(null);

    const selection = selectedPrivateChallengeDraft(
      startLookup.selected,
      endLookup.selected,
    );
    if (!selection.ok) {
      setErrors(selection.errors);
      setCreating(false);
      return;
    }

    const controller = createPrivateChallengeController({
      create: async (draft) => {
        const { challenge } = await createCustomChallenge(draft);
        return challenge;
      },
      navigateToPreview: (challenge) => {
        router.replace(privateChallengePreviewRoute(challenge));
      },
    });

    try {
      const result = await controller.submit({
        ...selection.value,
        searchTier,
      });
      if (!result.ok) setErrors(result.errors);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Could not create this challenge. Try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.page}
    >
      <Stack.Screen options={{ title: "Create a private game" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.kicker}>Private game</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Pick the route
          </Text>
          <Text style={styles.detail}>
            Choose two Wikipedia articles. We’ll make a link you can send to
            friends.
          </Text>
        </View>

        <EditorialCard style={styles.formCard}>
          <ArticleSuggestionField
            accessibilityLabel="Starting Wikipedia article"
            controller={startController}
            error={errors.startArticle}
            inputTestID="private-start-input"
            label="Starting article"
            onChange={() => {
              if (errors.startArticle) {
                setErrors((current) => ({
                  ...current,
                  startArticle: undefined,
                }));
              }
            }}
            onSelect={() => targetInput.current?.focus()}
            placeholder="e.g. Christopher Columbus"
            state={startLookup}
            styles={styles}
            theme={theme}
          />

          <ArticleSuggestionField
            accessibilityLabel="Target Wikipedia article"
            controller={endController}
            error={errors.endArticle}
            inputRef={targetInput}
            inputTestID="private-target-input"
            label="Target article"
            onChange={() => {
              if (errors.endArticle) {
                setErrors((current) => ({
                  ...current,
                  endArticle: undefined,
                }));
              }
            }}
            onSubmit={() => void submit()}
            placeholder="e.g. United Nations"
            state={endLookup}
            styles={styles}
            theme={theme}
          />

          <SearchTierChoice
            selected={searchTier}
            styles={styles}
            onChange={setSearchTier}
          />

          {requestError ? (
            <Text accessibilityRole="alert" style={styles.requestError}>
              {requestError}
            </Text>
          ) : null}

          <PrimaryAction
            icon="send"
            label="Create challenge"
            loading={creating}
            onPress={() => void submit()}
            testID="create-private-challenge-btn"
          />
        </EditorialCard>

        <Text style={styles.footnote}>
          Creating the link does not start your attempt. You’ll see the route
          before anyone plays.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SearchTierChoice({
  selected,
  styles,
  onChange,
}: {
  selected: SearchTier;
  styles: ReturnType<typeof makeStyles>;
  onChange: (value: SearchTier) => void;
}) {
  const options: Array<{ value: SearchTier; title: string; detail: string }> = [
    {
      value: "find",
      title: "Find only",
      detail: "Only in-article text find during the race.",
    },
    {
      value: "palette",
      title: "Full palette",
      detail: "Links list plus in-article text find.",
    },
  ];

  return (
    <View style={styles.searchTierSection}>
      <Text style={styles.label}>Search</Text>
      <View style={styles.searchTierOptions}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={[
                styles.searchTierOption,
                active && styles.searchTierOptionActive,
              ]}
              testID={`search-tier-${option.value}`}
            >
              <Text
                style={[
                  styles.searchTierTitle,
                  active && styles.searchTierTitleActive,
                ]}
              >
                {option.title}
              </Text>
              <Text style={styles.searchTierDetail}>{option.detail}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SuggestionController = ReturnType<
  typeof createArticleSuggestionController
>;

type ArticleSuggestionFieldProps = {
  accessibilityLabel: string;
  controller: SuggestionController;
  error?: string;
  inputRef?: React.RefObject<TextInput | null>;
  inputTestID: string;
  label: string;
  onChange: () => void;
  onSelect?: (suggestion: WikipediaSuggestion) => void;
  onSubmit?: () => void;
  placeholder: string;
  state: ArticleSuggestionState;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
};

function ArticleSuggestionField({
  accessibilityLabel,
  controller,
  error,
  inputRef,
  inputTestID,
  label,
  onChange,
  onSelect,
  onSubmit,
  placeholder,
  state,
  styles,
  theme,
}: ArticleSuggestionFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={accessibilityLabel}
          autoCapitalize="words"
          autoCorrect
          onChangeText={(value) => {
            controller.changeQuery(value);
            onChange();
          }}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.inkMuted}
          returnKeyType={onSubmit ? "done" : "next"}
          style={[
            styles.input,
            state.selected && styles.inputSelected,
            error && styles.inputError,
          ]}
          testID={inputTestID}
          value={state.query}
        />
        {state.query ? (
          <Pressable
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              controller.clear();
              onChange();
            }}
            style={styles.clearButton}
            testID={`${inputTestID}-clear`}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {state.status === "loading" ? (
        <View accessibilityLiveRegion="polite" style={styles.lookupStatus}>
          <ActivityIndicator color={theme.colors.accent} size="small" />
          <Text style={styles.statusText}>Searching Wikipedia…</Text>
        </View>
      ) : state.status === "empty" ? (
        <Text accessibilityLiveRegion="polite" style={styles.statusText}>
          No matching articles. Try another title.
        </Text>
      ) : state.status === "error" ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {state.error}
        </Text>
      ) : state.status === "selected" && state.selected ? (
        <Text accessibilityLiveRegion="polite" style={styles.selectedText}>
          {state.selected.description
            ? `Selected · ${state.selected.title} — ${state.selected.description}`
            : `Selected · ${state.selected.title}`}
        </Text>
      ) : state.query.trim().length === 1 ? (
        <Text style={styles.statusText}>
          Type one more character to search.
        </Text>
      ) : null}

      {state.suggestions.length > 0 ? (
        <View
          accessibilityLabel={`${label} suggestions`}
          style={styles.suggestionList}
        >
          {state.suggestions.map((suggestion) => (
            <Pressable
              accessibilityLabel={`Select ${suggestion.title}${
                suggestion.description ? `, ${suggestion.description}` : ""
              }`}
              accessibilityRole="button"
              key={suggestion.title}
              onPress={() => {
                controller.select(suggestion);
                onSelect?.(suggestion);
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              {suggestion.description ? (
                <Text numberOfLines={2} style={styles.suggestionDescription}>
                  {suggestion.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    page: {
      backgroundColor: colors.chrome,
      flex: 1,
    },
    content: {
      gap: 20,
      padding: 20,
      paddingBottom: 40,
    },
    intro: {
      gap: 8,
      paddingTop: 8,
    },
    kicker: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.label,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      ...editorialType.pageTitle,
    },
    detail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      ...editorialType.body,
    },
    formCard: {
      gap: 20,
      padding: 18,
    },
    searchTierSection: {
      gap: 8,
    },
    searchTierOptions: {
      gap: 9,
    },
    searchTierOption: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    searchTierOptionActive: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    searchTierTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    searchTierTitleActive: {
      color: colors.accent,
    },
    searchTierDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
    },
    field: {
      gap: 7,
    },
    label: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: editorialType.control.fontSize,
      minHeight: 50,
      paddingHorizontal: 13,
      paddingVertical: 12,
      flex: 1,
    },
    inputRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    inputSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    inputError: {
      borderColor: colors.danger,
      borderWidth: 2,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    clearButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      minWidth: 52,
      paddingHorizontal: 6,
    },
    clearButtonText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    lookupStatus: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 28,
    },
    statusText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    selectedText: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      lineHeight: 19,
    },
    suggestionList: {
      borderColor: colors.border,
      borderWidth: 1,
    },
    suggestion: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 3,
      minHeight: 56,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    suggestionTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    suggestionDescription: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
    },
    requestError: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    footnote: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      ...editorialType.body,
      paddingHorizontal: 4,
      textAlign: "center",
    },
  });
}
