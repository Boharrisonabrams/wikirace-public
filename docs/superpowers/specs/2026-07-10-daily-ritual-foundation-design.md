# WikiPath Daily Ritual Foundation: Design

**Status:** Approved by Bo on 2026-07-10  
**Branch:** `feat/expo-mobile`  
**Primary client:** Expo SDK 54 mobile app in `artifacts/mobile`  
**Distribution boundary:** Expo Go only for this cycle; do not merge `main` or start TestFlight.

## Product intent

Turn the working WikiPath demo into a repeatable NYT-Games-inspired daily ritual. The daily game must be instantly playable, competitively fair, satisfying to finish and share, and structurally ready for friend competition without making social features the first dependency.

The primary loop is:

> Open → play today's path → celebrate and understand the result → save/share/compare → return tomorrow.

WikiPath keeps its own identity: players navigate real Wikipedia links, with path efficiency and active solve speed treated as separate forms of mastery.

## Approved product decisions

1. Daily ritual and retention are Phase A; friend competition is Phase B.
2. Every local calendar date has one shared Daily Path.
3. A new daily unlocks at midnight in the player's local timezone.
4. Topic pairs are unpredictably selected across broad subject areas. At least one endpoint is familiar; the other may be a discovery.
5. The first attempt is the only official ranked attempt. Later runs are explicitly unranked replays.
6. Two independent champions are recognized:
   - **Shortest Path:** fewest clicks, then active time, then completion timestamp.
   - **Fastest Solve:** least active time, then clicks, then completion timestamp.
7. Guest-first play is required. Account creation is offered after the result through Apple, Google, or email.
8. A guest's official result must remain attached to the same identity when a new account is claimed.
9. Perfect Path is a later graph-snapshot feature. Until it is mathematically provable, the product says **Shortest Path Today**, never Perfect Path.
10. Coins, lives, energy, generic XP, and a blended opaque score are excluded.

## Experience design

### First launch and identity

The app silently ensures a persisted Supabase anonymous session. Anonymous users are authenticated users with a stable UUID, so the existing server-authoritative game model remains intact. The UI calls them guests and does not show account-management chrome.

The home screen loads today's challenge immediately. No login screen interrupts play. After an official result, the result screen presents **Save your score and join the rankings** with Apple, Google, and email options.

For a new identity, account conversion preserves the anonymous UUID:

- Email uses `updateUser` and verification before password creation.
- Google uses Supabase manual OAuth identity linking.
- Apple guest conversion also uses Supabase manual OAuth identity linking so the
  anonymous UUID is preserved. The existing native identity-token flow remains
  available for permanent sign-in, but it must not replace a guest session and
  discard its result.

Anonymous results are private and excluded from public leaderboards until the identity is claimed. After conversion, the same result becomes visible without copying game data. Signing into an already-existing account is a conflict case: the app must explain that the account already exists and use a later explicit merge endpoint rather than silently discarding either history.

Hosted Supabase must enable anonymous users and manual identity linking. Provider buttons remain fail-closed unless their hosted provider and public feature flag are both enabled. Email remains the guaranteed claim path for the Expo Go demo.

### Daily identity and local midnight

The client sends its IANA timezone, not a self-asserted date. The server derives the calendar date in that timezone and selects the globally shared challenge row for that date. The session records `timezone_at_start` and `local_date` so completion and streak logic are stable even if the device timezone later changes.

The same `YYYY-MM-DD` challenge pair is shared globally, but it becomes available when that date begins locally. The server accepts only a valid IANA timezone and bounds pathological timezone changes. A future anti-abuse pass can harden travel behavior; the current rule is one official session per user and challenge, enforced by the database.

The Home card shows the local issue date and removes the current UTC label. Returning to a mounted Home or Rank tab re-fetches daily state so midnight rollover does not remain stale.

### Official attempt and unranked replay

`game_sessions` records `attempt_number` and `is_official`. A partial unique index guarantees at most one official session per `(user_id, challenge_id)`, including concurrent starts. Daily start is atomic: it creates or returns the official session.

After the official session completes, the Home and Result screens offer **Replay unranked**. A replay uses the same start and target, receives the next attempt number, and is clearly labeled throughout. Replays never affect daily champions, streaks, official personal records, or friend results. They may contribute to a separate future practice total, but not in this cycle.

Give Up completes the official attempt as a loss. It does not permit a second official attempt. The player may still replay unranked.

### Fair active-play timing

Ranked time measures play, not waiting. The server stores `active_time_ms`, `active_started_at`, and a timing protocol version. The mobile app sends idempotent timing transitions:

