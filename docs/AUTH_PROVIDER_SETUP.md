# WikiRace social-auth provider setup

Local implementation is complete on Expo SDK 54. Provider secrets stay in the
Google and Supabase dashboards; none belong in this repository or in an
`EXPO_PUBLIC_*` variable.

## Current proof boundary

- The current playable demo renders only email/password. Google and Apple are
  hidden because both hosted providers are disabled and their public app flags
  default to `false`; testers are not offered dead-end controls.
- With each provider configured and its flag enabled, prior simulator proof
  confirms Google and Apple cancellation return to the form without an error.
- The Apple button opens the native Apple sheet in Expo Go. The simulator has no
  Apple Account, so success must be checked on a physical iPhone.
- Google currently reaches the hosted Supabase project, which responds with
  `400 validation_failed: Unsupported provider: provider is not enabled`.
- Google OAuth success must be checked in a future signed development or
  standalone build. Expo's current guidance does not support using Expo Go as
  the proof environment for an app-owned OAuth/OIDC callback scheme. EAS
  profiles exist in `artifacts/mobile/eas.json`, but no successful signed build
  exists yet, so that proof remains pending.

Public identifiers used below (`<project-ref>` is your Supabase project ref):

- Supabase project ref: `<project-ref>`
- Supabase OAuth callback:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- iOS bundle identifier: `com.boabrams.wikirace` (since 2026-07-16)
- Preferred app callback: `wikirace://auth/callback`
- Stable legacy callback accepted for compatibility:
  `wikipath://auth/callback`

Public UI flags are separate from provider secrets:

```dotenv
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=false
EXPO_PUBLIC_APPLE_AUTH_ENABLED=false
```

Leave each flag `false` until its corresponding Google/Apple and Supabase setup
below is complete. Then change only that provider's flag to `true` in the local
or build environment and restart Metro/build the client. These flags expose
already-implemented controls; they do not configure or secure a provider.

Keep every still-used web URL in the Supabase allow list. Add the scoped mobile
value; do not replace the current entries. Confirm the pattern in Supabase's
Redirect URL Glob Tester before inviting testers.

## Google

| Dashboard            | Screen                                | Field                         | Exact value                                                                                                    | Sensitivity                  | Verify                                                                                                              |
| -------------------- | ------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Google Auth Platform | Branding                              | App name/support details      | WikiRace and Bo-controlled support details                                                                     | Public                       | Google consent shows WikiRace rather than a raw project name.                                                       |
| Google Auth Platform | Audience                              | User type/test users          | External; add each beta tester while the app remains in testing                                                | Public account configuration | A listed tester reaches consent without `access_denied`.                                                            |
| Google Auth Platform | Data Access                           | Scopes                        | `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile` | Public                       | All three appear in configured scopes.                                                                              |
| Google Auth Platform | Clients                               | Application type              | Web application                                                                                                | Public                       | A Web client ID and client secret are created.                                                                      |
| Google Auth Platform | Web client                            | Authorized JavaScript origins | `https://<your-app-host>` plus only still-used web origins                                  | Public                       | The Railway origin is present without a path; stale preview origins are removed deliberately.                       |
| Google Auth Platform | Web client                            | Authorized redirect URIs      | `https://<project-ref>.supabase.co/auth/v1/callback`                                                    | Public                       | Google saves the URI without a mismatch warning. Do not enter either app callback scheme here.                      |
| Supabase             | Authentication -> Providers -> Google | Enable                        | On                                                                                                             | Public configuration         | The observed `provider is not enabled` response disappears.                                                         |
| Supabase             | Authentication -> Providers -> Google | Client ID                     | Google Web client ID                                                                                           | Public identifier            | Starting Google auth reaches Google's consent page.                                                                 |
| Supabase             | Authentication -> Providers -> Google | Client secret                 | Google Web client secret                                                                                       | **Secret**                   | Enter only in Supabase; never paste it into chat or the app env file.                                               |
| Supabase             | Authentication -> URL Configuration   | Redirect URLs                 | `wikirace://auth/callback**` and `wikipath://auth/callback**`                                                  | Public                       | Both scoped patterns pass the Glob Tester; new transactions prefer WikiRace and legacy links remain valid.          |

Verification after configuration:

1. Set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`, then restart Metro or build the
   client so the Google control is present.
2. After a future signed development or standalone client containing both
   schemes has been created and installed, launch it with
   `wikirace://auth/callback`, then repeat with the stable legacy
   `wikipath://auth/callback`; confirm the callback screen opens for both.
