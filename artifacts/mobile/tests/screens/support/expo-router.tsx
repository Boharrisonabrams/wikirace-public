// Test double for expo-router: records navigation calls, serves route params
// set by the test, and runs focus effects like a screen that stays focused.
import * as React from "react";
import { vi } from "vitest";

type SearchParams = Record<string, string | string[] | undefined>;

let searchParams: SearchParams = {};

export function setSearchParams(next: SearchParams) {
  searchParams = next;
}

export const router = {
  back: vi.fn(),
  dismissTo: vi.fn(),
  navigate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
};

export function useLocalSearchParams() {
  return searchParams;
}

export function useFocusEffect(effect: () => void | (() => void)) {
  React.useEffect(() => effect(), [effect]);
}

export const Stack = {
  Screen: () => null,
};
