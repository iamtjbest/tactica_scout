"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resendSignupCode, verifySignupCode } from "@/lib/auth";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get("email") || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await verifySignupCode(email, code);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await resendSignupCode(email);
      setMessage("A new verification code has been sent.");
    } catch (err: any) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-6 py-14">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/signin" className="font-display font-black text-2xl text-white">
          Scout <span className="text-volt">Editor</span>
        </Link>
        <div>
          <h1 className="font-display font-black text-2xl text-white">Verify your email</h1>
          <p className="text-mt text-sm mt-1">
            Enter the 6-digit code sent to {email || "your email"}.
          </p>
        </div>
        <form onSubmit={verify} className="card space-y-4">
          {!emailFromQuery && (
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
          )}
          <label className="block">
            <span className="text-mt text-xs font-semibold uppercase tracking-wide">6-digit code</span>
            <input
              className="input-select mt-1.5 font-mono text-lg tracking-[0.4em] text-center"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </label>
          {error && <p className="text-red2 text-sm">{error}</p>}
          {message && <p className="text-volt2 text-sm">{message}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className="btn-volt w-full">
            {busy ? "Verifying..." : "Verify & continue"}
          </button>
          <button
            type="button"
            className="w-full text-mt2 text-sm hover:text-white transition-colors underline underline-offset-2"
            onClick={resend}
            disabled={busy || !email.trim()}
          >
            Resend code
          </button>
        </form>
        <p className="text-mt text-sm text-center">
          Already verified? <Link href="/signin" className="text-volt font-semibold">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="text-mt text-sm">Loading...</p>}>
      <VerifyForm />
    </Suspense>
  );
}
