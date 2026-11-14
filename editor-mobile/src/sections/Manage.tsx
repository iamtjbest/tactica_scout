/**
 * src/sections/Manage.tsx
 *
 * The rest of the competition sections: standings, teams, players,
 * info, regulations, proof and collaborators. Same content as the web
 * editor's equivalents, laid out for a phone.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../theme";
import Crest from "../components/Crest";
import { S, Field, Btn, Choice, Empty, Loading } from "./kit";
import {
  getStandings, listSquad, listProofs, addProof, deleteProof,
  searchClubs, addTeam, removeTeam, uploadCrest, listSubCompetitions,
  registerPlayer, updateRegisteredPlayer, unregisterPlayer,
  listMembers, listInvites, createInvite, revokeInvite,
  listRequests, decideRequest, removeMember,
  updateTournament, updateClub, updateTournamentTeam,
  uploadPlayerPhoto, uploadTournamentCrest, TIEBREAKERS,
  type Tournament, type TeamRow, type StandingRow, type Proof, type PlayerRegistration,
  type Club, type SubCompetition,
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

/* ── teams (Add + Tap Card to Edit Details & Crest) ─────────────── */
export function Teams({
  tid,
  teams,
  editable,
  onChanged,
}: {
  tid: string;
  teams: TeamRow[];
  editable: boolean;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Club[]>([]);
  const [subs, setSubs] = useState<SubCompetition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "", short_name: "", institution: "",
    sub_competition_id: "", home_color: "#CCFF00", away_color: "#111827",
    attack_rating: "", defence_rating: "",
  });

  useEffect(() => {
    let active = true;
    listSubCompetitions(tid)
      .then((data) => { if (active) setSubs(data.sub_competitions || []); })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load groups.");
      });
    return () => { active = false; };
  }, [tid]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchClubs(query)
        .then((data) => { if (active) setHits(data.clubs || []); })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Could not search clubs.");
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const add = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await addTeam(tid, { ...body, group_name: null });
      setQ("");
      setHits([]);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add team.");
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (tm: TeamRow) => {
    if (!editable) return;
    if (editingId === tm.id) {
      setEditingId(null);
      return;
    }
    setEditingId(tm.id);
    setError(null);
    setDraft({
      name: tm.clubs?.name ?? "",
      short_name: tm.clubs?.short_name ?? "",
      institution: tm.clubs?.institution ?? "",
      sub_competition_id: tm.sub_competition_id ?? "",
      home_color: tm.home_color ?? "#CCFF00",
      away_color: tm.away_color ?? "#111827",
      attack_rating: tm.attack_rating == null ? "" : String(tm.attack_rating),
      defence_rating: tm.defence_rating == null ? "" : String(tm.defence_rating),
    });
  };

  const pickCrest = async (clubId: string) => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Gallery permission required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const image = result.assets[0];
      setBusy(true);
      await uploadCrest(clubId, {
        uri: image.uri,
        name: image.fileName || "crest.jpg",
        type: image.mimeType || "image/jpeg",
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload team crest.");
    } finally {
      setBusy(false);
    }
  };

  const saveTeam = async (tm: TeamRow) => {
    const attack = draft.attack_rating.trim() ? Number(draft.attack_rating) : null;
    const defence = draft.defence_rating.trim() ? Number(draft.defence_rating) : null;
    if (draft.name.trim().length < 2) {
      setError("Team name must be at least 2 characters.");
      return;
    }
    if ([attack, defence].some((value) =>
      value !== null && (!Number.isFinite(value) || value < 40 || value > 90)
    )) {
      setError("Seed ratings must be between 40 and 90.");
      return;
    }
    if ([draft.home_color, draft.away_color].some((color) =>
      color.trim() && !/^#[0-9a-f]{6}$/i.test(color.trim())
    )) {
      setError("Kit colors must use the #RRGGBB format.");
      return;
    }
    if (!tm.club_id) {
      setError("This team is not linked to a club.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateClub(tm.club_id, {
        name: draft.name.trim(),
        short_name: draft.short_name.trim() || null,
        institution: draft.institution.trim() || null,
      });
      await updateTournamentTeam(tid, tm.id, {
        sub_competition_id: draft.sub_competition_id || null,
        home_color: draft.home_color.trim() || null,
        away_color: draft.away_color.trim() || null,
        attack_rating: attack,
        defence_rating: defence,
      });
      setEditingId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save team details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {editable ? (
        <View style={S.card}>
          <Text style={S.label}>ADD A TEAM</Text>
          <Field label="Club name" value={q}
                 placeholder="Search existing clubs, or type a new name"
                 onChangeText={setQ} />
          {hits.map((club) => (
            <TouchableOpacity key={club.id} style={[S.chip, { justifyContent: "space-between", paddingVertical: 10 }]}
                              disabled={busy} onPress={() => { void add({ club_id: club.id }); }}>
              <Text style={S.body}>
                {club.name}{club.institution ? ` — ${club.institution}` : ""}
              </Text>
              <Text style={S.link}>Pick</Text>
            </TouchableOpacity>
          ))}
          {q.trim().length >= 2 ? (
            <View style={{ marginTop: 6 }}>
              <Btn label={`Add "${q.trim()}" as new team`} busy={busy}
                   onPress={() => { void add({ club_name: q.trim() }); }} />
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={S.error}>{error}</Text> : null}
      {teams.length === 0 ? (
        <Empty title="No teams yet" body="Add the teams taking part, then assign groups or fixtures." />
      ) : (
        teams.map((tm) => {
          const isOpen = editingId === tm.id;
          return (
            <View key={tm.id} style={[S.card, isOpen && { borderColor: COLORS.cardBorderActive }]}>
              <View style={[S.row, { gap: 10 }]}>
                <TouchableOpacity disabled={!editable || !tm.club_id || busy}
                                  onPress={() => { if (tm.club_id) void pickCrest(tm.club_id); }}>
                  <Crest url={tm.clubs?.crest_url ?? null} name={tm.clubs?.name ?? "?"} size={28} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={editable ? 0.75 : 1}
                                  onPress={() => openEditor(tm)} style={{ flex: 1 }}>
                  <Text style={S.title} numberOfLines={1}>
                    {tm.clubs?.name ?? "Unknown"} {tm.clubs?.short_name ? `(${tm.clubs.short_name})` : ""}
                  </Text>
                  <Text style={S.dim}>
                    {[tm.group_name, tm.clubs?.institution].filter(Boolean).join(" • ") ||
                      (editable ? "Tap to edit team details; tap crest to upload" : "Registered")}
                  </Text>
                </TouchableOpacity>
                {editable ? (
                  <TouchableOpacity onPress={() => openEditor(tm)}>
                    <Text style={S.link}>{isOpen ? "Close" : "Edit"}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isOpen && editable ? (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 10 }}>
                  <Field label="Team name" value={draft.name}
                         onChangeText={(name: string) => setDraft({ ...draft, name })} />
                  <View style={[S.wrapRow, { gap: 10 }]}>
                    <Field label="Short name" value={draft.short_name} placeholder="ENG"
                           onChangeText={(short_name: string) => setDraft({ ...draft, short_name })} />
                    <Field label="Institution / faculty" value={draft.institution} placeholder="KWASU"
                           onChangeText={(institution: string) => setDraft({ ...draft, institution })} />
                  </View>
                  {subs.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={S.dim}>GROUP / STAGE</Text>
                      <View style={S.wrapRow}>
                        <TouchableOpacity onPress={() => setDraft({ ...draft, sub_competition_id: "" })}
                                          style={[S.chip, !draft.sub_competition_id && { borderColor: COLORS.volt, backgroundColor: COLORS.voltMuted }]}>
                          <Text style={[S.chipText, !draft.sub_competition_id && { color: COLORS.volt }]}>None</Text>
                        </TouchableOpacity>
                        {subs.map((sub) => {
                          const selected = draft.sub_competition_id === sub.id;
                          return (
                            <TouchableOpacity key={sub.id}
                                              onPress={() => setDraft({ ...draft, sub_competition_id: sub.id })}
                                              style={[S.chip, selected && { borderColor: COLORS.volt, backgroundColor: COLORS.voltMuted }]}>
                              <Text style={[S.chipText, selected && { color: COLORS.volt, fontWeight: "700" }]}>
                                {sub.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  <View style={[S.wrapRow, { gap: 10 }]}>
                    <Field label="Seed ATK (40-90)" value={draft.attack_rating}
                           keyboardType="decimal-pad" placeholder="54"
                           onChangeText={(attack_rating: string) => setDraft({ ...draft, attack_rating })} />
                    <Field label="Seed DEF (40-90)" value={draft.defence_rating}
                           keyboardType="decimal-pad" placeholder="54"
                           onChangeText={(defence_rating: string) => setDraft({ ...draft, defence_rating })} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Btn label="Save details" busy={busy} onPress={() => { void saveTeam(tm); }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn label="Remove" tone="danger" busy={busy} onPress={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          await removeTeam(tid, tm.id);
                          setEditingId(null);
                          onChanged();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not remove team.");
                        } finally {
                          setBusy(false);
                        }
                      }} />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

/* ── players (Register + Photo Upload) ──────────────────────────── */
export function Players({ teams, editable }: { teams: TeamRow[]; editable: boolean }) {
  const [open, setOpen] = useState<string | null>(teams[0]?.id ?? null);
  if (teams.length === 0) {
    return <Empty title="No teams yet" body="Players are registered to a team, so add the teams first." />;
  }
  return (
    <View style={{ gap: 8 }}>
      {teams.map((team) => (
        <View key={team.id} style={S.card}>
          <TouchableOpacity onPress={() => setOpen(open === team.id ? null : team.id)}>
            <View style={[S.row, { gap: 10 }]}>
              <Crest url={team.clubs?.crest_url ?? null} name={team.clubs?.name ?? "?"} size={22} />
              <Text style={[S.title, { flex: 1 }]} numberOfLines={1}>
                {team.clubs?.name ?? "Unknown"}
              </Text>
              <Text style={S.dim}>{open === team.id ? "Hide" : "Show"}</Text>
            </View>
          </TouchableOpacity>
          {open === team.id ? <Squad teamId={team.id} editable={editable} /> : null}
        </View>
      ))}
    </View>
  );
}

function Squad({ teamId, editable }: { teamId: string; editable: boolean }) {
  const [squad, setSquad] = useState<PlayerRegistration[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    first_name: "", last_name: "", dob: "", position: "MID", jersey_number: "",
  });
  const [newPlayer, setNewPlayer] = useState({
    first_name: "", last_name: "", dob: "", position: "MID", jersey_number: "",
  });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const positions: { id: "GK" | "DEF" | "MID" | "FWD"; label: string }[] = [
    { id: "GK", label: "GK" },
    { id: "DEF", label: "DEF" },
    { id: "MID", label: "MID" },
    { id: "FWD", label: "FWD" },
  ];
  type Position = typeof positions[number]["id"];

  const load = useCallback(() => {
    listSquad(teamId)
      .then((data) => { setSquad(data.squad || []); })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load the squad.");
        setSquad([]);
      });
  }, [teamId]);
  useEffect(() => { load(); }, [load]);

  const pickImage = async (): Promise<string | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Gallery permission required.");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    return result.canceled ? null : result.assets[0]?.uri ?? null;
  };

  const register = async () => {
    if (!newPlayer.first_name.trim() || !newPlayer.last_name.trim() || !newPlayer.dob.trim()) {
      setError("First name, last name, and DOB (YYYY-MM-DD) are required.");
      return;
    }
    const jersey = newPlayer.jersey_number.trim() ? Number(newPlayer.jersey_number) : null;
    if (jersey !== null && (!Number.isInteger(jersey) || jersey < 1 || jersey > 99)) {
      setError("Shirt number must be a whole number from 1 to 99.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const registration = await registerPlayer(teamId, {
        first_name: newPlayer.first_name.trim(),
        last_name: newPlayer.last_name.trim(),
        dob: newPlayer.dob.trim(),
        position: newPlayer.position,
        jersey_number: jersey,
      });
      setNewPlayer({ first_name: "", last_name: "", dob: "", position: "MID", jersey_number: "" });
      const selectedPhoto = photoUri;
      setPhotoUri(null);
      load();
      if (selectedPhoto && registration?.player_id) {
        try {
          await uploadPlayerPhoto(registration.player_id, selectedPhoto);
        } catch (e) {
          setError(`Player added, but the photo failed to upload: ${
            e instanceof Error ? e.message : "Upload failed."
          }`);
          load();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add player.");
    } finally {
      setBusy(false);
    }
  };

  const uploadPlayerImage = async (playerId: string) => {
    setError(null);
    try {
      const uri = await pickImage();
      if (!uri) return;
      setBusy(true);
      await uploadPlayerPhoto(playerId, uri);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload player photo.");
    } finally {
      setBusy(false);
    }
  };

  if (squad === null) return <Loading />;
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {squad.length === 0 ? <Text style={S.muted}>Nobody registered yet.</Text> :
        squad.map((registration) => {
          const player = registration.players;
          if (!player) return null;
          const isEditing = editingId === registration.id;
          const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();
          const position = (draft.position || "MID") as Position;
          return (
            <View key={registration.id} style={{ gap: 8, paddingVertical: 6 }}>
              <View style={[S.row, { gap: 8 }]}>
                <TouchableOpacity disabled={!editable || busy}
                                  onPress={() => { void uploadPlayerImage(registration.player_id); }}
                                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.cardElevated, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {player.photo_url ? (
                    <Image source={{ uri: player.photo_url }} style={{ width: 38, height: 38 }} />
                  ) : (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: "800" }}>
                      {initials || "?"}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={[S.dim, { width: 34 }]}>
                  {registration.jersey_number ? `#${registration.jersey_number}` : ""}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.body} numberOfLines={1}>
                    {player.first_name} {player.last_name}
                  </Text>
                  <Text style={S.dim}>
                    {(registration.position || player.position || "—").toUpperCase()}
                    {editable && !player.photo_url ? " • Tap avatar for photo" : ""}
                  </Text>
                </View>
                {editable ? (
                  <TouchableOpacity onPress={() => {
                    setError(null);
                    setEditingId(isEditing ? null : registration.id);
                    setDraft({
                      first_name: player.first_name,
                      last_name: player.last_name,
                      dob: player.dob ?? "",
                      position: registration.position ?? player.position ?? "MID",
                      jersey_number: registration.jersey_number == null ? "" : String(registration.jersey_number),
                    });
                  }}>
                    <Text style={S.link}>{isEditing ? "Cancel" : "Edit"}</Text>
                  </TouchableOpacity>
                ) : null}
                {editable ? (
                  <TouchableOpacity disabled={busy} onPress={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await unregisterPlayer(teamId, registration.id);
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not remove player.");
                    } finally {
                      setBusy(false);
                    }
                  }}>
                    <Text style={S.danger}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {isEditing ? (
                <View style={{ gap: 8 }}>
                  <View style={[S.row, { alignItems: "flex-start" }]}>
                    <Field label="First name" value={draft.first_name}
                           onChangeText={(first_name: string) => setDraft({ ...draft, first_name })} />
                    <Field label="Last name" value={draft.last_name}
                           onChangeText={(last_name: string) => setDraft({ ...draft, last_name })} />
                  </View>
                  <Field label="Date of birth (YYYY-MM-DD)" value={draft.dob}
                         onChangeText={(dob: string) => setDraft({ ...draft, dob })} />
                  <Text style={S.dim}>POSITION</Text>
                  <Choice value={position} options={positions}
                          onChange={(value) => setDraft({ ...draft, position: value })} />
                  <Field label="Shirt number (1-99)" value={draft.jersey_number}
                         keyboardType="number-pad"
                         onChangeText={(jersey_number: string) => setDraft({ ...draft, jersey_number })} />
                  <Btn label="Save player details" busy={busy} onPress={async () => {
                    const jersey = draft.jersey_number.trim() ? Number(draft.jersey_number) : null;
                    if (!draft.first_name.trim() || !draft.last_name.trim()) {
                      setError("First and last name are required.");
                      return;
                    }
                    if (jersey !== null && (!Number.isInteger(jersey) || jersey < 1 || jersey > 99)) {
                      setError("Shirt number must be a whole number from 1 to 99.");
                      return;
                    }
                    setBusy(true);
                    setError(null);
                    try {
                      await updateRegisteredPlayer(teamId, registration.id, {
                        first_name: draft.first_name.trim(),
                        last_name: draft.last_name.trim(),
                        dob: draft.dob.trim() || null,
                        position: draft.position,
                        jersey_number: jersey,
                      });
                      setEditingId(null);
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not save player details.");
                    } finally {
                      setBusy(false);
                    }
                  }} />
                  <Btn label="Choose player photo" tone="ghost" busy={busy}
                       onPress={() => { void uploadPlayerImage(registration.player_id); }} />
                </View>
              ) : null}
            </View>
          );
        })}

      {editable ? (
        <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 }}>
          <Text style={S.label}>ADD PLAYER</Text>
          <View style={[S.wrapRow, { gap: 8 }]}>
            <Field label="First name" value={newPlayer.first_name}
                   onChangeText={(first_name: string) => setNewPlayer({ ...newPlayer, first_name })} />
            <Field label="Last name" value={newPlayer.last_name}
                   onChangeText={(last_name: string) => setNewPlayer({ ...newPlayer, last_name })} />
          </View>
          <View style={[S.wrapRow, { gap: 8 }]}>
            <Field label="DOB (YYYY-MM-DD)" value={newPlayer.dob} placeholder="2005-08-14"
                   onChangeText={(dob: string) => setNewPlayer({ ...newPlayer, dob })} />
            <Field label="Shirt no." value={newPlayer.jersey_number} keyboardType="number-pad"
                   placeholder="10"
                   onChangeText={(jersey_number: string) => setNewPlayer({ ...newPlayer, jersey_number })} />
          </View>
          <Text style={S.dim}>POSITION</Text>
          <Choice value={newPlayer.position as Position} options={positions}
                  onChange={(position) => setNewPlayer({ ...newPlayer, position })} />
          <TouchableOpacity onPress={async () => {
            setError(null);
            try {
              const uri = await pickImage();
              if (uri) setPhotoUri(uri);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not choose a player photo.");
            }
          }} style={[S.chip, { justifyContent: "center", paddingVertical: 10 }]}>
            <Text style={S.link}>{photoUri ? "✓ Player photo selected" : "+ Pick player photo from gallery"}</Text>
          </TouchableOpacity>
          <Btn label="Add player" busy={busy} onPress={() => { void register(); }} />
        </View>
      ) : null}
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

  const uploadLogo = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Allow photo-library access to choose a competition logo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (image.fileSize && image.fileSize > 1_000_000) {
        setError("The competition logo must be under 1 MB.");
        return;
      }
      const type = image.mimeType ?? "image/jpeg";
      if (!["image/png", "image/jpeg", "image/webp"].includes(type)) {
        setError("Choose a PNG, JPG, or WebP image.");
        return;
      }
      await uploadTournamentCrest(t.id, image.uri);
      setSaved(true);
      onChanged();
    } catch (e: any) { setError(e.message); }
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
        <Text style={S.label}>COMPETITION LOGO</Text>
        <View style={[S.wrapRow, { gap: 12, marginTop: 8 }]}>
          <Crest url={t.crest_url} name={t.name} size={56} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={S.muted}>PNG, JPG, or WebP under 1 MB.</Text>
            <Btn label={t.crest_url ? "Update competition logo" : "Upload competition logo"}
                 busy={busy} onPress={uploadLogo} />
          </View>
        </View>
      </View>
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
              <Text style={S.title}>{m.profiles?.display_name || m.profiles?.email || m.user_id || "Member"}</Text>
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
                      {r.profiles?.display_name || r.profiles?.email || "Someone"}
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
