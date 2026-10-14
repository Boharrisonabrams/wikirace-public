import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

export const PLAYER_SESSION_UNAVAILABLE_MESSAGE =
  "Guest play is unavailable. Try again, or sign in with email.";

const playerSessionBootstraps = new WeakMap<SupabaseClient, Promise<Session>>();

export function isGuestUser(user: User | null | undefined): boolean {
  return user?.is_anonymous === true;
}

async function createPlayerSession(client: SupabaseClient): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const { data: anonymousData, error: anonymousError } =
    await client.auth.signInAnonymously();
  if (anonymousError) {
    throw new Error(PLAYER_SESSION_UNAVAILABLE_MESSAGE);
  }
  if (anonymousData.session) return anonymousData.session;

  throw new Error(PLAYER_SESSION_UNAVAILABLE_MESSAGE);
}

export function ensurePlayerSession(client: SupabaseClient): Promise<Session> {
  const activeBootstrap = playerSessionBootstraps.get(client);
  if (activeBootstrap) return activeBootstrap;

  const bootstrap = createPlayerSession(client).finally(() => {
    if (playerSessionBootstraps.get(client) === bootstrap) {
      playerSessionBootstraps.delete(client);
    }
  });
  playerSessionBootstraps.set(client, bootstrap);
  return bootstrap;
}
