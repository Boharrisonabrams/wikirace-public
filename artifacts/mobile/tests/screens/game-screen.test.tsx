// @vitest-environment jsdom
import * as React from "react";
import { Alert, Keyboard } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameSession } from "@/lib/types";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  api: {
    completeGame: vi.fn(),
    getArticle: vi.fn(),
    navigateGame: vi.fn(),
    startGame: vi.fn(),
    transitionGameTiming: vi.fn(),
  },
  auth: {
    isGuest: false,
    loading: false,
    user: { id: "player-1" } as { id: string } | null,
  },
}));

vi.mock("react-native", () => import("./support/react-native-dom"));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
vi.mock("react-native-webview", () => import("./support/webview"));
vi.mock("@expo/vector-icons/Ionicons", () => import("./support/icon"));
vi.mock("expo-router", () => import("./support/expo-router"));
vi.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  impactAsync: vi.fn(async () => undefined),
  selectionAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "event-id" }));
vi.mock("@/hooks/use-auth-session", () => ({
  useAuthSession: () => mocks.auth,
}));
vi.mock("@/lib/api", () => mocks.api);

import GameScreen from "@/app/game";
import { router, setSearchParams } from "./support/expo-router";
import {
  flush,
  getByLabel,
  getByTestId,
  isDisabled,
  press,
  queryByLabel,
  queryByTestId,
  render,
  textOf,
  typeInto,
  unmountAll,
} from "./support/render";
import { postMessage, webView } from "./support/webview";

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    activeTimeMs: 0,
    attemptNumber: 1,
    challengeId: null,
    challengeType: "practice",
    clicks: 0,
    completed: false,
    completedAt: null,
    endArticle: "Moon",
    endDescription: "Natural satellite of Earth",
    friendChallengeId: null,
    gaveUp: false,
    id: "session-1",
    isOfficial: false,
    localDate: null,
    path: ["Bronze"],
    startArticle: "Bronze",
    startedAt: "2026-10-15T00:00:00.000Z",
    timeSeconds: null,
    timeZone: null,
    timingActive: false,
    won: false,
    ...overrides,
  };
}

function postedCommands(): Array<Record<string, unknown>> {
  return postMessage.mock.calls.map(
    ([payload]) => JSON.parse(String(payload)) as Record<string, unknown>,
  );
}

async function sendArticleMessage(message: Record<string, unknown>) {
  await webView.props?.onMessage?.({
    nativeEvent: { data: JSON.stringify(message) },
  });
  await flush();
}

async function renderLoadedGame() {
  const screen = await render(<GameScreen />);
  webView.props?.onLoadEnd?.();
  await flush();
  const documentId = String(
    postedCommands().find((command) => command.type === "links/collect")
      ?.documentId,
  );
  return { ...screen, documentId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.loading = false;
  mocks.auth.user = { id: "player-1" };
  webView.props = null;
  setSearchParams({ type: "practice" });
  mocks.api.startGame.mockResolvedValue({ session: makeSession() });
  mocks.api.getArticle.mockImplementation(async (title: string) => ({
    html: `<p>${title} article</p>`,
    title,
  }));
  mocks.api.transitionGameTiming.mockResolvedValue({
    activeTimeMs: 0,
    timingActive: true,
  });
  mocks.api.completeGame.mockResolvedValue({});
});

afterEach(async () => {
  await unmountAll();
});

