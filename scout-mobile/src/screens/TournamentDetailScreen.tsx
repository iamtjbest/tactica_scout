// src/screens/TournamentDetailScreen.tsx - Local competition hub (full parity with LeaguesScreen detail)
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';
import {
  getTournament,
  type MatchSummary,
  type TournamentDetail,
  type TournamentFixture,
  type TournamentStanding,
} from '../services/api';
import { MatchCard } from '../components/MatchCard';
import { FollowButton } from '../components/FollowButton';

type Tab = 'matches' | 'table' | 'teams' | 'stats' | 'bracket';

function groupLabel(name?: string | null): string {
  const g = (name || '').trim();
  if (!g) return '';
  return /^group\b/i.test(g) ? g : `Group ${g}`;
}

function seasonRange(start?: string | null, end?: string | null): string {
  const fmt = (iso: string, withYear: boolean) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    return new Date(t).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  };
  if (!start && !end) return '';
  if (!start) return fmt(end as string, true);
  if (!end) return `From ${fmt(start, true)}`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, !sameYear)} - ${fmt(end, true)}`;
}

function toMatchSummary(fx: TournamentFixture, tournamentId: string, competitionName: string): MatchSummary {
  return {
    event_id: fx.id,
    source: 'local',
    tournament_id: tournamentId,
    home_crest: fx.home_crest,
    away_crest: fx.away_crest,
    home_team: fx.home_team || 'TBD',
    away_team: fx.away_team || 'TBD',
    home_score: fx.home_score ?? 0,
    away_score: fx.away_score ?? 0,
    minute: 0,
    status: fx.status || 'scheduled',
    kickoff: fx.kickoff_at || undefined,
    competition: competitionName,
    round: fx.round,
  };
}

export const TournamentDetailScreen: React.FC<any> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { tournamentId, tournamentName } = route.params;
  const [d, setD] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('matches');
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const load = useCallback(() => {
    getTournament(tournamentId)
      .then((x) => {
        setD(x);
        setError(null);
      })
      .catch((e) => setError(e?.message || 'Failed to load competition.'))
      .finally(() => setRefreshing(false));
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const fixtures = Array.isArray(d?.fixtures) ? d!.fixtures : [];
  const teams = Array.isArray(d?.teams) ? d!.teams : [];
  const standings = Array.isArray(d?.standings) ? d!.standings : [];

  const hasLive = fixtures.some((fx) =>
    ['live', 'ht'].includes(String(fx.status || '').toLowerCase())
  );

  useEffect(() => {
    if (!hasLive) return;
    const timer = setInterval(() => load(), 25_000);
    return () => clearInterval(timer);
  }, [hasLive, load]);

  const openLocalTeam = (teamId: string | undefined, name: string, crest: string | null) => {
    navigation.navigate('TeamDetail', {
      source: 'local',
      tournamentId,
      teamId,
      teamName: name,
      teamCrest: crest,
    });
  };

  const compName = d?.tournament?.name || tournamentName || 'Competition';
  const hasTable = Boolean(standings.length || Object.keys(d?.group_tables ?? {}).length);
  const tabs: { id: Tab; label: string }[] = [
    ...(hasTable ? [{ id: 'table' as const, label: 'Table' }] : []),
    { id: 'matches', label: 'Fixtures' },
    { id: 'teams', label: 'Teams' },
    { id: 'stats', label: 'Player Stats' },
    ...(d?.tournament?.format !== 'league' ? [{ id: 'bracket' as const, label: 'Bracket' }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Top Safe-Area Navigation Bar */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {compName}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {error && !d ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !d || !d.tournament ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading competition data...</Text>
        </View>
      ) : (
        <>
          {/* Competition Hero Header */}
          <View style={styles.leagueHeaderCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.leagueHeroTitle} numberOfLines={1}>
                {d.tournament.name}
              </Text>
              <Text style={styles.leagueHeroCountry} numberOfLines={1}>
                {[d.tournament.organizing_body, d.tournament.country].filter(Boolean).join(' • ').toUpperCase()}
              </Text>
              {!!seasonRange(d.tournament.start_date, d.tournament.end_date) && (
                <Text style={styles.seasonRangeText}>
                  {seasonRange(d.tournament.start_date, d.tournament.end_date)}
                </Text>
              )}
            </View>

            <FollowButton
              teamName={d.tournament.name}
              token={`tournament:${tournamentId}:${d.tournament.name}`}
              size="sm"
            />
          </View>

          {/* Underline Navigation Tabs */}
          <View style={styles.tabRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 18 }}
            >
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => setTab(t.id)}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Tab Body */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 44, paddingTop: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={COLORS.volt}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {/* FIXTURES / BRACKET */}
            {(tab === 'matches' || (tab === 'bracket' && d.tournament.format !== 'league')) && (
              <FixtureGroups
                fixtures={fixtures}
                tournamentId={tournamentId}
                competitionName={d.tournament.name}
                navigation={navigation}
              />
            )}

            {/* TABLE */}
            {tab === 'table' && hasTable && (
              <View style={{ gap: 16 }}>
                {d.group_tables && Object.keys(d.group_tables).length > 0 ? (
                  Object.keys(d.group_tables)
                    .sort()
                    .map((g) => (
                      <View key={g} style={{ gap: 6 }}>
                        <Text style={styles.groupHeading}>{groupLabel(g).toUpperCase()}</Text>
                        <Table
                          rows={Array.isArray(d.group_tables![g]) ? d.group_tables![g] : []}
                          onSelectTeam={(row) => openLocalTeam(row.team_id, row.name, row.crest_url)}
                        />
                      </View>
                    ))
                ) : (
                  <Table
                    rows={standings}
                    onSelectTeam={(row) => openLocalTeam(row.team_id, row.name, row.crest_url)}
                  />
                )}
                <Text style={styles.mono}>
                  Built from finished matches only.
                  {d.points_rules
                    ? ` ${d.points_rules.win} for a win, ${d.points_rules.draw} for a draw.`
                    : ''}
                </Text>
              </View>
            )}

            {/* TEAMS */}
            {tab === 'teams' && (
              <View style={styles.leaderCard}>
                <View style={styles.leaderHeader}>
                  <Text style={styles.leaderTitle}>PARTICIPATING TEAMS ({teams.length})</Text>
                </View>
                {teams.length > 0 ? (
                  teams.map((tm) => (
                    <TouchableOpacity
                      key={tm.team_id}
                      style={styles.leaderRow}
                      activeOpacity={0.75}
                      onPress={() => openLocalTeam(tm.team_id, tm.name, tm.crest_url)}
                    >
                      <Crest url={tm.crest_url} name={tm.name} size={28} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.leaderPlayerName} numberOfLines={1}>
                          {tm.name}
                        </Text>
                        {tm.group_name ? (
                          <Text style={styles.leaderTeamName}>{groupLabel(tm.group_name)}</Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No teams registered yet.</Text>
                )}
              </View>
            )}

            {/* PLAYER STATS */}
            {tab === 'stats' && (
              <View style={{ gap: 14 }}>
                {[
                  {
                    title: 'TOP GOALSCORERS',
                    tag: 'G',
                    rows: Array.isArray(d.top_scorers) ? d.top_scorers : [],
                    color: COLORS.volt,
                  },
                  {
                    title: 'TOP ASSISTS',
                    tag: 'A',
                    rows: Array.isArray(d.top_assists) ? d.top_assists : [],
                    color: '#38bdf8',
                  },
                ].map((board) => (
                  <View key={board.title} style={styles.leaderCard}>
                    <View style={styles.leaderHeader}>
                      <Text style={[styles.leaderTitle, { color: board.color }]}>{board.title}</Text>
                    </View>
                    {board.rows.length > 0 ? (
                      board.rows.slice(0, 10).map((p, idx) => (
                        <TouchableOpacity
                          key={`${board.title}-${p.player_id}-${idx}`}
                          style={styles.leaderRow}
                          onPress={() =>
                            navigation.navigate('TournamentPlayer', {
                              tournamentId,
                              playerId: p.player_id,
                              playerName: p.player_name,
                            })
                          }
                        >
                          <Text style={styles.rankNum}>{idx + 1}</Text>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.leaderPlayerName} numberOfLines={1}>
                              {p.player_name}
                            </Text>
                            <Text style={styles.leaderTeamName} numberOfLines={1}>
                              {p.team_name}
                            </Text>
                          </View>
                          <View style={styles.statValBadge}>
                            <Text style={[styles.statValText, { color: board.color }]}>
                              {p.value}
                            </Text>
                            <Text style={[styles.statValSub, { color: board.color }]}>
                              {board.tag}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>No stats recorded yet.</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

function FixtureGroups({
  fixtures,
  tournamentId,
  competitionName,
  navigation,
}: {
  fixtures: TournamentFixture[];
  tournamentId: string;
  competitionName: string;
  navigation: any;
}) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
        <Text style={styles.emptyText}>No fixtures published yet.</Text>
      </View>
    );
  }

  const sorted = fixtures
    .slice()
    .sort((a, b) => (a.kickoff_at || '').localeCompare(b.kickoff_at || ''));

  const grouped: Record<string, TournamentFixture[]> = {};
  for (const fx of sorted) {
    let key = 'FIXTURES';
    if (fx.kickoff_at) {
      const dt = new Date(fx.kickoff_at);
      if (!Number.isNaN(dt.getTime())) {
        key = dt.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } else {
      key =
        [groupLabel(fx.group_name), (fx.round || '').trim()].filter(Boolean).join(' • ') ||
        'FIXTURES';
    }
    (grouped[key] ||= []).push(fx);
  }

  return (
    <View style={{ gap: 14 }}>
      {Object.keys(grouped).map((heading) => (
        <View key={heading}>
          <Text style={styles.groupHeading}>{heading.toUpperCase()}</Text>
          {grouped[heading].map((fx) => (
            <MatchCard
              key={fx.id}
              match={toMatchSummary(fx, tournamentId, competitionName)}
              onPress={() =>
                navigation.navigate('TournamentMatch', {
                  tournamentId,
                  fixtureId: fx.id,
                  tournamentName: competitionName,
                })
              }
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Crest({ url, name, size = 20 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    const initials = (name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    return (
      <View style={[styles.crest, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.crestText}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="cover"
    />
  );
}

function Table({
  rows,
  onSelectTeam,
}: {
  rows: TournamentStanding[];
  onSelectTeam: (row: TournamentStanding) => void;
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <Text style={styles.noDataText}>No finished matches yet.</Text>;
  }
  return (
    <View style={styles.leaderCard}>
      <View style={[styles.row, { paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.cardBorder }]}>
        <Text style={[styles.mono, { width: 18 }]}>#</Text>
        <Text style={[styles.mono, { flex: 1 }]}>CLUB</Text>
        <Text style={[styles.mono, styles.col]}>P</Text>
        <Text style={[styles.mono, styles.col]}>W</Text>
        <Text style={[styles.mono, styles.col]}>D</Text>
        <Text style={[styles.mono, styles.col]}>L</Text>
        <Text style={[styles.mono, styles.colWide]}>GD</Text>
        <Text style={[styles.mono, styles.colWide]}>PTS</Text>
      </View>
      {rows.map((r) => (
        <TouchableOpacity
          key={r.team_id}
          style={[styles.row, { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.04)' }]}
          activeOpacity={0.7}
          onPress={() => onSelectTeam(r)}
        >
          <Text style={[styles.mono, { width: 18 }]}>{r.position}</Text>
          <View style={[styles.row, { flex: 1 }]}>
            <Crest url={r.crest_url} name={r.name} size={18} />
            <Text style={[styles.leaderPlayerName, { flex: 1 }]} numberOfLines={1}>
              {r.name}
            </Text>
          </View>
          <Text style={[styles.cell, styles.col]}>{r.played}</Text>
          <Text style={[styles.cell, styles.col]}>{r.won}</Text>
          <Text style={[styles.cell, styles.col]}>{r.drawn}</Text>
          <Text style={[styles.cell, styles.col]}>{r.lost}</Text>
          <Text style={[styles.cell, styles.colWide]}>
            {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
          </Text>
          <Text style={[styles.pts, styles.colWide]}>{r.points}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 4 },
  navTitle: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontSize: 15,
    maxWidth: '80%',
    textAlign: 'center',
  },
  leagueHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  leagueHeroTitle: { fontFamily: FONTS.display, color: COLORS.text, fontSize: 18 },
  leagueHeroCountry: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  seasonRangeText: { fontFamily: FONTS.regular, color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  tabRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardElevated,
  },
  tabBtn: { paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabText: { fontFamily: FONTS.medium, color: COLORS.textDim, fontSize: 12 },
  tabTextActive: { fontFamily: FONTS.bold, color: COLORS.volt },
  groupHeading: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mono: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 10 },
  pts: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 13, textAlign: 'center' },
  col: { width: 18, textAlign: 'center' },
  colWide: { width: 28, textAlign: 'center' },
  cell: { color: COLORS.textSecondary, fontSize: 12 },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    minHeight: 200,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  emptyText: { color: COLORS.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },
  errorText: { color: '#FF4444', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  leaderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
  },
  leaderHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 8,
    marginBottom: 8,
  },
  leaderTitle: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 11, letterSpacing: 1 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rankNum: { fontFamily: FONTS.bold, width: 20, color: COLORS.textDim, fontSize: 12, textAlign: 'center' },
  leaderPlayerName: { fontFamily: FONTS.semibold, color: COLORS.text, fontSize: 13 },
  leaderTeamName: { fontFamily: FONTS.regular, color: COLORS.textSecondary, fontSize: 11, marginTop: 1 },
  statValBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.voltMuted,
    borderColor: COLORS.cardBorderActive,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  statValText: { fontSize: 13, fontWeight: '800' },
  statValSub: { fontSize: 10, fontWeight: '700' },
  noDataText: { color: COLORS.textDim, fontSize: 12, paddingVertical: 12, textAlign: 'center' },
  crest: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestText: { color: COLORS.textSecondary, fontSize: 8, fontWeight: '700' },
});

export default TournamentDetailScreen;