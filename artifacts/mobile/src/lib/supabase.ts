import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

function getNativeAuthStorage(): AsyncStorageStatic | undefined {
  if (Platform.OS === 'web') {
    return undefined;
  }

  return require('@react-native-async-storage/async-storage').default as AsyncStorageStatic;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Missing Supabase Expo environment variables');
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: getNativeAuthStorage() } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabase;
}
