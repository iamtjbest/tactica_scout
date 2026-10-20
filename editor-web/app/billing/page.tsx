"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Guard from "@/components/Guard";
import { getBilling, startCheckout, verifyPayment, type Billing } from "@/lib/api";

export default function Page() {
  return <Guard><BillingView /></Guard>;
}

function BillingView() {
  const params = useSearchParams();
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    getBilling().then(setB).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Coming back from Paystack. The reference is checked against
  // Paystack server-side; landing on this URL proves nothing on its
  // own, so the plan is only applied if they confirm the money arrived.
  useEffect(() => {
    const ref = params.get("reference") || params.get("trxref");
    if (!ref) return;
    verifyPayment(ref)
      .then((r) => {
        setNote(r.paid
          ? `Payment confirmed. You're on the ${r.plan} plan.`
          : "That payment hasn't gone through yet. If you were charged, it'll land shortly.");
        load();
      })
      .catch((e) => setError(e.message));
  }, [params, load]);

  const buy = async (plan: string) => {
    setBusy(plan); setError(null);
    try {
      const r = await startCheckout(plan);
      // Paystack hosts the card form. Nothing in this app ever sees or
      // stores a card number.
      window.location.href = r.authorization_url;
    } catch (e: any) { setError(e.message); setBusy(null); }
  };

  if (error && !b) return <p className="text-red2 text-sm font-semibold">{error}</p>;
  if (!b) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Billing</h1>
        <p className="text-mt text-sm mt-1">
          Hosting tournaments is free, with no limit. What you pay for is
          generated match graphics.
        </p>
      </div>

      {note && <div className="card"><p className="text-white text-sm">{note}</p></div>}
      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      <div className="card">
        <p className="section-label mb-3">Your plan</p>
        <div className="flex items-baseline gap-3">
          <span className="font-display font-black text-3xl text-volt capitalize">
            {b.plan}
          </span>
          <span className="text-mt text-sm">
            {b.unlimited
              ? "Unlimited images"
              : `${b.remaining} of ${b.image_quota} images left`}
          </span>
        </div>
        {!b.unlimited && b.remaining === 0 && (
          <p className="text-amber text-sm mt-2">
            You&apos;ve used your allowance. Pick a plan below to generate more.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {b.plans.map((p) => (
          <div key={p.id} className="card flex flex-col">
            <p className="text-white font-semibold capitalize">{p.id}</p>
            <p className="font-display font-black text-2xl text-white mt-2">
              ₦{p.naira.toLocaleString()}
            </p>
            <p className="text-mt text-sm mt-1 flex-1">{p.label}</p>
            <button className="btn-volt mt-4" disabled={busy === p.id || b.plan === p.id}
                    onClick={() => buy(p.id)}>
              {b.plan === p.id ? "Current plan"
                : busy === p.id ? "Opening Paystack..."
                : "Choose"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-mt2 text-xs">
        Payment is handled by Paystack on their own page. Card details never
        reach Tactica.
      </p>
    </div>
  );
}
