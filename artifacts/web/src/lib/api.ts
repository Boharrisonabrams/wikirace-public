import { getSupabase } from "@/lib/supabase/client";

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // not signed in
  }
  return headers;
}

/** Fetch against /api with the Supabase session token attached. */
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // non-JSON response
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? `Request failed (${response.status})`,
      data?.reason,
    );
  }
  return data as T;
}

export interface GameTimingActionResponse {
  activeTimeMs: number;
  timingActive: boolean;
}

export function transitionGameTiming(body: {
  sessionId: string;
  action: "resume" | "pause" | "heartbeat";
  eventId: string;
}) {
  return api<GameTimingActionResponse>("/game/timing", {
    method: "POST",
    body,
  });
}

export function updateUsername(username: string) {
  return api<{
    profile: {
      username: string;
      displayName: string | null;
      friendCode: string;
      userId: string;
    };
  }>("/profile/me", {
    method: "PATCH",
    body: { username },
  });
}
