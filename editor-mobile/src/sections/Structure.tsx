/**
 * src/sections/Structure.tsx
 *
 * Venues, the parts a competition divides into, and suspensions.
 * The same three screens the web editor has, in the same order, calling
 * the same endpoints.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { COLORS } from "../theme";
import { S, Field, Btn, Choice, Empty, Loading } from "./kit";
import {
  listVenues, addVenue, deleteVenue,
  listSubCompetitions, addSubCompetition, deleteSubCompetition,
  assignTeams, unassignTeam, SUB_KINDS,
  listSuspensions, addSuspension, markServed, deleteSuspension,
  listSquad,
  type Venue, type SubCompetition, type SubCompKind, type Suspension,
  type TeamRow,
} from "../services/api";

/* ── venues ─────────────────────────────────────────────────────── */
export function Venues({ tid, editable }: { tid: string; editable: boolean }) {
  const [rows, setRows] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", city: "", capacity: "" });

  const load = useCallback(() => {
    listVenues(tid).then((d) => { setRows(d.venues); setError(null); })
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
      {error ? <Text style={S.error}>{error}</Text> : null}

      {rows && rows.length === 0 ? (
        <Empty title="No venues yet"
               body="Add the grounds your matches are played at, then pick one per fixture instead of typing it every time." />
      ) : null}

      {(rows || []).map((v) => (
        <View key={v.id} style={S.card}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>{v.name}</Text>
              <Text style={S.dim}>
                {[v.city, v.address].filter(Boolean).join(" • ") || "No address"}
                {v.capacity != null ? ` • holds ${v.capacity.toLocaleString()}` : ""}
              </Text>
            </View>
            {editable ? (
              <TouchableOpacity disabled={busy} onPress={() => run(() => deleteVenue(tid, v.id))}>
                <Text style={S.danger}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      {editable ? (
        <View style={S.card}>
          <Text style={S.label}>ADD A VENUE</Text>
          <View style={[S.wrapRow, { gap: 10 }]}>
            <Field label="Name" value={f.name} placeholder="Main Bowl"
                   onChangeText={(v: string) => setF({ ...f, name: v })} />
            <Field label="City" value={f.city} placeholder="Zaria"
                   onChangeText={(v: string) => setF({ ...f, city: v })} />
          </View>
          <Field label="Capacity" value={f.capacity} keyboardType="number-pad"
                 placeholder="800"
                 onChangeText={(v: string) => setF({ ...f, capacity: v })} />
          <View style={{ marginTop: 10 }}>
            <Btn label="Add venue" busy={busy} disabled={!f.name.trim()}
                 onPress={() => run(async () => {
                   await addVenue(tid, {
                     name: f.name.trim(),
                     city: f.city.trim() || null,
                     capacity: f.capacity.trim() === "" ? null : Number(f.capacity),
                   });
                   setF({ name: "", city: "", capacity: "" });
                 })} />
          </View>
        </View>
      ) : null}

      <Text style={S.dim}>
        Removing a venue leaves the name on fixtures already played there.
      </Text>
    </View>
  );
}

/* ── parts of the competition ───────────────────────────────────── */
export function Structure({ tid, editable, onChanged }: {
  tid: string; editable: boolean; onChanged: () => void;
}) {
  const [subs, setSubs] = useState<SubCompetition[] | null>(null);
  const [loose, setLoose] = useState<TeamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SubCompKind>("group");

  const load = useCallback(() => {
    listSubCompetitions(tid)
      .then((d) => { setSubs(d.sub_competitions); setLoose(d.unassigned); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (subs === null && !error) return <Loading />;

  return (
    <View style={{ gap: 10 }}>
      {error ? <Text style={S.error}>{error}</Text> : null}

      {subs && subs.length === 0 ? (
        <Empty title="Not divided yet"
               body="Add the groups or stages this competition runs in. A team in a part appears in that part's table." />
      ) : null}

      {(subs || []).map((sc) => (
        <View key={sc.id} style={S.card}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>{sc.name}</Text>
              <Text style={S.dim}>
                {sc.kind} • {sc.teams.length} {sc.teams.length === 1 ? "team" : "teams"}
              </Text>
            </View>
            {editable ? (
              <TouchableOpacity disabled={busy}
                                onPress={() => run(() => deleteSubCompetition(tid, sc.id))}>
                <Text style={S.danger}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {sc.teams.length > 0 ? (
            <View style={[S.wrapRow, { marginTop: 8 }]}>
              {sc.teams.map((tm) => (
                <View key={tm.id} style={S.chip}>
                  <Text style={S.chipText}>{tm.clubs?.name ?? "Unknown"}</Text>
                  {editable ? (
                    <TouchableOpacity disabled={busy}
                                      onPress={() => run(() => unassignTeam(tid, tm.id))}>
                      <Text style={{ color: "#FF4444", fontSize: 13 }}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {loose.length > 0 ? (
        <View style={S.card}>
          <Text style={S.label}>NOT PLACED YET ({loose.length})</Text>
          <Text style={S.muted}>
            These sit outside every table until they are put somewhere.
          </Text>
          <View style={[S.wrapRow, { marginTop: 8 }]}>
            {loose.map((tm) => (
              <View key={tm.id} style={[S.chip, { borderColor: "rgba(255,184,48,0.4)" }]}>
                <Text style={[S.chipText, { color: "#FFB830" }]}>
                  {tm.clubs?.name ?? "Unknown"}
                </Text>
              </View>
            ))}
          </View>
          {editable && (subs || []).length > 0 ? (
            <View style={{ gap: 8, marginTop: 10 }}>
              <Text style={S.dim}>PLACE ALL IN</Text>
              {(subs || []).map((sc) => (
                <TouchableOpacity key={sc.id} disabled={busy} style={S.chip}
                                  onPress={() => run(() => assignTeams(tid, sc.id, loose.map((x) => x.id)))}>
                  <Text style={S.chipText}>{sc.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {editable ? (
        <View style={S.card}>
          <Text style={S.label}>ADD A PART</Text>
          <Field label="Name" value={name} placeholder="Group A" onChangeText={setName} />
          <View style={{ marginTop: 10, gap: 10 }}>
            <Choice value={kind} options={SUB_KINDS} onChange={setKind} />
            <Btn label="Add" busy={busy} disabled={!name.trim()}
                 onPress={() => run(async () => {
                   await addSubCompetition(tid, {
                     name: name.trim(), kind, sort_order: (subs || []).length,
                   });
                   setName("");
                 })} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── suspensions ────────────────────────────────────────────────── */
export function Suspensions({ tid, teams, editable }: {
  tid: string; teams: TeamRow[]; editable: boolean;
}) {
  const [rows, setRows] = useState<Suspension[] | null>(null);
  const [served, setServed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [squad, setSquad] = useState<any[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [matches, setMatches] = useState("1");
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    listSuspensions(tid, served).then((d) => { setRows(d.suspensions); setError(null); })
      .catch((e) => setError(e.message));
  }, [tid, served]);
  useEffect(() => { load(); }, [load]);

  // A ban is always against a player registered to that team here, so
  // the player list follows the team rather than listing everyone.
  useEffect(() => {
    if (!teamId) { setSquad([]); setPlayerId(""); return; }
    listSquad(teamId).then((d: any) => setSquad(d.squad || [])).catch(() => setSquad([]));
  }, [teamId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); load(); } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (rows === null && !error) return <Loading />;

  return (
    <View style={{ gap: 10 }}>
      <View style={S.row}>
        <TouchableOpacity onPress={() => setServed(!served)}>
          <Text style={S.link}>{served ? "Hide served bans" : "Include served bans"}</Text>
        </TouchableOpacity>
        {editable && !open ? (
          <TouchableOpacity onPress={() => setOpen(true)}>
            <Text style={S.link}>Add suspension</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={S.error}>{error}</Text> : null}

      {editable && open ? (
        <View style={S.card}>
          <Text style={S.label}>ADD SUSPENSION</Text>

          <Text style={[S.dim, { marginTop: 8 }]}>TEAM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
            {teams.map((tm) => {
              const on = tm.id === teamId;
              return (
                <TouchableOpacity key={tm.id} onPress={() => setTeamId(tm.id)}
                  style={[S.chip, on && {
                    borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted }]}>
                  <Text style={[S.chipText, on && { color: COLORS.volt, fontWeight: "700" }]}>
                    {tm.clubs?.name ?? "Unknown"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[S.dim, { marginTop: 8 }]}>PLAYER</Text>
          {!teamId ? (
            <Text style={S.muted}>Pick a team first.</Text>
          ) : squad.length === 0 ? (
            <Text style={S.muted}>Nobody registered to that team yet.</Text>
          ) : (
            <View style={[S.wrapRow, { marginTop: 6 }]}>
              {squad.map((r: any) => {
                const pid = r.players?.id ?? "";
                const on = pid === playerId;
                return (
                  <TouchableOpacity key={r.id} onPress={() => setPlayerId(pid)}
                    style={[S.chip, on && {
                      borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted }]}>
                    <Text style={[S.chipText, on && { color: COLORS.volt, fontWeight: "700" }]}>
                      {r.jersey_number ? `#${r.jersey_number} ` : ""}
                      {r.players?.first_name} {r.players?.last_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={[S.wrapRow, { gap: 10, marginTop: 8 }]}>
            <Field label="Matches" value={matches} keyboardType="number-pad"
                   onChangeText={setMatches} />
            <Field label="Reason" value={reason} placeholder="Violent conduct, 78'"
                   onChangeText={setReason} />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Btn label="Add suspension" busy={busy} disabled={!teamId || !playerId}
                   onPress={() => run(async () => {
                     await addSuspension(tid, {
                       tournament_team_id: teamId, player_id: playerId,
                       matches: Number(matches) || 1,
                       start_date: new Date().toISOString().slice(0, 10),
                       reason: reason.trim() || null,
                     });
                     setOpen(false); setTeamId(""); setPlayerId("");
                     setMatches("1"); setReason("");
                   })} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Cancel" tone="ghost" onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      ) : null}

      {rows && rows.length === 0 ? (
        <Empty title="Nobody suspended"
               body="Bans logged here show against the player for the rest of the competition." />
      ) : null}

      {(rows || []).map((sp) => (
        <View key={sp.id} style={S.card}>
          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={[S.title, !sp.active && {
                color: COLORS.textSecondary, textDecorationLine: "line-through",
              }]}>
                {sp.players?.first_name} {sp.players?.last_name}
              </Text>
              <Text style={S.dim}>
                {sp.tournament_teams?.clubs?.name ?? "Unknown team"} • {sp.matches}
                {sp.matches === 1 ? " match" : " matches"} • from {sp.start_date}
              </Text>
              {sp.reason ? <Text style={[S.muted, { marginTop: 4 }]}>{sp.reason}</Text> : null}
            </View>
            {editable ? (
              <View style={{ gap: 8, alignItems: "flex-end" }}>
                {sp.active ? (
                  <TouchableOpacity disabled={busy} onPress={() => run(() => markServed(tid, sp.id))}>
                    <Text style={[S.link, { color: COLORS.win }]}>Served</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity disabled={busy}
                                  onPress={() => run(() => deleteSuspension(tid, sp.id))}>
                  <Text style={S.danger}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      ))}

      <Text style={S.dim}>
        Nothing expires a ban automatically. Mark it served when it has been,
        which keeps the disciplinary record intact rather than deleting it.
      </Text>
    </View>
  );
}
