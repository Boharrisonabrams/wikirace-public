import { Router } from "express";
import { createServiceClient, getRequestUser } from "../lib/supabase";

const router = Router();

type OfficialDailySession = {
  active_time_ms: number | string | null;
  clicks: number;
  time_seconds: number | null;
  won: boolean;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  friend_code: string;
  avatar_url: string | null;
  claimed_at: string | null;
};

type UsernameValidationResult = { ok: true; username: string } | { ok: false; error: string };

function activeTimeMs(session: OfficialDailySession): number {
  const activeMs = Number(session.active_time_ms ?? 0);
  if (activeMs > 0) return activeMs;
  return Math.max(0, Number(session.time_seconds ?? 0) * 1_000);
}

function profileToJson(profile: ProfileRow, isGuest: boolean) {
  return {
    userId: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    friendCode: profile.friend_code,
    avatarUrl: profile.avatar_url,
    claimed: profile.claimed_at != null,
    isGuest,
  };
}

function validateUsername(input: unknown): UsernameValidationResult {
  const username = typeof input === "string" ? input.toLowerCase().trim() : "";
  if (username.length < 3) {
    return { ok: false, error: "Username needs at least 3 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return {
      ok: false,
      error: "Username can use letters, numbers, and underscores only.",
    };
  }
  if (username.length > 24) {
    return {
      ok: false,
      error: "Username must be 24 characters or fewer.",
    };
  }
  return { ok: true, username };
}

function statsToJson(s: any, officialSessions: OfficialDailySession[]) {
  const wins = officialSessions.filter((session) => session.won);
  const winClicks = wins.map((session) => Number(session.clicks));
  const winActiveTimes = wins.map(activeTimeMs);

  return {
    gamesPlayed: officialSessions.length,
    gamesWon: wins.length,
    totalClicks: officialSessions.reduce((sum, session) => sum + Number(session.clicks), 0),
    totalTimeSeconds: officialSessions.reduce(
      (sum, session) => sum + Number(session.time_seconds ?? 0),
      0
    ),
    currentStreak: s?.current_streak ?? 0,
    longestStreak: s?.longest_streak ?? 0,
    lastDailyCompleted: s?.last_daily_completed ?? null,
    averageClicks:
      wins.length > 0 ? winClicks.reduce((sum, clicks) => sum + clicks, 0) / wins.length : null,
    averageActiveTimeMs:
      wins.length > 0
        ? Math.round(winActiveTimes.reduce((sum, timeMs) => sum + timeMs, 0) / wins.length)
        : null,
    bestClicks: wins.length > 0 ? Math.min(...winClicks) : null,
    fastestTimeMs: wins.length > 0 ? Math.min(...winActiveTimes) : null,
  };
}

/** POST /profile/claim — mark the caller's permanent identity as claimed. */
router.post("/profile/claim", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.is_anonymous) {
      return res.status(409).json({ error: "Identity is still anonymous" });
    }

    const admin = createServiceClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      req.log.error({ err: error }, "Error updating profile claim");
      return res.status(500).json({ error: "Failed to claim profile" });
    }
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    return res.json({ claimed: true });
  } catch (err) {
    req.log.error({ err }, "Error claiming profile");
    return res.status(500).json({ error: "Failed to claim profile" });
  }
});

/** GET /profile/me — the caller's profile + stats. */
router.get("/profile/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const admin = createServiceClient();
    const [profileResult, statsResult, sessionsResult] = await Promise.all([
      admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      admin.from("user_stats").select("*").eq("user_id", user.id).maybeSingle(),
      admin
        .from("game_sessions")
        .select("won,clicks,time_seconds,active_time_ms")
        .eq("user_id", user.id)
        .eq("challenge_type", "daily")
        .eq("is_official", true)
        .eq("completed", true),
    ]);

    const { data: profile, error: profileError } = profileResult;
    const { data: stats } = statsResult;
    const { data: officialSessions, error: sessionsError } = sessionsResult;

    if (profileError) {
      req.log.error({ err: profileError }, "Error fetching profile row");
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (sessionsError) {
      req.log.error({ err: sessionsError }, "Error fetching official statistics");
      return res.status(500).json({ error: "Failed to fetch profile" });
    }

    return res.json({
      profile: profileToJson(profile, user.is_anonymous === true),
      stats: statsToJson(stats, officialSessions ?? []),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching profile");
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/** PATCH /profile/me — rename the caller's profile username. */
router.patch("/profile/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const validated = validateUsername(req.body?.username);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const admin = createServiceClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .update({ username: validated.username })
      .eq("id", user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "That username is taken" });
      }
      req.log.error({ err: error }, "Error updating profile username");
      return res.status(500).json({ error: "Failed to update profile" });
    }
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    return res.json({
      profile: profileToJson(profile, user.is_anonymous === true),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating profile username");
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

/** DELETE /profile/me — permanently delete the authenticated player and data. */
router.delete("/profile/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (req.body?.confirmation !== "DELETE") {
      return res.status(400).json({ error: "Account deletion confirmation is required" });
    }

    const admin = createServiceClient();
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) {
      req.log.error({ err: error }, "Error deleting account");
      return res.status(500).json({ error: "Failed to delete account" });
    }

    return res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting account");
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
