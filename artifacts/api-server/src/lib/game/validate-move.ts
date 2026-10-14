import { normalizeTitle } from "./titles";

export interface ValidateMoveInput {
  fromArticle: string;
  toArticle: string;
  fromArticleLinks: string[];
}

export type ValidateMoveResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Determine whether a move from `fromArticle` to `toArticle` is permitted
 * given the source article's outbound link list (fetched server-side from
 * Wikipedia). Title comparison normalizes underscores -> spaces and
 * lower-cases both sides.
 *
 * Pure: no I/O, no globals.
 */
export function validateMove(input: ValidateMoveInput): ValidateMoveResult {
  const from = normalizeTitle(input.fromArticle);
  const to = normalizeTitle(input.toArticle);

  if (from === to) {
    return { valid: false, reason: "destination is the same as source" };
  }

  const linkSet = new Set(input.fromArticleLinks.map(normalizeTitle));
  if (!linkSet.has(to)) {
    return {
      valid: false,
      reason: "destination is not linked from the source article",
    };
  }

  return { valid: true };
}
