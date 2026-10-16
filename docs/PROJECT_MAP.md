# WikiRace project map

Updated: 2026-07-12 (identifiers replaced with placeholders for the public export)

This is the operator source of truth for names, deployables, stable
infrastructure identities, and proof boundaries.

## Canonical names

| Layer | Current / stable value | Rule |
| --- | --- | --- |
| Product | **WikiRace** | Use in public copy and display metadata. |
| GitHub source | `wikirace` (renamed from `wikipath` on 2026-07-12) | Canonical deployable history. |
| Reference source | An older, separate WikiRace implementation, archived | Archive only; never deploy or merge wholesale. |

An earlier server-authoritative feature worktree was preserved as reference
work and is not merged into `main`.

## Deployable source

| Deployable | Path | Identity / destination |
| --- | --- | --- |
| Native app | `artifacts/mobile` | Expo/EAS |
| Browser app | `artifacts/web` | Built into the Railway container |
| API and static host | `artifacts/api-server` | Railway |

Only these packages are deployable source. Archived checkouts, recovery
bundles, Replit and Vercel files, and migration backups are references or
history, and none of them ship in this public export.

## Stable legacy infrastructure IDs

The private deployment keeps these identifiers exact. The public export
replaces account-specific values with placeholders.

| System | Value in this export | Why it remains stable |
| --- | --- | --- |
| Railway production URL | Set through `PUBLIC_APP_URL` (placeholder `https://wikirace.example.com`) | Existing auth settings and shared challenge links depend on the production host. |
| Railway service label | `wikipath` | This legacy display label may be renamed later without replacing the service. |
| Supabase project | `<project-ref>` | Changing it would select a different backend project. |
| EAS project ID | Set through `EAS_PROJECT_ID` in `artifacts/mobile/app.config.ts` (placeholder all-zero UUID) | Builds, updates, and credentials stay attached to one EAS project. |
| iOS bundle ID | `com.boabrams.wikirace` | Since 2026-07-16. The original `com.boabrams.wikipath` is permanently held by a removed App Store Connect record and can never back a new app; do not switch back. |
| Android package | `com.boabrams.wikipath` | Changing it creates a different Android app identity. |
| Legacy app scheme | `wikipath://` | Existing callbacks and links remain compatible. |

The public name is WikiRace and new native links use `wikirace://`. A retained
`wikipath` string in the table above is an intentional stable legacy identifier,
not an incomplete public rebrand. Historical migration names, persisted storage
keys, reminder ownership IDs, analytics values, and database objects remain
unchanged unless a separately approved migration names them explicitly.

## Proof boundaries

Keep these claims separate:

1. Local tests/builds prove the checkout.
2. A local Docker route smoke proves one-container wiring.
3. `railway up` plus production route checks proves the hosted deployment.
4. Expo Go proves a Metro-served developer session, not a signed app.
5. An EAS preview build proves an installable internal binary, not TestFlight.
6. TestFlight is proven only after App Store Connect processing and device
   installation.

## Rename record

The guarded rename from `wikipath` to `wikirace` finished on 2026-07-12. It ran
in gates: verify recovery bundles for the dirty reference checkouts, archive the
older reference repository, rename the canonical GitHub repository, resolve
worktrees, move the local root last, then verify Railway, Supabase, and EAS
identities without renaming any stable ID. After the rename, `main` was
pushed and a Railway deployment reached `SUCCESS`. The step-by-step procedure was
specific to one machine, so it is not part of this public export.
