// Client logic shared by artifacts/web and artifacts/mobile.
// Platform code (DOM, WebView, Expo, Supabase client setup) stays in each app.

export {
  HEARTBEAT_INTERVAL_MS,
  createActiveTimerState,
  createTimingRequestCoordinator,
  displayedActiveTimeMs,
  reconcileActiveTimer,
  reduceActiveTimer,
  type ActiveTimerDecision,
  type ActiveTimerEvent,
  type ActiveTimerState,
  type ClientTimingAction,
  type CreateActiveTimerStateOptions,
  type ServerTimingState,
  type TimingRequestCoordinator,
  type TimingSessionToken,
} from "./active-timer";

export {
  buildArticleFindPresentation,
  createArticleFindState,
  resetArticleFindState,
  stepMatchIndex,
  updateArticleFindQuery,
  type ArticleFindPresentation,
  type ArticleFindState,
  type ArticleLinkEntry,
  type FindDirection,
  type FindSnippet,
} from "./article-find";

export {
  completeEmailClaim,
  currentClaimSession,
  type ClaimProfile,
  type ClaimSuccess,
} from "./claim-account";

export {
  LINK_RESULT_CAP,
  buildSearchSections,
  filterArticleLinks,
  linkRowSubtitle,
  resolveLinkSearchMode,
  splitByRange,
  splitSnippet,
  type LinkMatch,
  type LinkSearchMode,
  type LinkSectionStatus,
  type SearchSections,
  type TextSectionStatus,
} from "./game-search";

export {
  PLAYER_SESSION_UNAVAILABLE_MESSAGE,
  ensurePlayerSession,
  isGuestUser,
} from "./player-session";

export { puzzleNumber } from "./puzzle-number";

export {
  resolveSocialAuthVisibility,
  type SocialAuthEnvironment,
  type SocialAuthVisibility,
} from "./social-auth-availability";

export type { ChallengeType, SearchTier } from "./types";

export { USERNAME_MAX_LENGTH, normalizeUsername, validateUsername } from "./username";
