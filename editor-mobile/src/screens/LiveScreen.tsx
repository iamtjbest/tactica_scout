import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import TeamSheet from "../components/TeamSheet";
import { COLORS } from "../theme";
import {
  getTournament, getLineup, setScore, listEvents, addEvent, deleteEvent,
  type Fixture, type TeamRow, type MatchEvent, type FixtureLineup,
} from "../services/api";
import {
  enqueueOfflineAction, flushOfflineQueue, isRetryableNetworkError, readOfflineQueue,
} from "../services/offlineQueue";

/**
 * The reason the mobile editor exists. One thumb, at the side of a
 * pitch, in the sun.
 *
 * Scoreboard and event log stay separate, same as the backend: the
 * score goes up the instant the ball crosses the line, and who scored
 * gets filled in when there's a gap in play. Tying them together means
 * neither gets recorded.
 */
type TeamSide = "home" | "away";
type PrimaryEvent =
  | "goal" | "penalty" | "own_goal" | "yellow"
  | "second_yellow" | "red" | "substitution";
type PenaltyOutcome = "penalty_scored" | "penalty_saved" | "penalty_missed";

const PRIMARY_EVENTS: { id: PrimaryEvent; label: string }[] = [
  { id: "goal", label: "Goal" },
  { id: "penalty", label: "Penalty" },
  { id: "own_goal", label: "Own Goal" },
  { id: "yellow", label: "Yellow" },
  { id: "second_yellow", label: "2nd Yellow" },
  { id: "red", label: "Red" },
  { id: "substitution", label: "Sub" },
];

const PENALTY_OUTCOMES: { id: PenaltyOutcome; label: string }[] = [
  { id: "penalty_scored", label: "Penalty Scored" },
  { id: "penalty_saved", label: "Penalty Saved" },
  { id: "penalty_missed", label: "Penalty Missed" },
];

const EVENT_LABEL: Record<string, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  penalty_scored: "Penalty",
  penalty_saved: "Penalty saved",
  penalty_missed: "Penalty missed",
  yellow: "Yellow",
  second_yellow: "2nd yellow",
  red: "Red",
  substitution: "Sub",
};

const STATUSES = ["live", "ht", "ft", "postponed"];

