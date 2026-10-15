/**
 * Wikipedia title handling. Wikipedia freely mixes underscore form
 * ("New_York_City", used in URLs) and space form ("New York City", the
 * canonical display title returned by the API). All comparisons in the game
 * go through normalizeTitle so both forms — and case differences — match.
 */

export function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ").trim().toLowerCase();
}

export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

export function titleMatchesTarget(
  candidate: string,
  target: string,
  aliases?: readonly string[] | null
): boolean {
  if (titlesMatch(candidate, target)) return true;
  if (!aliases?.length) return false;

  const normalizedCandidate = normalizeTitle(candidate);
  return aliases.some((alias) => normalizeTitle(alias) === normalizedCandidate);
}

/** Display form: underscores become spaces. */
export function toDisplayTitle(title: string): string {
  return title.replace(/_/g, " ").trim();
}

/** URL form: spaces become underscores. */
export function toUrlTitle(title: string): string {
  return title.trim().replace(/ /g, "_");
}
