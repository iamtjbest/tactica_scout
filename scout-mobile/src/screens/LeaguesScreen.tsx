// src/screens/LeaguesScreen.tsx - FotMob-style Leagues Directory + Full 5-Tab League Hub
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import { FollowButton } from '../components/FollowButton';
import {
  getLeagues,
  getTournaments,
  getLeagueSeasons,
  getStandings,
  getLeagueFixtures,
  getLeagueTopStats,
  getLeagueTeamStats,
  getMe,
  isSignedIn,
  playerImageUrl,
  teamLogoUrl,
  type StandingsRow,
  type StandingsGroup,
  type MatchSummary,
  type TopStatPlayer,
  type LeagueSeason,
  type TournamentSummary,
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

export const LeaguesScreen: React.FC<LeaguesScreenProps> = ({ navigation, route }) => {
  const [leagues, setLeagues] = useState<{ league_id: number; name: string }[]>([]);
  const [localTournaments, setLocalTournaments] = useState<TournamentSummary[]>([]);
  const [followedTokens, setFollowedTokens] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(true);

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
  const [loading, setLoading] = useState(false);

  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [groups, setGroups] = useState<StandingsGroup[]>([]);
  const [fixtures, setFixtures] = useState<MatchSummary[]>([]);
  const [topScorers, setTopScorers] = useState<TopStatPlayer[]>([]);
  const [topAssists, setTopAssists] = useState<TopStatPlayer[]>([]);
  const [topRatings, setTopRatings] = useState<TopStatPlayer[]>([]);
  const [topCards, setTopCards] = useState<TopStatPlayer[]>([]);
  const [teamStats, setTeamStats] = useState<any>(null);

  const bodyScrollRef = useRef<any>(null);
  const [nextMatchOffsetY, setNextMatchOffsetY] = useState<number | null>(null);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setDirectoryLoading(true);
    Promise.all([
      getLeagues().catch(() => ({ leagues: [] })),
      getTournaments().catch(() => ({ tournaments: [] })),
      (async () => {
        try {
          if (await isSignedIn()) {
            const me = await getMe();
            return Array.isArray(me?.user?.followed_teams) ? me.user.followed_teams : [];
          }
        } catch { }
        return [];
      })(),
    ])
      .then(([lgRes, trRes, follows]) => {
        if (!alive) return;
        setLeagues(Array.isArray(lgRes?.leagues) ? lgRes.leagues : []);
        setLocalTournaments(Array.isArray(trRes?.tournaments) ? trRes.tournaments : []);
        setFollowedTokens(follows);
      })
      .finally(() => {
        if (alive) setDirectoryLoading(false);
      });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (route?.params?.leagueId) {
      setSelectedLeagueId(route.params.leagueId);
      if (route.params.leagueName) setLeagueTitle(route.params.leagueName);
      setActiveTab('table');
    }
  }, [route?.params?.leagueId, route?.params?.leagueName]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    let alive = true;
    setSelectedSeasonId(null);
    setSelectedSeasonLabel('');

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
    setNextMatchOffsetY(null);
    hasAutoScrolledRef.current = false;
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

  useEffect(() => {
    if (activeTab === 'matches') {
      hasAutoScrolledRef.current = false;
    }
  }, [activeTab]);

  useEffect(() => {
    if (
      activeTab === 'matches' &&
      !loading &&
      nextMatchOffsetY != null &&
      nextMatchOffsetY > 0 &&
      !hasAutoScrolledRef.current
    ) {
      hasAutoScrolledRef.current = true;
      const timer = setTimeout(() => {
        bodyScrollRef.current?.scrollTo({ y: Math.max(0, nextMatchOffsetY - 8), animated: false });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loading, nextMatchOffsetY]);

  const pickSeason = (s: LeagueSeason) => {
    setSelectedSeasonId(s.id);
    setSelectedSeasonLabel(s.label || '');
    setSeasonModalOpen(false);
  };

  const openLeague = (id: number, name: string) => {
    setSelectedLeagueId(id);
    setLeagueTitle(name);
    setLeagueCountry('');
    setActiveTab('table');
  };

  // VIEW A: FOTMOB-STYLE VERTICAL LEAGUES DIRECTORY
  if (selectedLeagueId == null) {
    const q = searchQuery.trim().toLowerCase();

    const isLeagueFollowed = (l: { league_id: number; name: string }) =>
      followedTokens.some(
        (tok) => tok.startsWith(`league:${l.league_id}:`) || tok.toLowerCase() === l.name.toLowerCase()
      );

    const isTournamentFollowed = (t: TournamentSummary) =>
      followedTokens.some(
        (tok) => tok.startsWith(`tournament:${t.id}:`) || tok.toLowerCase() === t.name.toLowerCase()
      );

    const filteredLeagues = leagues.filter((l) => !q || l.name.toLowerCase().includes(q));
    const filteredTournaments = localTournaments.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        String(t.organizing_body || '').toLowerCase().includes(q)
    );

    const followedLeagues = filteredLeagues.filter(isLeagueFollowed);
    const followedTournaments = filteredTournaments.filter(isTournamentFollowed);
    const hasFollowing = followedLeagues.length > 0 || followedTournaments.length > 0;

    return (
      <View style={styles.container}>
        <View style={styles.dirHeader}>
          <Text style={styles.dirTitle}>Leagues</Text>
          <View style={styles.dirSearchWrap}>
            <Ionicons name="search" size={16} color={COLORS.textDim} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Find leagues"
              placeholderTextColor={COLORS.textDim}
              style={styles.dirSearchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {directoryLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.volt} />
            <Text style={styles.loadingText}>Loading leagues...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 16 }} showsVerticalScrollIndicator={false}>
            {hasFollowing && (
              <View style={styles.dirCard}>
                <Text style={styles.dirSectionTitle}>Following</Text>
                {followedTournaments.map((t) => (
                  <TouchableOpacity
                    key={`fol-t-${t.id}`}
                    style={styles.dirRow}
                    onPress={() =>
                      navigation.navigate('TournamentDetail', {
                        tournamentId: t.id,
                        tournamentName: t.name,
                      })
                    }
                  >
                    <View style={styles.dirIconWrap}>
                      <Ionicons name="star" size={16} color={COLORS.volt} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dirRowTitle} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.dirRowSub} numberOfLines={1}>
                        {t.organizing_body || 'Local Competition'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                  </TouchableOpacity>
                ))}
                {followedLeagues.map((l) => (
                  <TouchableOpacity
                    key={`fol-l-${l.league_id}`}
                    style={styles.dirRow}
                    onPress={() => openLeague(l.league_id, l.name)}
                  >
                    <View style={styles.dirIconWrap}>
                      <Ionicons name="star" size={16} color={COLORS.volt} />
                    </View>
                    <Text style={[styles.dirRowTitle, { flex: 1 }]} numberOfLines={1}>
                      {l.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {filteredTournaments.length > 0 && (
              <View style={styles.dirCard}>
                <Text style={styles.dirSectionTitle}>Local Competitions</Text>
                {filteredTournaments.map((t) => (
                  <TouchableOpacity
                    key={`loc-${t.id}`}
                    style={styles.dirRow}
                    onPress={() =>
                      navigation.navigate('TournamentDetail', {
                        tournamentId: t.id,
                        tournamentName: t.name,
                      })
                    }
                  >
                    <View style={[styles.dirIconWrap, { borderColor: COLORS.cardBorderActive }]}>
                      <Ionicons name="trophy" size={15} color={COLORS.volt} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dirRowTitle} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.dirRowSub} numberOfLines={1}>
                        {t.organizing_body} {t.country ? `• ${t.country}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.dirCard}>
              <Text style={styles.dirSectionTitle}>All Leagues</Text>
              {filteredLeagues.length > 0 ? (
                filteredLeagues.map((l) => (
                  <TouchableOpacity
                    key={`lg-${l.league_id}`}
                    style={styles.dirRow}
                    onPress={() => openLeague(l.league_id, l.name)}
                  >
                    <View style={styles.dirIconWrap}>
                      <Ionicons name="football-outline" size={15} color={COLORS.textSecondary} />
                    </View>
                    <Text style={[styles.dirRowTitle, { flex: 1 }]} numberOfLines={1}>
                      {l.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDataText}>No leagues match &quot;{searchQuery}&quot;.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // VIEW B: FULL 5-TAB LEAGUE DETAIL HUB
  const safeFixtures = (Array.isArray(fixtures) ? fixtures : [])
    .filter((m) => m && m.kickoff)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.kickoff!).getTime();
      const tb = new Date(b.kickoff!).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });

  const nowMs = Date.now();
  const isFinishedStatus = (st?: string) =>
    ['finished', 'ended', 'played', 'ft'].includes(String(st || '').toLowerCase());

  const nextAnchorMatch =
    safeFixtures.find(
      (m) => !isFinishedStatus(m.status) && new Date(m.kickoff!).getTime() >= nowMs - 3 * 3600 * 1000
    ) || safeFixtures.find((m) => !isFinishedStatus(m.status));

  const nextAnchorDayKey = nextAnchorMatch
    ? new Date(nextAnchorMatch.kickoff!).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : null;

  const dayGroups: { dayLabel: string; matches: MatchSummary[]; isNextAnchor: boolean }[] = [];
  const dayMap = new Map<string, MatchSummary[]>();

  for (const m of safeFixtures) {
    const d = new Date(m.kickoff!);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(m);
  }

  dayMap.forEach((matches, dayLabel) => {
    dayGroups.push({
      dayLabel,
      matches,
      isNextAnchor: dayLabel === nextAnchorDayKey,
    });
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backToDirRow}
        onPress={() => setSelectedLeagueId(null)}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={16} color={COLORS.volt} />
        <Text style={styles.backToDirText}>All Leagues</Text>
      </TouchableOpacity>

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

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading competition data...</Text>
        </View>
      ) : (
        <ScrollView
          ref={bodyScrollRef}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 44, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
        >
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

          {activeTab === 'matches' && (
            <View>
              {nextMatchOffsetY != null && nextMatchOffsetY > 40 && (
                <TouchableOpacity
                  onPress={() =>
                    bodyScrollRef.current?.scrollTo({
                      y: Math.max(0, nextMatchOffsetY - 8),
                      animated: true,
                    })
                  }
                  style={styles.jumpToNextBtn}
                >
                  <Ionicons name="locate-outline" size={14} color={COLORS.volt} />
                  <Text style={styles.jumpToNextText}>Jump to Next Matchday</Text>
                </TouchableOpacity>
              )}

              {dayGroups.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>
                    No fixtures available for {selectedSeasonLabel || 'this season'}.
                  </Text>
                </View>
              ) : (
                dayGroups.map((grp) => (
                  <View
                    key={grp.dayLabel}
                    style={{ marginTop: 8 }}
                    onLayout={(e) => {
                      if (grp.isNextAnchor) {
                        setNextMatchOffsetY(e.nativeEvent.layout.y);
                      }
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={styles.groupHeading}>{grp.dayLabel.toUpperCase()}</Text>
                      {grp.isNextAnchor && (
                        <View style={styles.nextBadge}>
                          <Text style={styles.nextBadgeText}>NEXT UP</Text>
                        </View>
                      )}
                    </View>
                    {grp.matches.map((m, idx) => (
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

export default LeaguesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  dirHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  dirTitle: {
    fontFamily: FONTS.display,
    color: COLORS.text,
    fontSize: 22,
  },
  dirSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  dirSearchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  dirCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dirSectionTitle: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dirIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirRowTitle: {
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    fontSize: 14,
  },
  dirRowSub: {
    fontFamily: FONTS.regular,
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  backToDirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backToDirText: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 12,
  },
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
  leagueHeroTitle: { fontFamily: FONTS.display, color: COLORS.text, fontSize: 16 },
  leagueHeroCountry: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 10, marginTop: 1 },
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
  seasonBtnText: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 11 },
  tabRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  tabBtn: { paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabText: { fontFamily: FONTS.medium, color: COLORS.textDim, fontSize: 12 },
  tabTextActive: { fontFamily: FONTS.bold, color: COLORS.text },
  groupHeading: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 10,
    letterSpacing: 1.3,
  },
  nextBadge: {
    backgroundColor: COLORS.voltMuted,
    borderWidth: 1,
    borderColor: COLORS.volt,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nextBadgeText: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  jumpToNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 4,
  },
  jumpToNextText: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 11,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    minHeight: 200,
  },
  loadingText: { fontFamily: FONTS.regular, color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  emptyText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },
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
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rankNum: { fontFamily: FONTS.bold, width: 20, color: COLORS.textDim, fontSize: 12, textAlign: 'center' },
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
  statValText: { fontFamily: FONTS.bold, fontSize: 13 },
  statValSub: { fontFamily: FONTS.bold, fontSize: 10 },
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