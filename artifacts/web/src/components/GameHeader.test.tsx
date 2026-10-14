// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import GameHeader from "@/components/GameHeader";
import type { GameSession } from "@/lib/store/game-store";

describe("GameHeader", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // React 19 expects the environment flag for manual root + act tests.
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: () => {},
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the target description popover when metadata is available", async () => {
    const session: GameSession = {
      id: "session-1",
      challengeType: "daily",
      challengeId: "daily-1",
      friendChallengeId: null,
      startArticle: "Civil war",
      endArticle: "Civil war",
      endDescription:
        "a war between organized groups within the same state",
      path: ["Civil war"],
      clicks: 0,
      completed: false,
      won: false,
      gaveUp: false,
      timeSeconds: null,
      startedAt: "2026-07-24T00:00:00.000Z",
      completedAt: null,
      isOfficial: true,
    };

    await act(async () => {
      root.render(
        <GameHeader
          elapsedSeconds={12}
          moving={false}
          onBack={() => {}}
          onGiveUp={() => {}}
          session={session}
        />,
      );
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Civil war");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("Exact page: Civil war");
    expect(document.body.textContent).toContain(
      "a war between organized groups within the same state",
    );
  });
});
