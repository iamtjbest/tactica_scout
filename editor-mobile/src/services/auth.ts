// src/services/auth.ts — everything auth, talking straight to Supabase.
//
// Mirrors scout-web's lib/auth.ts so the two apps behave identically.
// The only difference is signup_source, which is how we tell later which
// app actually brought someone in.
//
// The backend never sees a password and never sends an email. Supabase
// stores the session in AsyncStorage and refreshes it in the background,
// so nothing here writes a token by hand. The old `scout_token` key is
// dead.
import { supabase } from './supabase';

export async function isSignedIn(): Promise<boolean> {
  try {
    const { data } = await supabase().auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/** Bearer header for calls to the Scout backend. Empty when signed out. */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Create the account. Supabase emails a 6-digit code; there's no session
 * until it's verified, so send the user to the Verify screen next.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  opts?: { displayName?: string; referredByTournamentId?: string }
): Promise<void> {
  const { error } = await supabase().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        signup_source: 'scout_mobile',
        ...(opts?.displayName ? { display_name: opts.displayName } : {}),
        ...(opts?.referredByTournamentId
          ? { referred_by_tournament_id: opts.referredByTournamentId }
          : {}),
      },
    },
  });
  if (error) throw new Error(friendly(error.message));
}

export async function verifySignupCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'signup',
  });
  if (error) throw new Error(friendly(error.message));
}

/** Supabase enforces a 60s gap between code requests. */
export async function resendSignupCode(email: string): Promise<void> {
  const { error } = await supabase().auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(friendly(error.message));
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(friendly(error.message));
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(
    email.trim().toLowerCase()
  );
  if (error) throw new Error(friendly(error.message));
}

/**
 * Verify the reset code, then set the new password. Two steps: the code
 * gives us a session, and the session is what lets us change it.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const { error: verifyError } = await supabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'recovery',
  });
  if (verifyError) throw new Error(friendly(verifyError.message));

  const { error: updateError } = await supabase().auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw new Error(friendly(updateError.message));
}

/** Supabase's raw messages are written for developers, not users. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the code.';
  if (m.includes('user already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('token has expired') || m.includes('otp_expired')) return 'That code has expired. Request a new one.';
  if (m.includes('invalid') && m.includes('token')) return "That code isn't right. Check it and try again.";
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  if (m.includes('password should be')) return message;
  return message;
}