- Resume when the current article WebView reports interactive.
- Pause immediately before navigation, Back, Give Up, app backgrounding, or screen exit.
- Resume only after the next article is interactive.
- Send a periodic heartbeat while interactive so a dropped background pause can
  over-count by only one bounded interval.
- Completion atomically closes the final active segment.

The server owns the accumulated value and rejects transitions for another user or a completed session. A capped heartbeat limits over-counting if a background pause request never arrives. The displayed timer is optimistic but periodically reconciles with server state. `time_seconds` remains as a compatibility projection rounded from `active_time_ms`.

This is beta-grade competitive timing, not anti-cheat proof. The UI may call it **Active time**. It must not include article fetch, WebView render, or time outside the app.

### Results, rankings, stats, and sharing

The result screen keeps outcome, exact route, clicks, active time, streak, and native Share. It adds:

- Official or Unranked Replay status.
- Difficulty label.
- Shortest Path rank and Fastest Solve rank when the claimed player is eligible.
- Daily champion callouts when rank is 1.
- **Shortest Path Today** comparison after leaderboard data exists.
- Account-claim CTA for guests.
- Replay and Home actions.

Rank becomes two explicit boards rather than a blended score. Both boards support Everyone and Friends using the same official-session data. Anonymous profiles are filtered until claimed.

Personal statistics add daily games played, wins, current/best streak, average official clicks, average active time, best click result, and fastest result. Stats are derived from official sessions or transactionally updated once; replays cannot inflate them.

Share text includes the puzzle number, clicks, active time, difficulty, and a compact spoiler-safe route glyph. It never reveals article titles by default. The native Share sheet remains the delivery mechanism.

### Daily reminder

After a successful result, the app offers a single opt-in local reminder for the next local daily. Expo Go can verify local scheduling and tap handling. Remote push tokens, server campaigns, and production notification credentials remain a signed-build/TestFlight concern.

The reminder setting must support enabled/disabled state, permission denial, rescheduling after timezone changes, and a test notification in development. Tapping routes to Home, which refreshes the current Daily Path.

**Accepted implementation adjustment (Expo Go/iOS):** the durable reminder is
implemented as a recoverable rolling horizon of 28 independent one-shot local
`DATE` requests at 9:00 a.m. in the current IANA timezone, rather than one
forever-repeating calendar request. Matching future deliveries are reused on
reconciliation; only the missing tail is installed. This keeps reminders alive
when the app is not opened after delivery, permits native pending-request
verification and crash recovery, and stays below iOS's 64-request limit. The
user-facing contract remains one opt-in local reminder for each future Daily.

## Controlled puzzle generation and difficulty

The overnight implementation evolves the current 241-title pool into a versioned, topic-tagged catalogue. Selection is deterministic by challenge date and generator version, draws endpoints from different topic groups, applies a repeat-exclusion window, and guarantees at least one `familiar` endpoint. This meets the controlled broad-topic requirement without pretending a raw uniform Wikipedia page is automatically playable.

The challenge row stores generator metadata: `generator_version`, `seed`, endpoint topic tags, recognition roles, and a provisional difficulty.

Initial difficulty is a transparent heuristic based on catalogue relationship and bounded live validation:

- **Easy:** familiar-to-familiar or closely connected topic groups.
- **Medium:** cross-topic familiar pair or familiar-to-discovery with healthy link density.
- **Hard:** distant topic groups or a discovery endpoint passing playability checks.

The label is `Provisional` until sufficient official outcomes exist. Once a challenge has enough finishes, empirical classification may use completion rate, median clicks, median active time, backtracks, and give-ups.

The long-term generator is ahead-of-time, never first-request critical-path work. It will ingest a Wikipedia article catalogue with namespace/redirect/disambiguation quality, topic, pageviews, link degree, and validation timestamps; sample candidates with a dated seed; validate a bounded route; and fall back to the safe catalogue. A pinned graph snapshot is required before claiming Perfect Path.

## Data model

Add a forward-only Supabase migration with:

### `daily_challenges`

- `difficulty text not null default 'medium'`
- `difficulty_source text not null default 'provisional'`
- `generator_version integer not null default 1`
- `generator_seed text`
- `start_topic text`, `end_topic text`
- `start_recognition text`, `end_recognition text`

### `game_sessions`

- `attempt_number integer not null default 1`
- `is_official boolean not null default true`
- `local_date date`
- `timezone_at_start text`
- `active_time_ms bigint not null default 0`
- `active_started_at timestamptz`
- `timing_version integer not null default 1`
- partial unique index on `(user_id, challenge_id)` where `is_official` and `challenge_id is not null`
- indexes for both official leaderboard orderings

### `profiles`

- `claimed_at timestamptz`

