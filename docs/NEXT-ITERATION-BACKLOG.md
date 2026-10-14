# WikiRace next iteration backlog

This is the staged follow-up list from the July 10 physical-iPhone session. It
does not change the current Expo demo.

## Implementation proof: 2026-07-18

- The first external tester's "Ctrl+F is faster than mobile find" gap (items
  3–4's acknowledged pain) is answered by a unified search palette: one
  thumb-reachable Search action in the race bar opens a bottom sheet with
  "Links on this page" (fuzzy title match + prose snippet; tap = the existing
  server-validated navigate flow) and "In the article" (text matches; tap =
  scroll there, sheet collapses to a mini bar, keyboard stays up). Typing
  live-scrolls the article to the first text match. Piped anchors reveal
  their true destination ("Goes to …").
- Fairness: the official Daily renders link results only at 2+ typed
  characters (`minLinkQueryChars`, mirroring `allowsArticleBack`); Practice,
  friend races, and unranked replays may browse the full link inventory with
  an empty query. Navigation authority is unchanged: every palette move goes
  through `POST /game/navigate`.
- The header find rail is absorbed: next/previous no longer blur or dismiss
  the keyboard, and "I want Kenya" is 3 interactions (Search → "ke" → tap).
- Proof: mobile `264/264`, workspace typecheck, scoped Prettier, and
  simulator recordings/stills in `docs/ai/evidence/mobile-unified-search/`
  (the evidence folder is not part of the public export)
  (Daily gate + palette navigation; Practice browse, mini bar, give-up;
  light/dark; iPhone 17 Pro and 17e). No TestFlight or EAS action.

## Implementation proof: 2026-07-13

- Web/mobile search consolidation follow-up (2026-07-21): the web race search
  copies the current mobile pure ranking/gating logic locally because PR #3
  (`claude/wikirace-mobile-search-4d2f8e`) is still separate from `main`. Once
  that branch lands, hoist the shared search helpers into a workspace lib and
  repoint both apps without changing the reviewed behavior.

- Sharing now has explicit **Challenge a friend** and **Share my result**
  actions backed by one mobile/web formatter. Compact challenge, won, and
  stopped copy includes no full solution path. Stopped copy omits clicks/time;
  links remain opaque and preview-only until Start.
- Private-game article entry is now a live MediaWiki picker: two-character
  threshold, 250 ms debounce, stale-request rejection, six-result cap,
  title/description rows, explicit loading/empty/error states, selection
  required, edit-to-clear, and automatic Start-to-Target focus. The server still
  resolves the selected titles canonically before challenge creation.
- The approved circular W master now deterministically generates the mobile
  icon/splash/adaptive assets, web favicon/PWA/maskable assets, and a generic
  spoiler-free social card. Stable infrastructure and app identity values are
  unchanged.
- Completed proof: mobile `232/232`, API `103/103`, browser share/deep-link
  `9/9`, all workspace typechecks, production web build, Expo Doctor `17/17`,
  iOS export, deterministic asset hashes, and iPhone 17 Pro simulator picker
  proof. Full-game Playwright remains pending Docker/local Supabase recovery;
  hosted suggestions remain pending an explicitly approved deployment.

## Implementation proof: 2026-07-10

- Friend-beta polish removes the unsupported Difficulty judgment from Home,
  Result, and share copy; Home now explains that everyone receives the same
  start and target. One editorial type scale now governs page/section/card/body/
  label/control roles across the mobile sharing journey. Terracotta is the
  primary-action color and blue remains the link/target color.
- Private previews now include Copy link beside the native share action. The
  copy path permits only a safe short HTTPS challenge URL, and the iPhone 17 Pro
  simulator visibly changed the control to **Link copied**. The public browser
  fallback removes the generated player handle, uses **A friend challenges you
  to race**, explains the free-profile step, aligns to Warm Editorial, and has a
  canonical Copy challenge link fallback.
- Current proof: mobile `211/211`, API `97/97`, browser share `7/7`, production
  web build, workspace TypeScript, Expo Doctor `18/18`, and a fresh iOS export
  pass. The browser visual update is live in a Railway deployment;
  `/api/healthz`, `/daily`, and the
  public Christopher Columbus → United Nations challenge each return HTTP 200. Physical Messages sharing plus a two-player finish remain the final live
  friend-beta test.

- Private games are now implemented on `feat/expo-mobile`: Home opens a custom
  pair form, the API resolves both Wikipedia articles and rejects canonical
  aliases that collapse to the same page, and the returned challenge opens a
  preview with Share and explicit Start. Private games remain unranked against
  Official Daily statistics and retain their own race rules.
