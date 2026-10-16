import * as gameClient from "@workspace/game-client";
import { describe, expect, it } from "vitest";

import * as activeTimer from "./active-timer";
import * as articleFind from "./article-find";
import * as claimAccount from "./claim-account";
import * as gameSearch from "./game-search";
import * as gameUtils from "./game-utils";
import * as playerSession from "./player-session";
import * as socialAuthAvailability from "./social-auth-availability";
import * as username from "./username";

// Each lib module keeps the runtime exports it had before the shared package
// existed. Shared names must be the package's own bindings, not local copies.
const adapters: Array<{
  module: string;
  adapter: Record<string, unknown>;
  shared: string[];
  local: string[];
}> = [
  {
    module: "active-timer",
    adapter: activeTimer,
    shared: [
      "HEARTBEAT_INTERVAL_MS",
      "createActiveTimerState",
      "createTimingRequestCoordinator",
      "displayedActiveTimeMs",
      "reconcileActiveTimer",
      "reduceActiveTimer",
    ],
    local: [],
  },
  {
    module: "article-find",
    adapter: articleFind,
    shared: [
      "buildArticleFindPresentation",
      "createArticleFindState",
      "resetArticleFindState",
      "stepMatchIndex",
      "updateArticleFindQuery",
    ],
    local: [
      "applyArticleFindEvent",
      "isArticleWebViewEventForDocument",
      "parseArticleWebViewEvent",
    ],
  },
  {
    module: "claim-account",
    adapter: claimAccount,
    shared: ["completeEmailClaim"],
    local: [
      "ACCOUNT_CLAIM_CONFLICT_MESSAGE",
      "AccountClaimConflictError",
      "claimWithOAuth",
      "isAccountClaimConflict",
      "requestEmailClaim",
    ],
  },
  {
    module: "game-search",
    adapter: gameSearch,
    shared: [
      "LINK_RESULT_CAP",
      "buildSearchSections",
      "filterArticleLinks",
      "linkRowSubtitle",
      "resolveLinkSearchMode",
      "splitByRange",
      "splitSnippet",
    ],
    local: [],
  },
  {
    module: "game-utils",
    adapter: gameUtils,
    shared: ["puzzleNumber"],
    local: ["formatTime", "isSafeChallengeUrl", "progressSavedCopy"],
  },
  {
    module: "player-session",
    adapter: playerSession,
    shared: [
      "PLAYER_SESSION_UNAVAILABLE_MESSAGE",
      "ensurePlayerSession",
      "isGuestUser",
    ],
    local: [],
  },
  {
    module: "social-auth-availability",
    adapter: socialAuthAvailability,
    shared: ["resolveSocialAuthVisibility"],
    local: [],
  },
  {
    module: "username",
    adapter: username,
    shared: ["USERNAME_MAX_LENGTH", "normalizeUsername", "validateUsername"],
    local: [],
  },
];

const sharedBindings: Record<string, unknown> = gameClient;

describe("mobile lib adapters for @workspace/game-client", () => {
  it.each(adapters)(
    "$module keeps its exports and uses the shared implementation",
    ({ adapter, shared, local }) => {
      expect(Object.keys(adapter).sort()).toEqual([...shared, ...local].sort());
      for (const name of shared) {
        expect(sharedBindings[name], name).toBeDefined();
        expect(adapter[name], name).toBe(sharedBindings[name]);
      }
      for (const name of local) {
        expect(adapter[name], name).toBeDefined();
      }
    },
  );
});
