import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Request } from "express";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars not set — database features will fail");
}
if (!supabaseServiceRoleKey) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set — game writes will fail");
}

/**
 * Per-request client: anon key + the caller's JWT. Reads go through RLS as
 * the user; auth.getUser() validates the token.
 */
export function createSupabaseClient(authHeader?: string): SupabaseClient {
  const options = authHeader
    ? { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    : { auth: { persistSession: false } };
  return createClient(supabaseUrl, supabaseAnonKey, options);
}

let serviceClient: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS. The ONLY writer for game_sessions,
 * game_moves, daily_challenges, friend_challenges and user_stats — the game
 * is server-authoritative and clients have no write policies on those tables.
 */
export function createServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

/**
 * Resolve the authenticated user from the request's Authorization header.
 * Returns null when missing/invalid.
 */
export async function getRequestUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const supabase = createSupabaseClient(authHeader);
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}
