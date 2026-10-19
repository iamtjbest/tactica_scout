// lib/supabase.ts — the Supabase browser client.
//
// Auth lives entirely in Supabase: signup, email verification codes,
// sign-in, password reset. The Scout backend on Render never sees a
// password and never sends an email. It only verifies the access token
// this client hands it.
//
// Uses the PUBLISHABLE key (sb_publishable_...), which is safe in a
// browser bundle. The secret key never comes near the frontend.
//
// Created lazily so importing this module during a server render
// doesn't try to touch localStorage.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local"
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // we use 6-digit codes, not magic links
      },
    });
  }
  return _client;
}
