export const USERNAME_MAX_LENGTH = 24;

export function normalizeUsername(value: string): string {
  return value.toLowerCase().trim();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < 3) {
    return "Username needs at least 3 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Username can use letters, numbers, and underscores only.";
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return "Username must be 24 characters or fewer.";
  }
  return null;
}
