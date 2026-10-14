import type { SharedChallengePreview } from "./challenge-entry";
import type { SearchTier } from "./types";
import {
  formatShareIntent,
  isSafeChallengeUrl,
  shareContentAsMessage,
  type ShareContent,
} from "@workspace/share-intent";
import {
  buildNativeSharePayload,
  type NativeSharePayload,
} from "./share-intent";

export interface PrivateChallengeDraft {
  startArticle: string;
  endArticle: string;
  searchTier: SearchTier;
}

export interface PrivateChallengeErrors {
  startArticle?: string;
  endArticle?: string;
}

export interface CreatedPrivateChallenge extends SharedChallengePreview {
  url: string;
}

export type ChallengePreviewState = {
  challenge: SharedChallengePreview | null;
  code: string;
  error: string | null;
  status: "loading" | "refreshing" | "ready" | "error";
};

const PREVIEW_HANDOFF_TTL_MS = 5 * 60 * 1_000;
const MAX_PREVIEW_HANDOFFS = 8;
const createdPreviewHandoffs = new Map<
  string,
  { challenge: CreatedPrivateChallenge; expiresAt: number }
>();

export function stageCreatedPrivateChallengeHandoff(
  challenge: CreatedPrivateChallenge,
  now = Date.now(),
): void {
  for (const [code, entry] of createdPreviewHandoffs) {
    if (entry.expiresAt <= now) createdPreviewHandoffs.delete(code);
  }
  createdPreviewHandoffs.delete(challenge.code);
  createdPreviewHandoffs.set(challenge.code, {
    challenge,
    expiresAt: now + PREVIEW_HANDOFF_TTL_MS,
  });
  while (createdPreviewHandoffs.size > MAX_PREVIEW_HANDOFFS) {
    const oldestCode = createdPreviewHandoffs.keys().next().value;
    if (typeof oldestCode !== "string") break;
    createdPreviewHandoffs.delete(oldestCode);
  }
}

export function peekCreatedPrivateChallengeHandoff(
  code: string,
  now = Date.now(),
): CreatedPrivateChallenge | null {
  const entry = createdPreviewHandoffs.get(code);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    createdPreviewHandoffs.delete(code);
    return null;
  }
  return entry.challenge;
}

export function clearCreatedPrivateChallengeHandoff(code?: string): void {
  if (code) createdPreviewHandoffs.delete(code);
  else createdPreviewHandoffs.clear();
}

export function beginChallengePreview(
  code: string,
  handedOffChallenge: SharedChallengePreview | null,
): ChallengePreviewState {
  return {
    challenge: handedOffChallenge,
    code,
    error: null,
    status: handedOffChallenge ? "refreshing" : "loading",
  };
}

export function acceptChallengePreview(
  state: ChallengePreviewState,
  requestedCode: string,
  challenge: SharedChallengePreview,
): ChallengePreviewState {
  if (state.code !== requestedCode) return state;
  return {
    challenge,
    code: requestedCode,
    error: null,
    status: "ready",
  };
}

export function failChallengePreview(
  state: ChallengePreviewState,
  requestedCode: string,
  error: string,
): ChallengePreviewState {
  if (state.code !== requestedCode) return state;
  return { ...state, error, status: "error" };
}

export const CREATE_PRIVATE_CHALLENGE_ROUTE = "/challenge/create" as const;

export function privateChallengePreviewRoute(
  challenge: Pick<CreatedPrivateChallenge, "code">,
) {
  return {
    pathname: "/challenge/[code]" as const,
    params: { code: challenge.code },
  };
}

export type PrivateChallengeValidation =
  | { ok: true; value: PrivateChallengeDraft }
  | { ok: false; errors: PrivateChallengeErrors };

export type PrivateChallengeSubmission =
  | { ok: true; challenge: CreatedPrivateChallenge }
  | { ok: false; errors: PrivateChallengeErrors };

function comparableTitle(value: string): string {
  return value.trim().replaceAll("_", " ").replace(/\s+/g, " ").toLowerCase();
}

export function validatePrivateChallengeDraft(
  draft: PrivateChallengeDraft,
): PrivateChallengeValidation {
  const value = {
      startArticle: draft.startArticle.trim(),
      endArticle: draft.endArticle.trim(),
      searchTier: draft.searchTier,
    };
  const errors: PrivateChallengeErrors = {};

  if (!value.startArticle) {
    errors.startArticle = "Enter a starting article.";
  }
  if (!value.endArticle) {
    errors.endArticle = "Enter a target article.";
  } else if (
    value.startArticle &&
    comparableTitle(value.startArticle) === comparableTitle(value.endArticle)
  ) {
    errors.endArticle = "Choose a different target article.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, value };
}

export function createPrivateChallengeController(dependencies: {
  create: (draft: PrivateChallengeDraft) => Promise<CreatedPrivateChallenge>;
  navigateToPreview: (challenge: CreatedPrivateChallenge) => void;
  stageForPreview?: (challenge: CreatedPrivateChallenge) => void;
}) {
  return {
    async submit(
      draft: PrivateChallengeDraft,
    ): Promise<PrivateChallengeSubmission> {
      const validation = validatePrivateChallengeDraft(draft);
      if (!validation.ok) return validation;

      const challenge = await dependencies.create(validation.value);
      (dependencies.stageForPreview ?? stageCreatedPrivateChallengeHandoff)(
        challenge,
      );
      dependencies.navigateToPreview(challenge);
      return { ok: true, challenge };
    },
  };
}

export function buildPrivateChallengeShareText(
  challenge: CreatedPrivateChallenge,
): string {
  return shareContentAsMessage(buildPrivateChallengeShareContent(challenge));
}

export function buildPrivateChallengeShareContent(
  challenge: CreatedPrivateChallenge,
): ShareContent {
  try {
    return formatShareIntent({
      intent: "challenge",
      startTitle: challenge.startTitle,
      endTitle: challenge.endTitle,
      challengeUrl: challenge.url,
    });
  } catch {
    throw new Error("Challenge link is not safe to share.");
  }
}

export function createPrivateChallengeShareController(dependencies: {
  platform: string;
  share: (payload: NativeSharePayload) => Promise<void>;
}) {
  return {
    async share(challenge: CreatedPrivateChallenge): Promise<void> {
      await dependencies.share(
        buildNativeSharePayload(
          buildPrivateChallengeShareContent(challenge),
          dependencies.platform,
        ),
      );
    },
  };
}

export function createPrivateChallengeCopyController(dependencies: {
  copy: (value: string) => Promise<void>;
}) {
  return {
    async copy(challenge: CreatedPrivateChallenge): Promise<void> {
      if (!isSafeChallengeUrl(challenge.url)) {
        throw new Error("Challenge link is not safe to copy.");
      }
      await dependencies.copy(challenge.url);
    },
  };
}
