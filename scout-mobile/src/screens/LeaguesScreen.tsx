// src/screens/LeaguesScreen.tsx — Full 5-Tab Mobile League & Competition Hub
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import { FollowButton } from '../components/FollowButton';
import * as api from '../services/api';
import {
  getLeagues,
  getLeagueSeasons,
  getStandings,
  getLeagueFixtures,
  getLeagueTopStats,
  getLeagueTeamStats,
  playerImageUrl,
  teamLogoUrl,
  type StandingsRow,
  type StandingsGroup,
  type MatchSummary,
  type TopStatPlayer,
  type LeagueSeason,
} from '../services/api';

interface LeaguesScreenProps {
  navigation: any;
  route?: any;
}

type LeagueTab = 'table' | 'matches' | 'player-stats' | 'team-stats' | 'season';

const TABS: { id: LeagueTab; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'matches', label: 'Fixtures' },
  { id: 'player-stats', label: 'Player Stats' },
  { id: 'team-stats', label: 'Team Stats' },
  { id: 'season', label: 'Season' },
];

const MONTHS = [
  { val: '01', label: 'Jan' }, { val: '02', label: 'Feb' },
  { val: '03', label: 'Mar' }, { val: '04', label: 'Apr' },
  { val: '05', label: 'May' }, { val: '06', label: 'Jun' },
  { val: '07', label: 'Jul' }, { val: '08', label: 'Aug' },
  { val: '09', label: 'Sep' }, { val: '10', label: 'Oct' },
  { val: '11', label: 'Nov' }, { val: '12', label: 'Dec' },
];

