# WikiRace friend-beta plan

Updated: 2026-07-09

Status note for the public export: this plan predates the TestFlight release.
`docs/ai/state.md` records that a TestFlight build was installed and the Daily
challenge loaded from production on a physical iPhone on 2026-07-16. The
per-feature physical-iPhone checks listed as pending below were not
re-recorded after that date.

## Source boundary

WikiRace is the product. The canonical repository (`wikipath` before the
guarded rename, `wikirace` afterward) remains the only writable implementation
source. Keep its Railway deployment, Supabase identity/data model,
`com.boabrams.wikirace` iOS bundle ID (since 2026-07-16; Android keeps
`com.boabrams.wikipath`), and server-authoritative game endpoints.

A private design handoff and two older local checkouts (an earlier WikiRace
implementation and a server-authoritative feature worktree) served as
read-only product references, not merge sources. None of them is part of this
public export.

Port interaction patterns deliberately. Do not port Clerk, the older API or
database, Replit deployment assumptions, or the archived Expo project identity.

## Parity matrix

| Concept                    | Active WikiRace web                                                                      | Active WikiRace native                                                                                                                                                                                                                                                                          | Reference source                                                                                  | Decision                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily/practice             | Complete daily load/resume/result and practice play                                      | Complete daily load/resume/result and practice play                                                                                                                                                                                                                                             | Active web and API                                                                                | Keep both clients on the current API.                                                                                                                                                        |
| Server-authoritative moves | Emits a selected legal link; API validates navigate/back/complete                        | WebView emits a selected legal link; API validates navigate/back/complete                                                                                                                                                                                                                       | Active API `routes/game.ts`                                                                       | Preserve unchanged. Find highlights may reveal or activate a link, but never validate a move locally.                                                                                        |
| Mobile find                | No first-class app control; only browser find                                            | Complete locally: unified bottom-sheet palette (link results + text matches), typed WebView protocol with link inventory/snippets, official-Daily 2-character link gate, empty-query browse in lenient modes, mini-bar match walking with a persistent keyboard, and server-validated link taps | WikiRace `ArticleView*` and game screen; `wikipath-server-auth` `ArticleBrowser.tsx` at `ec67505` | Phase 2 plus the 2026-07-18 unified-search palette are implemented with simulator proof (`docs/ai/evidence/mobile-unified-search/`); physical-iPhone confirmation remains.                   |
| Visual path map            | Scrollable text breadcrumb                                                               | Complete locally: start/current/target transit map, compacted intermediate hops, accessible full route, and horizontal overflow                                                                                                                                                                 | WikiRace `PathMap.tsx` and game screen                                                            | Phase 4 slice 2 implementation and simulator proof are green; physical-iPhone confirmation remains.                                                                                          |
| History/replay             | Missing                                                                                  | Missing                                                                                                                                                                                                                                                                                         | WikiRace `history.tsx`                                                                            | Phase 4.3. Add a user-scoped history read endpoint first; then filters, search, detail, exact-route display, replay, and real challenge sharing.                                             |
| Share-and-challenge        | Complete: creates a server challenge, shares `/challenge/:id`, accepts and shows results | Shares score text only; can play a known friend challenge ID                                                                                                                                                                                                                                    | Active web, `routes/challenge.ts`                                                                 | Phase 4.2: make native sharing create/open the real WikiRace friend challenge and add invite/results deep-link screens.                                                                      |
| Profile/friends            | Complete profile/stats, friend code, request/accept/decline, accepted list               | Missing                                                                                                                                                                                                                                                                                         | Active web, `routes/profile.ts`, `routes/friends.ts`                                              | Phase 4.4: port the canonical feature, not the archived reference repository's device-identity model.                                                                                        |
| Authentication             | Supabase email/password                                                                  | Warm Editorial email/password UI plus gated Supabase Google callback plumbing and native Apple ID-token exchange; intended-route and AsyncStorage restoration retained                                                                                                                          | Expo/Supabase provider docs; WikiRace social buttons only as state/copy reference                 | Phase 3 behavior and Phase 4 visual consistency are locally complete. Disabled providers remain hidden; Google/Apple success still require the documented external setup. Do not port Clerk. |
| Leaderboards               | Daily Everyone/Friends                                                                   | Daily Everyone/Friends                                                                                                                                                                                                                                                                          | Active API/RPC; WikiRace leaderboard presentation                                                 | Keep daily boards. Phase 4.5 adds friend-challenge results and integrates profile/friend flows.                                                                                              |
| Warm Editorial design      | Wikipedia-inspired but colder blue/white tokens                                          | Shared Warm Editorial tokens/fonts cover Home, Rank, navigation, game chrome, path map, article shell, result, login, signup, callback, and shared states                                                                                                                                       | Design handoff; WikiRace `constants/colors.ts`                                                    | The approved core design migration is locally complete. Keep this system as the baseline for new friend-beta surfaces.                                                                       |
| Dark mode                  | Dormant `.dark` variables; no runtime activation and many light literals                 | All current native core screens, article content, controls, loading, empty, success, and error states respond to system appearance                                                                                                                                                              | WikiRace paired tokens and `useColors`                                                            | Core light/dark simulator proof is green. Physical-iPhone confirmation remains before claiming device-level completion.                                                                      |
| Sandbox/testing            | Playwright covers the live web game, but not deterministic find behavior                 | 51 deterministic mobile tests covering theme, result presentation/share copy, game paths, Find/WebView, auth, provider visibility, home modeling, and routing helpers                                                                                                                           | `wikipath-server-auth` local fixture; WikiRace sandbox/find test and TestFlight checklist         | Root TypeScript, Expo Doctor, iOS/web exports, and full visible simulator proof are green; the physical-device matrix remains.                                                               |

