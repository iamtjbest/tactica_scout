"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PitchAnimation from "@/components/PitchAnimation";
import { signInWithEmail } from "@/lib/auth";

/**
 * Split sign-in: form on the left, a looping passing move on the right.
 *
 * The animation is hidden below `lg`. On a phone it would push the
 * form below the fold, and the form is the only thing anyone came
 * here to use.
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
      router.replace("/competitions");
    } catch (err: any) {
      setError(err.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 grid lg:grid-cols-2">
      {/* form */}
      <div className="flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-sm">
          <p className="font-display font-black text-2xl text-white">
            Scout <span className="text-volt">Editor</span>
          </p>
          <h1 className="font-display font-black text-3xl text-white mt-8">
            Run your competition
          </h1>
          <p className="text-mt text-sm mt-2">
            Fixtures, live scores and tables, published to Scout. Sign in with
            your Scout account.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-mt text-xs uppercase tracking-wide">Email</span>
              <input type="email" required autoComplete="email" className="input-select mt-1"
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-mt text-xs uppercase tracking-wide">Password</span>
              <input type="password" required autoComplete="current-password"
                     className="input-select mt-1"
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

            <button className="btn-volt w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-mt2 text-xs mt-6">
            One account works across Scout and the editor. If someone sent you
            a join code, sign in first, then open the link they gave you.
          </p>
        </div>
      </div>

      {/* animation, large screens only */}
      <div className="hidden lg:block relative border-l border-bd">
        <PitchAnimation />
        <div className="absolute bottom-10 left-10 right-10 pointer-events-none">
          <p className="font-display font-black text-xl text-white">
            Every pass, every goal, on the record.
          </p>
          <p className="text-mt text-sm mt-1">
            Local competitions, tracked like the big ones.
          </p>
        </div>
      </div>
    </div>
  );
}
