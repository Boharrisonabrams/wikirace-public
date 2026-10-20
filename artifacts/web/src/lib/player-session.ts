import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ensurePlayerSession as ensureSharedPlayerSession } from "@workspace/game-client";

import { getSupabase } from "@/lib/supabase/client";

export {
  PLAYER_SESSION_UNAVAILABLE_MESSAGE,
  isGuestUser,
} from "@workspace/game-client";

export function ensurePlayerSession(
  client: SupabaseClient = getSupabase(),
): Promise<Session> {
  return ensureSharedPlayerSession(client);
}
