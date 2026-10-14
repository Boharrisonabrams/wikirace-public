import type { ChallengeType } from "./types";

export interface SharedChallengePreview {
  code: string;
  kind: ChallengeType;
  dailyChallengeId?: string | null;
  dailyDate?: string | null;
  startTitle: string;
  endTitle: string;
  startDescription?: string | null;
  endDescription?: string | null;
  url?: string;
}

export type ChallengeGameParams =
  | {
      challengeId: string;
      dailyDate?: string;
      friendChallengeId: string;
      type: "daily";
    }
  | { friendChallengeId: string; type: "practice" | "friend" };

export function challengeGameParams(
  challenge: SharedChallengePreview,
): ChallengeGameParams {
  if (challenge.kind === "daily") {
    if (!challenge.dailyChallengeId) {
      throw new Error("Daily challenge link is missing its challenge ID");
    }
    return {
      challengeId: challenge.dailyChallengeId,
      ...(challenge.dailyDate ? { dailyDate: challenge.dailyDate } : {}),
      friendChallengeId: challenge.code,
      type: "daily" as const,
    };
  }
  return {
    friendChallengeId: challenge.code,
    type: challenge.kind,
  };
}

export function createChallengeEntryController(dependencies: {
  recordStart: (code: string) => Promise<void>;
  navigate: (params: ChallengeGameParams) => void;
}) {
  return {
    async start(challenge: SharedChallengePreview) {
      await dependencies.recordStart(challenge.code);
      dependencies.navigate(challengeGameParams(challenge));
    },
  };
}
