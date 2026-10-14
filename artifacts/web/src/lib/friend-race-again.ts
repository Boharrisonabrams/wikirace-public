import type { SearchTier } from "@/lib/store/game-store";
import { api } from "@/lib/api";

export interface FriendRaceAgainDraft {
  startArticle: string;
  endArticle: string;
  searchTier: SearchTier;
}

export async function createFriendRaceAgainChallenge(
  draft: FriendRaceAgainDraft,
) {
  return api<{ challenge: { code: string } }>("/challenge", {
    method: "POST",
    body: draft,
  });
}

export function createFriendRaceAgainController(dependencies: {
  create: (
    draft: FriendRaceAgainDraft,
  ) => Promise<{ challenge: { code: string } }>;
  navigate: (code: string) => void;
}) {
  return {
    async submit(draft: FriendRaceAgainDraft) {
      const { challenge } = await dependencies.create(draft);
      dependencies.navigate(challenge.code);
      return challenge.code;
    },
  };
}
