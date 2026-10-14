# Daily Ritual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a guest-first, local-midnight WikiPath Daily Path with official/replay isolation, fair active time, dual champions, richer results/stats/sharing, and an Expo-Go-testable local reminder.

**Architecture:** Keep the API server authoritative. Extend Supabase with additive challenge/session/profile metadata and atomic invariants, expose compatible API fields, then make Expo silently use a persisted anonymous Supabase user and claim that same identity after play. Daily generation remains deterministic and safe through a versioned topic catalogue; broader Wikipedia ingestion stays behind the same generator contract.

**Tech Stack:** PostgreSQL/Supabase, Express 5, TypeScript 5.9, Vitest 4, Expo SDK 54, Expo Router 6, React Native 0.81, Supabase JS 2.105, `expo-notifications`.

## Global Constraints

- Work only on `feat/expo-mobile`; do not merge `main` or start TestFlight.
- Preserve server-authoritative moves, wins, attempts, timing, and results.
- Use a Supabase anonymous user for guest identity, never a client-only token.
- Enforce one official attempt in PostgreSQL; replays affect no official metric.
- Keep Shortest Path and Fastest Solve separate; use no blended score.
- Exclude background, navigation, article fetch, and rendering from active time.
- Derive the daily date server-side from a validated IANA timezone.
- Guarantee at least one familiar endpoint; never claim Perfect Path yet.
- Fail closed when provider or notification configuration is absent.

## File Map

### Database and API

- `supabase/migrations/20260710080000_daily_ritual_foundation.sql`: additive columns, official uniqueness, timing event idempotency, claimed filtering, dual-board RPC.
- `supabase/config.toml`: local anonymous/manual-link settings.
- `artifacts/api-server/src/lib/game/daily-date.ts`: IANA local-date derivation.
- `artifacts/api-server/src/lib/game/article-pool.ts`: typed topic catalogue and generator.
- `artifacts/api-server/src/lib/game/timing.ts`: active timing state machine.
- `artifacts/api-server/src/routes/{daily,game,leaderboard,profile}.ts`: new HTTP contracts.

### Mobile

- `artifacts/mobile/src/lib/player-session.ts`: anonymous bootstrap/classification.
- `artifacts/mobile/src/lib/claim-account.ts`: same-UUID email/OAuth claiming.
- `artifacts/mobile/src/lib/daily-context.ts`: timezone and route parameters.
- `artifacts/mobile/src/lib/active-timer.ts`: display/transition model.
- `artifacts/mobile/src/lib/reminders.ts`: local reminder service.
- Existing Home, Game, Result, Rank, auth, API, type, and presentation modules consume those focused helpers.

### Operations

- `docs/ai/state.md`, `docs/IPHONE_DEMO.md`, and `docs/AUTH_PROVIDER_SETUP.md`: deviations, setup, proof, and morning checklist.

---

### Task 1: Daily date and controlled generator domain

**Files:**
- Create: `artifacts/api-server/src/lib/game/daily-date.ts`
- Create: `artifacts/api-server/src/lib/game/daily-date.test.ts`
- Modify: `artifacts/api-server/src/lib/game/article-pool.ts`
- Modify: `artifacts/api-server/src/lib/game/titles.test.ts`

**Interfaces:**
- Produces `localDateForTimeZone(now: Date, timeZone: string): string`.
- Produces `dailyPairForDate(date: string): DailyPair` with titles, topics, recognition, provisional difficulty, generator version, and seed.

- [ ] **Step 1: Write the failing timezone tests**

```ts
import { describe, expect, it } from "vitest";
import { localDateForTimeZone } from "./daily-date";

describe("localDateForTimeZone", () => {
  const instant = new Date("2026-07-10T06:30:00.000Z");
  it("derives local calendar dates", () => {
    expect(localDateForTimeZone(instant, "America/Los_Angeles")).toBe("2026-07-09");
    expect(localDateForTimeZone(instant, "Pacific/Kiritimati")).toBe("2026-07-10");
  });
  it("rejects an invalid IANA zone", () => {
    expect(() => localDateForTimeZone(instant, "Mars/Olympus")).toThrow("Invalid time zone");
  });
});
```

- [ ] **Step 2: Run red**

Run: `pnpm --dir artifacts/api-server test -- src/lib/game/daily-date.test.ts`  
Expected: FAIL because `./daily-date` does not exist.

