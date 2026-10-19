// src/services/supabase.ts — the Supabase client for React Native.
//
// Deliberately separate from the API base URL in api.ts. That one is
// user-editable at runtime (handy for pointing at a laptop over LAN).
// This one is NOT: the publishable key is tied to one Supabase project,
// so letting it be changed at runtime would just break auth.
//
// 'react-native-url-polyfill/auto' has to be the first import. Supabase
// still ships it in their React Native examples, and it costs nothing.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env'
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // No URL to parse on native. We use 6-digit codes, not magic links.
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}
