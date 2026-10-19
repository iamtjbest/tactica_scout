"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resendSignupCode, verifySignupCode } from "@/lib/auth";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get("email") || "";

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Supabase enforces a 60s gap between code requests, so the button
  // is disabled rather than letting the user hit a rate-limit error.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await verifySignupCode(email, code);
      router.push("/settings");
    } catch (err: any) {
      setError(err.message || "Failed to verify.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      await resendSignupCode(email);
      setNotice("New code sent. Check your inbox.");
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to resend.");
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Check your email</h1>
        <p className="text-mt text-sm mt-1">
          {email ? `We sent a 6-digit code to ${email}.` : "Enter the 6-digit code we sent you."}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {!emailFromQuery && (
          <div>
            <label className="text-mt text-xs font-semibold uppercase tracking-wide">Email</label>
            <input
              type="email"
              className="input-select mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label className="text-mt text-xs font-semibold uppercase tracking-wide">Code</label>
          <input
            className="input-select mt-1 tracking-[0.5em] text-center text-lg"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
          />
          <p className="text-mt text-[11px] mt-1">Expires in 15 minutes.</p>
        </div>
        {error && <p className="text-red2 text-sm">{error}</p>}
        {notice && <p className="text-volt text-sm">{notice}</p>}
        <button type="submit" disabled={loading || code.length !== 6} className="btn-volt w-full">
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
      <div className="text-center space-y-2">
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || !email}
          className="text-mt text-sm disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <p className="text-mt text-sm">
          Wrong email? <Link href="/signup" className="text-volt font-semibold">Start over</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<p className="text-mt text-sm">Loading...</p>}>
      <VerifyForm />
    </Suspense>
  );
}