- [ ] **Step 3: Implement local-date derivation**

```ts
export function localDateForTimeZone(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (!value.year || !value.month || !value.day) throw new Error();
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    throw new Error("Invalid time zone");
  }
}
```

- [ ] **Step 4: Write generator invariants**

Define `Recognition = "familiar" | "discovery"`, `Difficulty = "easy" | "medium" | "hard"`, and an `ArticleCandidate` with `title`, one of nine topic tags, and recognition. Extend `titles.test.ts` over 180 dates to prove deterministic output, distinct topics/titles, at least one familiar endpoint, no adjacent-date title reuse, and valid difficulty.

- [ ] **Step 5: Implement seeded selection**

Attach metadata to the existing titles using their current comment groups. Choose a familiar endpoint first, choose the second from another topic, rotate deterministically when either appeared during the preceding seven generated dates, and label cross-topic discovery routes Hard, closely related familiar routes Easy, and the rest Medium. Return `difficultySource:"provisional"`, `generatorVersion:2`, and the date-derived seed.

- [ ] **Step 6: Run green and commit**

Run: `pnpm --dir artifacts/api-server test -- src/lib/game/daily-date.test.ts src/lib/game/titles.test.ts`  
Expected: PASS.  
Commit: `git commit -am "Add local daily dates and controlled puzzle generation"`

---

### Task 2: Additive database foundation

**Files:**
- Create: `supabase/migrations/20260710080000_daily_ritual_foundation.sql`
- Modify: `supabase/config.toml`

**Interfaces:**
- Produces official/replay/timing/challenge/profile columns.
- Produces `get_daily_leaderboard_v2(uuid,text,integer,integer,boolean)`.

- [ ] **Step 1: Write the migration**

```sql
alter table public.daily_challenges
  add column if not exists difficulty text not null default 'medium'
    check (difficulty in ('easy','medium','hard')),
  add column if not exists difficulty_source text not null default 'provisional',
  add column if not exists generator_version integer not null default 1,
  add column if not exists generator_seed text,
  add column if not exists start_topic text,
  add column if not exists end_topic text,
  add column if not exists start_recognition text,
  add column if not exists end_recognition text;

alter table public.game_sessions
  add column if not exists attempt_number integer not null default 1,
  add column if not exists is_official boolean not null default true,
  add column if not exists local_date date,
  add column if not exists timezone_at_start text,
  add column if not exists active_time_ms bigint not null default 0,
  add column if not exists active_started_at timestamptz,
  add column if not exists timing_version integer not null default 1;

with ranked as (
  select id,
    row_number() over (
      partition by user_id, challenge_id
      order by completed desc, created_at asc, id asc
    ) as attempt_number
  from public.game_sessions
  where challenge_id is not null
)
update public.game_sessions gs
set attempt_number = ranked.attempt_number,
    is_official = (ranked.attempt_number = 1)
from ranked
where gs.id = ranked.id;

create unique index if not exists game_sessions_one_official_daily
  on public.game_sessions(user_id, challenge_id)
  where is_official and challenge_id is not null;

alter table public.profiles add column if not exists claimed_at timestamptz;
update public.profiles p set claimed_at = coalesce(p.claimed_at, now())
where exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous);

create table if not exists public.game_timing_events (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  event_id uuid not null,
  action text not null check (action in ('resume','pause','heartbeat')),
  created_at timestamptz not null default now(),
  primary key (session_id,event_id)
);

alter table public.game_timing_events enable row level security;
```

Update `handle_new_user()` to set `claimed_at` only for permanent users. Define
`transition_game_timing(p_session_id uuid, p_user_id uuid, p_action text,
p_event_id uuid)` as a security-definer PL/pgSQL function that inserts the event,
locks the owned incomplete session `for update`, applies the transition, and
returns the stored timing fields in the same transaction. Define the v2 board
RPC to filter `is_official`, completed winners, and non-null `claimed_at`, then
order by clicks/time or time/clicks according to a validated board value.

- [ ] **Step 2: Enable local auth behavior**

Set `enable_anonymous_sign_ins = true` and `enable_manual_linking = true` under `[auth]` in `supabase/config.toml`; preserve unrelated keys.

- [ ] **Step 3: Prove the local migration**

Run: `supabase db reset`  
Expected: all migrations apply with exit 0. Insert two official sessions for one user/challenge and expect SQLSTATE `23505`; insert an official plus replay and expect both. Fixture two different board winners and verify both RPC orderings.

