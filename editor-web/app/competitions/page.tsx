"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import CreateWizard from "@/components/CreateWizard";
import { listTournaments, addProof, type Tournament } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function Home() {
  return <Guard><Competitions /></Guard>;
}

function Competitions() {
  const [rows, setRows] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    listTournaments()
      .then((d) => { setRows(d.tournaments); setError(null); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    // Prefill the contact email with the signed-in account's, since
    // that's right most of the time and still editable.
    supabase().auth.getUser()
      .then(({ data }) => setEmail(data.user?.email || ""))
      .catch(() => {});
  }, [load]);

  const done = async (id: string, proofs: { type: string; url: string; note: string }[]) => {
    // Proof is gathered during the wizard but can only be attached once
    // the tournament exists, so it's saved here. A failure is reported
    // rather than swallowed: the draft is created either way, and they
    // can add proof again from the Proof tab.
    const failed: string[] = [];
    for (const p of proofs) {
      try { await addProof(id, p); } catch { failed.push(p.url); }
    }
    setCreating(false);
    load();
    if (failed.length) {
      setError(
        `Competition created, but ${failed.length} proof(s) didn't save. ` +
        `Add them again from the Proof tab.`
      );
    }
  };

  const filtered = (rows || []).filter((t) =>
    t.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  if (creating) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="font-display font-black text-2xl text-white">
            Create a competition
          </h1>
        </div>
        <CreateWizard defaultEmail={email} onDone={done} onCancel={() => setCreating(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-white">My competitions</h1>
          <p className="text-mt text-sm mt-1">
            {rows === null ? "Loading..." :
             `${rows.length} ${rows.length === 1 ? "competition" : "competitions"}`}
          </p>
        </div>
        <button className="btn-volt shrink-0" onClick={() => setCreating(true)}>
          New competition
        </button>
      </div>

      {rows !== null && rows.length > 3 && (
        <input className="input-select" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search competitions" />
      )}

      {error && (
        <div className="card border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
          <p className="text-mt text-xs mt-1">
            If this says &ldquo;Failed to fetch&rdquo;, the backend is either asleep
            or not reachable from this address. It sleeps when idle and takes
            about a minute to wake.
          </p>
        </div>
      )}

      {/* An empty account is not an error. It gets the same treatment as
          a full one: tell them where they are and what to do next. */}
      {rows !== null && rows.length === 0 && !error && (
        <div className="card">
          <p className="text-white font-semibold">No competitions yet</p>
          <p className="text-mt text-sm mt-1">
            Create one to get started. Hosting is free and unlimited, and
            nothing appears on Scout until it&apos;s approved.
          </p>
          <button className="btn-volt mt-4" onClick={() => setCreating(true)}>
            Create your first competition
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((t) => (
          <Link key={t.id} href={`/t/${t.id}`}
                className="card block hover:border-volt/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{t.name}</p>
                <p className="text-mt text-xs mt-1">
                  {t.organizing_body} • {t.country} • {t.format.replace("_", " + ")}
                  {(t as any)._role && (t as any)._role !== "owner"
                    ? `  •  you're an ${(t as any)._role}` : ""}
                </p>
                <p className="text-mt2 text-xs mt-1 font-mono">
                  {t.start_date} to {t.end_date}
                </p>
              </div>
              <StatusPill status={t.status} />
            </div>
            {t.status === "rejected" && t.rejection_reason && (
              <p className="text-red2 text-xs mt-3 border-t border-bd pt-3">
                {t.rejection_reason}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
