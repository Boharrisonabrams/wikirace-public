import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { ensurePlayerSession } from "./player-session";

const supabaseMocks = vi.hoisted(() => ({ getSupabase: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: supabaseMocks.getSupabase,
}));

describe("web default player client", () => {
  it("uses the app Supabase client when no client is passed", async () => {
    const session = {
      access_token: "access",
      refresh_token: "refresh",
      user: { id: "user-1", is_anonymous: false },
    };
    const signInAnonymously = vi.fn();
    const appClient = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session }, error: null }),
        signInAnonymously,
      },
    } as unknown as SupabaseClient;
    supabaseMocks.getSupabase.mockReset();
    supabaseMocks.getSupabase.mockReturnValue(appClient);

    await expect(ensurePlayerSession()).resolves.toBe(session);
    expect(supabaseMocks.getSupabase).toHaveBeenCalledOnce();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("does not read the app client when a client is passed", async () => {
    const session = {
      access_token: "access",
      refresh_token: "refresh",
      user: { id: "user-2", is_anonymous: false },
    };
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session }, error: null }),
        signInAnonymously: vi.fn(),
      },
    } as unknown as SupabaseClient;
    supabaseMocks.getSupabase.mockReset();

    await expect(ensurePlayerSession(client)).resolves.toBe(session);
    expect(supabaseMocks.getSupabase).not.toHaveBeenCalled();
  });
});
