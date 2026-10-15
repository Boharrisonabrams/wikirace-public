import { Router } from "express";
import { attachFinisherPaths, callerCompletedDailyRace } from "../lib/game/path-reveal";
import { createServiceClient, createSupabaseClient, getRequestUser } from "../lib/supabase";
import { parseBoard } from "../lib/game/leaderboard";

const router = Router();

/**
 * GET /leaderboard/daily?challengeId=…&friendsOnly=true
 * friendsOnly requires an Authorization header — the RPC filters on
 * auth.uid()'s accepted friendships (self always included).
 */
router.get("/leaderboard/daily", async (req, res) => {
  try {
    const challengeId = req.query.challengeId as string;
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 100);
    const offset = parseInt((req.query.offset as string) || "0", 10) || 0;
    const friendsOnly = req.query.friendsOnly === "true";

    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required" });
    }

    let board;
    try {
      board = parseBoard(req.query.board);
    } catch {
      return res.status(400).json({ error: "Invalid board" });
    }

    const supabase = createSupabaseClient(req.headers.authorization);
    const { data, error } = await supabase.rpc("get_daily_leaderboard_v2", {
      p_challenge_id: challengeId,
      p_board: board,
      p_limit: limit,
      p_offset: offset,
      p_friends_only: friendsOnly,
    });

    if (error) {
      req.log.error({ err: error }, "Error fetching leaderboard");
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }

    const user = await getRequestUser(req);
    const admin = createServiceClient();
    const revealPaths =
      user && challengeId ? await callerCompletedDailyRace(admin, user.id, challengeId) : false;
    const leaderboard = revealPaths
      ? await attachFinisherPaths(
          admin,
          { type: "daily", challengeId },
          (data ?? []) as Array<{
            clicks: number;
            completed_at: string | null;
            time_seconds: number;
            user_id: string;
          }>
        )
      : (data ?? []);

    return res.json({ board, leaderboard });
  } catch (err) {
    req.log.error({ err }, "Error getting leaderboard");
    return res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
