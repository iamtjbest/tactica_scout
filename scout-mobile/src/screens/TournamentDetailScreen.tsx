/**
 * src/screens/TournamentDetailScreen.tsx
 *
 * A published local competition, as a fan sees it. Mirrors the web
 * /tournament/[id] page: Matches, Table, Teams.
 *
 * Opens on Matches rather than the table: someone arriving mid-season
 * wants today's score, and the table is one tap away. A knockout has no
 * table at all, so that tab isn't drawn for one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../theme';
import {
  getTournament,
  type TournamentDetail, type TournamentFixture, type TournamentStanding,
} from '../services/api';

type Tab = 'matches' | 'table' | 'teams';

/**
 * Organisers type the group as "B" or as "Group B". Prefixing blindly is
 * what produced the "GROUP GROUP B" heading, so this is the one place
 * that decides the label.
 */
function groupLabel(name?: string | null): string {
  const g = (name || '').trim();
  if (!g) return '';
  return /^group\b/i.test(g) ? g : `Group ${g}`;
}

/**
 * "5 Sep – 12 Dec 2026" rather than the raw ISO the API stores. The year
 * is printed on both ends only when the season crosses into a new one.
 */
function seasonRange(start?: string | null, end?: string | null): string {
  const fmt = (iso: string, withYear: boolean) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    return new Date(t).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
    });
  };
  if (!start && !end) return '';
  if (!start) return fmt(end as string, true);
  if (!end) return `From ${fmt(start, true)}`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

