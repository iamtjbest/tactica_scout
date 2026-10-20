"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guard from "@/components/Guard";
import { joinWithCode } from "@/lib/api";

export default function Page() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<p className="text-mt text-sm">Loading...</p>}>
      <Guard><Join /></Guard>
    </Suspense>
  );
}

function Join() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; role: string } | null>(null);

  const go = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await joinWithCode(c.trim());
      setDone({ name: r.tournament_name, role: r.role });
      setTimeout(() => router.replace(`/t/${r.tournament_id}`), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // A code in the URL means they followed the owner's link, so just
  // redeem it rather than making them press a button for no reason.
  useEffect(() => {
    const c = params.get("code");
    if (c) go(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center">
        <p className="font-display font-black text-2xl text-white">You&apos;re in</p>
        <p className="text-mt text-sm mt-2">
          {done.name} — you joined as a {done.role}.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-14">
      <h1 className="font-display font-black text-2xl text-white">Join a tournament</h1>
      <p className="text-mt text-sm mt-1">
        Enter the code the organiser gave you.
      </p>
      <div className="card mt-5 space-y-4">
        <input
          className="input-select font-mono text-lg tracking-widest text-center uppercase"
          value={code} placeholder="XXXXXXXX" maxLength={12}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && go(code)}
        />
        {error && <p className="text-red2 text-sm font-semibold">{error}</p>}
        <button className="btn-volt w-full" disabled={busy || !code.trim()}
                onClick={() => go(code)}>
          {busy ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}
