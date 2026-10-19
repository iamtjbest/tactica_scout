"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpWithEmail } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, { displayName: displayName.trim() || undefined });
      // No session yet — Supabase has emailed a code. Carry the email
      // through so /verify doesn't have to ask for it again.
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Sign up</h1>
        <p className="text-mt text-sm mt-1">Create an account to follow teams.</p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="text-mt text-xs font-semibold uppercase tracking-wide">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="input-select mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-mt text-xs font-semibold uppercase tracking-wide">Name</label>
          <input
            className="input-select mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={12}
        />
        {error && <p className="text-red2 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length < 12 || !email.trim()}
          className="btn-volt w-full disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="text-mt text-sm text-center">
        Already have an account? <Link href="/signin" className="text-volt font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
