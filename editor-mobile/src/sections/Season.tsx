/**
 * src/sections/Season.tsx
 *
 * The season strip and the match filters, matching the web Matches
 * screen. Progress is worked out from the fixtures rather than stored:
 * a stored column goes stale the moment a score is corrected, and
 * correcting scores is the most common thing an organiser does.
 */
import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { COLORS } from "../theme";
import { S } from "./kit";
import { sortRounds, type Tournament, type Fixture, type TeamRow } from "../services/api";

export function SeasonStrip({ t, fixtures }: { t: Tournament; fixtures: Fixture[] }) {
  const start = new Date(t.start_date).getTime();
  const end = new Date(t.end_date).getTime();
  const byTime = end > start
    ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
    : 0;

  const played = fixtures.filter((f) => String(f.status).toLowerCase() === "ft").length;
  const pct = Math.round(fixtures.length ? (played / fixtures.length) * 100 : byTime);
  const ended = fixtures.length > 0 && played === fixtures.length;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={{ gap: 10 }}>
      <View style={S.card}>
        <View style={S.row}>
          <Text style={S.label}>SEASON PROGRESS</Text>
          <Text style={[S.body, { fontWeight: "800" }]}>{pct}%</Text>
        </View>
        <View style={{
          height: 6, borderRadius: 999, backgroundColor: COLORS.cardElevated,
          overflow: "hidden", marginTop: 8,
        }}>
          <View style={{
            height: "100%", width: `${pct}%`, borderRadius: 999,
            backgroundColor: ended ? COLORS.win : COLORS.volt,
          }} />
        </View>
        <View style={[S.row, { marginTop: 8 }]}>
          <Text style={S.dim}>{fmt(t.start_date)}</Text>
          <Text style={S.dim}>{fmt(t.end_date)}</Text>
        </View>
      </View>

      {ended ? (
        <View style={[S.card, { borderColor: "rgba(34,197,94,0.35)" }]}>
          <Text style={S.body}>
            {t.name} has ended — all {fixtures.length} matches played.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function MatchFilters({
  fixtures, teams, sub, round, team, onSub, onRound, onTeam,
}: {
  fixtures: Fixture[]; teams: TeamRow[];
  sub: string; round: string; team: string;
  onSub: (v: string) => void; onRound: (v: string) => void; onTeam: (v: string) => void;
}) {
  const subs = Array.from(new Set(fixtures.map((f) => f.group_name).filter(Boolean))) as string[];
  const rounds = sortRounds(
    Array.from(new Set(fixtures.map((f) => f.round).filter(Boolean))) as string[]
  );

  const Pill = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}
      style={[S.chip, on && {
        borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted }]}>
      <Text style={[S.chipText, on && { color: COLORS.volt, fontWeight: "700" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (fixtures.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      {subs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}>
          <Pill on={!sub} label="All groups" onPress={() => onSub("")} />
          {subs.map((g) => (
            <Pill key={g} on={sub === g} label={`Group ${g}`} onPress={() => onSub(g)} />
          ))}
        </ScrollView>
      ) : null}

      {rounds.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}>
          <Pill on={!round} label="All rounds" onPress={() => onRound("")} />
          {rounds.map((r) => (
            <Pill key={r} on={round === r} label={r} onPress={() => onRound(r)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}>
        <Pill on={!team} label="All teams" onPress={() => onTeam("")} />
        {teams.map((tm) => (
          <Pill key={tm.id} on={team === tm.id} label={tm.clubs?.name ?? "Unknown"}
                onPress={() => onTeam(tm.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

export function EmptyMatches() {
  return (
    <View style={[S.card, { alignItems: "center", paddingVertical: 32 }]}>
      <Text style={S.title}>No matches yet</Text>
      <Text style={[S.muted, { textAlign: "center", marginTop: 4 }]}>
        Matches appear here once the schedule is set.
      </Text>
    </View>
  );
}
