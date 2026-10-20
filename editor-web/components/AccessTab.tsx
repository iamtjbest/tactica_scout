"use client";
import { useCallback, useEffect, useState } from "react";
import {
  listMembers, listInvites, createInvite, revokeInvite,
  removeMember, listRequests, decideRequest,
  type Member, type Invite, type AccessRequest, type TRole,
} from "@/lib/api";

const ROLE_HELP: Record<TRole, string> = {
  owner:  "Runs the tournament: teams, players, fixtures, people, submitting",
  editor: "Match details only: score, goalscorers, assists, cards, subs",
};

/**
 * Who can work on this tournament.
 *
 * The invite code is first because it's the case that actually
 * happens: the owner is standing with their commissioners before
 * kickoff and reads a code out. Access requests sit underneath for
 * when they're not in the same place.
 */
export default function AccessTab({ tid, isOwner }: { tid: string; isOwner: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<TRole>("editor");

  const load = useCallback(() => {
    listMembers(tid).then((d) => setMembers(d.members)).catch((e) => setError(e.message));
    if (isOwner) {
      listInvites(tid).then((d) => setInvites(d.invites)).catch(() => {});
      listRequests(tid).then((d) => setRequests(d.requests)).catch(() => {});
    }
  }, [tid, isOwner]);

  useEffect(() => { load(); }, [load]);

  const make = async () => {
    setBusy(true); setError(null);
    try { await createInvite(tid, { role: newRole }); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard is blocked on insecure origins and in some mobile
      // browsers. The code is on screen either way, which is how it
      // gets read out at a pitch anyway.
      setError("Couldn't copy. The code is on screen, read it out.");
    }
  };

  const live = invites.filter((i) => !i.revoked);

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="section-label mb-2">Why this exists</p>
        <p className="text-mt text-sm">
          Three matches can be going at once and one person can&apos;t key in all
          of them. Give each match commissioner access and they update their
          own pitch.
        </p>
      </div>

      {isOwner && (
        <div className="card space-y-3">
          <p className="section-label">Invite with a code</p>
          <p className="text-mt text-sm">
            They join as an <strong className="text-white">editor</strong>:
            {" "}{ROLE_HELP.editor.toLowerCase()}. They can&apos;t change teams,
            fixtures, or submit the tournament.
          </p>
          <button className="btn-volt" disabled={busy} onClick={make}>
            {busy ? "Creating..." : "Create code"}
          </button>

          {live.length > 0 && (
            <div className="space-y-2 pt-2">
              {live.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 border-t border-bd pt-3">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-volt text-lg tracking-widest">
                      {i.code}
                    </p>
                    <p className="text-mt text-xs mt-0.5">
                      joins as {i.role} • used {i.uses}
                      {i.max_uses ? ` of ${i.max_uses}` : " times"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* join_url is null until EDITOR_URL is set on the
                        server. Offering a dead link is worse than
                        offering the code, which is what gets read out
                        at a pitch regardless. */}
                    <button className="text-volt2 text-sm font-semibold"
                            onClick={() => copy(i.join_url || i.code, i.id)}>
                      {copied === i.id ? "Copied" : i.join_url ? "Copy link" : "Copy code"}
                    </button>
                    <button className="text-mt hover:text-red2 text-sm"
                            onClick={async () => {
                              try { await revokeInvite(tid, i.id); load(); }
                              catch (e: any) { setError(e.message); }
                            }}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwner && requests.length > 0 && (
        <div className="card space-y-3">
          <p className="section-label">Asking for access</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-t border-bd pt-3">
              <div className="min-w-0">
                <p className="text-white text-sm truncate">
                  {r.profiles?.display_name || r.profiles?.email || "Someone"}
                </p>
                <p className="text-mt text-xs mt-0.5">wants to be a {r.role_requested}</p>
                {r.message && <p className="text-mt text-xs mt-1">&ldquo;{r.message}&rdquo;</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="text-volt2 text-sm font-semibold"
                        onClick={async () => {
                          try { await decideRequest(tid, r.id, true); load(); }
                          catch (e: any) { setError(e.message); }
                        }}>
                  Approve
                </button>
                <button className="text-mt hover:text-red2 text-sm"
                        onClick={async () => {
                          try { await decideRequest(tid, r.id, false); load(); }
                          catch (e: any) { setError(e.message); }
                        }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      <div className="card">
        <p className="section-label mb-3">On this tournament</p>
        {members === null ? (
          <p className="text-mt text-sm">Loading...</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-bd last:border-0">
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">
                    {m.profiles?.display_name || m.profiles?.email || m.user_id.slice(0, 8)}
                  </p>
                  <p className="text-mt text-xs mt-0.5">{ROLE_HELP[m.role]}</p>
                </div>
                {isOwner && m.role !== "owner" ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <button className="text-mt hover:text-red2 text-sm"
                            onClick={async () => {
                              try { await removeMember(tid, m.id); load(); }
                              catch (err: any) { setError(err.message); }
                            }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="text-mt2 text-xs font-mono shrink-0 uppercase">{m.role}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner && (
          <p className="text-mt2 text-xs mt-3">
            Removing someone revokes their access. Events they already logged
            stay, because they&apos;re a record of what happened in a match.
          </p>
        )}
      </div>
    </div>
  );
}
