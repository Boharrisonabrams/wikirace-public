export function normalizeReturnPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

export function nextTargetFromSearch(search: string): string {
  return normalizeReturnPath(new URLSearchParams(search).get("next"));
}

export function buildAuthCallbackUrl(
  origin: string,
  next: unknown = "/",
): string {
  const url = new URL("/auth/callback", origin);
  const returnPath = normalizeReturnPath(next);

  if (returnPath !== "/") {
    url.searchParams.set("next", returnPath);
  }

  return url.toString();
}