Existing permanent users are backfilled as claimed. Anonymous users created afterward remain unclaimed until identity conversion. Leaderboard functions join only claimed profiles.

### Server functions / transactions

Use database functions or atomic guarded updates for:

- create-or-read official daily session;
- allocate replay attempt numbers;
- timing pause/resume accumulation;
- idempotent completion plus one-time stats/streak update;
- separate shortest and fastest leaderboard ranks.

## API contracts

- `GET /daily?timeZone=America/Los_Angeles`
  - returns challenge metadata, official session, replay availability, and local date.
- `POST /game/start`
  - accepts `timeZone` and optional `replay: true`.
  - returns official/replay metadata and server timing state.
- `POST /game/timing`
  - accepts `{sessionId, action: 'resume'|'pause'|'heartbeat', eventId}`.
  - idempotently returns accumulated active time.
- `POST /game/navigate`
  - pauses timing before move validation and returns updated timing state.
- `POST /game/complete`
  - atomically finalizes result and official stats.
- `GET /leaderboard/daily`
  - accepts `board=shortest|fastest`, `friendsOnly`, pagination.
  - returns both board rank fields where useful.
- `GET /profile/me`
  - adds derived official-only statistics and claimed/guest status.
- `POST /profile/claim`
  - verifies the authenticated JWT is no longer anonymous, then sets
    `profiles.claimed_at`; it never accepts a client-supplied user ID.

All new fields are additive. Existing web clients continue to receive compatible fields and preserve click-first behavior until deliberately updated.

## Error handling and recovery

- Anonymous bootstrap failure shows retry and email sign-in, never a false playable state.
- If local timezone validation fails, use UTC only as an explicitly labeled fallback and log the failure.
- Concurrent official starts converge on the unique official session.
- Duplicate timing events are harmless through event IDs or guarded state transitions.
- Article/network failures pause timing and retain the previous readable page plus Retry.
- Replay creation failure leaves the locked official result intact.
- Claim cancellation returns to the result without losing it.
- Provider-disabled states hide their buttons; provider errors remain actionable and preserve the guest session.
- Notification denial is non-fatal and leaves reminders off.
- Generator validation failure falls back to a deterministic safe pair and records the fallback source.

## Security and abuse boundaries

- The API remains server-authoritative for articles, moves, completion, attempts, and timing.
- Anonymous users use authenticated JWTs; public writes remain blocked by RLS.
- Anonymous profiles cannot publish leaderboard entries until claimed.
- Rate-limit anonymous creation and game starts; add CAPTCHA/Turnstile before broader public launch.
- The server validates IANA timezone names and stores the first official timezone.
- Never accept client-reported clicks, result time, win state, difficulty, or rank.

## Verification strategy

### Automated

- Generator determinism, topic separation, recognition invariant, repeat window, and difficulty tests.
- Local-date/DST/timezone matrix tests.
- Concurrent official-start integration test.
- Official/replay isolation tests for stats, streaks, and both boards.
- Timing state-machine and idempotency tests, including background and navigation gaps.
- Guest bootstrap and identity-conversion state tests.
- Dual leaderboard ordering and exact-tie tests.
- Result/share/personal-stat/reminder model tests.
- Existing mobile, API, and workspace tests; TypeScript; Expo Doctor; iOS export.

### Runtime

- Local Supabase reset and migration proof.
- Simulator flow: fresh install → guest daily → background → navigation → finish → result → replay → boards unchanged → email claim → board eligibility.
- Permission-denied and scheduled local-reminder paths.
- Physical iPhone via canonical Expo tunnel: guest play, fair timer behavior, official result, replay, share, reminder, and claim CTA.
- Hosted migration and Railway deployment health before pointing the physical demo at production.

Google success, Apple production identity, remote push, existing-account merge, and Perfect Path require their documented external prerequisites and may not be represented as verified until those proofs exist.

## Acceptance criteria

The feature is complete only when:

1. A fresh user can play the Daily Path without seeing an account wall.
2. A single official attempt is enforced by the database and replays are unranked everywhere.
3. Active time excludes background and loading intervals and is server-persisted.
4. Shortest and Fastest boards independently order only claimed official winners.
5. The daily derives from local timezone and streak behavior survives midnight/DST tests.
6. The generator is deterministic, topic-balanced, repeat-aware, recognition-safe, and exposes provisional difficulty.
7. Result, sharing, stats, streaks, and reminder flows are coherent and accessible.
8. Email claim preserves the guest UUID and result; Apple/Google code uses claim semantics and remains fail-closed until configured.
9. Automated suites, local database integration, Expo checks, simulator flows, hosted health, and the physical-iPhone checklist provide the appropriate proof layers.
10. `main` and TestFlight remain untouched.
