"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithCode } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get("email") || "";

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPasswordWithCode(email, code, password);
      // Verifying the code signs you in, so go straight through.
      router.push("/settings");
    } catch (err: any) {
      setError(err.message || "Failed to reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Set a new password</h1>
        <p className="text-mt text-sm mt-1">
          {email ? `Enter the code we sent to ${email}.` : "Enter the code we sent you."}
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
        <PasswordInput
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={12}
        />
        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        {confirm.length > 0 && confirm !== password && (
          <p className="text-red2 text-[11px]">The two passwords don&apos;t match.</p>
        )}
        {error && <p className="text-red2 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6 || password.length < 12 || password !== confirm}
          className="btn-volt w-full disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Set password"}
        </button>
      </form>
      <p className="text-mt text-sm text-center">
        Need a new code? <Link href="/forgot-password" className="text-volt font-semibold">Request one</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-mt text-sm">Loading...</p>}>
      <ResetForm />
    </Suspense>
  );
}