describe("GameScreen", () => {
  it("shows the loading state until the race starts", async () => {
    mocks.api.startGame.mockReturnValue(new Promise(() => undefined));

    const { container } = await render(<GameScreen />);

    expect(textOf(container)).toContain("Loading race...");
    expect(queryByTestId(container, "article-webview")).toBeNull();
  });

  it("renders the race header, route, article, and action bar", async () => {
    const { container } = await renderLoadedGame();
    const text = textOf(container);

    expect(mocks.api.startGame).toHaveBeenCalledWith({
      challengeId: undefined,
      challengeType: "practice",
      friendChallengeId: undefined,
    });
    expect(mocks.api.getArticle).toHaveBeenCalledWith("Bronze");
    expect(text).toContain("Practice");
    expect(text).toContain("0 clicks · Active 0:00");
    expect(text).toContain("Bronze");
    expect(text).toContain("Moon");
    expect(getByTestId(container, "article-webview")).toBeTruthy();
    expect(webView.props?.source?.html).toContain("Bronze article");
    expect(getByLabel(container, "Exit race")).toBeTruthy();
    expect(isDisabled(getByLabel(container, "Back one article"))).toBe(true);
    expect(getByLabel(container, "Search this page")).toBeTruthy();
    expect(getByLabel(container, "Give up")).toBeTruthy();
  });

  it("shows the start error with a way back home", async () => {
    mocks.api.startGame.mockRejectedValue(new Error("Daily is closed"));

    const { container } = await render(<GameScreen />);

    expect(textOf(container)).toContain("Daily is closed");
    await press(getByLabel(container, "Back home"));
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("sends a signed-out player to login with a return path", async () => {
    mocks.auth.user = null;

    await render(<GameScreen />);

    expect(mocks.api.startGame).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({
      params: { next: "/game?type=practice" },
      pathname: "/login",
    });
  });

  it("moves to a tapped article link and counts the click", async () => {
    mocks.api.navigateGame.mockResolvedValue({
      clicks: 1,
      currentArticle: "Metallurgy",
      path: ["Bronze", "Metallurgy"],
      valid: true,
      won: false,
    });
    const { container, documentId } = await renderLoadedGame();

    await sendArticleMessage({
      article: "Metallurgy",
      documentId,
      type: "article/link",
    });

    expect(mocks.api.navigateGame).toHaveBeenCalledWith({
      destinationTitle: "Metallurgy",
      sessionId: "session-1",
    });
    expect(mocks.api.getArticle).toHaveBeenLastCalledWith("Metallurgy");
    expect(textOf(container)).toContain("1 click · Active 0:00");
    expect(isDisabled(getByLabel(container, "Back one article"))).toBe(false);
  });

  it("goes back one article when back is allowed", async () => {
    mocks.api.startGame.mockResolvedValue({
      session: makeSession({ clicks: 1, path: ["Bronze", "Metallurgy"] }),
    });
    mocks.api.navigateGame.mockResolvedValue({
      clicks: 2,
      currentArticle: "Bronze",
      path: ["Bronze"],
      valid: true,
      won: false,
    });
    const { container } = await renderLoadedGame();

    await press(getByLabel(container, "Back one article"));

    expect(mocks.api.navigateGame).toHaveBeenCalledWith({
      back: true,
      sessionId: "session-1",
    });
    expect(textOf(container)).toContain("2 clicks");
  });

  it("opens the result after a confirmed give up", async () => {
    const { container } = await renderLoadedGame();

    await press(getByLabel(container, "Give up"));
    const [title, body, buttons] = vi.mocked(Alert.alert).mock.calls[0] ?? [];
    expect(title).toBe("Give up?");
    expect(body).toBe("Reveal the target: Moon");
    buttons?.find((button) => button.text === "Give up")?.onPress?.();
    await flush();

    expect(mocks.api.completeGame).toHaveBeenCalledWith("session-1", true);
    expect(router.replace).toHaveBeenCalledWith({
      params: { gaveUp: "true", sessionId: "session-1", type: "practice" },
      pathname: "/result",
    });
  });

  it("opens the result when a move reaches the target", async () => {
    mocks.api.navigateGame.mockResolvedValue({
      clicks: 1,
      currentArticle: "Moon",
      path: ["Bronze", "Moon"],
      valid: true,
      won: true,
    });
    const { documentId } = await renderLoadedGame();

    await sendArticleMessage({
      article: "Moon",
      documentId,
      type: "article/link",
    });

    expect(mocks.api.completeGame).toHaveBeenCalledWith("session-1", false);
    expect(router.replace).toHaveBeenCalledWith({
      params: { gaveUp: "false", sessionId: "session-1", type: "practice" },
      pathname: "/result",
    });
  });

  it("exits home from the close button", async () => {
    const { container } = await renderLoadedGame();

    await press(getByLabel(container, "Exit race"));

    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("shows and dismisses the exact target details", async () => {
    const { container } = await renderLoadedGame();
    expect(textOf(container)).not.toContain("Exact page: Moon");

    const target = [
      ...Array.from(
        container.querySelectorAll<HTMLElement>("[data-pressable]"),
      ),
    ].find((element) => textOf(element).includes("Moon"));
    if (!target) throw new Error("No pressable target in the path map");
    await press(target);
    expect(textOf(container)).toContain("Exact page: Moon");
    expect(textOf(container)).toContain("Natural satellite of Earth");

    await press(getByLabel(container, "Close target details"));
    expect(textOf(container)).not.toContain("Exact page: Moon");
  });

  it("searches the article and clears the find state on close", async () => {
    const { container, documentId } = await renderLoadedGame();

    await press(getByTestId(container, "search-open"));
    expect(queryByTestId(container, "search-open")).toBeNull();
    await typeInto(getByTestId(container, "search-input"), "alloy");
    await new Promise((resolve) => setTimeout(resolve, 150));
    await flush();

    expect(postedCommands()).toContainEqual({
      documentId,
      includeSnippets: true,
      query: "alloy",
      scrollToFirst: true,
      topOffset: 24,
      type: "find/query",
    });

    await press(getByTestId(container, "search-done"));
    expect(postedCommands()).toContainEqual({
      documentId,
      type: "find/clear",
    });
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(getByTestId(container, "search-open")).toBeTruthy();
    expect(queryByLabel(container, "Hide search results")).toBeNull();
  });

  it("navigates from a link picked in the search sheet", async () => {
    mocks.api.navigateGame.mockResolvedValue({
      clicks: 1,
      currentArticle: "Metallurgy",
      path: ["Bronze", "Metallurgy"],
      valid: true,
      won: false,
    });
    const { container, documentId } = await renderLoadedGame();
    await sendArticleMessage({
      documentId,
      links: [
        {
          article: "Metallurgy",
          snippet: "Early metallurgy.",
          text: "metallurgy",
        },
      ],
      type: "links/inventory",
    });

    await press(getByTestId(container, "search-open"));
    await typeInto(getByTestId(container, "search-input"), "metal");
    await press(getByTestId(container, "search-link-Metallurgy"));

    expect(mocks.api.navigateGame).toHaveBeenCalledWith({
      destinationTitle: "Metallurgy",
      sessionId: "session-1",
    });
    expect(getByTestId(container, "search-open")).toBeTruthy();
  });
});
