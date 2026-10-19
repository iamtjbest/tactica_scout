"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmail } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      // Supabase stores the session itself; nothing to stash by hand.
      router.push("/settings");
    } catch (err: any) {
      const msg = err.message || "Failed to sign in.";
      setError(msg);
      // Unverified account: send them to finish, don't dead-end them.
      if (msg.toLowerCase().includes("confirm your email")) {
        router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Sign in</h1>
        <p className="text-mt text-sm mt-1">Welcome back.</p>
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
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && <p className="text-red2 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-volt w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="text-center space-y-2">
        <p className="text-mt text-sm">
          <Link href="/forgot-password" className="text-volt font-semibold">Forgot password?</Link>
        </p>
        <p className="text-mt text-sm">
          No account? <Link href="/signup" className="text-volt font-semibold">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
