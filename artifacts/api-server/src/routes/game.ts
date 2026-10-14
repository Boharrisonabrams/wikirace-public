import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, getRequestUser } from "../lib/supabase";
import { fetchArticleLinks, WikipediaUpstreamError } from "../lib/wikipedia";
import { validateMove } from "../lib/game/validate-move";
import { titleMatchesTarget, toDisplayTitle } from "../lib/game/titles";
import { randomPair } from "../lib/game/article-pool";
import { sessionToJson } from "../lib/game/session-json";
import { allowsArticleBack, parseStartMode } from "../lib/game/session-mode";
import { localDateForTimeZone } from "../lib/game/daily-date";
import {
  assertDailyChallengeDate,
  DAILY_CHALLENGE_DATE_CONFLICT,
  insertReplayWithRetry,
} from "../lib/game/daily-start";
import type { TimingAction } from "../lib/game/timing";
import { loadCompletionResultContext } from "../lib/game/completion-result";

const router = Router();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isWikipediaVerificationFailure(
  error: unknown,
): error is WikipediaUpstreamError {
  return (
    error instanceof WikipediaUpstreamError ||
    (error instanceof Error && error.name === "WikipediaUpstreamError")
  );
}

function isTimingAction(value: unknown): value is TimingAction {
  return value === "resume" || value === "pause" || value === "heartbeat";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function loadSharedChallenge(admin: SupabaseClient, reference: string) {
  const column = isUuid(reference) ? "id" : "short_code";
  const { data } = await admin
    .from("friend_challenges")
    .select("*")
    .eq(column, reference)
    .maybeSingle();
  return data;
}

async function loadSessionChallengeMetadata(
  admin: SupabaseClient,
  session: {
    challenge_id?: string | null;
    friend_challenge_id?: string | null;
  },
) {
  if (session.friend_challenge_id) {
    const { data } = await admin
      .from("friend_challenges")
      .select("*")
      .eq("id", session.friend_challenge_id)
      .maybeSingle();
    return {
      endArticleAliases: data?.end_article_aliases ?? null,
      startDescription: data?.start_description ?? null,
      endDescription: data?.end_description ?? null,
      searchTier: data?.search_tier ?? null,
    };
  }

  if (session.challenge_id) {
    const { data } = await admin
      .from("daily_challenges")
      .select("end_article_aliases, start_description, end_description")
      .eq("id", session.challenge_id)
      .maybeSingle();
    return {
      endArticleAliases: data?.end_article_aliases ?? null,
      startDescription: data?.start_description ?? null,
      endDescription: data?.end_description ?? null,
    };
  }

  return {
    endArticleAliases: null,
    startDescription: null,
    endDescription: null,
    searchTier: null,
  };
}

async function sessionJsonWithMetadata(
  admin: SupabaseClient,
  session: any,
  metadata?: {
    endArticleAliases?: string[] | null;
    startDescription?: string | null;
    endDescription?: string | null;
    searchTier?: string | null;
  },
) {
  const resolvedMetadata =
    metadata ??
    (await loadSessionChallengeMetadata(admin, {
      challenge_id: session.challenge_id,
      friend_challenge_id: session.friend_challenge_id,
    }));

  return sessionToJson({
    ...session,
    search_tier: resolvedMetadata.searchTier,
    start_description: resolvedMetadata.startDescription,
    end_description: resolvedMetadata.endDescription,
    end_article_aliases: resolvedMetadata.endArticleAliases,
  });
}

/**
 * POST /game/start
 * body: { challengeType: 'daily' | 'practice' | 'friend', challengeId?,
 *         friendChallengeId?, timeZone?, replay? }
 *
 * The server resolves the start/end articles itself (from the daily
 * challenge, friend challenge, or the practice pool) — the client never
 * chooses them. Daily has one database-enforced official attempt plus
 * unranked replays after that attempt completes. Friend challenges retain one
 * scored attempt: an in-progress session is resumed, a completed one returned.
 */
router.post("/game/start", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { challengeType, challengeId, friendChallengeId, timeZone, replay } =
      req.body ?? {};
    if (!["daily", "practice", "friend"].includes(challengeType)) {
      return res.status(400).json({ error: "Invalid challengeType" });
    }
    if (replay !== undefined && typeof replay !== "boolean") {
      return res.status(400).json({ error: "Invalid replay" });
    }

    let isOfficial: boolean;
    try {
      ({ isOfficial } = parseStartMode({ challengeType, replay }));
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid replay",
      });
    }

    const admin = createServiceClient();

    let startArticle: string;
    let endArticle: string;
    let dailyChallengeId: string | null = null;
    let friendChallengeRef: string | null = null;
    let localDate: string | null = null;
    let timeZoneAtStart: string | null = null;
    let attemptNumber = 1;
    let challengeEndArticleAliases: string[] | null = null;
    let challengeStartDescription: string | null = null;
    let challengeEndDescription: string | null = null;

    if (challengeType === "daily") {
      if (!challengeId)
        return res.status(400).json({ error: "challengeId is required" });

      const dailyTimeZone = timeZone === undefined ? "UTC" : timeZone;
      if (typeof dailyTimeZone !== "string") {
        return res.status(400).json({ error: "Invalid time zone" });
      }
      try {
        localDate = localDateForTimeZone(new Date(), dailyTimeZone);
        timeZoneAtStart = dailyTimeZone;
      } catch {
        return res.status(400).json({ error: "Invalid time zone" });
      }

      const { data: challenge } = await admin
        .from("daily_challenges")
        .select(
          "id, challenge_date, start_article_title, end_article_title, end_article_aliases, start_description, end_description",
        )
        .eq("id", challengeId)
        .single();
      if (!challenge)
        return res.status(404).json({ error: "Challenge not found" });
      challengeEndArticleAliases = challenge.end_article_aliases ?? null;
      challengeStartDescription = challenge.start_description ?? null;
      challengeEndDescription = challenge.end_description ?? null;
      try {
        assertDailyChallengeDate(challenge.challenge_date, localDate);
      } catch {
        return res.status(409).json({ error: DAILY_CHALLENGE_DATE_CONFLICT });
      }

      if (friendChallengeId) {
        const sharedChallenge = await loadSharedChallenge(
          admin,
          friendChallengeId,
        );
        if (
          !sharedChallenge ||
          sharedChallenge.challenge_type !== "daily" ||
          sharedChallenge.daily_challenge_id !== challenge.id
        ) {
          return res.status(400).json({
            error: "Shared challenge does not match this Daily",
          });
        }
        friendChallengeRef = sharedChallenge.id;
      }

      const { data: official, error: officialError } = await admin
        .from("game_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId)
        .eq("is_official", true)
        .maybeSingle();
      if (officialError) {
        req.log.error(
          { err: officialError },
          "Error loading official Daily session",
        );
        return res.status(500).json({ error: "Failed to create game session" });
      }

      if (isOfficial && official) {
        let attributedOfficial = official;
        if (
          friendChallengeRef &&
          !official.completed &&
          !official.friend_challenge_id
        ) {
          const { data: updatedOfficial, error: attributionError } = await admin
            .from("game_sessions")
            .update({ friend_challenge_id: friendChallengeRef })
            .eq("id", official.id)
            .is("friend_challenge_id", null)
            .select()
            .maybeSingle();
          if (attributionError) {
            req.log.error(
              { err: attributionError },
              "Error attributing shared Daily session",
            );
            return res
              .status(500)
              .json({ error: "Failed to create game session" });
          }
          attributedOfficial = updatedOfficial ?? official;
        }
        return res.json({
          session: await sessionJsonWithMetadata(admin, attributedOfficial, {
            endArticleAliases: challengeEndArticleAliases,
            startDescription: challengeStartDescription,
            endDescription: challengeEndDescription,
          }),
          resumed: !attributedOfficial.completed,
          alreadyCompleted: attributedOfficial.completed,
        });
      }

      if (!isOfficial) {
        if (!official?.completed) {
          return res.status(409).json({
            error: "Complete the official Daily before replaying",
          });
        }

        startArticle = official.start_article;
        endArticle = official.end_article;
      } else {
        startArticle = challenge.start_article_title;
        endArticle = challenge.end_article_title;
      }
      dailyChallengeId = challenge.id;
    } else if (challengeType === "friend") {
      if (!friendChallengeId) {
        return res.status(400).json({ error: "friendChallengeId is required" });
      }
      const challenge = await loadSharedChallenge(admin, friendChallengeId);
      if (!challenge)
        return res.status(404).json({ error: "Challenge not found" });
      challengeEndArticleAliases = challenge.end_article_aliases ?? null;
      challengeStartDescription = challenge.start_description ?? null;
      challengeEndDescription = challenge.end_description ?? null;

      const { data: existing } = await admin
        .from("game_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("friend_challenge_id", challenge.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return res.json({
          session: await sessionJsonWithMetadata(admin, existing, {
            endArticleAliases: challengeEndArticleAliases,
            startDescription: challengeStartDescription,
            endDescription: challengeEndDescription,
          }),
          resumed: !existing.completed,
          alreadyCompleted: existing.completed,
        });
      }

      startArticle = challenge.start_article_title;
      endArticle = challenge.end_article_title;
      friendChallengeRef = challenge.id;
    } else {
      if (friendChallengeId) {
        const challenge = await loadSharedChallenge(admin, friendChallengeId);
        if (!challenge)
          return res.status(404).json({ error: "Challenge not found" });
        challengeEndArticleAliases = challenge.end_article_aliases ?? null;
        challengeStartDescription = challenge.start_description ?? null;
        challengeEndDescription = challenge.end_description ?? null;

        const { data: existing } = await admin
          .from("game_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("friend_challenge_id", challenge.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          return res.json({
            session: await sessionJsonWithMetadata(admin, existing, {
              endArticleAliases: challengeEndArticleAliases,
              startDescription: challengeStartDescription,
              endDescription: challengeEndDescription,
            }),
            resumed: !existing.completed,
            alreadyCompleted: existing.completed,
          });
        }

        startArticle = challenge.start_article_title;
        endArticle = challenge.end_article_title;
        friendChallengeRef = challenge.id;
      } else {
        const pair = randomPair();
        startArticle = pair.start;
        endArticle = pair.end;
      }
    }

    const insert = {
      user_id: user.id,
      challenge_type: challengeType,
      challenge_id: dailyChallengeId,
      friend_challenge_id: friendChallengeRef,
      start_article: startArticle,
      end_article: endArticle,
      path: [startArticle],
      clicks: 0,
      ...(challengeType === "daily"
        ? {
            is_official: isOfficial,
            attempt_number: attemptNumber,
            local_date: localDate,
            timezone_at_start: timeZoneAtStart,
          }
        : {}),
    };

    if (challengeType === "daily" && !isOfficial) {
      const { data: session, error } = await insertReplayWithRetry({
        loadLatestAttemptNumber: async () =>
          admin
            .from("game_sessions")
            .select("attempt_number")
            .eq("user_id", user.id)
            .eq("challenge_id", dailyChallengeId)
            .order("attempt_number", { ascending: false })
            .limit(1)
            .maybeSingle(),
        insertAttempt: async (nextAttemptNumber) =>
          admin
            .from("game_sessions")
            .insert({ ...insert, attempt_number: nextAttemptNumber })
            .select()
            .single(),
      });

      if (error || !session) {
        req.log.error({ err: error }, "Error creating Daily replay session");
        return res.status(500).json({ error: "Failed to create game session" });
      }

      return res.json({
        session: await sessionJsonWithMetadata(admin, session, {
          endArticleAliases: challengeEndArticleAliases,
          startDescription: challengeStartDescription,
          endDescription: challengeEndDescription,
        }),
      });
    }

    const { data: session, error } = await admin
      .from("game_sessions")
      .insert(insert)
      .select()
      .single();

    if (error?.code === "23505" && friendChallengeRef) {
      const { data: existing, error: rereadError } = await admin
        .from("game_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("friend_challenge_id", friendChallengeRef)
        .maybeSingle();
      if (existing) {
        return res.json({
          session: await sessionJsonWithMetadata(admin, existing, {
            endArticleAliases: challengeEndArticleAliases,
            startDescription: challengeStartDescription,
            endDescription: challengeEndDescription,
          }),
          resumed: !existing.completed,
          alreadyCompleted: existing.completed,
        });
      }
      req.log.error(
        { err: rereadError ?? error },
        "Error reloading shared challenge session",
      );
    }

    if (error?.code === "23505" && challengeType === "daily" && isOfficial) {
      const { data: existing, error: rereadError } = await admin
        .from("game_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_id", dailyChallengeId)
        .eq("is_official", true)
        .maybeSingle();
      if (existing) {
        return res.json({
          session: await sessionJsonWithMetadata(admin, existing, {
            endArticleAliases: challengeEndArticleAliases,
            startDescription: challengeStartDescription,
            endDescription: challengeEndDescription,
          }),
          resumed: !existing.completed,
          alreadyCompleted: existing.completed,
        });
      }
      req.log.error(
        { err: rereadError ?? error },
        "Error reloading Daily session",
      );
    }

    if (error || !session) {
      req.log.error({ err: error }, "Error creating game session");
      return res.status(500).json({ error: "Failed to create game session" });
    }

    return res.json({
      session: await sessionJsonWithMetadata(admin, session, {
        endArticleAliases: challengeEndArticleAliases,
        startDescription: challengeStartDescription,
        endDescription: challengeEndDescription,
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Error starting game");
    return res.status(500).json({ error: "Failed to start game" });
  }
});

/**
 * POST /game/timing
 * body: { sessionId, action: 'resume' | 'pause' | 'heartbeat', eventId }
 *
 * The database RPC records the event and mutates the owned session in one
 * transaction. Replaying an event ID returns the stored state without applying
 * the transition twice.
 */
router.post("/game/timing", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId, action, eventId } = req.body ?? {};
    if (!sessionId || !action || !eventId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isTimingAction(action)) {
      return res.status(400).json({ error: "Invalid timing action" });
    }
    if (!isUuid(eventId)) {
      return res.status(400).json({ error: "Invalid eventId" });
    }

    const admin = createServiceClient();
    const { data: session } = await admin
      .from("game_sessions")
      .select("user_id, completed")
      .eq("id", sessionId)
      .single();

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (session.completed) {
      return res.status(409).json({ error: "Game already completed" });
    }

    const { data, error } = await admin.rpc("transition_game_timing", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_action: action,
      p_event_id: eventId,
    });
    const timing = data?.[0];
    if (error?.code === "P0002") {
      return res.status(409).json({ error: "Game already completed" });
    }
    if (error || !timing) {
      req.log.error({ err: error }, "Error updating game timing");
      return res.status(500).json({ error: "Failed to update game timing" });
    }

    return res.json({
      activeTimeMs: Number(timing.active_time_ms ?? 0),
      timingActive: Boolean(timing.active_started_at),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating game timing");
    return res.status(500).json({ error: "Failed to update game timing" });
  }
});

