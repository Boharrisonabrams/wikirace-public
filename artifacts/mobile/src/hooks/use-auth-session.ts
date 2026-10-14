import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { ensurePlayerSession, isGuestUser } from "@/lib/player-session";
import { getSupabase } from "@/lib/supabase";

export function useAuthSession(): {
  bootstrapError: string | null;
  isClaimed: boolean;
  isGuest: boolean;
  loading: boolean;
  retryBootstrap: () => void;
  session: Session | null;
  user: User | null;
} {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  const retryBootstrap = useCallback(() => {
    setBootstrapError(null);
    setLoading(true);
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    async function bootstrap() {
      setBootstrapError(null);
      setLoading(true);
      try {
        const nextSession = await ensurePlayerSession(supabase);
        if (active) setSession(nextSession);
      } catch (error) {
        if (!active) return;
        setSession(null);
        setBootstrapError(
          error instanceof Error
            ? error.message
            : "Guest play is unavailable. Try again, or sign in with email.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) {
        setBootstrapError(null);
        setLoading(false);
      } else {
        void bootstrap();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [bootstrapAttempt]);

  const user = session?.user ?? null;
  const isGuest = isGuestUser(user);

  return {
    bootstrapError,
    isClaimed: user !== null && !isGuest,
    isGuest,
    loading,
    retryBootstrap,
    session,
    user,
  };
}
