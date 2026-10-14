import type { ChallengeType } from "./types";

export function shouldCompleteWonSession(_session: {
  completed: boolean;
  won: boolean;
}): boolean {
  return _session.won && !_session.completed;
}

export function allowsArticleBack(options: {
  challengeType: ChallengeType;
  isOfficial: boolean;
}): boolean {
  return options.challengeType !== "daily" || !options.isOfficial;
}

interface GameMoveErrorLike {
  message?: string;
  reason?: string;
  status?: number;
}

function isGameMoveErrorLike(value: unknown): value is GameMoveErrorLike {
  return typeof value === "object" && value !== null;
}

export function noticeForNavigateFailure(error: unknown): string {
  if (!isGameMoveErrorLike(error)) return "Move failed.";

  if (error.status === 400) {
    return error.reason ?? "That link is not on this page.";
  }

  if (error.status === 409) {
    if (error.message === "Move already recorded") {
      return "That link already went through.";
    }
    if (error.message === "Game already completed") {
      return "That race already finished.";
    }
    return "That move is already resolving.";
  }

  if (error.status === 503) {
    return error.reason ?? "Couldn't verify that move. Try that link again.";
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return "Move failed.";
}

export function noticeForBlockedArticleTap(): string {
  return "Finishing your last move...";
}

export function createResultCompletionCoordinator(dependencies: {
  complete: (sessionId: string) => Promise<void>;
  openResult: (sessionId: string) => void;
}) {
  const completions = new Map<string, Promise<void>>();

  return {
    completeResult(sessionId: string): Promise<void> {
      const existing = completions.get(sessionId);
      if (existing) return existing;

      const completion = dependencies
        .complete(sessionId)
        .then(() => dependencies.openResult(sessionId))
        .catch((error: unknown) => {
          completions.delete(sessionId);
          throw error;
        });
      completions.set(sessionId, completion);
      return completion;
    },
  };
}
