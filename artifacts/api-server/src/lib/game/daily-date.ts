const NUMERIC_OFFSET_TIME_ZONE = /^[+-]\d{2}(?::?\d{2})?$/;

export function localDateForTimeZone(now: Date, timeZone: string): string {
  try {
    // ECMA-402 also accepts signed offset identifiers such as +23:59. Daily
    // identity is intentionally bound to named IANA zones (plus UTC), so a
    // device cannot manufacture a calendar date with an arbitrary offset.
    if (timeZone !== "UTC" && NUMERIC_OFFSET_TIME_ZONE.test(timeZone)) {
      throw new Error();
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (!value.year || !value.month || !value.day) throw new Error();
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    throw new Error("Invalid time zone");
  }
}

export function isCurrentDailySessionDate({
  challengeDate,
  localDate,
  timeZone,
  now,
}: {
  challengeDate: string;
  localDate: string | null | undefined;
  timeZone: string | null | undefined;
  now: Date;
}): boolean {
  const boundDate = localDate ?? challengeDate;
  if (challengeDate !== boundDate) return false;

  let currentDate: string;
  try {
    currentDate = localDateForTimeZone(now, timeZone || "UTC");
  } catch {
    currentDate = localDateForTimeZone(now, "UTC");
  }
  return boundDate === currentDate;
}
