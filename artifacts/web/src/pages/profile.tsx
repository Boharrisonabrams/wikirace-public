import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Check, UserPlus, Flame } from "lucide-react";
import { api, updateUsername } from "@/lib/api";
import { formatTime } from "@/lib/game-utils";
import { normalizeUsername, validateUsername } from "@/lib/username";

interface Profile {
  userId: string;
  username: string;
  displayName: string | null;
  friendCode: string;
}

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  totalClicks: number;
  totalTimeSeconds: number;
  currentStreak: number;
  longestStreak: number;
}

interface Friend {
  userId: string;
  username: string;
  displayName: string | null;
  friendCode: string;
  friendshipId?: string;
}

interface FriendsData {
  friends: Friend[];
  pendingIncoming: Friend[];
  pendingOutgoing: Friend[];
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [friends, setFriends] = useState<FriendsData | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [addState, setAddState] = useState<{
    kind: "idle" | "ok" | "error";
    message?: string;
  }>({
    kind: "idle",
  });
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  async function loadAll() {
    const [me, friendsData] = await Promise.all([
      api<{ profile: Profile; stats: Stats }>("/profile/me"),
      api<FriendsData>("/friends"),
    ]);
    setProfile(me.profile);
    setStats(me.stats);
    setFriends(friendsData);
  }

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  async function copyCode() {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addFriend(event: React.FormEvent) {
    event.preventDefault();
    if (!codeInput.trim() || adding) return;
    setAdding(true);
    setAddState({ kind: "idle" });
    try {
      const result = await api<{ status: string; friend: Friend }>(
        "/friends/request",
        {
          method: "POST",
          body: { friendCode: codeInput.trim() },
        },
      );
      setAddState({
        kind: "ok",
        message:
          result.status === "accepted"
            ? `You and @${result.friend.username} are now friends`
            : `Request sent to @${result.friend.username}`,
      });
      setCodeInput("");
      await loadAll();
    } catch (err) {
      setAddState({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not add friend",
      });
    } finally {
      setAdding(false);
    }
  }

  async function respond(friendshipId: string, accept: boolean) {
    await api("/friends/respond", {
      method: "POST",
      body: { friendshipId, accept },
    });
    await loadAll();
  }

  function startUsernameEdit() {
    if (!profile) return;
    setEditingUsername(true);
    setUsernameInput(profile.username);
    setUsernameError(null);
    setAddState({ kind: "idle" });
  }

  function cancelUsernameEdit() {
    setEditingUsername(false);
    setUsernameInput(profile?.username ?? "");
    setUsernameError(null);
  }

  async function saveUsername(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || usernameSaving) return;
    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    const normalized = normalizeUsername(usernameInput);
    if (normalized === profile.username) {
      setEditingUsername(false);
      setUsernameError(null);
      return;
    }

    setUsernameSaving(true);
    setUsernameError(null);
    try {
      const result = await updateUsername(normalized);
      setProfile(result.profile);
      setEditingUsername(false);
      setUsernameInput(result.profile.username);
      setAddState({
        kind: "ok",
        message: `Username updated to @${result.profile.username}`,
      });
    } catch (err) {
      setUsernameError(
        err instanceof Error ? err.message : "Could not save username",
      );
    } finally {
      setUsernameSaving(false);
    }
  }

