import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachFinisherPaths } from "../lib/game/path-reveal";
import { getPublicAppUrl } from "../lib/public-app-url";
import { createServiceClient, getRequestUser } from "../lib/supabase";
import { parseRequestedSearchTier, type SearchTier } from "../lib/game/session-mode";
import {
  fetchArticleDescription,
  fetchArticleRedirectAliases,
  resolveArticle,
} from "../lib/wikipedia";
import { titlesMatch, toUrlTitle } from "../lib/game/titles";

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_APP_URL = getPublicAppUrl();

function isMissingSearchTierColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return [record.message, record.details, record.hint].some(
    (value) => typeof value === "string" && value.includes("search_tier")
  );
}

async function insertFriendChallenge(
  admin: SupabaseClient,
  values: Record<string, unknown>,
  searchTier: SearchTier
) {
  const withTier = await admin
    .from("friend_challenges")
    .insert({ ...values, search_tier: searchTier })
    .select()
    .single();

  if (!isMissingSearchTierColumnError(withTier.error)) {
    return withTier;
  }

  return admin.from("friend_challenges").insert(values).select().single();
}

function challengeToJson(c: any, dailyDate: string | null = null) {
  return {
    id: c.id,
    code: c.short_code ?? c.id,
    kind: c.challenge_type ?? "friend",
    dailyChallengeId: c.daily_challenge_id ?? null,
    dailyDate,
    startTitle: c.start_article_title,
    endTitle: c.end_article_title,
    startDescription: c.start_description ?? null,
    endDescription: c.end_description ?? null,
    createdAt: c.created_at,
    url: `${PUBLIC_APP_URL}/challenge/${c.short_code ?? c.id}`,
  };
}

async function loadChallenge(admin: SupabaseClient, reference: string) {
  const column = UUID_PATTERN.test(reference) ? "id" : "short_code";
  const { data } = await admin
    .from("friend_challenges")
    .select("*")
    .eq(column, reference)
    .maybeSingle();
  return data;
}

async function loadDailyDate(admin: SupabaseClient, challenge: any) {
  if (challenge?.challenge_type !== "daily" || !challenge.daily_challenge_id) {
    return null;
  }
  const { data } = await admin
    .from("daily_challenges")
    .select("challenge_date")
    .eq("id", challenge.daily_challenge_id)
    .maybeSingle();
  return data?.challenge_date ?? null;
}

/**
 * POST /challenge — create a head-to-head friend challenge.
 * body: { fromSessionId } (rematch my own run)
 *     | { startArticle, endArticle } (custom pair, validated against Wikipedia)
 * Returns the challenge; the client turns it into a share link (/challenge/:id).
 */
router.post("/challenge", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { fromSessionId, startArticle, endArticle, searchTier } = req.body ?? {};
    const admin = createServiceClient();
    let requestedSearchTier: SearchTier;
    try {
      requestedSearchTier = parseRequestedSearchTier(searchTier);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid searchTier",
      });
    }

    let startTitle: string;
    let endTitle: string;
    let sourceType: "daily" | "practice" | "friend" = "friend";
    let dailyChallengeId: string | null = null;
    let sourceSession: any = null;

    if (fromSessionId) {
      const { data: session } = await admin
        .from("game_sessions")
        .select(
          "user_id, challenge_type, challenge_id, friend_challenge_id, start_article, end_article"
        )
        .eq("id", fromSessionId)
        .single();
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.user_id !== user.id) return res.status(403).json({ error: "Forbidden" });
      sourceSession = session;
      if (session.friend_challenge_id) {
        const existing = await loadChallenge(admin, session.friend_challenge_id);
        if (existing) {
          return res.json({
            challenge: challengeToJson(existing, await loadDailyDate(admin, existing)),
          });
        }
      }
      startTitle = session.start_article;
      endTitle = session.end_article;
      sourceType = session.challenge_type;
      dailyChallengeId = session.challenge_id;
    } else {
      if (!startArticle || !endArticle) {
        return res.status(400).json({ error: "startArticle and endArticle are required" });
      }
      if (titlesMatch(startArticle, endArticle)) {
        return res.status(400).json({ error: "Start and end must be different articles" });
      }
      const [resolvedStart, resolvedEnd] = await Promise.all([
        resolveArticle(startArticle),
        resolveArticle(endArticle),
      ]);
      if (!resolvedStart)
        return res.status(400).json({ error: `Article not found: ${startArticle}` });
      if (!resolvedEnd) return res.status(400).json({ error: `Article not found: ${endArticle}` });
      if (titlesMatch(resolvedStart, resolvedEnd)) {
        return res.status(400).json({ error: "Start and end must be different articles" });
      }
      startTitle = resolvedStart;
      endTitle = resolvedEnd;
    }
    const [endArticleAliases, startDescription, endDescription] = await Promise.all([
      fetchArticleRedirectAliases(endTitle),
      fetchArticleDescription(startTitle),
      fetchArticleDescription(endTitle),
    ]);

    const { data: challenge, error } = await insertFriendChallenge(
      admin,
      {
        creator_id: user.id,
        challenge_type: sourceType,
        daily_challenge_id: dailyChallengeId,
        start_article: toUrlTitle(startTitle),
        end_article: toUrlTitle(endTitle),
        start_article_title: startTitle,
        end_article_title: endTitle,
        end_article_aliases: endArticleAliases,
        start_description: startDescription,
        end_description: endDescription,
      },
      requestedSearchTier
    );

    if (error || !challenge) {
      req.log.error({ err: error }, "Error creating friend challenge");
      return res.status(500).json({ error: "Failed to create challenge" });
    }

    // Link the creator's source run to the challenge so it shows on the
    // results board as the score to beat (only if not already shared).
    if (fromSessionId && sourceSession) {
      await admin
        .from("game_sessions")
        .update({ friend_challenge_id: challenge.id })
        .eq("id", fromSessionId)
        .is("friend_challenge_id", null);
    }

    return res.json({
      challenge: challengeToJson(challenge, await loadDailyDate(admin, challenge)),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating challenge");
    return res.status(500).json({ error: "Failed to create challenge" });
  }
});

