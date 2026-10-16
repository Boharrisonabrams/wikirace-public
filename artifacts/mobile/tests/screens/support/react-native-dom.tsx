// A DOM stand-in for the react-native primitives the screens use, so a
// screen can render under react-dom in jsdom. Each primitive keeps the props
// a user can perceive (text, accessibility label, role, state, testID) and
// maps presses to clicks. Layout and styling props are dropped.
import * as React from "react";
import { vi } from "vitest";

type NativeProps = Record<string, unknown> & { children?: unknown };

interface AccessibilityStateLike {
  busy?: boolean;
  checked?: boolean;
  disabled?: boolean;
}

function asNode(value: unknown): React.ReactNode {
  return value as React.ReactNode;
}

function domAttributes(props: NativeProps): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (typeof props.testID === "string") {
    attributes["data-testid"] = props.testID;
  }
  if (typeof props.accessibilityLabel === "string") {
    attributes["aria-label"] = props.accessibilityLabel;
  }
  if (typeof props.accessibilityHint === "string") {
    attributes["data-hint"] = props.accessibilityHint;
  }
  const role = props.accessibilityRole ?? props.role;
  if (typeof role === "string") attributes.role = role;
  const state = props.accessibilityState as AccessibilityStateLike | undefined;
  if (state?.busy) attributes["aria-busy"] = "true";
  if (state?.checked !== undefined) {
    attributes["aria-checked"] = String(state.checked);
  }
  if (state?.disabled || props.disabled === true) {
    attributes["aria-disabled"] = "true";
  }
  return attributes;
}

export function View(props: NativeProps) {
  return <div {...domAttributes(props)}>{asNode(props.children)}</div>;
}

export function Text(props: NativeProps) {
  return <span {...domAttributes(props)}>{asNode(props.children)}</span>;
}

export function Pressable(props: NativeProps) {
  const children =
    typeof props.children === "function"
      ? (props.children as (state: { pressed: boolean }) => unknown)({
          pressed: false,
        })
      : props.children;
  const onPress = props.onPress as ((event: unknown) => void) | undefined;
  return (
    <div
      role="button"
      {...domAttributes(props)}
      data-pressable="true"
      onClick={(event) => {
        if (props.disabled === true) return;
        onPress?.(event);
      }}
    >
      {asNode(children)}
    </div>
  );
}

export function ActivityIndicator(props: NativeProps) {
  return <span {...domAttributes(props)} data-activity-indicator="true" />;
}

export function KeyboardAvoidingView(props: NativeProps) {
  return <div {...domAttributes(props)}>{asNode(props.children)}</div>;
}

export function Modal(props: NativeProps) {
  if (props.visible !== true) return null;
  return <div data-modal="true">{asNode(props.children)}</div>;
}

export function RefreshControl(props: NativeProps) {
  const onRefresh = props.onRefresh as (() => void) | undefined;
  return (
    <div
      data-refreshing={String(props.refreshing === true)}
      data-testid="refresh-control"
      onClick={() => onRefresh?.()}
    />
  );
}

export const scrollToSpy = vi.fn();

export function ScrollView(props: NativeProps & { ref?: React.Ref<unknown> }) {
  React.useImperativeHandle(props.ref, () => ({
    scrollTo: scrollToSpy,
    scrollToEnd: () => undefined,
  }));
  return (
    <div {...domAttributes(props)}>
      {asNode(props.refreshControl)}
      {asNode(props.children)}
    </div>
  );
}

interface SectionLike {
  data: readonly unknown[];
  key?: string;
}

export function SectionList(props: NativeProps) {
  const sections = (props.sections ?? []) as readonly SectionLike[];
  const renderItem = props.renderItem as
    | ((info: {
        item: unknown;
        index: number;
        section: SectionLike;
      }) => unknown)
    | undefined;
  const renderSectionHeader = props.renderSectionHeader as
    | ((info: { section: SectionLike }) => unknown)
    | undefined;
  const renderSectionFooter = props.renderSectionFooter as
    | ((info: { section: SectionLike }) => unknown)
    | undefined;
  return (
    <div {...domAttributes(props)}>
      {sections.map((section, sectionIndex) => (
        <div key={section.key ?? String(sectionIndex)}>
          {asNode(renderSectionHeader?.({ section }))}
          {section.data.map((item, index) => (
            <div key={index}>
              {asNode(renderItem?.({ item, index, section }))}
            </div>
          ))}
          {asNode(renderSectionFooter?.({ section }))}
        </div>
      ))}
    </div>
  );
}

export function TextInput(
  props: NativeProps & { ref?: React.Ref<HTMLInputElement> },
) {
  const onChangeText = props.onChangeText as
    | ((value: string) => void)
    | undefined;
  const onSubmitEditing = props.onSubmitEditing as
    | ((event: { nativeEvent: { text: string } }) => void)
    | undefined;
  return (
    <input
      {...domAttributes(props)}
      disabled={props.editable === false}
      onChange={(event) => onChangeText?.(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSubmitEditing?.({
            nativeEvent: { text: event.currentTarget.value },
          });
        }
      }}
      placeholder={
        typeof props.placeholder === "string" ? props.placeholder : undefined
      }
      ref={props.ref}
      value={typeof props.value === "string" ? props.value : ""}
    />
  );
}

export const StyleSheet = {
  absoluteFill: {},
  absoluteFillObject: {},
  create: <T,>(styles: T): T => styles,
  flatten: <T,>(style: T): T => style,
  hairlineWidth: 1,
};

export const Platform = {
  OS: "ios",
  Version: "18.0",
  select: <T,>(spec: { default?: T; ios?: T; native?: T }): T | undefined =>
    spec.ios ?? spec.native ?? spec.default,
};

export const Alert = { alert: vi.fn() };

type AppStateListener = (state: string) => void;
const appStateListeners = new Set<AppStateListener>();

export const AppState = {
  addEventListener: (_type: string, listener: AppStateListener) => {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
  currentState: "active",
};

export function emitAppState(state: string) {
  AppState.currentState = state;
  for (const listener of [...appStateListeners]) listener(state);
}

export const Keyboard = {
  addListener: () => ({ remove: () => undefined }),
  dismiss: vi.fn(),
};

export const Linking = {
  openSettings: vi.fn(async () => undefined),
  openURL: vi.fn(async () => true),
};

export const Share = {
  share: vi.fn(async () => ({ action: "sharedAction" })),
};

export function useColorScheme() {
  return "light";
}

export function useWindowDimensions() {
  return { fontScale: 1, height: 852, scale: 3, width: 393 };
}