- Challenge-link safety is live. Hosted migrations are aligned through
  `20260710160000`; the Railway deployment is successful. A fresh anonymous-user
  proof confirmed preview-before-attempt, one resumable attempt after Start,
  opaque ten-character codes, no user/session ID exposure, and a working SPA
  fallback. Challenge pages now emit route-specific Open Graph/Twitter metadata
  with a bounded public cache and rate limit.
- Completion, Official Daily stats/streaks, and invite completion tracking are
  now one atomic v2 database operation. The drained-deployment reconciliation
  rebuilt 11 users with zero aggregate mismatches or missing completion events.
  Shared Daily starts retain their invite attribution, and result paths use
  every audited turn, including Back, when the move audit is complete.
- Simulator proof on iPhone 17 Pro covered the Home entry, real `Pizza` to
  `Italy` creation, preview, native Share sheet, and explicit Start. Final
  automated proof is mobile `210/210`, API `97/97`, pgTAP `42/42`, browser
  share `3/3`, workspace TypeScript, Expo Doctor `18/18`, Docker route smoke
  tests, and a fresh iOS export. The Expo Go tunnel remains available for
  Bo's physical-iPhone smoke test.

- Search-design follow-up: the active-race Search control now expands into an
  integrated header match rail with a full-width article-specific field,
  explicit idle/searching/matched/empty messaging, clear action, `n of total`,
  44-point previous/next controls, and match progress. It does not overlay or
  jump the article. Mobile `197/197`, API `85/85`, workspace TypeScript, Expo
  Doctor `18/18`, and a fresh iOS export pass; the iPhone 17 Pro simulator
  rendered the live matched state and term highlights.
- Brand follow-up: Bo approved the existing WikiRace 1024x1024 PNG from the
  older reference checkout.
  The generic Expo and iOS icon config now use its byte-identical copy (SHA-256
  `41749ee1a3e426464e655abf10d32b1ef2effd989255ccd7a6b8c14ae0e9b503`).
  Expo Go cannot show a project launcher icon; standalone-build icon proof is
  therefore pending the next explicitly approved development/App Store build.

- `133bc5b` fixes the target-to-result handoff: a winning move is finalized
  before Result opens, duplicate target events share one completion, and a
  recorded target move is recovered if completion was interrupted. Official
  Daily Back is hidden in mobile and rejected by the API. Result standings keep
  raw Shortest/Fastest ranks and add `Top N%` only when the server returns the
  eligible field size.
- `34d38bc` moves Search into the active-race header, prevents a new query from
  auto-scrolling, retains explicit next/previous match scrolling, enables
  WebView touch/momentum hints, and ships the approved saved-progress copy.
- `c7d0e04` finalizes Give up before Result, expands win/give-up shares to the
  exact route and natural outcome copy, and adds opaque short HTTPS challenge
  links with a preview-first mobile/web fallback. Link opens, explicit starts,
  and completions use `challenge_link_events`, not leaderboard rows. Public
  link payloads contain no user IDs or session IDs.
- Automated proof: mobile `194/194`, API `85/85`, all workspace typechecks,
  Expo Doctor `17/17`, local Supabase reset, and iOS export pass. Simulator
  proof covers visible header Search, a fast article flick, Give up confirmation,
  stopped result time, non-ranked replay result, target display, and Share.
- Hosted proof is complete for the percentile/short-link migrations, public
  preview, explicit Start, one-attempt resume, web fallback, and route-specific
  share metadata. Result-share formatting remains covered by automated win and
  give-up tests; the native Share sheet is visibly proven with a live private
  challenge link.
- App-icon source identification is complete. Do not substitute a different
  logo or regenerate this approved asset without a new explicit approval.

## Fix before the next friend test

1. **Finish the official race at the target.** Reproduce the path ending at the
   target article. The target tap should complete the official attempt, stop
   active timing, and open the result screen with raw rank, percentile (when
   available), clicks, time, and a share action. Add a regression test for the
   exact target-article transition.
2. **Remove article Back from an official Daily race.** Keep the exit control
   available for an intentional abandon flow, but do not offer a way to reverse
   a ranked path. Practice and private games can keep Back if their rules allow
   it.
3. **Make search a first-class race control.** Put a clear search field or
   search button in the active-race header. Keep the find field open while the
   user scans and make the result list easy to flick through without jumping
   the article unexpectedly.
4. **Improve fast scrolling.** Audit the WebView/article shell for touch,
   momentum, nested-scroll, and overlay behavior. The goal is quick scanning
   during a race, not a slow reading experience.