- [ ] **Step 4: Commit**

Stage only the config and migration.  
Commit: `git commit -m "Add Daily Ritual database invariants"`

---

### Task 3: Official/replay API and local Daily contract

**Files:**
- Modify: `artifacts/api-server/src/routes/daily.ts`
- Modify: `artifacts/api-server/src/routes/game.ts`
- Modify: `artifacts/api-server/src/lib/game/session-json.ts`
- Create: `artifacts/api-server/src/lib/game/session-mode.ts`
- Create: `artifacts/api-server/src/lib/game/session-mode.test.ts`

**Interfaces:**
- Produces `parseStartMode({challengeType,replay}): {isOfficial:boolean}`.
- `GET /daily?timeZone=...` returns challenge metadata and the official session.
- `POST /game/start` accepts `timeZone` and optional `replay:true`.

- [ ] **Step 1: Write and run failing mode tests**

```ts
expect(parseStartMode({challengeType:"daily", replay:false})).toEqual({isOfficial:true});
expect(parseStartMode({challengeType:"daily", replay:true})).toEqual({isOfficial:false});
expect(() => parseStartMode({challengeType:"practice", replay:true})).toThrow("Replay is daily-only");
```

Run: `pnpm --dir artifacts/api-server test -- src/lib/game/session-mode.test.ts`  
Expected: FAIL before implementation, PASS afterward.

- [ ] **Step 2: Implement timezone-aware `/daily`**

Validate `req.query.timeZone`, derive the date server-side, return a stable 400 on invalid zones, persist every generator metadata field, and load only `.eq("is_official", true)` for the current player.

- [ ] **Step 3: Implement atomic start semantics**

Official Daily inserts `is_official:true`, `attempt_number:1`, `local_date`, and `timezone_at_start`; on unique violation it re-reads the existing official. Replay requires a completed official, calculates `max(attempt_number)+1`, inserts `is_official:false`, and reuses the challenge pair. Practice/Friend behavior remains unchanged.

- [ ] **Step 4: Extend session JSON**

```ts
attemptNumber: s.attempt_number ?? 1,
isOfficial: s.is_official ?? true,
localDate: s.local_date ?? null,
timeZone: s.timezone_at_start ?? null,
activeTimeMs: Number(s.active_time_ms ?? 0),
timingActive: Boolean(s.active_started_at),
```

- [ ] **Step 5: Test and commit**

Run mode tests, full API tests, TypeScript, and local curl fixtures for duplicate official starts and replay isolation.  
Commit: `git commit -am "Add official Daily attempts and unranked replay"`

---

### Task 4: Server-authoritative active timing

**Files:**
- Create: `artifacts/api-server/src/lib/game/timing.ts`
- Create: `artifacts/api-server/src/lib/game/timing.test.ts`
- Modify: `artifacts/api-server/src/routes/game.ts`

**Interfaces:**
- Produces `applyTimingTransition(state, action, nowMs): TimingUpdate`.
- Produces `POST /game/timing` for `resume|pause|heartbeat` with UUID `eventId`.

- [ ] **Step 1: Write state-machine tests**

```ts
expect(applyTimingTransition({activeTimeMs:0,activeStartedAt:null}, "resume", 1_000))
  .toEqual({activeTimeMs:0,activeStartedAt:1_000});
expect(applyTimingTransition({activeTimeMs:0,activeStartedAt:1_000}, "heartbeat", 16_000))
  .toEqual({activeTimeMs:15_000,activeStartedAt:16_000});
expect(applyTimingTransition({activeTimeMs:15_000,activeStartedAt:16_000}, "pause", 20_000))
  .toEqual({activeTimeMs:19_000,activeStartedAt:null});
```

Also test duplicate resume/pause as no-ops and negative deltas clamped to zero.

- [ ] **Step 2: Run red and implement**

Run: `pnpm --dir artifacts/api-server test -- src/lib/game/timing.test.ts`.  
Implement a pure transition that accumulates only heartbeat/pause intervals and never makes time negative.

- [ ] **Step 3: Add `/game/timing`**

Authenticate ownership, call `transition_game_timing`, return current state for
a duplicate event, reject completed sessions with 409, and return
`{activeTimeMs,timingActive}`. Event insertion and mutation must never be split
across two API operations.

- [ ] **Step 4: Integrate navigation and completion**

