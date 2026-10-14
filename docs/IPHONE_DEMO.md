# WikiRace physical-iPhone demo

This is the shortest local demo path. It uses Expo Go and the configured API
target; hosted Railway/Supabase proof is a separate deployment step and does
not require TestFlight once verified.

## Current known demo baseline

- Branch: `codex/share-private-game-polish` (merged later as PR #2)
- Mobile code commit: `468485c`
- Expo URL: the `exp://...exp.direct` tunnel URL that Metro prints. It changes
  per machine and session, so it is not recorded here.
- Detached Metro session: `wikirace-share-preview`.
  The controller started and rechecked this session on 2026-07-13, and the
  tunnel HTTPS endpoint returned HTTP 200.
- This running tunnel contains the unmerged sharing/private-game branch and its
  final keyboard/share-spacing follow-ups. The app copy updates immediately
  through Metro. The new W link-preview card and suggestions endpoint still
  require a separately approved hosted API deployment.
- Hosted API deployment: a Railway deployment that reported `SUCCESS`.
- Auth path: email/password. New accounts are auto-confirmed in the current
  friend-beta configuration.
- Canonical physical-device command: `pnpm --dir artifacts/mobile demo:iphone` (tunnel mode, without
  Expo MCP). Expo MCP is localhost-only and is not part of the phone runbook.
- Google/Apple: hidden until their hosted providers and public UI flags are
  enabled.

## Distribution status (2026-07-11)

These are four different delivery paths:

1. **Live Expo Go tunnel:** PR #2's mobile branch is available at the Expo URL
   above. It requires Bo's Mac, Metro session, network connection, and Expo Go
   on the phone; it is not a signed standalone build.
2. **Durable browser challenge:** the hosted HTTPS `/challenge/<code>` route
   remains available without Bo's Mac. It is the browser fallback, not an
   installed iOS app.
3. **EAS internal preview:** configured for registered iOS devices, but no EAS
   build exists yet. Linkage to the stable EAS project is verified; there is
   no build ID or install URL to share before the interactive build succeeds.
4. **TestFlight:** not started. No upload, submission, review, or public beta is
   claimed.

The EAS-readiness release gate passes locally on
`codex/wikirace-consolidation`; that does not replace or update the separately
running tunnel baseline. The next controller action is
`eas build --platform ios --profile preview`, followed by Bo entering a fresh
Apple 2FA code. Reuse the remote credentials and registered device; do not
auto-submit.

The Mac must stay awake and online because Expo Go loads from Metro through the
tunnel.

## Open it on iPhone

1. Install/open Expo Go from the App Store.
2. Scan the QR code printed by the Metro session with the Camera app, or enter
   the Expo URL above manually in Expo Go.
3. Create an email/password account or sign in.
4. Start Practice or the daily race.
5. Open Find, search a visible term, advance through matches, and tap a linked
   highlighted match.
6. Confirm official Daily has no article Back. An unranked replay, Practice, or
   private race may show Back according to its rules.
7. Give Up and confirm the timer stops on the non-ranked result. Share requires
   a live HTTPS challenge link and should open the native Share sheet.
8. From Home, choose **Create a private game**, enter two Wikipedia articles,
   create the challenge, and confirm its preview appears before any attempt.
   Share it, then tap **Start** and confirm the private race opens.
9. Open Everyone and Friends leaderboards.

The shared HTTPS URL is playable in its browser fallback. Opening that HTTPS
URL directly in an installed WikiRace app requires a later signed build with
Universal Links; Expo Go cannot register WikiRace's Associated Domains
entitlement.

If Expo Go shows stale UI, force-quit it and scan/open the URL again.

## Operate the demo tunnel

From anywhere inside the repository, resolve the current root first. This works
both before and after the guarded local-root rename:

```sh
# Inspect the detached server and its QR code/logs
tmux capture-pane -pt wikirace-share-preview:0.0 -S -80

# Attach interactively (detach with Ctrl-b, then d)
tmux attach -t wikirace-share-preview

# Start it if no session exists
repo_root=$(git rev-parse --show-toplevel)
tmux new-session -d -s wikirace-share-preview \
  -c "$repo_root/artifacts/mobile" \
  'pnpm demo:iphone'

# Stop it deliberately
tmux send-keys -t wikirace-share-preview C-c
tmux kill-session -t wikirace-share-preview
```

Optional hosted checks after a Railway deploy:

```sh
curl -I http://localhost:8081
curl https://<your-app-host>/api/healthz
```

`pnpm --dir artifacts/mobile demo:iphone` is the canonical physical-iPhone
command. The project targets SDK 54 and the command starts tunnel mode with a
clean Metro cache on port `8081`; it deliberately does
not enable `EXPO_UNSTABLE_MCP_SERVER`, because MCP is localhost-only. For a
simulator/local automation session, run
`pnpm --dir artifacts/mobile start:mcp:localhost` instead.
Port 8081
is intentional. The Expo/EAS project behind the WikiRace display name retains
its stable legacy project ID, avoiding stale-recent-project failures on Bo's
phone.

## Separate follow-ons

- Google needs its Google/Supabase setup, the public Google UI flag, and a
  signed development/standalone callback test.
- Apple needs its Apple/Supabase setup, the public Apple UI flag, and a physical
  iPhone success test.
- Stable distribution without the Mac/tunnel requires the pending EAS internal
  preview or a later TestFlight build. None of those follow-ons block this
  email/password Expo Go demo.