/**
 * POST /game/navigate
 * body: { sessionId, destinationTitle } | { sessionId, back: true }
 *
 * The heart of the server-authoritative design: the server re-fetches the
 * CURRENT article's outbound links from Wikipedia and only accepts the move
 * if the destination is genuinely linked. The client's word is never taken.
 * Going back to the previous article is always legal and costs one click.
 */
router.post("/game/navigate", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId, destinationTitle, back } = req.body ?? {};
    if (!sessionId || (!destinationTitle && !back)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const admin = createServiceClient();
    const { data: session } = await admin
      .from("game_sessions")
      .select(
        "id, user_id, challenge_type, is_official, challenge_id, friend_challenge_id, end_article, path, clicks, completed",
      )
      .eq("id", sessionId)
      .single();

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== user.id)
      return res.status(403).json({ error: "Forbidden" });
    if (session.completed)
      return res.status(409).json({ error: "Game already completed" });

    const { error: timingError } = await admin.rpc("transition_game_timing", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_action: "pause",
      p_event_id: randomUUID(),
    });
    if (timingError) {
      if (timingError.code === "P0002") {
        return res.status(409).json({ error: "Game already completed" });
      }
      req.log.error({ err: timingError }, "Error pausing game timing");
      return res.status(500).json({ error: "Failed to pause game timing" });
    }

    if (
      back &&
      !allowsArticleBack({
        challengeType: session.challenge_type,
        isOfficial: session.is_official ?? true,
      })
    ) {
      return res.status(400).json({
        error: "Invalid move",
        reason: "Back is unavailable in an official Daily race",
      });
    }

    const path: string[] = session.path ?? [];
    const currentArticle = path[path.length - 1];
    const moveNumber = session.clicks + 1;

    let newPath: string[];
    let destination: string;

    if (back) {
      if (path.length <= 1) {
        return res
          .status(400)
          .json({ error: "Invalid move", reason: "already at the start" });
      }
      newPath = path.slice(0, -1);
      destination = newPath[newPath.length - 1];
    } else {
      destination = toDisplayTitle(String(destinationTitle));
      let links: string[];
      try {
        links = await fetchArticleLinks(currentArticle);
      } catch (err) {
        if (isWikipediaVerificationFailure(err)) {
          req.log.warn(
            { err, currentArticle, destination },
            "Wikipedia move verification failed",
          );
          return res.status(503).json({
            error: "Couldn't verify that move",
            reason: "Wikipedia didn't answer — try that link again.",
          });
        }
        throw err;
      }
      const verdict = validateMove({
        fromArticle: currentArticle,
        toArticle: destination,
        fromArticleLinks: links,
      });
      if (!verdict.valid) {
        return res
          .status(400)
          .json({ error: "Invalid move", reason: verdict.reason });
      }
      newPath = [...path, destination];
    }

    const { endArticleAliases } = await loadSessionChallengeMetadata(admin, {
      challenge_id: session.challenge_id,
      friend_challenge_id: session.friend_challenge_id,
    });
    const won =
      !back &&
      titleMatchesTarget(destination, session.end_article, endArticleAliases);

    // The database locks the session, rejects a concurrent completion, and
    // records the audit row plus session update in one transaction.
    const { error: moveError } = await admin.rpc("record_game_move", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_move_number: moveNumber,
      p_from_article: currentArticle,
      p_to_article: destination,
      p_new_path: newPath,
      p_won: won,
    });
    if (moveError) {
      if (moveError.code === "P0002") {
        return res.status(409).json({ error: "Game already completed" });
      }
      if (moveError.code === "23505") {
        return res.status(409).json({ error: "Move already recorded" });
      }
      req.log.error({ err: moveError }, "Error recording move");
      return res.status(500).json({ error: "Failed to record move" });
    }

    return res.json({
      valid: true,
      won,
      clicks: moveNumber,
      currentArticle: destination,
      path: newPath.map(toDisplayTitle),
    });
  } catch (err) {
    req.log.error({ err }, "Error navigating");
    return res.status(500).json({ error: "Failed to navigate" });
  }
});

