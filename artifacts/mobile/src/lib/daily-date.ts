import { deviceTimeZone } from "./daily-context";
import type { GameSession } from "./types";

function datePart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day",
) {
  return parts.find((part) => part.type === type)?.value ?? null;
}

export function currentLocalDate(
  timeZone = deviceTimeZone(),
  now = new Date(),
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = datePart(parts, "year");
    const month = datePart(parts, "month");
    const day = datePart(parts, "day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to a UTC-safe representation.
  }

  return now.toISOString().slice(0, 10);
}

export function isCurrentDailyDate(
  date: string | null | undefined,
  options?: {
    now?: Date;
    timeZone?: string;
  },
): boolean {
  if (!date) return false;
  return date === currentLocalDate(options?.timeZone, options?.now);
}

export function isCurrentDailySessionDate(
  session: Pick<GameSession, "challengeType" | "localDate"> | null | undefined,
  options?: {
    now?: Date;
    timeZone?: string;
  },
): boolean {
  if (!session || session.challengeType !== "daily") return false;
  return isCurrentDailyDate(session.localDate, options);
}
