"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import StadiumArt from "@/components/StadiumArt";
import { signInWithEmail } from "@/lib/auth";

/**
 * Split sign-in: form on the left, the visual on the right.
 *
 * The previous version used `fixed inset-0` with a centred, scrolling
 * column. On a laptop that is not tall, centring inside a fixed box
 * pushes the top of the form out of reach and clips the button off the
 * bottom, which is exactly what happened. This one is an ordinary
 * `min-h-screen` grid: the page scrolls normally, so nothing can ever
 * be cut off whatever the window height.
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
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] bg-bg">
      {/* ── form ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center px-6 py-14 sm:py-16">
        <div className="w-full max-w-sm">
          <a href="/" className="font-display font-black text-2xl text-white inline-block">
            Scout <span className="text-volt">Editor</span>
          </a>

          <h1 className="font-display font-black text-3xl text-white mt-10 leading-tight">
            Run your competition
          </h1>
          <p className="text-mt text-sm mt-2 leading-relaxed">
            Fixtures, live scores and tables, published to Scout. Sign in with
            your Scout account.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-mt text-xs uppercase tracking-wide">Email</span>
              <input type="email" required autoComplete="email" className="input-select mt-1.5"
                     value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-mt text-xs uppercase tracking-wide">Password</span>
              <input type="password" required autoComplete="current-password"
                     className="input-select mt-1.5"
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            {error && (
              <p className="text-red2 text-sm font-semibold bg-red2/10 border border-red2/30
                            rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button className="btn-volt w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-mt2 text-xs mt-7 leading-relaxed">
            One account works across Scout and the editor. If someone sent you
            a join code, sign in first, then open the link they gave you.
          </p>
        </div>
      </div>

      {/* ── visual, large screens only ────────────────────────── */}
      <div className="hidden lg:block relative border-l border-bd overflow-hidden">
        <StadiumArt />

        <div className="absolute bottom-12 left-12 right-12 pointer-events-none">
          <p className="font-display font-black text-[27px] text-white leading-[1.15]">
            Every pass, every goal,
            <br />
            on the record.
          </p>
          <p className="text-mt text-sm mt-3">
            Local competitions, tracked like the big ones.
          </p>
        </div>
      </div>
    </div>
  );
}
