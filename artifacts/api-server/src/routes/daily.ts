import { Router } from "express";
import { createServiceClient, getRequestUser } from "../lib/supabase";
import { dailyPairForDate } from "../lib/game/article-pool";
import {
  fetchArticleDescription,
  fetchArticleRedirectAliases,
  resolveArticle,
} from "../lib/wikipedia";
import { toUrlTitle } from "../lib/game/titles";
import { sessionToJson } from "../lib/game/session-json";
import { localDateForTimeZone } from "../lib/game/daily-date";

const router = Router();

function challengeToJson(c: any) {
  return {
    id: c.id,
    date: c.challenge_date,
    startArticle: c.start_article,
    endArticle: c.end_article,
    startTitle: c.start_article_title,
    endTitle: c.end_article_title,
    startDescription: c.start_description ?? null,
    endDescription: c.end_description ?? null,
    difficulty: c.difficulty,
    difficultySource: c.difficulty_source,
    generatorVersion: c.generator_version,
    generatorSeed: c.generator_seed,
    startTopic: c.start_topic,
    endTopic: c.end_topic,
    startRecognition: c.start_recognition,
    endRecognition: c.end_recognition,
  };
}

/**
 * GET /daily — today's challenge (created on first request).
 *
 * The article pair is a deterministic function of the date, so concurrent
 * first requests all compute the same pair and the unique(challenge_date)
 * constraint + retry-select make creation race-safe.
 *
 * When called with a valid Authorization header, also returns the caller's
 * session for today (so the client knows "resume" vs "play" vs "done").
 */
router.get("/daily", async (req, res) => {
  try {
    const timeZone = req.query.timeZone === undefined ? "UTC" : req.query.timeZone;
    if (typeof timeZone !== "string") {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    let today: string;
    try {
      today = localDateForTimeZone(new Date(), timeZone);
    } catch {
      return res.status(400).json({ error: "Invalid time zone" });
    }

    const admin = createServiceClient();

    let { data: challenge, error: challengeError } = await admin
      .from("daily_challenges")
      .select("*")
      .eq("challenge_date", today)
      .maybeSingle();
    if (challengeError) {
      req.log.error({ err: challengeError }, "Error loading daily challenge");
      return res.status(500).json({ error: "Failed to get daily challenge" });
    }

    if (!challenge) {
      const pair = dailyPairForDate(today);
      // Resolve through Wikipedia once so stored titles are canonical.
      const [startTitle, endTitle] = await Promise.all([
        resolveArticle(pair.start).then((t) => t ?? pair.start),
        resolveArticle(pair.end).then((t) => t ?? pair.end),
      ]);
      const [endArticleAliases, startDescription, endDescription] = await Promise.all([
        fetchArticleRedirectAliases(endTitle),
        fetchArticleDescription(startTitle),
        fetchArticleDescription(endTitle),
      ]);

      const { data: inserted, error } = await admin
        .from("daily_challenges")
        .insert({
          challenge_date: today,
          start_article: toUrlTitle(startTitle),
          end_article: toUrlTitle(endTitle),
          start_article_title: startTitle,
          end_article_title: endTitle,
          end_article_aliases: endArticleAliases,
          start_description: startDescription,
          end_description: endDescription,
          difficulty: pair.difficulty,
          difficulty_source: pair.difficultySource,
          generator_version: pair.generatorVersion,
          generator_seed: pair.seed,
          start_topic: pair.startTopic,
          end_topic: pair.endTopic,
          start_recognition: pair.startRecognition,
          end_recognition: pair.endRecognition,
        })
        .select()
        .single();

      if (inserted) {
        challenge = inserted;
      } else if (error?.code === "23505") {
        // Another request won the race — read theirs.
        const { data: existing, error: existingError } = await admin
          .from("daily_challenges")
          .select("*")
          .eq("challenge_date", today)
          .single();
        if (existingError) {
          req.log.error({ err: existingError }, "Error reloading daily challenge");
          return res.status(500).json({ error: "Failed to get daily challenge" });
        }
        challenge = existing;
      } else {
        req.log.error({ err: error }, "Error creating daily challenge");
        return res.status(500).json({ error: "Failed to create challenge" });
      }
    }

    if (!challenge) {
      return res.status(500).json({ error: "Failed to get daily challenge" });
    }

    const user = await getRequestUser(req);
    let session = null;
    if (user) {
      const { data: existing, error: sessionError } = await admin
        .from("game_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge.id)
        .eq("is_official", true)
        .maybeSingle();
      if (sessionError) {
        req.log.error({ err: sessionError }, "Error loading Daily session");
        return res.status(500).json({ error: "Failed to get daily challenge" });
      }
      if (existing) {
        session = sessionToJson({
          ...existing,
          start_description: challenge.start_description ?? null,
          end_description: challenge.end_description ?? null,
        });
      }
    }

    return res.json({
      challenge: challengeToJson(challenge),
      session,
      localDate: today,
      replayAvailable: Boolean(session?.completed),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting daily challenge");
    return res.status(500).json({ error: "Failed to get daily challenge" });
  }
});

export default router;