export default function LiveScreen({ route }: any) {
  const { tournamentId, fixtureId } = route.params;
  const [fx, setFx] = useState<Fixture | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [lineupData, setLineupData] = useState<FixtureLineup | null>(null);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [implied, setImplied] = useState<{ home: number; away: number } | null>(null);
  const [minute, setMinute] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [kickoffNow, setKickoffNow] = useState(() => Date.now());
  const [teamSide, setTeamSide] = useState<TeamSide>("home");
  const [primaryType, setPrimaryType] = useState<PrimaryEvent>("goal");
  const [penaltyOutcome, setPenaltyOutcome] = useState<PenaltyOutcome>("penalty_scored");
  const [playerId, setPlayerId] = useState("");
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
  const [syncScore, setSyncScore] = useState(true);
  // Score and events first: that is what someone at the pitch needs in
  // the second after a goal. The sheet is filled in before kickoff.
  const [pane, setPane] = useState<"match" | "sheet">(
    route.params?.pane === "sheet" ? "sheet" : "match"
  );

  useEffect(() => {
    setPane(route.params?.pane === "sheet" ? "sheet" : "match");
  }, [fixtureId, route.params?.pane]);

  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await readOfflineQueue();
      setQueueCount(queue.filter((item) => item.fixtureId === fixtureId).length);
    } catch {
      setQueueCount(0);
    }
  }, [fixtureId]);

  const load = useCallback(() => {
    getTournament(tournamentId).then((d) => {
      setTeams(d.teams);
      setFx(d.fixtures.find((f) => f.id === fixtureId) ?? null);
    }).catch((e) => setError(e.message));
    getLineup(fixtureId)
      .then((d) => { setLineupData(d); setLineupError(null); })
      .catch((e) => setLineupError(e.message));
    listEvents(fixtureId).then((d) => setEvents(d.events)).catch((e) => setError(e.message));
    refreshQueueCount();
  }, [tournamentId, fixtureId, refreshQueueCount]);

  const applyOfflineAction = useCallback(async (action: {
    fixtureId: string; kind: "score" | "event"; payload: Record<string, unknown>;
  }) => {
    if (action.kind === "event") {
      await addEvent(action.fixtureId, action.payload);
      return;
    }

    const incrementSide = action.payload.increment_side;
    if (incrementSide === "home" || incrementSide === "away") {
      const queuedTournamentId = typeof action.payload.tournament_id === "string"
        ? action.payload.tournament_id : tournamentId;
      const tournament = await getTournament(queuedTournamentId);
      const queuedFixture = tournament.fixtures.find((item) => item.id === action.fixtureId);
      if (!queuedFixture) throw new Error("Queued fixture was not found.");
      await setScore(action.fixtureId, {
        home_score: (queuedFixture.home_score ?? 0) + (incrementSide === "home" ? 1 : 0),
        away_score: (queuedFixture.away_score ?? 0) + (incrementSide === "away" ? 1 : 0),
        ...(queuedFixture.status === "scheduled" ? { status: "live" } : {}),
      });
      return;
    }

    await setScore(action.fixtureId, action.payload);
  }, [tournamentId]);

  const syncOfflineActions = useCallback(async () => {
    const before = await readOfflineQueue();
    if (before.length === 0) {
      await refreshQueueCount();
      return false;
    }
    await flushOfflineQueue(applyOfflineAction);
    await refreshQueueCount();
    const after = await readOfflineQueue();
    return after.length < before.length;
  }, [applyOfflineAction, refreshQueueCount]);

  useFocusEffect(useCallback(() => {
    let active = true;
    let syncing = false;
    const sync = async (refreshAfterSync: boolean) => {
      if (syncing) return;
      syncing = true;
      try {
        const changed = await syncOfflineActions();
        if (active && (refreshAfterSync || changed)) load();
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        syncing = false;
      }
    };
    void sync(true);
    const timer = setInterval(() => {
      if (queueCount > 0) void sync(false);
    }, 25_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, queueCount, syncOfflineActions]));

  useEffect(() => {
    if (!fx?.kickoff_at || fx.status !== "scheduled") return;
    const unlockAt = new Date(fx.kickoff_at).getTime() - 15 * 60_000;
    const delay = unlockAt - Date.now();
    if (delay <= 0) {
      setKickoffNow(Date.now());
      return;
    }
    const timer = setTimeout(() => setKickoffNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [fx?.kickoff_at, fx?.status]);

  if (error && !fx) return <Text style={s.error}>{error}</Text>;
  if (!fx) return <Text style={s.muted}>Loading...</Text>;

  const name = (tid: string) => teams.find((t) => t.id === tid)?.clubs?.name ?? "Unknown";
  const home = fx.home_score ?? 0;
  const away = fx.away_score ?? 0;
  const noScores = fx.home_score == null || fx.away_score == null;
  const kickoffReached = fx.status !== "scheduled" || !fx.kickoff_at ||
    kickoffNow + 15 * 60_000 >= new Date(fx.kickoff_at).getTime();

  const activeTeamId = teamSide === "home" ? fx.home_team_id : fx.away_team_id;
  const opposingTeamId = teamSide === "home" ? fx.away_team_id : fx.home_team_id;
  const teamPlayers = (teamId: string) => {
    if (!lineupData) return [];
    const side = teamId === fx.home_team_id ? "home" : "away";
    return (lineupData.lineups[side]?.squad ?? [])
      .filter((entry) => entry.players?.id)
      .map((entry) => ({
        id: entry.players!.id,
        pos: (entry.position || "").toUpperCase(),
        label: `${entry.jersey_number != null ? `#${entry.jersey_number} ` : ""}${entry.players!.first_name} ${entry.players!.last_name}`.trim(),
      }));
  };
  const activeSquad = teamPlayers(activeTeamId);
  const opposingSquad = teamPlayers(opposingTeamId).sort((a, b) =>
    Number(!a.pos.startsWith("G")) - Number(!b.pos.startsWith("G"))
  );
  const resolvedEventType = primaryType === "penalty" ? penaltyOutcome : primaryType;
  const isScoringEvent = resolvedEventType === "goal" || resolvedEventType === "penalty_scored";
  const isOwnGoal = resolvedEventType === "own_goal";
  const creditSide: TeamSide = isOwnGoal
    ? (teamSide === "home" ? "away" : "home")
    : teamSide;
  const isSavedPenalty = resolvedEventType === "penalty_saved";
  const showRelatedPlayer = primaryType === "goal" ||
    primaryType === "substitution" || isSavedPenalty;
  const relatedSquad = isSavedPenalty ? opposingSquad : activeSquad;
  const relatedLabel = primaryType === "goal"
    ? "Assist (optional)"
    : primaryType === "substitution"
      ? "Player coming on"
      : "Saved by goalkeeper";

  const push = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try {
      const next = await setScore(fixtureId, patch);
      setFx(next);
      await refreshQueueCount();
    } catch (e: any) {
      if (await isRetryableNetworkError(e)) {
        await enqueueOfflineAction({
          id: `${fixtureId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fixtureId,
          kind: "score",
          payload: patch,
          createdAt: Date.now(),
          tries: 0,
        });
        setError("Saved offline. It will sync when the connection returns.");
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const bump = (side: "home" | "away", by: number) =>
    push({
      [`${side}_score`]: Math.max(0, (side === "home" ? home : away) + by),
      ...(fx.status === "scheduled" ? { status: "live" } : {}),
    });

  const queueScoreIncrement = async (side: TeamSide) => {
    await enqueueOfflineAction({
      id: `${fixtureId}-score-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fixtureId,
      kind: "score",
      payload: { tournament_id: tournamentId, increment_side: side },
      createdAt: Date.now(),
      tries: 0,
    });
    setFx((current) => current ? {
      ...current,
      home_score: (current.home_score ?? 0) + (side === "home" ? 1 : 0),
      away_score: (current.away_score ?? 0) + (side === "away" ? 1 : 0),
      ...(current.status === "scheduled" ? { status: "live" } : {}),
    } : current);
    await refreshQueueCount();
  };

  const submitEvent = async () => {
    const eventMinute = minute.trim() === "" ? null : Number(minute);
    if (eventMinute !== null &&
        (!Number.isInteger(eventMinute) || eventMinute < 0 || eventMinute > 130)) {
      setError("Minute must be a whole number from 0 to 130.");
      return;
    }
    if (!playerId) {
      setError("Select the player affected by this event.");
      return;
    }
    if ((primaryType === "substitution" || resolvedEventType === "penalty_saved") &&
        !relatedPlayerId) {
      setError(primaryType === "substitution"
        ? "Select the player coming on."
        : "Select the goalkeeper who saved the penalty.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const payload = {
      tournament_team_id: activeTeamId,
      type: resolvedEventType,
      player_id: playerId,
      related_player_id: relatedPlayerId || null,
      minute: eventMinute,
    };
    const shouldSyncScore = syncScore && (isScoringEvent || isOwnGoal);
    let eventSaved = false;
    let eventQueued = false;

    try {
      try {
        const result = await addEvent(fixtureId, payload);
        setImplied(result.score_from_events);
        setEvents((current) => [...current, result.event]);
        eventSaved = true;
      } catch (e: any) {
        if (!(await isRetryableNetworkError(e))) throw e;
        await enqueueOfflineAction({
          id: `${fixtureId}-event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fixtureId,
          kind: "event",
          payload,
          createdAt: Date.now(),
          tries: 0,
        });
        eventSaved = true;
        eventQueued = true;
      }

      if (!eventSaved) return;

      if (shouldSyncScore) {
        if (eventQueued) {
          await queueScoreIncrement(creditSide);
          setNotice("Event and score queued offline. They will sync when connection returns.");
        } else {
          try {
            const next = await setScore(fixtureId, {
              home_score: home + (creditSide === "home" ? 1 : 0),
              away_score: away + (creditSide === "away" ? 1 : 0),
              ...(fx.status === "scheduled" ? { status: "live" } : {}),
            });
            setFx(next);
          } catch (scoreError: any) {
            if (await isRetryableNetworkError(scoreError)) {
              await queueScoreIncrement(creditSide);
              setNotice("Event recorded. Score update queued offline.");
            } else {
              setError(`Event recorded, but scoreboard update failed: ${scoreError.message}`);
            }
          }
        }
      } else if (eventQueued) {
        setNotice("Event queued offline. It will sync when connection returns.");
      }

      setMinute("");
      setPlayerId("");
      setRelatedPlayerId("");
      if (!eventQueued) {
        listEvents(fixtureId)
          .then((result) => setEvents(result.events))
          .catch((e) => setError(e.message));
      } else {
        await refreshQueueCount();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const mismatch = implied && (implied.home !== home || implied.away !== away);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.paneTabs}>
        {([["match", "Score & events"], ["sheet", "Team sheet"]] as const).map(([k, label]) => (
          <TouchableOpacity key={k} onPress={() => setPane(k)}
                            style={[s.panePill, { flex: 1 }, pane === k && s.panePillOn]}>
            <Text style={[s.panePillText, pane === k && { color: COLORS.volt }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {queueCount > 0 ? (
        <Text style={[s.muted, { color: "#FFB830" }]}>Offline queue: {queueCount} pending update{queueCount === 1 ? "" : "s"}</Text>
      ) : null}

      {pane === "sheet" ? (
        <TeamSheet
          fixtureId={fixtureId}
          homeName={name(fx.home_team_id)}
          awayName={name(fx.away_team_id)}
        />
      ) : (
      <>
      {!kickoffReached ? (
        <View style={[s.card, { borderColor: "rgba(255,184,48,0.4)", backgroundColor: "rgba(255,184,48,0.05)" }]}>
          <Text style={{ color: "#FFB830", fontSize: 13, fontWeight: "700" }}>
            Match hasn&apos;t kicked off yet
          </Text>
          <Text style={s.muted}>
            Scheduled for{" "}
            {new Date(fx.kickoff_at!).toLocaleString("en-GB", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
            . Score and event logging unlock automatically at kickoff. You can still edit the team sheet now.
          </Text>
        </View>
      ) : null}
      <View style={s.card}>
        <View style={s.board}>
          <Side label={name(fx.home_team_id)} score={home} disabled={busy || !kickoffReached}
                onUp={() => bump("home", 1)} onDown={() => bump("home", -1)} />
          <Text style={s.status}>{String(fx.status).toUpperCase()}</Text>
          <Side label={name(fx.away_team_id)} score={away} disabled={busy || !kickoffReached}
                onUp={() => bump("away", 1)} onDown={() => bump("away", -1)} />
        </View>

        <View style={s.statusRow}>
          {STATUSES.map((st) => (
            <TouchableOpacity key={st} disabled={busy || !kickoffReached} onPress={() => push({ status: st })}
              style={[s.chip, fx.status === st && s.chipOn]}>
              <Text style={[s.chipText, fx.status === st && { color: COLORS.volt }]}>
                {st.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* The backend refuses ft without both scores. Say so before
            the tap, not after it fails. */}
        {noScores ? (
          <Text style={s.hint}>Set both scores before marking the match finished.</Text>
        ) : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      {mismatch ? (
        <View style={[s.card, { borderColor: "rgba(255,184,48,0.4)" }]}>
          <Text style={{ color: "#FFB830", fontSize: 13 }}>
            Events add up to {implied!.home}-{implied!.away}, scoreboard says {home}-{away}.
          </Text>
          <Text style={s.muted}>Nothing is changed automatically. Fix whichever is wrong.</Text>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.label}>LOG MATCH EVENT</Text>

        <View>
          <Text style={s.stepLabel}>1. TEAM</Text>
          <View style={s.eventRow}>
            {(["home", "away"] as const).map((side) => (
              <TouchableOpacity
                key={side}
                style={[s.choiceBtn, teamSide === side && s.choiceBtnOn]}
                onPress={() => {
                  setTeamSide(side);
                  setPlayerId("");
                  setRelatedPlayerId("");
                }}
              >
                <Text style={[s.choiceText, teamSide === side && s.choiceTextOn]}>
                  {name(side === "home" ? fx.home_team_id : fx.away_team_id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={s.stepLabel}>2. EVENT TYPE</Text>
          <View style={s.eventRow}>
            {PRIMARY_EVENTS.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[s.choiceBtn, primaryType === event.id && s.choiceBtnOn]}
                onPress={() => {
                  setPrimaryType(event.id);
                  setPlayerId("");
                  setRelatedPlayerId("");
                }}
              >
                <Text style={[s.choiceText, primaryType === event.id && s.choiceTextOn]}>
                  {event.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {primaryType === "penalty" ? (
            <View style={s.penaltyPanel}>
              <Text style={s.stepLabel}>PENALTY OUTCOME</Text>
              <View style={s.eventRow}>
                {PENALTY_OUTCOMES.map((outcome) => (
                  <TouchableOpacity
                    key={outcome.id}
                    style={[s.choiceBtn, penaltyOutcome === outcome.id && s.choiceBtnOn]}
                    onPress={() => {
                      setPenaltyOutcome(outcome.id);
                      setRelatedPlayerId("");
                    }}
                  >
                    <Text style={[s.choiceText, penaltyOutcome === outcome.id && s.choiceTextOn]}>
                      {outcome.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View>
          <Text style={s.stepLabel}>3. MINUTE & PLAYER AFFECTED</Text>
          <TextInput
            style={s.input}
            value={minute}
            onChangeText={setMinute}
            keyboardType="number-pad"
            placeholder="Minute (optional, 0–130)"
            placeholderTextColor={COLORS.textDim}
          />
          <Text style={s.muted}>
            {primaryType === "substitution"
              ? "Player off"
              : primaryType === "penalty"
                ? "Penalty taker"
                : primaryType === "goal"
                  ? "Goal scorer"
                  : "Player affected"}
          </Text>
          {lineupError ? <Text style={s.error}>{lineupError}</Text> : null}
          {activeSquad.length === 0 ? (
            <Text style={s.muted}>No registered players are available for this team.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.eventRow}>
                {activeSquad.map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    style={[s.choiceBtn, playerId === player.id && s.choiceBtnOn]}
                    onPress={() => {
                      setPlayerId(player.id);
                      if (relatedPlayerId === player.id) setRelatedPlayerId("");
                    }}
                  >
                    <Text style={[s.choiceText, playerId === player.id && s.choiceTextOn]}>
                      {player.label}{player.pos ? ` (${player.pos})` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {showRelatedPlayer ? (
            <View style={{ marginTop: 10 }}>
              <Text style={s.stepLabel}>
                {primaryType === "penalty" ? `${relatedLabel.toUpperCase()} · ${name(opposingTeamId).toUpperCase()}` : relatedLabel.toUpperCase()}
              </Text>
              {relatedSquad.length === 0 ? (
                <Text style={s.muted}>No players are available for this selection.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.eventRow}>
                    {primaryType === "goal" ? (
                      <TouchableOpacity
                        style={[s.choiceBtn, !relatedPlayerId && s.choiceBtnOn]}
                        onPress={() => setRelatedPlayerId("")}
                      >
                        <Text style={[s.choiceText, !relatedPlayerId && s.choiceTextOn]}>
                          No assist
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {relatedSquad
                      .filter((player) => player.id !== playerId)
                      .map((player) => (
                        <TouchableOpacity
                          key={player.id}
                          style={[s.choiceBtn, relatedPlayerId === player.id && s.choiceBtnOn]}
                          onPress={() => setRelatedPlayerId(player.id)}
                        >
                          <Text style={[s.choiceText, relatedPlayerId === player.id && s.choiceTextOn]}>
                            {player.label}{player.pos ? ` (${player.pos})` : ""}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>

        {(isScoringEvent || isOwnGoal) ? (
          <TouchableOpacity
            onPress={() => setSyncScore(!syncScore)}
            style={s.scoreSync}
          >
            <Text style={s.body}>
              Also add +1 to {name(creditSide === "home" ? fx.home_team_id : fx.away_team_id)}
            </Text>
            <Text style={[s.choiceText, syncScore && s.choiceTextOn]}>
              {syncScore ? "ON" : "OFF"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}
        {notice ? <Text style={s.notice}>{notice}</Text> : null}
        <TouchableOpacity
          disabled={busy || !kickoffReached}
          style={[s.recordBtn, (busy || !kickoffReached) && { opacity: 0.5 }]}
          onPress={() => { void submitEvent(); }}
        >
          <Text style={s.recordBtnText}>{busy ? "Recording..." : "4. Record Event"}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.label}>TIMELINE</Text>
        {events.length === 0 ? (
          <Text style={s.muted}>Nothing logged yet.</Text>
        ) : events.map((e) => (
          <View key={e.id} style={s.timelineRow}>
            <Text style={s.timelineText} numberOfLines={1}>
              <Text style={s.mono}>{e.minute != null ? `${e.minute}'  ` : "--  "}</Text>
              {EVENT_LABEL[e.type] ?? String(e.type).replace(/_/g, " ")}
              {e.type === "substitution"
                ? ` · Out: ${e.players ? `${e.players.first_name} ${e.players.last_name}` : "—"} • In: ${e.related_player ? `${e.related_player.first_name} ${e.related_player.last_name}` : "—"}`
                : e.players ? ` — ${e.players.first_name} ${e.players.last_name}` : ""}
              {e.type === "goal" && e.related_player
                ? ` (Assist: ${e.related_player.first_name} ${e.related_player.last_name})`
                : e.type === "penalty_saved" && e.related_player
                  ? ` (Saved by: ${e.related_player.first_name} ${e.related_player.last_name})`
                  : ""}
            </Text>
            <TouchableOpacity onPress={async () => {
              try { await deleteEvent(fixtureId, e.id); load(); }
              catch (err: any) { setError(err.message); }
            }}>
              <Text style={s.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      </>
      )}
    </ScrollView>
  );
}

function Side({ label, score, disabled, onUp, onDown }: {
  label: string; score: number; disabled: boolean; onUp: () => void; onDown: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={s.sideName} numberOfLines={1}>{label}</Text>
      <Text style={s.score}>{score}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TouchableOpacity disabled={disabled} onPress={onDown} style={s.minus}>
          <Text style={s.minusText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={disabled} onPress={onUp} style={s.plus}>
          <Text style={s.plusText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  paneTabs: { flexDirection: "row", gap: 6 },
  panePill: {
    paddingVertical: 9, borderRadius: 999, borderWidth: 1,
    borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
    alignItems: "center",
  },
  panePillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  panePillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },

  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 6,
  },
  board: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideName: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  score: { color: COLORS.volt, fontSize: 48, fontWeight: "900", marginTop: 4 },
  status: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700", width: 54, textAlign: "center" },
  // 48pt targets: this is used one-handed, outdoors, in a hurry.
  plus: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.volt,
          alignItems: "center", justifyContent: "center" },
  plusText: { color: COLORS.bg, fontSize: 24, fontWeight: "900" },
  minus: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.cardElevated,
           alignItems: "center", justifyContent: "center" },
  minusText: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, justifyContent: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
          borderWidth: 1, borderColor: COLORS.cardBorder },
  chipOn: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.cardBorderActive },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800" },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  body: { color: COLORS.text, fontSize: 13 },
  eventRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  stepLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "700",
               letterSpacing: 1, marginTop: 8 },
  choiceBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9,
               backgroundColor: COLORS.cardElevated, borderWidth: 1,
               borderColor: COLORS.cardBorder },
  choiceBtnOn: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.cardBorderActive },
  choiceText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700" },
  choiceTextOn: { color: COLORS.volt },
  penaltyPanel: { marginTop: 10, padding: 10, borderRadius: 10,
                  backgroundColor: COLORS.cardElevated, borderWidth: 1,
                  borderColor: COLORS.cardBorderActive },
  scoreSync: { flexDirection: "row", alignItems: "center",
               justifyContent: "space-between", paddingVertical: 8 },
  recordBtn: { backgroundColor: COLORS.volt, borderRadius: 10,
               paddingVertical: 13, alignItems: "center", marginTop: 4 },
  recordBtnText: { color: COLORS.bg, fontWeight: "900", fontSize: 14 },
  input: { backgroundColor: COLORS.cardElevated, borderRadius: 10, paddingHorizontal: 14,
           paddingVertical: 12, color: COLORS.text, borderWidth: 1, borderColor: COLORS.cardBorder },
  timelineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 gap: 10, paddingVertical: 6 },
  timelineText: { color: COLORS.text, fontSize: 13, flexShrink: 1 },
  mono: { color: COLORS.textSecondary, fontSize: 12 },
  remove: { color: COLORS.textDim, fontSize: 11 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  notice: { color: COLORS.win, fontSize: 12, fontWeight: "600", marginTop: 8 },
  hint: { color: COLORS.textDim, fontSize: 11, textAlign: "center", marginTop: 10 },
  error: { color: "#FF4444", fontSize: 13, fontWeight: "600", marginTop: 8 },
});