Pause before forward/Back validation. Completion closes the active segment and stores `time_seconds = round(active_time_ms/1000)`. Only the guarded transition from `completed=false` updates stats; repeat completion returns stored data.

- [ ] **Step 5: Test and commit**

Run timing, navigation, completion, full API tests, and a local fixture proving background time is excluded.  
Commit: `git commit -am "Track fair active Daily play time"`

---

### Task 5: Dual boards, claimed profiles, and official stats

**Files:**
- Modify: `artifacts/api-server/src/routes/leaderboard.ts`
- Modify: `artifacts/api-server/src/routes/profile.ts`
- Create: `artifacts/api-server/src/lib/game/leaderboard.ts`
- Create: `artifacts/api-server/src/lib/game/leaderboard.test.ts`

**Interfaces:**
- Produces `parseBoard(value): "shortest"|"fastest"`.
- Produces `POST /profile/claim` and enriched `GET /profile/me`.

- [ ] **Step 1: Write ordering tests**

Use fixtures proving a 3-click/90-second player wins Shortest, a 5-click/30-second player wins Fastest, time breaks Shortest ties, clicks break Fastest ties, timestamp breaks exact ties, and replay/unclaimed rows never appear.

- [ ] **Step 2: Implement board selection**

Validate `board`, default to `shortest` for web compatibility, call `get_daily_leaderboard_v2`, and return `{board,leaderboard}` with both rank fields when available.

- [ ] **Step 3: Implement account claim**

`POST /profile/claim` rejects a still-anonymous JWT with 409 `Identity is still anonymous`, updates only `profiles.id = user.id`, and returns `{claimed:true}`. It never accepts a user ID in the body.

- [ ] **Step 4: Add official-only stats**

Aggregate completed official sessions for games played/won, average clicks, average active time, best clicks, and fastest time. Preserve every existing camelCase field and exclude replays.

- [ ] **Step 5: Test and commit**

Run focused/full API tests, local RPC fixtures, and TypeScript.  
Commit: `git commit -am "Add dual Daily boards and official statistics"`

---

### Task 6: Guest bootstrap and account claiming on mobile

**Files:**
- Create: `artifacts/mobile/src/lib/player-session.ts`
- Create: `artifacts/mobile/src/lib/player-session.test.ts`
- Create: `artifacts/mobile/src/lib/claim-account.ts`
- Create: `artifacts/mobile/src/lib/claim-account.test.ts`
- Modify: `artifacts/mobile/src/hooks/use-auth-session.ts`
- Modify: `artifacts/mobile/src/components/social-auth-buttons.tsx`
- Modify: `artifacts/mobile/src/lib/social-auth.ts`
- Modify: `artifacts/mobile/src/lib/apple-auth.ios.ts`

**Interfaces:**
- Produces `ensurePlayerSession(client): Promise<Session>` and `isGuestUser(user): boolean`.
- Produces email/OAuth claim functions that preserve the guest UUID then call `/profile/claim`.

- [ ] **Step 1: Write bootstrap tests**

Test reuse of an existing session, exactly one `signInAnonymously()` call when empty, and a stable actionable error when hosted anonymous auth is disabled.

- [ ] **Step 2: Implement bootstrap and hook state**

`ensurePlayerSession` calls `getSession`, otherwise `signInAnonymously`, and requires a returned session. `useAuthSession` exposes `{user,isGuest,isClaimed,loading,bootstrapError,retryBootstrap}` and treats an anonymous user as playable.

- [ ] **Step 3: Write claim-preservation tests**

Record the user ID before email update or `linkIdentity`; require the same ID after success. Cancellation/provider error must leave the anonymous session intact. Existing-identity conflict must preserve the result and return explicit conflict copy.

- [ ] **Step 4: Implement `mode="claim"|"signin"`**

Claim mode uses `updateUser` for email and `linkIdentity({provider:"google"|"apple"})` for OAuth, completes the callback, then calls `/profile/claim`. Disabled providers stay hidden. Native Apple ID-token sign-in remains permanent-sign-in-only.

- [ ] **Step 5: Test and commit**

Run all mobile auth/session tests and TypeScript.  
Commit: `git commit -am "Add guest-first play and account claiming"`

---

### Task 7: Mobile Daily, replay, and timing integration

