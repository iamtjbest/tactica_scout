"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/lib/auth";

/**
 * One account across Scout and the editor, because it is the same
 * Supabase project. Signing up happens in Scout; this is sign-in only,
 * which matches how organisers reach the editor in the first place.
 */
export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="font-display font-black text-2xl text-white">Sign in</h1>
      <p className="text-mt text-sm mt-1">
        Same account as Scout.
      </p>
      <form onSubmit={submit} className="card mt-5 space-y-4">
        <label className="block">
          <span className="text-mt text-xs uppercase tracking-wide">Email</span>
          <input type="email" required className="input-select mt-1"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-mt text-xs uppercase tracking-wide">Password</span>
          <input type="password" required className="input-select mt-1"
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
        <button className="btn-volt w-full" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