3. Open `/login?next=%2Fgame%3Ftype%3Dpractice` and continue with Google.
4. Confirm success returns to Practice, not merely Home.
5. Repeat once with the app warm and once after force-quitting it so both warm
   and cold callback delivery restore the intended route.
6. Deny consent at Google and confirm the provider error returns to WikiRace
   without creating a session; cancel the browser and confirm cancellation is
   silent.
7. Force-quit/relaunch; the Supabase session must restore without another login.
8. Sign out; relaunch must stay signed out. Re-opening the prior callback must
   recreate a real session rather than reporting a cached success.
9. For a genuinely new account, confirm `/profile/me` succeeds and the Supabase
   `profiles` and `user_stats` tables each contain that user's trigger-created
   row. Do not manually insert test rows.

## Apple

| Dashboard       | Screen                                                         | Field               | Exact value                                    | Sensitivity              | Verify                                                                                                                                    |
| --------------- | -------------------------------------------------------------- | ------------------- | ---------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer | Certificates, Identifiers & Profiles -> Identifiers -> App IDs | Bundle ID           | `com.boabrams.wikirace`                        | Public                   | The explicit App ID exists (since 2026-07-16).                                                                                            |
| Apple Developer | App ID capabilities                                            | Sign in with Apple  | Enabled                                        | Public configuration     | The capability is checked for the App ID.                                                                                                 |
| Supabase        | Authentication -> Providers -> Apple                           | Enable              | On                                             | Public configuration     | Supabase accepts an Apple ID token instead of returning an unsupported-provider error.                                                    |
| Supabase        | Authentication -> Providers -> Apple                           | Client IDs          | `host.exp.Exponent,com.boabrams.wikirace`      | Public identifiers       | Expo Go physical-device tokens and signed WikiRace tokens are both accepted. `com.boabrams.wikirace` is the iOS app ID since 2026-07-16; remove `host.exp.Exponent` after Expo Go testing if desired. |
| Supabase        | Authentication -> Providers -> Apple                           | OAuth secret fields | Leave blank for this native-only ID-token flow | **Secret if later used** | Native Apple sign-in works without a Services ID, `.p8` key, or six-month OAuth secret rotation.                                          |

If a future development or preview build uses a bundle suffix, add that exact
bundle identifier to the Supabase Apple Client IDs before testing it. A token
issued for an unlisted bundle audience will be rejected even if the production
bundle ID is already configured.

Verification after configuration:

1. Set `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true`, restart Metro, and confirm the
   official Apple control appears only on supported iOS devices.
2. On a physical iPhone signed into an Apple Account, open the SDK 54 Expo Go
   tunnel and tap Continue with Apple. Confirm cancel is silent, then complete a
   sign-in.
3. On first authorization, choose/share a name and confirm both Supabase user
   metadata and `profiles.display_name` receive it. Repeated authorization may
   return no name; that is expected.
4. Confirm the new user's `profiles` and `user_stats` rows exist, play a race,
   sign out, relaunch, sign back in, and confirm the same data remains.
5. Treat this only as Expo Go proof. The Apple subject/identifier can differ in
   the signed bundle.
6. For EAS/TestFlight, make a new native build after the App ID capability is
   enabled. Confirm the built entitlements contain
   `com.apple.developer.applesignin`, then repeat sign-in with
   `com.boabrams.wikirace` as the token audience.

## Email/password regression

Email/password remains enabled. For the current friend beta, keep Supabase
Authentication -> Sign In / Up -> Email -> **Confirm email OFF**, matching
`docs/DEPLOY.md`; friends should receive a session immediately after sign-up.
Verify that dashboard setting before invitations go out.

The sign-up call still supplies a mobile callback defensively. If confirmation
is turned on later, keep the default `{{ .ConfirmationURL }}` email-template
behavior and verify it in a signed build where both
`wikirace://auth/callback**` and the stable legacy
`wikipath://auth/callback**` URLs are allowlisted. Do not enable confirmation for
the current Expo Go beta: Expo Go generates a tunnel-specific `exp://` callback,
and this repo intentionally does not commit that ephemeral hostname. Either add
the currently generated Expo Go callback temporarily in the dashboard for a
one-off test or require the future signed build. A custom `token_hash` template
would also require new callback code and is not supported by this implementation.

## Official references

- [Expo OAuth/OIDC authentication](https://docs.expo.dev/guides/authentication/)
- [Expo SDK 54 AuthSession](https://docs.expo.dev/versions/v54.0.0/sdk/auth-session/)
- [Expo SDK 54 Apple Authentication](https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/)
- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase Google auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Apple auth](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
