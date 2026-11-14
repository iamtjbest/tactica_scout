"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StadiumArt from "@/components/StadiumArt";
import PasswordInput from "@/components/PasswordInput";
import { resendSignupCode, signUpWithEmail, verifySignupCode } from "@/lib/auth";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyStep, setVerifyStep] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await signUpWithEmail(email.trim(), password, { displayName: name.trim() });
      setVerifyStep(true);
    } catch (err: any) {
      setError(err.message || "Could not create your account.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await verifySignupCode(email.trim(), code.trim());
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);

    try {
      await resendSignupCode(email.trim());
      setError(null);
    } catch (err: any) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] bg-bg">
      <div className="flex items-center justify-center px-6 py-14 sm:py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-display font-black text-2xl text-white inline-block">
            Scout <span className="text-volt">Editor</span>
          </Link>

          <h1 className="font-display font-black text-3xl text-white mt-10 leading-tight">
            {verifyStep ? "Verify your email" : "Create your account"}
          </h1>
          <p className="text-mt text-sm mt-2 leading-relaxed">
            {verifyStep
              ? "We sent a 6-digit code to your email. Enter it to finish creating your account."
              : "Register to organise local competitions, run fixtures and publish them to Scout."}
          </p>

          {!verifyStep ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-mt text-xs uppercase tracking-wide">Full name</span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  className="input-select mt-1.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-mt text-xs uppercase tracking-wide">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="input-select mt-1.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />

              <label className="block">
                <span className="text-mt text-xs uppercase tracking-wide">Confirm password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  className="input-select mt-1.5"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>

              {error && (
                <p className="text-red2 text-sm font-semibold bg-red2/10 border border-red2/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button className="btn-volt w-full" disabled={busy}>
                {busy ? "Creating account..." : "Create account"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-mt text-xs uppercase tracking-wide">6-digit code</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input-select mt-1.5 font-mono text-lg tracking-[0.4em] text-center"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>

              {error && (
                <p className="text-red2 text-sm font-semibold bg-red2/10 border border-red2/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button className="btn-volt w-full" disabled={busy || code.length !== 6}>
                {busy ? "Verifying..." : "Verify & continue"}
              </button>

              <button
                type="button"
                className="text-mt2 text-sm hover:text-white transition-colors underline underline-offset-2"
                onClick={resend}
                disabled={busy}
              >
                Resend code
              </button>
            </form>
          )}

          <p className="text-mt2 text-xs mt-7 leading-relaxed">
            Already have an account? {" "}
            <Link href="/signin" className="text-volt hover:text-volt2 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block relative border-l border-bd overflow-hidden">
        <StadiumArt />

        <div className="absolute bottom-12 left-12 right-12 pointer-events-none">
          <p className="font-display font-black text-[27px] text-white leading-[1.15]">
            Build the competition,
            <br />
            publish it to Scout.
          </p>
          <p className="text-mt text-sm mt-3">
            Local clubs, school cups, league weekends, and everything in between.
          </p>
        </div>
      </div>
    </div>
  );
}