**Files:**
- Create: `artifacts/mobile/src/lib/daily-context.ts`
- Create: `artifacts/mobile/src/lib/daily-context.test.ts`
- Create: `artifacts/mobile/src/lib/active-timer.ts`
- Create: `artifacts/mobile/src/lib/active-timer.test.ts`
- Modify: `artifacts/mobile/src/lib/api.ts`
- Modify: `artifacts/mobile/src/lib/types.ts`
- Modify: `artifacts/mobile/src/lib/home-model.ts`
- Modify: `artifacts/mobile/src/lib/home-model.test.ts`
- Modify: `artifacts/mobile/src/app/(tabs)/index.tsx`
- Modify: `artifacts/mobile/src/app/game.tsx`

**Interfaces:**
- Produces `deviceTimeZone(): string` with `UTC` fallback.
- Produces client timing decisions consumed only by `game.tsx`.

- [ ] **Step 1: Extend API types**

Add approved challenge, official/replay, timing, dual-rank, claimed, and richer-stat fields. Add timezone to Daily/start, replay mode, timing transitions, and board selection.

- [ ] **Step 2: Replace the guest wall test**

Change the guest Home expectation from `Create account & play` to `Begin today's path`. Add completed-official Result and `Replay unranked` routing tests.

- [ ] **Step 3: Add timing decision tests**

Prove WebView-ready resumes, moving/background pauses, foreground alone does not resume before ready, heartbeats occur every 15 seconds only while active, and displayed time reconciles to server milliseconds.

- [ ] **Step 4: Integrate Home and Game**

Home passes timezone, displays local issue date/difficulty, uses guest-safe copy, and shows official stats for claimed users. Game passes replay mode, labels Official/Unranked Replay, watches `AppState`, pauses before every move/exit, resumes from the WebView ready message, and sends UUID event IDs plus heartbeats.

- [ ] **Step 5: Test and commit**

Run focused/full mobile tests, TypeScript, and simulator background/foreground smoke.  
Commit: `git commit -am "Integrate Daily replay and active timing on mobile"`

---

### Task 8: Results, dual Rank, stats, and sharing

**Files:**
- Modify: `artifacts/mobile/src/app/result.tsx`
- Modify: `artifacts/mobile/src/app/(tabs)/leaderboard.tsx`
- Modify: `artifacts/mobile/src/lib/result-presentation.ts`
- Modify: `artifacts/mobile/src/lib/result-presentation.test.ts`
- Modify: `artifacts/mobile/src/lib/game-utils.ts`
- Modify: `artifacts/mobile/src/lib/game-utils.test.ts`

**Interfaces:**
- Result consumes official/replay, difficulty, shortest/fastest ranks, and claimed status.
- Rank consumes board plus Everyone/Friends without blending metrics.

- [ ] **Step 1: Write presentation/share tests**

Assert official/replay kicker, difficulty label, independent rank copy, sweep copy when both ranks are 1, claim CTA for guests, and spoiler-safe share text containing puzzle number/clicks/active time/difficulty but no article titles.

- [ ] **Step 2: Implement Result hierarchy**

Keep the Warm Editorial masthead and exact route. Add two rank cards, champion callouts, guest claim CTA, Replay unranked, reminder CTA placeholder, Share, and Home. Replay results cannot show official streak/ranks.

- [ ] **Step 3: Implement dual Rank controls**

Use a top Shortest/Fastest segment and nested Everyone/Friends segment. Shortest rows emphasize clicks then time; Fastest rows emphasize time then clicks. Preserve current-user highlighting and complete accessibility labels.

- [ ] **Step 4: Test and commit**

Run presentation/share tests, full mobile tests, TypeScript, and light/dark/large-text simulator inspection.  
Commit: `git commit -am "Add dual Daily champions and richer results"`

---

### Task 9: Expo-Go local Daily reminders

