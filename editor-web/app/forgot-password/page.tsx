"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      setError(err.message || "Failed to send the code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-6 py-14">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/signin" className="font-display font-black text-2xl text-white">
          Scout <span className="text-volt">Editor</span>
        </Link>
        <div>
          <h1 className="font-display font-black text-2xl text-white">Forgot password</h1>
          <p className="text-mt text-sm mt-1">We&apos;ll email you a 6-digit code.</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <label className="block">
            <span className="text-mt text-xs font-semibold uppercase tracking-wide">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="input-select mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-red2 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-volt w-full">
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
        <p className="text-mt text-sm text-center">
          Remembered it? <Link href="/signin" className="text-volt font-semibold">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
