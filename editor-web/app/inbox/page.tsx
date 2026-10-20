"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import { getInbox, decideRequest, type Inbox } from "@/lib/api";

export default function Page() {
  return <Guard><InboxScreen /></Guard>;
}

/**
 * Things that arrived, rather than things you went looking for.
 *
 * Two kinds: people asking to help run a competition you own, and the
 * review decision on one you submitted. Both turn up without you doing
 * anything, which is what makes them an inbox rather than a page.
 */
function InboxScreen() {
  const [d, setD] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getInbox().then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (tid: string, reqId: string, approve: boolean) => {
    setBusy(reqId); setError(null);
    try { await decideRequest(tid, reqId, approve); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (error && !d) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        <p className="text-red2 text-sm font-semibold">{error}</p>
      </div>
    );
  }
  if (!d) return <p className="text-mt text-sm p-8">Loading...</p>;

  const nothing = d.requests.length === 0 && d.decisions.length === 0;

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">Inbox</h1>
        <p className="text-mt text-sm mt-1">
          Access requests and review decisions.
        </p>
      </div>

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {nothing && (
        <div className="card">
          <p className="text-white font-semibold">Nothing waiting</p>
          <p className="text-mt text-sm mt-1">
            When someone asks to help run one of your competitions, or we
            make a decision on one you submitted, it shows up here.
          </p>
        </div>
      )}

      {d.requests.length > 0 && (
        <section className="space-y-2">
          <p className="section-label">Asking for access ({d.requests.length})</p>
          {d.requests.map((r: any) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">
                    {r.profiles?.display_name || r.profiles?.email || "Someone"}
                  </p>
                  <p className="text-mt text-xs mt-1">
                    wants to be an {r.role_requested} on{" "}
                    <Link href={`/t/${r.tournament_id}`}
                          className="text-volt hover:underline">
                      {r.tournament_name}
                    </Link>
                  </p>
                  {r.message && (
                    <p className="text-mt text-sm mt-2 border-l-2 border-bd pl-3">
                      {r.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button disabled={busy === r.id}
                          onClick={() => decide(r.tournament_id, r.id, true)}
                          className="bg-volt text-bg font-bold text-sm px-4 py-2 rounded-lg
                                     hover:bg-volt2 transition-colors disabled:opacity-40">
                    Approve
                  </button>
                  <button disabled={busy === r.id}
                          onClick={() => decide(r.tournament_id, r.id, false)}
                          className="text-mt hover:text-red2 text-sm font-semibold
                                     disabled:opacity-40">
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {d.decisions.length > 0 && (
        <section className="space-y-2">
          <p className="section-label">Review decisions</p>
          {d.decisions.map((x) => (
            <Link key={x.tournament_id} href={`/t/${x.tournament_id}`}
                  className="card block hover:border-volt/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{x.tournament_name}</p>
                  <p className="text-mt text-xs mt-1">
                    {x.status === "approved"
                      ? "Approved and live on Scout."
                      : "Sent back for changes."}
                    {x.reviewed_at && ` • ${new Date(x.reviewed_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                  {x.reason && (
                    <p className="text-red2 text-sm mt-2 border-l-2 border-red2/40 pl-3">
                      {x.reason}
                    </p>
                  )}
                </div>
                <StatusPill status={x.status as any} />
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
