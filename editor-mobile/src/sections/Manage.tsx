/**
 * src/sections/Manage.tsx
 *
 * The rest of the competition sections: standings, teams, players,
 * info, regulations, proof and collaborators. Same content as the web
 * editor's equivalents, laid out for a phone.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { COLORS } from "../theme";
import Crest from "../components/Crest";
import { S, Field, Btn, Empty, Loading } from "./kit";
import {
  getStandings, listSquad, listProofs, addProof, deleteProof,
  listMembers, listInvites, createInvite, revokeInvite,
  listRequests, decideRequest, removeMember,
  updateTournament, TIEBREAKERS,
  type Tournament, type TeamRow, type StandingRow, type Proof,
  type Member, type Invite, type AccessRequest,
} from "../services/api";

/* ── standings ──────────────────────────────────────────────────── */
export function Standings({ tid }: { tid: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStandings(tid).then(setData).catch((e) => setError(e.message));
  }, [tid]);

  if (error) return <Text style={S.error}>{error}</Text>;
  if (!data) return <Loading />;

  const tables: [string, StandingRow[]][] = data.grouped
    ? Object.keys(data.group_tables || {}).sort()
        .map((g) => [`Group ${g}`, data.group_tables[g]])
    : [["Table", data.standings || []]];

  return (
    <View style={{ gap: 12 }}>
      <Text style={S.dim}>
        Built from finished matches only. A live or postponed match counts for
        nothing until it has a final score.
      </Text>
      {tables.map(([heading, rows]) => (
        <View key={heading} style={{ gap: 6 }}>
          <Text style={S.label}>{heading.toUpperCase()}</Text>
          <View style={S.card}>
            <View style={[S.row, { paddingBottom: 6 }]}>
              <Text style={[S.dim, { flex: 1 }]}>TEAM</Text>
              <Text style={[S.dim, { width: 26, textAlign: "center" }]}>P</Text>
              <Text style={[S.dim, { width: 30, textAlign: "center" }]}>GD</Text>
              <Text style={[S.dim, { width: 30, textAlign: "center" }]}>PTS</Text>
            </View>
            {rows.length === 0 ? (
              <Text style={S.muted}>No finished matches yet.</Text>
            ) : rows.map((r: any, i: number) => (
              <View key={r.team_id ?? i} style={[S.row, { paddingVertical: 6 }]}>
                <Text style={[S.dim, { width: 18 }]}>{r.position ?? i + 1}</Text>
                <Text style={[S.body, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[S.muted, { width: 26, textAlign: "center" }]}>{r.played}</Text>
                <Text style={[S.muted, { width: 30, textAlign: "center" }]}>
                  {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
                </Text>
                <Text style={[S.body, { width: 30, textAlign: "center",
                                        color: COLORS.volt, fontWeight: "800" }]}>
                  {r.points}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {data.points_rules ? (
        <Text style={S.dim}>
          {data.points_rules.win} for a win, {data.points_rules.draw} for a draw,
          {" "}{data.points_rules.loss} for a loss.
        </Text>
      ) : null}
    </View>
  );
}

/* ── teams ──────────────────────────────────────────────────────── */
export function Teams({ teams }: { teams: TeamRow[] }) {
  if (teams.length === 0) {
    return <Empty title="No teams yet"
                  body="Add the teams taking part, then generate or upload the fixtures." />;
  }
  return (
    <View style={{ gap: 8 }}>
      {teams.map((tm) => (
        <View key={tm.id} style={S.card}>
          <View style={[S.row, { gap: 10 }]}>
            <Crest url={tm.clubs?.crest_url ?? null} name={tm.clubs?.name ?? "?"} size={24} />
            <Text style={[S.title, { flex: 1 }]} numberOfLines={1}>
              {tm.clubs?.name ?? "Unknown"}
            </Text>
            {tm.group_name ? <Text style={S.dim}>Group {tm.group_name}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ── players ────────────────────────────────────────────────────── */
export function Players({ teams }: { teams: TeamRow[] }) {
  const [open, setOpen] = useState<string | null>(teams[0]?.id ?? null);

  if (teams.length === 0) {
    return <Empty title="No teams yet"
                  body="Players are registered to a team, so add the teams first." />;
  }

  return (
    <View style={{ gap: 8 }}>
      {teams.map((tm) => (
        <View key={tm.id} style={S.card}>
          <TouchableOpacity onPress={() => setOpen(open === tm.id ? null : tm.id)}>
            <View style={[S.row, { gap: 10 }]}>
              <Crest url={tm.clubs?.crest_url ?? null} name={tm.clubs?.name ?? "?"} size={22} />
              <Text style={[S.title, { flex: 1 }]} numberOfLines={1}>
                {tm.clubs?.name ?? "Unknown"}
              </Text>
              <Text style={S.dim}>{open === tm.id ? "Hide" : "Show"}</Text>
            </View>
          </TouchableOpacity>
          {open === tm.id ? <Squad teamId={tm.id} /> : null}
        </View>
      ))}
    </View>
  );
}

function Squad({ teamId }: { teamId: string }) {
  const [squad, setSquad] = useState<any[] | null>(null);
  useEffect(() => {
    listSquad(teamId).then((d: any) => setSquad(d.squad || [])).catch(() => setSquad([]));
  }, [teamId]);

  if (squad === null) return <Loading />;
  if (squad.length === 0) {
    return <Text style={[S.muted, { marginTop: 8 }]}>Nobody registered yet.</Text>;
  }
  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      {squad.map((r: any) => (
        <View key={r.id} style={[S.row, { paddingVertical: 2 }]}>
          <Text style={[S.dim, { width: 34 }]}>
            {r.jersey_number ? `#${r.jersey_number}` : ""}
          </Text>
          <Text style={[S.body, { flex: 1 }]} numberOfLines={1}>
            {r.players?.first_name} {r.players?.last_name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── info ───────────────────────────────────────────────────────── */
export function Info({ t, editable, onChanged }: {
  t: Tournament; editable: boolean; onChanged: () => void;
}) {
  const [f, setF] = useState({
    name: t.name, organizing_body: t.organizing_body || "",
    country: t.country || "", contact_email: t.contact_email || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try { await updateTournament(t.id, f); setSaved(true); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!editable) {
    return (
      <View style={S.card}>
        {[["Name", t.name], ["Organising body", t.organizing_body],
          ["Country", t.country], ["Level", t.level],
          ["Starts", t.start_date], ["Ends", t.end_date]].map(([k, v]) => (
          <View key={String(k)} style={[S.row, { paddingVertical: 4 }]}>
            <Text style={S.dim}>{String(k).toUpperCase()}</Text>
            <Text style={S.body}>{String(v || "—")}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={S.card}>
        <Field label="Name" value={f.name}
               onChangeText={(v: string) => { setF({ ...f, name: v }); setSaved(false); }} />
        <Field label="Organising body" value={f.organizing_body}
               onChangeText={(v: string) => { setF({ ...f, organizing_body: v }); setSaved(false); }} />
        <Field label="Country" value={f.country}
               onChangeText={(v: string) => { setF({ ...f, country: v }); setSaved(false); }} />
        <Field label="Contact email" value={f.contact_email} autoCapitalize="none"
               keyboardType="email-address"
               onChangeText={(v: string) => { setF({ ...f, contact_email: v }); setSaved(false); }} />
        <Text style={[S.dim, { marginTop: 10 }]}>
          Level, format and dates are changed in the web editor.
        </Text>
        {error ? <Text style={S.error}>{error}</Text> : null}
        {saved && !error ? <Text style={S.ok}>Saved.</Text> : null}
        <View style={{ marginTop: 10 }}>
          <Btn label="Save changes" busy={busy} onPress={save} />
        </View>
      </View>
    </View>
  );
}

/* ── regulations ────────────────────────────────────────────────── */
export function Regulations({ t, editable, onChanged }: {
  t: Tournament; editable: boolean; onChanged: () => void;
}) {
  const [pts, setPts] = useState({
    win: String(t.points_rules?.win ?? 3),
    draw: String(t.points_rules?.draw ?? 1),
    loss: String(t.points_rules?.loss ?? 0),
  });
  const [selected, setSelected] = useState<string[]>(
    (t.tiebreakers || []).filter((x) => TIEBREAKERS.some((o) => o.id === x))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const n = (v: string) => Number(v) || 0;
  const problem =
    n(pts.win) < n(pts.draw) ? "A win can't be worth less than a draw."
    : n(pts.draw) < n(pts.loss) ? "A draw can't be worth less than a loss."
    : [pts.win, pts.draw, pts.loss].some((v) => n(v) < 0 || n(v) > 10)
      ? "Points must be between 0 and 10." : null;

  const move = (i: number, by: number) => {
    const next = [...selected];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next); setSaved(false);
  };

  const save = async () => {
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null); setSaved(false);
    try {
      await updateTournament(t.id, {
        points_rules: { win: n(pts.win), draw: n(pts.draw), loss: n(pts.loss) },
        tiebreakers: selected,
      });
      setSaved(true); onChanged();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const available = TIEBREAKERS.filter((o) => !selected.includes(o.id));
  const labelOf = (id: string) => TIEBREAKERS.find((o) => o.id === id)?.label ?? id;
  const isLive = (id: string) => TIEBREAKERS.find((o) => o.id === id)?.implemented ?? false;

  return (
    <View style={{ gap: 10 }}>
      <View style={S.card}>
        <Text style={S.label}>POINTS SYSTEM</Text>
        <Text style={S.muted}>
          Applied to every result as the table is built. Change it and the table
          recalculates, including matches already played.
        </Text>
        <View style={[S.wrapRow, { gap: 10, marginTop: 8 }]}>
          {(["win", "draw", "loss"] as const).map((k) => (
            <Field key={k} label={k} value={pts[k]} keyboardType="number-pad"
                   editable={editable}
                   onChangeText={(v: string) => { setPts({ ...pts, [k]: v }); setSaved(false); }} />
          ))}
        </View>
      </View>

      <View style={S.card}>
        <Text style={S.label}>TIEBREAKERS</Text>
        <Text style={S.muted}>
          When teams are level on points, these are applied in order, top first.
        </Text>

        {selected.length === 0 ? (
          <Text style={[S.muted, { marginTop: 8 }]}>
            None chosen. Teams level on points are ordered by name.
          </Text>
        ) : (
          <View style={{ gap: 6, marginTop: 10 }}>
            {selected.map((id, i) => (
              <View key={id} style={[S.chip, { justifyContent: "space-between" }]}>
                <Text style={[S.chipText, { flex: 1, color: COLORS.text }]}>
                  {i + 1}. {labelOf(id)}
                  {!isLive(id) ? "  (not applied yet)" : ""}
                </Text>
                {editable ? (
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0}>
                      <Text style={[S.chipText, i === 0 && { opacity: 0.3 }]}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, 1)}
                                      disabled={i === selected.length - 1}>
                      <Text style={[S.chipText,
                                    i === selected.length - 1 && { opacity: 0.3 }]}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setSelected(selected.filter((x) => x !== id)); setSaved(false);
                    }}>
                      <Text style={{ color: "#FF4444" }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {editable && available.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={S.dim}>AVAILABLE</Text>
            <View style={[S.wrapRow, { marginTop: 6 }]}>
              {available.map((o) => (
                <TouchableOpacity key={o.id} style={S.chip}
                                  onPress={() => { setSelected([...selected, o.id]); setSaved(false); }}>
                  <Text style={S.chipText}>+ {o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[S.dim, { marginTop: 10 }]}>
          Head to head is stored but not applied yet. Doing it properly means a
          mini table among only the tied teams, and the pairwise shortcut gives
          the wrong answer for a three-way tie.
        </Text>
      </View>

      {problem || error ? <Text style={S.error}>{problem || error}</Text> : null}
      {saved && !error && !problem ? (
        <Text style={S.ok}>Saved. The table has recalculated.</Text>
      ) : null}

      {editable ? (
        <Btn label="Save regulations" busy={busy} disabled={Boolean(problem)} onPress={save} />
      ) : null}
    </View>
  );
}

/* ── proof ──────────────────────────────────────────────────────── */
export function ProofSection({ tid, editable }: { tid: string; editable: boolean }) {
  const [rows, setRows] = useState<Proof[] | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listProofs(tid).then((d) => { setRows(d.proofs); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (rows === null && !error) return <Loading />;

  return (
    <View style={{ gap: 10 }}>
      <Text style={S.dim}>
        Evidence this competition is real: a letter, a poster, the organising
        body&apos;s page. We read this before approving.
      </Text>
      {error ? <Text style={S.error}>{error}</Text> : null}

      {rows && rows.length === 0 ? (
        <Empty title="No proof attached"
               body="A competition can't be submitted for review without at least one." />
      ) : null}

      {(rows || []).map((p) => (
        <View key={p.id} style={S.card}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.body} numberOfLines={2}>{p.url}</Text>
              <Text style={S.dim}>{p.type}{p.note ? ` • ${p.note}` : ""}</Text>
            </View>
            {editable ? (
              <TouchableOpacity disabled={busy} onPress={() => run(() => deleteProof(tid, p.id))}>
                <Text style={S.danger}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      {editable ? (
        <View style={S.card}>
          <Text style={S.label}>ADD A LINK</Text>
          <Field label="URL" value={url} autoCapitalize="none" placeholder="https://..."
                 onChangeText={setUrl} />
          <Field label="Note" value={note} placeholder="Department announcement"
                 onChangeText={setNote} />
          <View style={{ marginTop: 10 }}>
            <Btn label="Add proof" busy={busy} disabled={!url.trim()}
                 onPress={() => run(async () => {
                   await addProof(tid, {
                     type: "link", url: url.trim(), note: note.trim() || null,
                   });
                   setUrl(""); setNote("");
                 })} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── collaborators ──────────────────────────────────────────────── */
export function Collaborators({ tid, isOwner }: { tid: string; isOwner: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listMembers(tid).then((d: any) => { setMembers(d.members); setError(null); })
      .catch((e) => setError(e.message));
    if (isOwner) {
      listInvites(tid).then((d) => setInvites(d.invites)).catch(() => setInvites([]));
      listRequests(tid).then((d) => setRequests(d.requests)).catch(() => setRequests([]));
    }
  }, [tid, isOwner]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (members === null && !error) return <Loading />;

  return (
    <View style={{ gap: 10 }}>
      <Text style={S.dim}>
        The people who can edit this competition. An editor updates matches and
        scores; the owner manages everything.
      </Text>
      {error ? <Text style={S.error}>{error}</Text> : null}

      {(members || []).map((m: any) => (
        <View key={m.id} style={S.card}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>{m.full_name || m.email || "Member"}</Text>
              <Text style={S.dim}>{m.role}</Text>
            </View>
            {isOwner && m.role !== "owner" ? (
              <TouchableOpacity disabled={busy} onPress={() => run(() => removeMember(tid, m.id))}>
                <Text style={S.danger}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      {isOwner ? (
        <>
          {requests.length > 0 ? (
            <View style={S.card}>
              <Text style={S.label}>REQUESTS ({requests.length})</Text>
              {requests.map((r: any) => (
                <View key={r.id} style={[S.row, { marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.body}>
                      {r.profiles?.full_name || r.profiles?.email || "Someone"}
                    </Text>
                    {r.message ? <Text style={S.dim}>{r.message}</Text> : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity disabled={busy}
                                      onPress={() => run(() => decideRequest(tid, r.id, true))}>
                      <Text style={[S.link, { color: COLORS.win }]}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={busy}
                                      onPress={() => run(() => decideRequest(tid, r.id, false))}>
                      <Text style={S.danger}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={S.card}>
            <Text style={S.label}>INVITE CODES</Text>
            <Text style={S.muted}>
              Short enough to read out across a pitch, which is how they actually
              get delivered.
            </Text>
            {invites.filter((i) => !i.revoked).map((i) => (
              <View key={i.id} style={[S.row, { marginTop: 8 }]}>
                <Text style={[S.body, { fontWeight: "800", letterSpacing: 2 }]}>
                  {i.code}
                </Text>
                <TouchableOpacity disabled={busy} onPress={() => run(() => revokeInvite(tid, i.id))}>
                  <Text style={S.danger}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ marginTop: 10 }}>
              <Btn label="New invite code" busy={busy}
                   onPress={() => run(() => createInvite(tid, "editor"))} />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