**Files:**
- Create: `artifacts/mobile/src/lib/reminders.ts`
- Create: `artifacts/mobile/src/lib/reminders.test.ts`
- Modify: `artifacts/mobile/src/app/result.tsx`
- Modify: `artifacts/mobile/src/app/_layout.tsx`
- Modify: `artifacts/mobile/package.json`
- Modify: `artifacts/mobile/app.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces `enableDailyReminder(hour?: number): Promise<ReminderState>`.
- Produces `disableDailyReminder()` and development-only `scheduleReminderTest(seconds: number)`.

- [ ] **Step 1: Install the SDK-matched package**

Run: `pnpm --dir artifacts/mobile exec expo install expo-notifications`  
Expected: SDK 54-compatible dependency and lock update. Add the `expo-notifications` config plugin without custom sounds.

- [ ] **Step 2: Write scheduling tests**

Inject permission, storage, and scheduler dependencies. Test granted, denied, disabled, rescheduled, timezone-changed, and 60-second development-trigger cases.

- [ ] **Step 3: Implement reminders and routing**

Schedule a recoverable rolling horizon of 28 independent one-shot local `DATE`
notifications for 9:00 a.m. local with title `Today's WikiPath is ready` and
data `{route:"/"}`. Reuse matching future deliveries and install only a missing
tail; persist enabled state and an ownership journal in AsyncStorage. Verify
native pending requests before committing or clearing the journal. RootLayout
registers a response listener that returns Home; Home focus refreshes Daily.

- [ ] **Step 4: Add Result opt-in**

After an official finish show `Remind me tomorrow`. Permission denial becomes neutral explanatory copy and never blocks Home, Share, or Replay.

- [ ] **Step 5: Test and commit**

Run reminder/full mobile tests, TypeScript, Expo Doctor, iOS export, and a simulator/phone 60-second notification proof.  
Commit: `git commit -am "Add local Daily Path reminders"`

---

### Task 10: Hosted configuration, deployment, and complete proof

**Files:**
- Modify: `docs/ai/state.md`
- Modify: `docs/IPHONE_DEMO.md`
- Modify: `docs/AUTH_PROVIDER_SETUP.md`

**Interfaces:**
- Produces a healthy Railway API and canonical Expo Go tunnel.
- Explicitly does not produce TestFlight or signed-provider proof.

- [ ] **Step 1: Run the full local gate**

```bash
pnpm --dir artifacts/api-server test
pnpm --dir artifacts/mobile test
pnpm typecheck
(cd artifacts/mobile && pnpm dlx expo-doctor@1.17.13)
(cd artifacts/mobile && pnpm exec expo export --platform ios)
git diff --check
```

Every command must exit 0. Record exact test counts and export size.

- [ ] **Step 2: Prove local integration**

Reset local Supabase, run the API, and exercise fresh anonymous Daily start, concurrent official start, timing pause, completion, replay, both boards, email claim, and official-only stats. Preserve response evidence without secrets.

- [ ] **Step 3: Apply hosted auth configuration safely**

Target the hosted Supabase project (`<project-ref>`). Enable only anonymous users and manual linking; confirm `/auth/v1/settings` reports anonymous users enabled. Do not enable Google/Apple without real credentials.

- [ ] **Step 4: Push the hosted migration**

Run `supabase migration list --linked`, a dry-run where supported, then `supabase db push`. Re-run migration list and read-only schema/RPC probes. Never reset hosted data.

- [ ] **Step 5: Deploy Railway**

Follow `docs/DEPLOY.md`, including its build and force-recreate rules. Verify `/api/healthz`, timezone-aware `/api/daily`, guest start, replay, dual boards, and error logs. Roll back if core Daily or health fails.

- [ ] **Step 6: Run visible flows**

Simulator: fresh guest → official → background → finish → replay → boards unchanged → Share → reminder → email claim. Physical morning checklist: the canonical Expo Go tunnel URL, guest play, timer pause, result, replay, Share, reminder, and claim CTA.

- [ ] **Step 7: Update docs and commit**

Record the architecture deviation before code, exact files/tests/deploy IDs, provider proof boundaries, and phone steps.  
Commit: `git commit -am "Document Daily Ritual verification"`

- [ ] **Step 8: Push only the feature branch**

Run: `git push origin feat/expo-mobile`. Confirm `main` is unchanged, tmux `wikipath-demo` is alive, and the tunnel manifest is HTTP 200 with `exposdk:54.0.0`.

---

## Self-Review Record

- **Spec coverage:** Tasks 1–10 cover every approved decision and acceptance criterion.
- **Placeholder scan:** The plan contains no `TBD`, generic error-handling instruction, or undefined later-task interface.
- **Type consistency:** `DailyPair`, official/replay fields, `activeTimeMs`, board names, claim endpoint, and reminder signatures match across tasks.
- **Scope check:** These subsystems share one schema/API contract, so separate plans would duplicate contracts and weaken end-to-end proof. Each task still yields an independently reviewable commit.
