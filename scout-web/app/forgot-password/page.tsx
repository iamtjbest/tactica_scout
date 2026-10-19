"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <div className="max-w-sm mx-auto mt-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Forgot password</h1>
        <p className="text-mt text-sm mt-1">We&apos;ll email you a 6-digit code.</p>
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
        {error && <p className="text-red2 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-volt w-full">
          {loading ? "Sending..." : "Send code"}
        </button>
      </form>
      <p className="text-mt text-sm text-center">
        Remembered it? <Link href="/signin" className="text-volt font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