5. **Rewrite the path-status copy.** Replace “Your current path is saved on the
   server at 2 articles” with: “2 articles so far · Your progress is saved.”
   Keep the copy short and concrete throughout the race and result screens.

## Next product slice

6. **Private games: implemented.** A user can choose a start article and
   target article, create a private game, preview it, and share a deep link with
   friends. Private games allow Back, do not affect Official Daily statistics,
   and use challenge-specific results rather than the Daily leaderboard.
7. **Give up.** The current race surface has a Give up control, but verify the
   full flow on-device: confirmation, active-timer stop, result state, and
   shareable outcome. Keep “Give up” separate from the ranked completion path.
8. **Brand asset refresh: implemented.** The approved circular W master now
   generates every mobile/web/PWA derivative and the generic social card through
   a deterministic script. The configured mobile icon and source master remain
   byte-verified; do not substitute the master without explicit approval.
9. **Share the race, not the solution: implemented for the current beta.**
   Native and browser shares include the start and target but never the audited
   article route. Won-result copy may include clicks and active time. Stopped
   copy says where the player stopped and names the target while omitting
   score-like metrics.

   Every share includes a short HTTPS deep link and a simple web fallback with
   an App Store/Expo Go next step. Links are opaque, expose no user or session
   ID, and do not start a ranked attempt until the recipient taps Start. Preview
   metadata and compact copy work when rich previews are unavailable. Direct
   installed-app opening remains the signed-build Universal Link follow-up in
   item 10.

   Viral loop to test: the compact win share separates “I finished
   Skateboarding → Castle.”, `9 clicks · 3:02`, and “Can you beat me?” into
   readable lines, with the safe URL handled separately on iOS. The stopped
   share separates the stopping point and “Can you finish it?” while continuing
   to omit score-like metrics. The generic W preview card now uses the
   cache-distinct `/wikirace-share-card.jpg` path. Track link opens, challenge
   starts, and completions separately from leaderboard data so sharing never
   changes rankings.

10. **Universal Links for a signed build.** Add the iOS Associated Domains
    entitlement and a hosted `apple-app-site-association` file after the Apple
    Team ID and signed standalone build are available. Then verify an HTTPS
    challenge URL opens the installed WikiRace app directly and retains the web
    fallback when the app is absent. Expo Go cannot register or prove this
    app-owned domain capability.

## Design direction

- Use the WikiRace visual language as the reference: stronger hierarchy,
  simpler labels, more visible controls, and less empty white space.
- Check banner contrast on light article pages. Status should remain readable
  without relying on a faint border or a small all-caps badge.
- Keep the official Daily path intentionally one-way. A visible search control,
  clear target state, and a decisive result transition matter more than adding
  chrome.
- Use the App Intents approach only for a small system-facing surface after the
  in-app flow is stable. The first candidates are “Open today's Daily Path” and
  “Start a practice race”; both should open the app at a predictable route.
  Do not mirror every screen as an intent.

## Suggested implementation order

1. Target completion and result/share proof.
2. Official Daily one-way navigation and search placement.
3. Scroll performance and copy pass.
4. Private-game links and rules.
5. Logo asset replacement and the next Expo build.
6. Share/deep-link instrumentation and result-card polish.
7. App Intents/App Shortcuts for the stable flows.

## Acceptance checklist for the next iPhone build

- [x] Canonical source consolidation: reviewed `main` is deployed from the
      renamed `wikirace` repository, and both older reference sources are
      archived with checksum-protected recovery bundles.

- [x] Automated: tapping the target finalizes a Daily exactly once; fresh
      physical-device target-path proof remains pending.
- [x] Results show clicks, active time, raw rank, optional percentile, and Share.
- [x] Official Daily has no article Back action in client or API rules.
- [x] Search is visible before the first tap and remains usable while scanning.
- [x] Simulator: a fast flick advances the article without moving race chrome.
- [x] Simulator: Give up confirms, stops timing, and produces a non-ranked result.
- [x] Hosted: a short private/Daily/Practice link opens the intended preview and
      starts only after Start. Local and hosted migration/API proof pass.
- [x] Hosted: Share sheet uses a live safe challenge link. Result-share tests
      cover spoiler-safe start/target, optional win metrics, and stopped outcome
      copy without a full route; simulator proof covers the native sheet.
- [x] The approved 1024x1024 WikiRace icon is wired into Expo/iOS config and
      byte-verified with a regression test; standalone launcher rendering awaits
      the approved EAS preview build.
- [ ] Signed build: HTTPS challenge links open WikiRace directly through
      Universal Links/AASA. Expo Go uses the playable web fallback instead.