## Delivery order

### Phase 2: native find-in-article

Dependencies: current SDK 54 client and server article sanitizer only.

Acceptance:

- Persistent, thumb-reachable find control; focused floating input; clean small-
  iPhone keyboard behavior.
- Literal, case-insensitive highlighting with active/total count, distinct active
  match, previous/next wrapping, and offset scrolling that keeps the active match
  below the overlay.
- Clear zero state, disabled navigation, and close/article-change reset.
- A highlighted term inside `.wiki-link[data-article]` follows the existing
  server-validated move path. Plain-text matches never navigate.
- Typed host-command and WebView-event protocol; no collection of unrelated
  one-off injected scripts.
- Unit coverage for index/wrapping plus a deterministic article fixture covering
  plain text, linked text, zero matches, wrapping, and navigation reset.
- Mobile/root typecheck, mobile tests, Expo Doctor, iOS export, visible simulator
  proof, then physical-iPhone confirmation.

Status: implementation, deterministic coverage, export, and simulator proof are
complete on `2ec2bbe`; the physical-iPhone script below is the remaining proof
layer.

### Phase 3: Google and Apple authentication

Dependencies: Supabase provider configuration, preferred `wikirace://` links,
and the stable legacy `wikipath://` compatibility scheme. Apple capability
proof additionally requires a signed EAS build.

Acceptance:

- Existing email/password flows remain green.
- Google success, cancellation, provider error, callback return, intended-route
  restoration, relaunch restoration, and sign-out all use the existing Supabase
  session.
- Apple uses the official native button and `expo-apple-authentication` when
  available, exchanges its identity token with Supabase, preserves first-login
  name/email, treats cancellation as cancellation, and is hidden when unavailable.
- New provider users receive the same WikiRace profile/stats bootstrap as email
  users; returning identities retain existing data.
- No provider secret or machine-local callback is committed. Dashboard-only work
  is documented as exact screen, field, public/secret classification, value, and
  verification step.
- Expo Go, simulator, physical-device, and EAS/TestFlight proof are reported as
  separate layers.

Status: local implementation is complete. The 27-test mobile suite, root
typecheck, Expo Doctor, iOS/web exports, callback error state, social-button
rendering behind explicit public flags, and Google/Apple cancellation are green.
Disabled providers are hidden from the current email/password demo. Google success is blocked by
the disabled hosted provider and requires a future signed client; Apple success
requires the documented Supabase/Apple configuration and a physical iPhone.
Use `docs/AUTH_PROVIDER_SETUP.md` for the exact dashboard fields and proof
checklist.

### Physical-iPhone find script

Use the current SDK 54 Expo Go tunnel while Metro is running:

1. Force-quit Expo Go, scan/open the current tunnel, and start Practice.
2. Tap the bottom-left find button. Confirm the input focuses and the software
   keyboard leaves the find bar and some article content visible.
3. Search a visible plain-text word. Confirm the counter, yellow matches,
   terracotta active match, next/previous movement, and that the active match is
   never under the bar. Tap the plain match; clicks/path must not change.
4. Search text that appears inside a blue article link. Advance until that linked
   match is active, tap the highlighted letters, and confirm clicks/path advance
   through the normal game move. The query/count must reset on the new article.
5. Search `zzzwikipathnomatch`. Confirm `0`, disabled arrows, the rock/hint, and
   the dimmed article. Press Search/Return again and confirm the bar shakes but
   the game does not move.
6. Close find. Confirm highlights disappear and Back/Give Up still work.

## Phase 4 slices

Do not combine these into one change.

1. **Warm Editorial foundation, Home, and real navigation**
   - Depends on: the working SDK 54 Expo Go baseline.
   - Accept when packaged Libre Caslon/Inter fonts, paired light/dark tokens,
     root navigation, and real Home/Rank tabs use the approved editorial system;
     all daily start/resume/result, auth, refresh, leaderboard, and sign-out
     contracts remain server-authoritative; no dead History/Profile tabs ship.
   - Status: implementation and simulator proof are complete; final commit and
     physical-iPhone refresh remain.

2. **Native visual path map and themed article shell**
   - Depends on: Phase 2 stable Find behavior and slice 1 tokens.
   - Accept when start/current/target are distinct, intermediate hops compact
     without losing the route, horizontal overflow works on small phones,
     Back/Give Up/find remain usable, and WebView chrome/body/link/infobox/find
     colors respond coherently to light and dark mode.
   - Status: implementation, 42-test mobile regression, and live light/dark
     simulator proof are complete. Physical-iPhone refresh remains.

3. **Result, auth, and remaining core-screen consistency**
   - Depends on: slice 1 primitives.
   - Accept when result, login, signup, callback, loading, empty, and error
     states use the shared tokens/fonts with no fixed-light islands or contrast
     failures. Preserve Supabase/provider behavior unchanged.
   - Status: implementation, 51-test regression, iOS/web exports, native share,
     callback recovery, accessibility, Dynamic Type, and light/dark simulator
     proof are complete. Physical-iPhone refresh remains.

4. **Real native share-and-challenge**
   - Depends on: Phase 3 callback/deep-link plumbing; existing challenge API.
   - Accept when sharing a completed run creates or reuses a challenge, emits a
     real invite URL, opens the native invite/results surface, handles signed-out
     recipients, and plays the same server-defined route.

5. **Native history, detail, replay, and sharing**
   - Depends on: a scoped own-session history endpoint and slice 4 sharing.
   - Accept when All/Daily/Practice/Wins filters, article search, empty/error
     states, path detail, replay, and real challenge sharing are complete. A user
     must never read another user's private history.

6. **Native profile and friends**
   - Depends on: Phase 3 authenticated identity; existing profile/friends API.
   - Accept when profile/stats, friend-code copy, request, accept/decline, pending
     states, and accepted-friend list match the working web behavior.

7. **Friends leaderboard and friend-challenge results**
   - Depends on: slices 4 and 6.
   - Accept when daily Friends ranking, challenge entrants/results, current-user
     state, loading/empty/error cases, and navigation between challenge, result,
     profile, and leaderboard are coherent.

8. **Physical-device regression matrix**
   - Depends on: all preceding slices.
   - Accept when clean launch/relaunch, auth providers, daily/practice/friend
     play, find/link/keyboard/scroll, Back/Give Up, share/deep links, history,
     profile/friends, leaderboards, light/dark, offline/error recovery, and small-
     phone layouts pass on the agreed devices with captured failures and builds.

9. **TestFlight build and distribution**
   - Depends on: slice 8 green, Apple identifiers/capabilities configured, and
     signed-build provider proof.
   - Accept when a release EAS build is uploaded, App Store Connect processing
     succeeds, internal testers install it without Expo Go/Metro, the primary
     flow checklist passes, and the friend-beta invitation and rollback/update
     procedure are documented.
