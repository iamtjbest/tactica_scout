"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import StatusPill from "@/components/StatusPill";
import CreateWizard from "@/components/CreateWizard";
import { listTournaments, addProof, type Tournament } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function Page() {
  return <Guard><Competitions /></Guard>;
}

/**
 * The dashboard. Everything the organiser has, grouped by where it is
 * in the review process rather than one flat list, because "why can't
 * I add teams yet" is answered by the heading the competition sits
 * under.
 *
 * Order is deliberate: what is live comes first, then what is waiting
 * on us, then what is waiting on them.
 */
const GROUPS: { status: string; title: string; note: string }[] = [
  { status: "approved",    title: "Live on Scout",
    note: "Approved. Fans can see these, and you can edit teams, players and scores." },
  { status: "pending",     title: "Awaiting approval",
    note: "With us for review. Teams and players unlock once it's approved." },
  { status: "rejected",    title: "Needs changes",
    note: "Sent back. Fix what's noted, then submit again." },
  { status: "draft",       title: "Drafts",
    note: "Not submitted yet. Submit when the details and proof are right." },
  { status: "unpublished", title: "Unpublished",
    note: "Pulled from Scout. Nothing is deleted." },
];

function Competitions() {
  const [rows, setRows] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    // rather than swallowed: the competition is created either way.
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
    } else {
      setNotice(
        "Competition created. It's in Drafts below. Submit it for approval, " +
        "and teams and players unlock once an admin approves it."
      );
    }
  };

  const term = q.trim().toLowerCase();
  const visible = (rows || []).filter((t) => t.name.toLowerCase().includes(term));

  if (creating) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display font-black text-2xl text-white mb-6">
          Create a competition
        </h1>
        <CreateWizard defaultEmail={email} onDone={done} onCancel={() => setCreating(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
            My competitions
          </h1>
          <p className="text-mt text-sm mt-1">
            {rows === null
              ? "Loading..."
              : `${rows.length} ${rows.length === 1 ? "competition" : "competitions"}`}
          </p>
        </div>
        <button className="btn-volt shrink-0" onClick={() => { setNotice(null); setCreating(true); }}>
          New competition
        </button>
      </div>

      {notice && (
        <div className="card border-volt/35 bg-volt/[0.04] flex items-start justify-between gap-4">
          <p className="text-white text-sm leading-relaxed">{notice}</p>
          <button onClick={() => setNotice(null)}
                  className="text-mt hover:text-white text-lg leading-none shrink-0"
                  aria-label="Dismiss">
            ×
          </button>
        </div>
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

      {rows !== null && rows.length > 3 && (
        <input className="input-select" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search competitions" />
      )}

      {/* An empty account is not an error. Same treatment as a full one:
          say where they are and what to do next. */}
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

      {GROUPS.map(({ status, title, note }) => {
        const group = visible.filter((t) => t.status === status);
        if (!group.length) return null;
        return (
          <section key={status} className="space-y-2">
            <div className="flex items-baseline gap-3 pt-2">
              <h2 className="section-label">{title}</h2>
              <span className="font-mono text-[11px] text-mt2">{group.length}</span>
            </div>
            <p className="text-mt text-xs -mt-1 mb-3">{note}</p>
            {group.map((t) => <Row key={t.id} t={t} />)}
          </section>
        );
      })}

      {rows !== null && rows.length > 0 && visible.length === 0 && (
        <p className="text-mt text-sm">Nothing matches &ldquo;{q}&rdquo;.</p>
      )}
    </div>
  );
}

function Row({ t }: { t: Tournament }) {
  const role = (t as any)._role;
  return (
    <Link href={`/t/${t.id}`} className="card block hover:border-volt/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{t.name}</p>
          <p className="text-mt text-xs mt-1">
            {t.organizing_body} • {t.country} • {t.format.replace("_", " + ")}
            {role && role !== "owner" ? `  •  you're an ${role}` : ""}
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
  );
}