/**
 * GET /challenge/:id — public: the challenge, its creator, and the results
 * board (everyone who has completed it, winners ranked first).
 */
router.get("/challenge/:id", async (req, res) => {
  try {
    const admin = createServiceClient();
    const challenge = await loadChallenge(admin, req.params.id);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    await admin.from("challenge_link_events").insert({
      challenge_id: challenge.id,
      event_type: "open",
    });

    const { data: creator } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", challenge.creator_id)
      .maybeSingle();

    // Raw result rows include user IDs for server-side current-user matching,
    // so only the service client may execute this RPC. The API strips them.
    const { data: results, error } = await admin.rpc("get_challenge_results", {
      p_challenge_id: challenge.id,
    });
    if (error) {
      req.log.error({ err: error }, "Error fetching challenge results");
    }

    const user = await getRequestUser(req);
    let mySession = null;
    if (user) {
      const { data: existing } = await admin
        .from("game_sessions")
        .select("completed, won, gave_up, clicks, time_seconds")
        .eq("user_id", user.id)
        .eq("friend_challenge_id", challenge.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      mySession = existing ?? null;
    }

    const sanitizedResults = (results ?? []).map(
      ({ path: _path, ...result }: Record<string, any>) => result
    );
    const revealedResults = mySession?.completed
      ? await attachFinisherPaths(
          admin,
          { type: "friend", challengeId: challenge.id },
          sanitizedResults as Array<{
            clicks: number;
            completed_at: string | null;
            time_seconds: number;
            user_id: string;
          }>
        )
      : sanitizedResults;

    return res.json({
      challenge: challengeToJson(challenge, await loadDailyDate(admin, challenge)),
      creator: creator ?? { username: "unknown", display_name: null },
      results: revealedResults.map(({ user_id: resultUserId, ...result }: Record<string, any>) => ({
        ...result,
        is_current_user: user?.id === resultUserId,
      })),
      mySession,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting challenge");
    return res.status(500).json({ error: "Failed to get challenge" });
  }
});

/** Records explicit acceptance only. It never creates a game session. */
router.post("/challenge/:id/start", async (req, res) => {
  try {
    const admin = createServiceClient();
    const challenge = await loadChallenge(admin, req.params.id);
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    const user = await getRequestUser(req);
    const { error } = await admin.from("challenge_link_events").insert({
      challenge_id: challenge.id,
      event_type: "start",
      user_id: user?.id ?? null,
    });
    if (error) {
      req.log.error({ err: error }, "Error recording challenge start");
      return res.status(500).json({ error: "Failed to start challenge" });
    }
    return res.json({ recorded: true });
  } catch (err) {
    req.log.error({ err }, "Error recording challenge start");
    return res.status(500).json({ error: "Failed to start challenge" });
  }
});

export default router;