export const LeaguesScreen: React.FC<LeaguesScreenProps> = ({ navigation, route }) => {
  const [leagues, setLeagues] = useState<{ league_id: number; name: string }[]>([]);
  const [localTournaments, setLocalTournaments] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(
    route?.params?.leagueId ?? null
  );
  const [leagueTitle, setLeagueTitle] = useState<string>(route?.params?.leagueName || '');
  const [leagueCountry, setLeagueCountry] = useState<string>('');

  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedSeasonLabel, setSelectedSeasonLabel] = useState<string>('');
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<LeagueTab>('table');
  const [loading, setLoading] = useState(true);

  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [groups, setGroups] = useState<StandingsGroup[]>([]);
  const [fixtures, setFixtures] = useState<MatchSummary[]>([]);
  const [topScorers, setTopScorers] = useState<TopStatPlayer[]>([]);
  const [topAssists, setTopAssists] = useState<TopStatPlayer[]>([]);
  const [topRatings, setTopRatings] = useState<TopStatPlayer[]>([]);
  const [topCards, setTopCards] = useState<TopStatPlayer[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);

  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'finished' | 'live'>('all');

  useEffect(() => {
    let alive = true;
    getLeagues()
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res?.leagues) ? res.leagues : [];
        setLeagues(list);
        if (!selectedLeagueId && list.length > 0) {
          setSelectedLeagueId(list[0].league_id);
          setLeagueTitle(list[0].name || '');
        } else if (list.length === 0) {
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    const fetchTournaments = (api as any).getTournaments;
    if (typeof fetchTournaments === 'function') {
      fetchTournaments()
        .then((res: any) => {
          if (!alive) return;
          setLocalTournaments(Array.isArray(res?.tournaments) ? res.tournaments : []);
        })
        .catch(() => { });
    }

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (route?.params?.leagueId) {
      setSelectedLeagueId(route.params.leagueId);
      if (route.params.leagueName) setLeagueTitle(route.params.leagueName);
    }
  }, [route?.params?.leagueId, route?.params?.leagueName]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    let alive = true;
    setSelectedSeasonId(null);
    setSelectedSeasonLabel('');
    setSelectedDay('');
    setSelectedMonth('');
    setSelectedYear('');
    setStatusFilter('all');

    getLeagueSeasons(selectedLeagueId)
      .then((res) => {
        if (!alive) return;
        if (res?.league && res.league !== 'Unknown') setLeagueTitle(res.league);
        if (res?.country) setLeagueCountry(res.country);
        const list = Array.isArray(res?.seasons) ? res.seasons : [];
        setSeasons(list);
        if (list.length > 0) {
          const cur = list.find((s) => s.is_current) || list[0];
          setSelectedSeasonId(cur.id);
          setSelectedSeasonLabel(cur.label || '');
        }
      })
      .catch(() => {
        if (alive) setSeasons([]);
      });

    return () => { alive = false; };
  }, [selectedLeagueId]);

  const loadLeagueData = useCallback(async (id: number, sId: number | null) => {
    setLoading(true);
    try {
      const [stdRes, fixRes, topRes, tmStatsRes] = await Promise.all([
        getStandings(id, sId).catch(() => ({ league: '', country: '', standings: [], groups: [] })),
        getLeagueFixtures(id, sId).catch(() => ({ matches: [] })),
        getLeagueTopStats(id, sId).catch(() => ({ scorers: [], assists: [], ratings: [], cards: [] })),
        getLeagueTeamStats(id, sId).catch(() => null),
      ]);
      if (stdRes?.league && stdRes.league !== 'Unknown') setLeagueTitle(stdRes.league);
      if (stdRes?.country) setLeagueCountry(stdRes.country);
      setStandings(Array.isArray(stdRes?.standings) ? stdRes.standings : []);
      setGroups(Array.isArray(stdRes?.groups) ? stdRes.groups : []);
      setFixtures(Array.isArray(fixRes?.matches) ? fixRes.matches : []);
      setTopScorers(Array.isArray(topRes?.scorers) ? topRes.scorers : []);
      setTopAssists(Array.isArray(topRes?.assists) ? topRes.assists : []);
      setTopRatings(Array.isArray(topRes?.ratings) ? topRes.ratings : []);
      setTopCards(Array.isArray(topRes?.cards) ? topRes.cards : []);
      setTeamStats(tmStatsRes && typeof tmStatsRes === 'object' ? tmStatsRes : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      loadLeagueData(selectedLeagueId, selectedSeasonId);
    }
  }, [selectedLeagueId, selectedSeasonId, loadLeagueData]);

  const pickSeason = (s: LeagueSeason) => {
    setSelectedSeasonId(s.id);
    setSelectedSeasonLabel(s.label || '');
    setSeasonModalOpen(false);
  };

  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;

  const safeFixtures = Array.isArray(fixtures) ? fixtures : [];

  const availableYears = Array.from(
    new Set(
      safeFixtures
        .map((m) => {
          if (!m?.kickoff) return '';
          const date = new Date(m.kickoff);
          return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
        })
        .filter((y) => /^\d{4}$/.test(y))
    )
  ).sort();

  const availableDates = Array.from(
    new Set(
      safeFixtures
        .filter((m) => {
          if (!m?.kickoff) return false;
          const d = new Date(m.kickoff);
          if (Number.isNaN(d.getTime())) return false;
          const y = String(d.getFullYear());
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          if (selectedYear && y !== selectedYear) return false;
          if (selectedMonth && mo !== selectedMonth) return false;
          return true;
        })
        .map((m) => dateKey(new Date(m.kickoff!)))
    )
  ).sort();

  const filteredFixtures = safeFixtures.filter((m) => {
    if (!m?.kickoff) return false;
    const d = new Date(m.kickoff);
    if (Number.isNaN(d.getTime())) return false;
    const y = String(d.getFullYear());
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dayIso = dateKey(d);

    if (selectedYear && y !== selectedYear) return false;
    if (selectedMonth && mo !== selectedMonth) return false;
    if (selectedDay && dayIso !== selectedDay) return false;

    const st = String(m.status || '').toLowerCase();
    const isFin = ['finished', 'ended', 'played', 'ft'].includes(st);
    const isUpc = ['scheduled', 'notstarted', 'postponed', 'cancelled', 'delayed', 'tbd'].includes(st);
    const isLiv = !isFin && !isUpc;

    if (statusFilter === 'finished' && !isFin) return false;
    if (statusFilter === 'upcoming' && !isUpc) return false;
    if (statusFilter === 'live' && !isLiv) return false;
    return true;
  });

  const groupedByFullDate: Record<string, MatchSummary[]> = {};
  filteredFixtures
    .slice()
    .sort((a, b) => String(a.kickoff || '').localeCompare(String(b.kickoff || '')))
    .forEach((m) => {
      const d = new Date(m.kickoff || '');
      if (Number.isNaN(d.getTime())) return;
      const key = d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      (groupedByFullDate[key] ||= []).push(m);
    });

  return (
    <View style={styles.container}>
      {/* Local Competitions Door */}
      {localTournaments.length > 0 && (
        <View style={styles.localBar}>
          <Text style={styles.localHeading}>LOCAL COMPETITIONS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
          >
            {localTournaments.map((t: any) => (
              <TouchableOpacity
                key={t.id}
                onPress={() =>
                  navigation.navigate('TournamentDetail', {
                    tournamentId: t.id,
                    tournamentName: t.name,
                  })
                }
                style={styles.localCard}
              >
                <Text style={styles.localTitle} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.localSub} numberOfLines={1}>
                  {t.organizing_body}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Horizontal League Selector Pills */}
      <View style={styles.pillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
        >
          {leagues.map((l) => {
            const isSelected = l.league_id === selectedLeagueId;
            return (
              <TouchableOpacity
                key={`league-pill-${l.league_id}`}
                style={[styles.pill, isSelected && styles.pillActive]}
                onPress={() => {
                  setSelectedLeagueId(l.league_id);
                  setLeagueTitle(l.name);
                }}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {l.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active League Header + Follow + Clickable Season Picker */}
      {selectedLeagueId != null && (
        <View style={styles.leagueHeaderCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.leagueHeroTitle} numberOfLines={1}>
              {leagueTitle || `League #${selectedLeagueId}`}
            </Text>
            {!!leagueCountry && (
              <Text style={styles.leagueHeroCountry}>{leagueCountry.toUpperCase()}</Text>
            )}
          </View>

          <FollowButton
            teamName={leagueTitle || `League #${selectedLeagueId}`}
            token={`league:${selectedLeagueId}:${leagueTitle || `League #${selectedLeagueId}`}`}
            size="sm"
          />

          <TouchableOpacity
            onPress={() => setSeasonModalOpen(true)}
            style={styles.seasonBtn}
            activeOpacity={0.75}
          >
            <Text style={styles.seasonBtnText}>{selectedSeasonLabel || '2026/2027'}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.volt} />
          </TouchableOpacity>
        </View>
      )}

      {/* 5 Complete Navigation Tabs */}
      <View style={styles.tabRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 16 }}
        >
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
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
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading competition data...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 44, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: TABLE */}
          {activeTab === 'table' && (
            <View>
              {groups.length > 0 ? (
                groups.map((g, gi) => (
                  <View key={g.group || `grp-${gi}`} style={{ marginBottom: 12 }}>
                    <Text style={styles.groupHeading}>{String(g.group || 'GROUP').toUpperCase()}</Text>
                    <StandingsTable
                      standings={Array.isArray(g.standings) ? g.standings : []}
                      onSelectTeam={(teamId, teamName) =>
                        navigation.navigate('TeamDetail', { teamId, teamName })
                      }
                    />
                  </View>
                ))
              ) : standings.length > 0 ? (
                <StandingsTable
                  standings={standings}
                  onSelectTeam={(teamId, teamName) =>
                    navigation.navigate('TeamDetail', { teamId, teamName })
                  }
                />
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="alert-circle-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>
                    No standings available for {selectedSeasonLabel || 'this season'}.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 2: FIXTURES */}
          {activeTab === 'matches' && (
            <View style={{ gap: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(['all', 'live', 'upcoming', 'finished'] as const).map((st) => {
                  const on = statusFilter === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setStatusFilter(st)}
                      style={[styles.filterChip, on && styles.filterChipOn]}
                    >
                      <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>
                        {st.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => { setSelectedYear(''); setSelectedDay(''); }}
                  style={[styles.filterChip, !selectedYear && styles.filterChipOn]}
                >
                  <Text style={[styles.filterChipText, !selectedYear && styles.filterChipTextOn]}>
                    All Years
                  </Text>
                </TouchableOpacity>
                {availableYears.map((y) => {
                  const on = selectedYear === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      onPress={() => { setSelectedYear(on ? '' : y); setSelectedDay(''); }}
                      style={[styles.filterChip, on && styles.filterChipOn]}
                    >
                      <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{y}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => { setSelectedMonth(''); setSelectedDay(''); }}
                  style={[styles.filterChip, !selectedMonth && styles.filterChipOn]}
                >
                  <Text style={[styles.filterChipText, !selectedMonth && styles.filterChipTextOn]}>
                    All Months
                  </Text>
                </TouchableOpacity>
                {MONTHS.map((m) => {
                  const on = selectedMonth === m.val;
                  return (
                    <TouchableOpacity
                      key={m.val}
                      onPress={() => { setSelectedMonth(on ? '' : m.val); setSelectedDay(''); }}
                      style={[styles.filterChip, on && styles.filterChipOn]}
                    >
                      <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {availableDates.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedDay('')}
                    style={[styles.filterChip, !selectedDay && styles.filterChipOn]}
                  >
                    <Text style={[styles.filterChipText, !selectedDay && styles.filterChipTextOn]}>
                      All Dates
                    </Text>
                  </TouchableOpacity>
                  {availableDates.map((isoDay) => {
                    const on = selectedDay === isoDay;
                    const [year, month, day] = isoDay.split('-').map(Number);
                    const label = new Date(year, month - 1, day).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    });
                    return (
                      <TouchableOpacity
                        key={isoDay}
                        onPress={() => setSelectedDay(on ? '' : isoDay)}
                        style={[styles.filterChip, on && styles.filterChipOn]}
                      >
                        <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {Object.keys(groupedByFullDate).length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No fixtures match those date filters.</Text>
                </View>
              ) : (
                Object.keys(groupedByFullDate).map((dayLabel) => (
                  <View key={dayLabel} style={{ marginTop: 6 }}>
                    <Text style={styles.groupHeading}>{dayLabel.toUpperCase()}</Text>
                    {groupedByFullDate[dayLabel].map((m, idx) => (
                      <MatchCard
                        key={`league-fix-${m.event_id ?? idx}`}
                        match={m}
                        onPress={() => {
                          if (m.event_id) {
                            navigation.navigate('MatchDetail', {
                              eventId: m.event_id,
                              matchSummary: m,
                            });
                          }
                        }}
                      />
                    ))}
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: PLAYER STATS */}
          {activeTab === 'player-stats' && (
            <View style={{ gap: 14 }}>
              {[
                { title: 'TOP GOALSCORERS', tag: 'G', rows: topScorers, color: COLORS.volt },
                { title: 'TOP ASSISTS', tag: 'A', rows: topAssists, color: '#38bdf8' },
                { title: 'HIGHEST RATED', tag: 'RTG', rows: topRatings, color: COLORS.win },
                { title: 'DISCIPLINE (CARDS)', tag: 'CRD', rows: topCards, color: COLORS.draw },
              ].map((board) => (
                <View key={board.title} style={styles.leaderCard}>
                  <View style={styles.leaderHeader}>
                    <Text style={[styles.leaderTitle, { color: board.color }]}>{board.title}</Text>
                  </View>
                  {board.rows.length > 0 ? (
                    board.rows.slice(0, 10).map((p, idx) => (
                      <TouchableOpacity
                        key={`${board.title}-${p.player_id ?? idx}`}
                        style={styles.leaderRow}
                        disabled={!p.player_id}
                        onPress={() =>
                          p.player_id &&
                          navigation.navigate('PlayerDetail', {
                            playerId: p.player_id,
                            playerName: p.player_name,
                          })
                        }
                      >
                        <Text style={styles.rankNum}>{p.rank ?? idx + 1}</Text>
                        <View style={styles.playerAvatarWrap}>
                          {playerImageUrl(p.player_id) ? (
                            <Image
                              source={{ uri: playerImageUrl(p.player_id)! }}
                              style={styles.playerAvatar}
                            />
                          ) : (
                            <Ionicons name="person" size={15} color={COLORS.textDim} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
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
                    <Text style={styles.noDataText}>No data published for this category yet.</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* TAB 4: TEAM STATS */}
          {activeTab === 'team-stats' && (
            <View style={{ gap: 14 }}>
              {[
                { title: 'GOALS PER MATCH', key: 'goals_per_match', rows: Array.isArray(teamStats?.goals_per_match) ? teamStats.goals_per_match : [], suffix: '' },
                { title: 'CONCEDED PER MATCH', key: 'conceded_per_match', rows: Array.isArray(teamStats?.conceded_per_match) ? teamStats.conceded_per_match : [], suffix: '' },
                { title: 'CLEAN SHEETS', key: 'clean_sheets', rows: Array.isArray(teamStats?.clean_sheets) ? teamStats.clean_sheets : [], suffix: '' },
                { title: 'WIN RATE %', key: 'win_rate', rows: Array.isArray(teamStats?.win_rate) ? teamStats.win_rate : [], suffix: '%' },
                { title: 'AVERAGE POSSESSION %', key: 'possession_avg', rows: Array.isArray(teamStats?.possession) ? teamStats.possession : [], suffix: '%' },
              ]
                .filter((c) => c.rows.length > 0)
                .map((card) => (
                  <View key={card.title} style={styles.leaderCard}>
                    <View style={styles.leaderHeader}>
                      <Text style={styles.leaderTitle}>{card.title}</Text>
                    </View>
                    {card.rows.slice(0, 10).map((tm: any, idx: number) => {
                      const logo = teamLogoUrl(tm.team_id);
                      return (
                        <TouchableOpacity
                          key={`${card.title}-${tm.team_id ?? idx}`}
                          style={styles.leaderRow}
                          disabled={!tm.team_id}
                          onPress={() =>
                            tm.team_id &&
                            navigation.navigate('TeamDetail', {
                              teamId: tm.team_id,
                              teamName: tm.team,
                            })
                          }
                        >
                          <Text style={styles.rankNum}>{idx + 1}</Text>
                          <View style={styles.playerAvatarWrap}>
                            {logo ? (
                              <Image source={{ uri: logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                            ) : (
                              <Ionicons name="shield-outline" size={14} color={COLORS.textDim} />
                            )}
                          </View>
                          <Text style={[styles.leaderPlayerName, { flex: 1 }]} numberOfLines={1}>
                            {tm.team}
                          </Text>
                          <Text style={[styles.statValText, { color: COLORS.volt }]}>
                            {tm[card.key]}
                            {card.suffix}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
            </View>
          )}

          {/* TAB 5: SEASON HISTORY & PREVIOUS WINNERS */}
          {activeTab === 'season' && (
            <View style={styles.leaderCard}>
              <View style={styles.leaderHeader}>
                <Text style={styles.leaderTitle}>SEASONS &amp; PREVIOUS WINNERS</Text>
              </View>
              {seasons.length === 0 ? (
                <Text style={styles.noDataText}>No season history available.</Text>
              ) : (
                seasons.map((s, idx) => {
                  const isSelected = s.label === selectedSeasonLabel;
                  const winnerLogo = teamLogoUrl(s.winner_id);
                  return (
                    <TouchableOpacity
                      key={s.label || `season-${idx}`}
                      onPress={() => {
                        pickSeason(s);
                        setActiveTab('table');
                      }}
                      style={[
                        styles.leaderRow,
                        isSelected && { backgroundColor: COLORS.voltMuted, borderRadius: 8, paddingHorizontal: 8 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaderPlayerName}>
                          {s.label} {s.is_current ? '(Current)' : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {winnerLogo ? (
                            <Image source={{ uri: winnerLogo }} style={{ width: 16, height: 16 }} resizeMode="contain" />
                          ) : null}
                          <Text style={styles.leaderTeamName}>
                            {s.winner_name
                              ? `Winner: ${s.winner_name}`
                              : s.is_current
                                ? 'Season in progress'
                                : 'Tap to view table'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: COLORS.volt, fontSize: 11, fontWeight: '700' }}>
                        Table →
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Season Year Picker Modal */}
      <Modal
        visible={seasonModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSeasonModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSeasonModalOpen(false)}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.leaderTitle}>SELECT SEASON</Text>
            {seasons.map((s, idx) => {
              const active = s.label === selectedSeasonLabel;
              return (
                <TouchableOpacity
                  key={s.label || `modal-season-${idx}`}
                  onPress={() => pickSeason(s)}
                  style={[styles.modalRow, active && { backgroundColor: COLORS.voltMuted }]}
                >
                  <Text style={[styles.leaderPlayerName, active && { color: COLORS.volt }]}>
                    {s.label}
                  </Text>
                  {s.winner_name ? (
                    <Text style={styles.leaderTeamName}>🏆 {s.winner_name}</Text>
                  ) : s.is_current ? (
                    <Text style={{ color: COLORS.volt, fontSize: 11, fontWeight: '700' }}>Current</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  localBar: { paddingTop: 10, paddingBottom: 4 },
  localHeading: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  localCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorderActive,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 140,
  },
  localTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  localSub: { color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  pillsContainer: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pillActive: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.volt },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: COLORS.volt, fontWeight: '700' },
  leagueHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  leagueHeroTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  leagueHeroCountry: { color: COLORS.textDim, fontSize: 10, fontWeight: '700', marginTop: 1 },
  seasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    backgroundColor: COLORS.cardElevated,
  },
  seasonBtnText: { color: COLORS.volt, fontSize: 11, fontWeight: '800' },
  tabRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  tabBtn: { paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabText: { color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: COLORS.text, fontWeight: '800' },
  groupHeading: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterChipOn: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.volt },
  filterChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  filterChipTextOn: { color: COLORS.volt, fontWeight: '800' },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    minHeight: 200,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  emptyText: { color: COLORS.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },
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
  leaderTitle: { color: COLORS.volt, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rankNum: { width: 20, color: COLORS.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  playerAvatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  playerAvatar: { width: 30, height: 30 },
  leaderPlayerName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  leaderTeamName: { color: COLORS.textSecondary, fontSize: 11, marginTop: 1 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    padding: 16,
    gap: 8,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});