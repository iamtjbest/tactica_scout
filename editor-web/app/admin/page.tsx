"use client";
import { useCallback, useEffect, useState } from "react";
import Guard from "@/components/Guard";
import { reviewQueue, reviewTournament } from "@/lib/api";

/**
 * Review queue. Admin-only, and that is enforced by require_admin on
 * the backend: a non-admin loading this page just gets 403s from every
 * call, which is the correct outcome.
 */
export default function Page() {
  return <Guard><Review /></Guard>;
}

function Review() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    reviewQueue("pending")
      .then((d) => { setRows(d.tournaments); setError(null); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, approve: boolean) => {
    setBusy(id); setError(null);
    try {
      await reviewTournament(id, approve, reasons[id]);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (error) {
    return (
      <div className="card border-red2/40">
        <p className="text-red2 text-sm font-semibold">{error}</p>
        <p className="text-mt text-xs mt-1">
          This page is for admins. If that&apos;s not you, there&apos;s nothing here.
        </p>
      </div>
    );
  }
  if (!rows) return <p className="text-mt text-sm">Loading...</p>;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="font-display font-black text-2xl text-white">Review queue</h1>
        <p className="text-mt text-sm mt-1">
          Oldest submission first. Approving puts a tournament on Scout.
        </p>
      </div>

      {rows.length === 0 && <p className="text-mt text-sm">Nothing waiting.</p>}

      {rows.map((t) => (
        <div key={t.id} className="card space-y-3">
          <div>
            <p className="text-white font-semibold">{t.name}</p>
            <p className="text-mt text-xs mt-1">
              {t.organizing_body} • {t.level} • {t.country}
            </p>
            <p className="text-mt2 text-xs mt-1 font-mono">
              {t.start_date} to {t.end_date} • submitted{" "}
              {t.submitted_at ? new Date(t.submitted_at).toLocaleString("en-GB") : "—"}
            </p>
            <p className="text-mt text-xs mt-1">
              {t.readiness?.counts?.teams} teams • {t.readiness?.counts?.fixtures} fixtures
            </p>
          </div>

          <div>
            <p className="section-label mb-2">Proof</p>
            {(t.proofs || []).length === 0 ? (
              <p className="text-mt text-sm">None attached.</p>
            ) : (
              <ul className="space-y-1">
                {t.proofs.map((p: any) => (
                  <li key={p.id} className="text-sm">
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                       className="text-volt2 hover:underline break-all">
                      {p.url}
                    </a>
                    <span className="text-mt text-xs ml-2">{p.type}</span>
                    {p.note && <span className="text-mt text-xs ml-2">{p.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input className="input-select" placeholder="Reason, required to reject"
                 value={reasons[t.id] || ""}
                 onChange={(e) => setReasons({ ...reasons, [t.id]: e.target.value })} />

          <div className="flex gap-3">
            <button className="btn-volt" disabled={busy === t.id}
                    onClick={() => act(t.id, true)}>
              Approve
            </button>
            <button className="text-red2 font-semibold text-sm px-4"
                    disabled={busy === t.id}
                    onClick={() => act(t.id, false)}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