  const usernameValidationError =
    editingUsername && usernameInput.length > 0
      ? validateUsername(usernameInput)
      : null;
  const normalizedUsernameInput = normalizeUsername(usernameInput);
  const canSaveUsername =
    Boolean(profile) &&
    !usernameSaving &&
    normalizedUsernameInput !== "" &&
    normalizedUsernameInput !== profile?.username &&
    usernameValidationError == null;
  const winRate =
    stats && stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[var(--wiki-chrome)]">
      <header className="border-b border-[var(--wiki-rule)] bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded border border-[var(--wiki-hairline)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-serif text-xl font-semibold">Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        {/* identity */}
        <section className="border border-[var(--wiki-rule)] bg-white p-5">
          {profile ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-semibold">
                    {profile.displayName || profile.username}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    @{profile.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startUsernameEdit}
                  disabled={usernameSaving}
                  className="min-h-10 rounded border border-[var(--wiki-hairline)] px-3 text-sm font-semibold text-[var(--wiki-blue)] disabled:opacity-50"
                >
                  Edit
                </button>
              </div>
              {editingUsername && (
                <form
                  onSubmit={saveUsername}
                  className="mt-4 space-y-3 border-t border-[var(--wiki-hairline)] pt-4"
                >
                  <div>
                    <label
                      htmlFor="profile-username"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Change username
                    </label>
                    <input
                      id="profile-username"
                      type="text"
                      value={usernameInput}
                      onChange={(event) => setUsernameInput(event.target.value)}
                      autoCapitalize="off"
                      autoComplete="username"
                      className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="player_one"
                    />
                    <p
                      className={`mt-1 text-xs ${
                        usernameError || usernameValidationError
                          ? "text-[var(--wiki-red)]"
                          : "text-muted-foreground"
                      }`}
                    >
                      {usernameError ||
                        usernameValidationError ||
                        "Lowercase letters, numbers, and underscores only."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!canSaveUsername}
                      className="min-h-11 flex-1 rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {usernameSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelUsernameEdit}
                      disabled={usernameSaving}
                      className="min-h-11 rounded border border-[var(--wiki-hairline)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <button
                onClick={copyCode}
                className="mt-3 flex min-h-11 w-full items-center justify-between rounded border border-dashed border-[var(--wiki-rule)] bg-[var(--wiki-chrome)] px-3 py-2"
              >
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Friend code
                </span>
                <span className="flex items-center gap-2 font-mono text-lg font-semibold tracking-[0.2em]">
                  {profile.friendCode}
                  {copied ? (
                    <Check className="h-4 w-4 text-[var(--wiki-green)]" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Friends enter this code to connect with you.
              </p>
            </>
          ) : (
            <div className="h-24 animate-pulse rounded bg-[var(--wiki-soft)]" />
          )}
        </section>

        {/* stats */}
        <section className="border border-[var(--wiki-rule)] bg-white">
          <h3 className="border-b border-[var(--wiki-hairline)] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Record
          </h3>
          {stats ? (
            <div className="grid grid-cols-3 gap-px bg-[var(--wiki-hairline)] text-center">
              {[
                { value: String(stats.gamesPlayed), label: "played" },
                { value: String(stats.gamesWon), label: "won" },
                { value: `${winRate}%`, label: "win rate" },
                {
                  value: (
                    <span className="inline-flex items-center gap-1">
                      {stats.currentStreak}
                      <Flame className="h-4 w-4 text-[var(--wiki-gold)]" />
                    </span>
                  ) as unknown as string,
                  label: "streak",
                },
                { value: String(stats.longestStreak), label: "best streak" },
                {
                  value: formatTime(stats.totalTimeSeconds),
                  label: "time racing",
                },
              ].map((cell, i) => (
                <div key={i} className="bg-white px-2 py-3">
                  <div className="tabular font-serif text-xl font-semibold">
                    {cell.value}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {cell.label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="m-4 h-24 animate-pulse rounded bg-[var(--wiki-soft)]" />
          )}
        </section>

        {/* friends */}
        <section className="border border-[var(--wiki-rule)] bg-white">
          <h3 className="border-b border-[var(--wiki-hairline)] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Friends
          </h3>

          <form onSubmit={addFriend} className="flex gap-2 px-5 pt-4">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Friend code"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              className="min-h-11 w-full flex-1 rounded border border-[var(--wiki-rule)] px-3 font-mono uppercase tracking-[0.2em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
            />
            <button
              type="submit"
              disabled={adding || codeInput.trim().length < 6}
              className="flex min-h-11 items-center gap-1.5 rounded bg-primary px-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Add
            </button>
          </form>
          {addState.kind !== "idle" && (
            <p
              className={`px-5 pt-2 text-sm ${addState.kind === "ok" ? "text-[var(--wiki-green)]" : "text-[var(--wiki-red)]"}`}
            >
              {addState.message}
            </p>
          )}

          <div className="px-5 py-4">
            {friends?.pendingIncoming && friends.pendingIncoming.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Wants to be friends
                </p>
                {friends.pendingIncoming.map((f) => (
                  <div
                    key={f.friendshipId}
                    className="mb-2 flex items-center justify-between gap-2 rounded border border-[var(--wiki-hairline)] px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">
                      @{f.username}
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        onClick={() => respond(f.friendshipId!, true)}
                        className="min-h-9 rounded bg-primary px-3 text-sm font-medium text-primary-foreground"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(f.friendshipId!, false)}
                        className="min-h-9 rounded border border-[var(--wiki-hairline)] px-3 text-sm"
                      >
                        Decline
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {friends ? (
              friends.friends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No friends yet. Share your code — the leaderboard is better
                  with rivals.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {friends.friends.map((f) => (
                    <li
                      key={f.userId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--wiki-green)]" />
                      <span className="font-medium">
                        {f.displayName || f.username}
                      </span>
                      <span className="text-muted-foreground">
                        @{f.username}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="h-12 animate-pulse rounded bg-[var(--wiki-soft)]" />
            )}

            {friends?.pendingOutgoing && friends.pendingOutgoing.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Waiting on:{" "}
                {friends.pendingOutgoing
                  .map((f) => `@${f.username}`)
                  .join(", ")}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