/**
 * POST /game/complete
 * body: { sessionId, gaveUp? }
 *
 * Idempotent. The server re-derives the win from the stored path and
 * finalizes the server-owned active timer — the client sends no result data.
 * Completion, Official Daily effects, and private completion events commit in
 * one database transaction; retries return the stored result.
 */
router.post("/game/complete", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId, gaveUp } = req.body ?? {};
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    const admin = createServiceClient();
    const { data: session } = await admin
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== user.id)
      return res.status(403).json({ error: "Forbidden" });

    const returnStoredCompletion = async (storedSession: typeof session) => {
      const { data: stats } = await admin
        .from("user_stats")
        .select("current_streak, longest_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      const context = await loadCompletionResultContext({
        admin,
        session: storedSession,
        user,
      });
      return res.json({
        won: storedSession.won,
        clicks: storedSession.clicks,
        timeSeconds: storedSession.time_seconds ?? 0,
        path: (storedSession.turn_path ?? storedSession.path ?? []).map(
          toDisplayTitle,
        ),
        endArticle: toDisplayTitle(storedSession.end_article),
        streak: stats
          ? {
              current: stats.current_streak,
              longest: stats.longest_streak,
              extended: false,
            }
          : null,
        ...context,
      });
    };

    const { data: completionRows, error: completionError } = await admin.rpc(
      "complete_game_session_v2",
      {
        p_session_id: sessionId,
        p_user_id: user.id,
        p_gave_up: Boolean(gaveUp),
      },
    );
    const completion = completionRows?.[0];
    const completedSession = completion?.session;
    if (completionError || !completedSession) {
      req.log.error({ err: completionError }, "Error completing game");
      return res.status(500).json({ error: "Failed to complete game" });
    }
    if (!completion.did_complete) {
      return returnStoredCompletion(completedSession);
    }

    const won = Boolean(completedSession.won);
    const activeTimeMs = Math.max(
      0,
      Number(completedSession.active_time_ms ?? 0),
    );
    const timeSeconds = Math.max(
      0,
      Number(completedSession.time_seconds ?? Math.round(activeTimeMs / 1000)),
    );
    const path: string[] =
      completedSession.turn_path ?? completedSession.path ?? [];
    const streakInfo = completion.streak ?? null;

    const context = await loadCompletionResultContext({
      admin,
      session: completedSession,
      user,
    });
    return res.json({
      won,
      clicks: completedSession.clicks,
      timeSeconds,
      path: path.map(toDisplayTitle),
      endArticle: toDisplayTitle(completedSession.end_article),
      streak: streakInfo,
      ...context,
    });
  } catch (err) {
    req.log.error({ err }, "Error completing game");
    return res.status(500).json({ error: "Failed to complete game" });
  }
});

/** GET /game/session/:id — reload own session (refresh-safe resume). */
router.get("/game/session/:id", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const admin = createServiceClient();
    const { data: session } = await admin
      .from("game_sessions")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== user.id)
      return res.status(403).json({ error: "Forbidden" });

    return res.json({ session: await sessionJsonWithMetadata(admin, session) });
  } catch (err) {
    req.log.error({ err }, "Error loading session");
    return res.status(500).json({ error: "Failed to load session" });
  }
});

export default router;
