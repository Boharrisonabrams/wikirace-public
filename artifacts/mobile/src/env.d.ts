/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL: string;
    EXPO_PUBLIC_APPLE_AUTH_ENABLED?: string;
    EXPO_PUBLIC_GOOGLE_AUTH_ENABLED?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    EXPO_PUBLIC_SUPABASE_URL: string;
  }
}
