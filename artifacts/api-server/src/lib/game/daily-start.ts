export const DAILY_CHALLENGE_DATE_CONFLICT = "Daily challenge is not current";
export const REPLAY_INSERT_MAX_ATTEMPTS = 5;

type DatabaseError = {
  code?: string;
  message: string;
};

type DatabaseResult<T, E extends DatabaseError> = {
  data: T | null;
  error: E | null;
};

type LatestAttempt = {
  attempt_number: number | null;
};

type ReplayInsertOptions<T, E extends DatabaseError> = {
  loadLatestAttemptNumber: () => Promise<DatabaseResult<LatestAttempt, E>>;
  insertAttempt: (attemptNumber: number) => Promise<DatabaseResult<T, E>>;
  maxAttempts?: number;
};

export function assertDailyChallengeDate(
  challengeDate: string,
  localDate: string,
): void {
  if (challengeDate !== localDate) {
    throw new Error(DAILY_CHALLENGE_DATE_CONFLICT);
  }
}

export async function insertReplayWithRetry<T, E extends DatabaseError>({
  loadLatestAttemptNumber,
  insertAttempt,
  maxAttempts = REPLAY_INSERT_MAX_ATTEMPTS,
}: ReplayInsertOptions<T, E>): Promise<DatabaseResult<T, E>> {
  let lastConflict: E | null = null;

  for (let insertCount = 0; insertCount < Math.max(1, maxAttempts); insertCount += 1) {
    const latestAttempt = await loadLatestAttemptNumber();
    if (latestAttempt.error) {
      return { data: null, error: latestAttempt.error };
    }

    const attemptNumber = Number(latestAttempt.data?.attempt_number ?? 1) + 1;
    const inserted = await insertAttempt(attemptNumber);
    if (inserted.error?.code !== "23505") {
      return inserted;
    }

    lastConflict = inserted.error;
  }

  return { data: null, error: lastConflict };
}
