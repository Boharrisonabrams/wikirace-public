import { Router } from "express";
import { createServiceClient, getRequestUser } from "../lib/supabase";

const router = Router();

interface FriendProfile {
  userId: string;
  username: string;
  displayName: string | null;
  friendCode: string;
}

function profileToJson(p: any): FriendProfile {
  return {
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    friendCode: p.friend_code,
  };
}

/** GET /friends — accepted friends plus pending requests in both directions. */
router.get("/friends", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const admin = createServiceClient();
    const { data: friendships, error } = await admin
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .neq("status", "rejected");
    if (error) {
      req.log.error({ err: error }, "Error fetching friendships");
      return res.status(500).json({ error: "Failed to fetch friends" });
    }

    const otherIds = [
      ...new Set((friendships ?? []).map((f) => (f.user_id === user.id ? f.friend_id : f.user_id))),
    ];
    const profilesById = new Map<string, any>();
    if (otherIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, username, display_name, friend_code")
        .in("id", otherIds);
      for (const p of profiles ?? []) profilesById.set(p.id, p);
    }

    const friends: FriendProfile[] = [];
    const pendingIncoming: Array<FriendProfile & { friendshipId: string }> = [];
    const pendingOutgoing: Array<FriendProfile & { friendshipId: string }> = [];

    for (const f of friendships ?? []) {
      const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
      const profile = profilesById.get(otherId);
      if (!profile) continue;
      if (f.status === "accepted") {
        friends.push(profileToJson(profile));
      } else if (f.status === "pending" && f.friend_id === user.id) {
        pendingIncoming.push({ ...profileToJson(profile), friendshipId: f.id });
      } else if (f.status === "pending") {
        pendingOutgoing.push({ ...profileToJson(profile), friendshipId: f.id });
      }
    }

    return res.json({ friends, pendingIncoming, pendingOutgoing });
  } catch (err) {
    req.log.error({ err }, "Error fetching friends");
    return res.status(500).json({ error: "Failed to fetch friends" });
  }
});

/**
 * POST /friends/request — add a friend by friend code.
 * If the other person already requested you, this auto-accepts.
 */
router.post("/friends/request", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const rawCode = String(req.body?.friendCode ?? "")
      .trim()
      .toUpperCase();
    if (!rawCode) return res.status(400).json({ error: "friendCode is required" });

    const admin = createServiceClient();
    const { data: other } = await admin
      .from("profiles")
      .select("id, username, display_name, friend_code")
      .eq("friend_code", rawCode)
      .maybeSingle();
    if (!other) return res.status(404).json({ error: "No player with that friend code" });
    if (other.id === user.id) {
      return res.status(400).json({ error: "That's your own friend code" });
    }

    const { data: existing } = await admin
      .from("friendships")
      .select("*")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${other.id}),and(user_id.eq.${other.id},friend_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") {
        return res.json({ status: "accepted", friend: profileToJson(other) });
      }
      if (existing.status === "pending" && existing.friend_id === user.id) {
        // They already asked us — accept.
        await admin.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
        return res.json({ status: "accepted", friend: profileToJson(other) });
      }
      return res.json({ status: "pending", friend: profileToJson(other) });
    }

    const { error } = await admin
      .from("friendships")
      .insert({ user_id: user.id, friend_id: other.id, status: "pending" });
    if (error) {
      req.log.error({ err: error }, "Error creating friend request");
      return res.status(500).json({ error: "Failed to send friend request" });
    }

    return res.json({ status: "pending", friend: profileToJson(other) });
  } catch (err) {
    req.log.error({ err }, "Error requesting friend");
    return res.status(500).json({ error: "Failed to send friend request" });
  }
});

/** POST /friends/respond — accept or decline an incoming request. */
router.post("/friends/respond", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { friendshipId, accept } = req.body ?? {};
    if (!friendshipId || typeof accept !== "boolean") {
      return res.status(400).json({ error: "friendshipId and accept are required" });
    }

    const admin = createServiceClient();
    const { data: friendship } = await admin
      .from("friendships")
      .select("*")
      .eq("id", friendshipId)
      .maybeSingle();
    if (!friendship) return res.status(404).json({ error: "Request not found" });
    if (friendship.friend_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    if (accept) {
      await admin.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
      return res.json({ status: "accepted" });
    }
    await admin.from("friendships").delete().eq("id", friendshipId);
    return res.json({ status: "declined" });
  } catch (err) {
    req.log.error({ err }, "Error responding to friend request");
    return res.status(500).json({ error: "Failed to respond" });
  }
});

export default router;
