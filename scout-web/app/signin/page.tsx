"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await signIn(username, password);
      window.localStorage.setItem("scout_token", token);
      router.push("/settings");
    } catch (err: any) {
      setError(err.message || "Failed to sign in.");
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
          <label className="text-mt text-xs font-semibold uppercase tracking-wide">Username</label>
          <input className="input-select mt-1" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="text-mt text-xs font-semibold uppercase tracking-wide">Password</label>
          <input type="password" className="input-select mt-1" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-red2 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-volt w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-mt text-sm text-center">
        No account? <Link href="/signup" className="text-volt font-semibold">Sign up</Link>
      </p>
    </div>
  );
}
