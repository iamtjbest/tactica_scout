// lib/auth.ts — everything auth, talking straight to Supabase.
//
// The flow:
//   signUpWithEmail()  -> Supabase emails a 6-digit code
//   verifySignupCode() -> code accepted, you now have a session
//   signInWithEmail()  -> straight to a session
//
//   requestPasswordReset() -> Supabase emails a 6-digit code
//   resetPasswordWithCode() -> code accepted + new password set
//
// Supabase stores the session itself and refreshes it in the
// background. Nothing writes a token to localStorage by hand any more,
// so the old `scout_token` key is dead.
import { supabase } from "./supabase";

/** Is there a live session right now? */
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
 * Create the account. Supabase emails a 6-digit code; there's no
 * session until it's verified, so the caller should send the user to
 * /verify next.
 *
 * signup_source lands in raw_user_meta_data, and the database trigger
 * copies it onto the profiles row. referredByTournamentId does the
 * same, for "which league brought this person in".
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
        signup_source: "scout_web",
        ...(opts?.displayName ? { display_name: opts.displayName } : {}),
        ...(opts?.referredByTournamentId
          ? { referred_by_tournament_id: opts.referredByTournamentId }
          : {}),
      },
    },
  });
  if (error) throw new Error(friendly(error.message));
}

/** Confirm the signup code. On success you're signed in. */
export async function verifySignupCode(email: string, code: string): Promise<void> {
  const { error } = await supabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "signup",
  });
  if (error) throw new Error(friendly(error.message));
}

/** Send the signup code again. Supabase enforces a 60s cooldown. */
export async function resendSignupCode(email: string): Promise<void> {
  const { error } = await supabase().auth.resend({
    type: "signup",
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

/** Email a 6-digit reset code. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(
    email.trim().toLowerCase()
  );
  if (error) throw new Error(friendly(error.message));
}

/**
 * Verify the reset code, then set the new password. Two steps: the
 * code gives us a session, and the session is what lets us change the
 * password.
 */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const { error: verifyError } = await supabase().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "recovery",
  });
  if (verifyError) throw new Error(friendly(verifyError.message));

  const { error: updateError } = await supabase().auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw new Error(friendly(updateError.message));
}

/**
 * Supabase's raw messages are written for developers. These are the
 * ones users actually hit.
 */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the code.";
  if (m.includes("user already registered")) return "That email already has an account. Try signing in.";
  if (m.includes("token has expired") || m.includes("otp_expired")) return "That code has expired. Request a new one.";
  if (m.includes("invalid") && m.includes("token")) return "That code isn't right. Check it and try again.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password should be")) return message; // length/strength rules are already clear
  return message;
}