export const TournamentDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const { tournamentId, tournamentName } = route.params;
  const [d, setD] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('matches');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getTournament(tournamentId)
      .then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: tournamentName || 'Competition' });
  }, [navigation, tournamentName]);

  if (error && !d) return <Text style={s.error}>{error}</Text>;
  if (!d) {
    return (
      <View style={s.center}><ActivityIndicator color={COLORS.volt} /></View>
    );
  }

  const hasTable = Boolean(
    d.standings?.length || Object.keys(d.group_tables ?? {}).length
  );
  const tabs: Tab[] = hasTable ? ['matches', 'table', 'teams'] : ['matches', 'teams'];

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                        onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <View>
        <Text style={s.title}>{d.tournament.name}</Text>
        <Text style={s.muted}>
          {d.tournament.organizing_body} • {d.tournament.country}
        </Text>
        <Text style={s.mono}>{seasonRange(d.tournament.start_date, d.tournament.end_date)}</Text>
      </View>

      <View style={s.tabs}>
        {tabs.map((x) => (
          <TouchableOpacity key={x} onPress={() => setTab(x)}
                            style={[s.pill, tab === x && s.pillOn]}>
            <Text style={[s.pillText, tab === x && s.pillTextOn]}>
              {x.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'matches' && (
        <Matches fixtures={d.fixtures} navigation={navigation}
                 tournamentId={tournamentId} />
      )}

      {tab === 'table' && hasTable && (
        <View style={{ gap: 16 }}>
          {d.group_tables
            ? Object.keys(d.group_tables).sort().map((g) => (
                <View key={g} style={{ gap: 6 }}>
                  <Text style={s.label}>{groupLabel(g).toUpperCase()}</Text>
                  <Table rows={d.group_tables![g]} />
                </View>
              ))
            : <Table rows={d.standings ?? []} />}
          <Text style={s.mono}>
            Built from finished matches only.
            {d.points_rules
              ? ` ${d.points_rules.win} for a win, ${d.points_rules.draw} for a draw.`
              : ''}
          </Text>
        </View>
      )}

      {tab === 'teams' && (
        <View style={{ gap: 8 }}>
          {d.teams.map((tm) => (
            <View key={tm.team_id} style={s.card}>
              <View style={s.row}>
                <Crest url={tm.crest_url} name={tm.name} size={22} />
                <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{tm.name}</Text>
                {tm.group_name ? (
                  <Text style={s.mono}>{groupLabel(tm.group_name)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

function Crest({ url, name, size = 20 }: {
  url: string | null; name: string; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join('');
    return (
      <View style={[s.crest, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={s.crestText}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} onError={() => setFailed(true)}
           style={{ width: size, height: size, borderRadius: size / 2 }}
           resizeMode="cover" />
  );
}

/** Grouped by round or group, in playing order. A flat list of thirty
 *  fixtures is unusable on a phone. */
function Matches({ fixtures, navigation, tournamentId }: {
  fixtures: TournamentFixture[]; navigation: any; tournamentId: string;
}) {
  if (fixtures.length === 0) {
    return <Text style={s.muted}>No fixtures published yet.</Text>;
  }
  const grouped: Record<string, TournamentFixture[]> = {};
  for (const fx of fixtures) {
    // Organisers type the group as "B" or as "Group B". Prefixing blindly
    // is what produced the "GROUP GROUP B" heading.
    // Group and round both, so matchday 7 and 8 don't run into one list.
    const key = [groupLabel(fx.group_name), (fx.round || '').trim()]
      .filter(Boolean).join(' · ') || 'Fixtures';
    (grouped[key] ||= []).push(fx);
  }

  return (
    <View style={{ gap: 16 }}>
      {Object.keys(grouped).map((heading) => (
        <View key={heading} style={{ gap: 8 }}>
          <Text style={s.label}>{heading.toUpperCase()}</Text>
          {grouped[heading]
            .slice()
            .sort((a, b) => (a.kickoff_at || '').localeCompare(b.kickoff_at || ''))
            .map((fx) => {
              const live = ['live', 'ht'].includes(String(fx.status).toLowerCase());
              return (
                <TouchableOpacity
                  key={fx.id} style={s.card}
                  onPress={() => navigation.navigate('TournamentMatch', {
                    tournamentId, fixtureId: fx.id,
                  })}
                >
                  <View style={s.row}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Side name={fx.home_team} crest={fx.home_crest} score={fx.home_score} />
                      <Side name={fx.away_team} crest={fx.away_crest} score={fx.away_score} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.mono, live && { color: '#FF4444' }]}>
                        {live ? 'LIVE' : String(fx.status).toUpperCase()}
                      </Text>
                      <Text style={s.mono}>
                        {fx.kickoff_at
                          ? new Date(fx.kickoff_at).toLocaleString('en-GB', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>
      ))}
    </View>
  );
}

function Side({ name, crest, score }: {
  name: string | null; crest: string | null; score: number | null;
}) {
  return (
    <View style={s.row}>
      <Crest url={crest} name={name ?? '?'} size={18} />
      <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{name ?? 'Unknown'}</Text>
      <Text style={s.score}>{score ?? '–'}</Text>
    </View>
  );
}

function Table({ rows }: { rows: TournamentStanding[] }) {
  if (rows.length === 0) return <Text style={s.muted}>No finished matches yet.</Text>;
  return (
    <View style={s.card}>
      <View style={[s.row, { paddingBottom: 6 }]}>
        <Text style={[s.mono, { width: 18 }]}>#</Text>
        <Text style={[s.mono, { flex: 1 }]}>TEAM</Text>
        <Text style={[s.mono, s.col]}>P</Text>
        <Text style={[s.mono, s.col]}>W</Text>
        <Text style={[s.mono, s.col]}>D</Text>
        <Text style={[s.mono, s.col]}>L</Text>
        <Text style={[s.mono, s.colWide]}>GD</Text>
        <Text style={[s.mono, s.colWide]}>PTS</Text>
      </View>
      {rows.map((r) => (
        <View key={r.team_id} style={[s.row, { paddingVertical: 6 }]}>
          <Text style={[s.mono, { width: 18 }]}>{r.position}</Text>
          <View style={[s.row, { flex: 1 }]}>
            <Crest url={r.crest_url} name={r.name} size={16} />
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
          </View>
          <Text style={[s.cell, s.col]}>{r.played}</Text>
          <Text style={[s.cell, s.col]}>{r.won}</Text>
          <Text style={[s.cell, s.col]}>{r.drawn}</Text>
          <Text style={[s.cell, s.col]}>{r.lost}</Text>
          <Text style={[s.cell, s.colWide]}>
            {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
          </Text>
          <Text style={[s.pts, s.colWide]}>{r.points}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  body: { color: COLORS.text, fontSize: 13 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  mono: { color: COLORS.textDim, fontSize: 10 },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  score: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  pts: { color: COLORS.volt, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  // Six numeric columns have to fit beside the club name at 390pt.
  col: { width: 18, textAlign: 'center' },
  colWide: { width: 28, textAlign: 'center' },
  cell: { color: COLORS.textSecondary, fontSize: 12 },
  error: { color: '#FF4444', fontSize: 13, fontWeight: '600', padding: 16 },
  tabs: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: COLORS.card,
  },
  pillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  pillText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  pillTextOn: { color: COLORS.volt },
  crest: {
    backgroundColor: COLORS.cardElevated, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  crestText: { color: COLORS.textSecondary, fontSize: 8, fontWeight: '700' },
});

export default TournamentDetailScreen;
