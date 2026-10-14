export function deviceTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.length > 0
      ? timeZone
      : "UTC";
  } catch {
    return "UTC";
  }
}
