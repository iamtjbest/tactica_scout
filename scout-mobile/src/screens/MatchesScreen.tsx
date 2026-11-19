// src/screens/MatchesScreen.tsx - Matches feed with 7-day centered date strip and filters
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';
import { MatchCard } from '../components/MatchCard';
import {
  getMatchesByDate,
  getLiveScores,
  getMe,
  LeagueMatches,
  MatchSummary,
} from '../services/api';

interface MatchesScreenProps {
  navigation: any;
}

type FilterType = 'all' | 'live' | 'upcoming' | 'finished' | 'following';

function formatLocalISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function todayLocalISO(): string {
  return formatLocalISO(new Date());
}

function parseISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const MatchesScreen: React.FC<MatchesScreenProps> = ({ navigation }) => {
  const [selectedDate, setSelectedDate] = useState<string>(todayLocalISO);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [leagues, setLeagues] = useState<LeagueMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);

  const loadFollowed = useCallback(async () => {
    try {
      const res = await getMe();
      setFollowedTeams(res.user?.followed_teams || []);
    } catch { }
  }, []);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await getMatchesByDate(selectedDate);
      setLeagues(res.leagues || []);

      try {
        const liveRes = await getLiveScores();
        setLiveCount(liveRes.count || 0);
      } catch { }
    } catch (err) {
      console.warn('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    fetchMatches();
    loadFollowed();
  }, [fetchMatches, loadFollowed]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
    loadFollowed();
  };

  const todayStr = todayLocalISO();
  const dateStrip = useMemo(() => {
    const center = parseISO(selectedDate);
    const days: { iso: string; dow: string; label: string; isToday: boolean }[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(center);
      d.setDate(center.getDate() + offset);
      const iso = formatLocalISO(d);
      days.push({
        iso,
        dow: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        isToday: iso === todayStr,
      });
    }
    return days;
  }, [selectedDate, todayStr]);

  const changeDateBy = (days: number) => {
    const d = parseISO(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(formatLocalISO(d));
  };

  useEffect(() => {
    if (selectedDate !== todayStr) return;
    const timer = setInterval(() => { void fetchMatches(); }, 25_000);
    return () => clearInterval(timer);
  }, [selectedDate, todayStr, fetchMatches]);

  const isTokenMatch = (m: MatchSummary, leagueGroup: LeagueMatches): boolean => {
    if (!followedTeams || followedTeams.length === 0) return false;
    return followedTeams.some((token) => {
      const parts = token.split(':');
      if (parts.length >= 2) {
        const [kind, rawId] = parts;
        if (kind === 'tournament' && leagueGroup.tournament_id === rawId) return true;
        if (kind === 'league' && String(leagueGroup.league_id) === rawId) return true;
        if (kind === 'team' && (String(m.home_team_id) === rawId || String(m.away_team_id) === rawId)) return true;
        return false;
      }
      return (
        m.home_team?.toLowerCase() === token.toLowerCase() ||
        m.away_team?.toLowerCase() === token.toLowerCase()
      );
    });
  };

  const filterMatch = (m: MatchSummary, leagueGroup: LeagueMatches): boolean => {
    const status = String(m.status || '').toLowerCase();
    const isLive =
      status.includes('live') ||
      status.includes('in_progress') ||
      status === 'ht' ||
      (m.minute != null && m.minute > 0 && !['finished', 'ft', 'ended'].includes(status));

    const isFinished = ['finished', 'ft', 'ended'].includes(status);
    const isUpcoming = !isLive && !isFinished;

    if (activeFilter === 'live') return isLive;
    if (activeFilter === 'finished') return isFinished;
    if (activeFilter === 'upcoming') return isUpcoming;
    if (activeFilter === 'following') return isTokenMatch(m, leagueGroup);
    return true;
  };

  const filteredLeagues = leagues
    .map((l) => ({
      ...l,
      matches: l.matches
        .filter((m) => filterMatch(m, l))
        .sort((a, b) => Number(isTokenMatch(b, l)) - Number(isTokenMatch(a, l))),
    }))
    .filter((l) => l.matches.length > 0)
    .sort((a, b) =>
      Number(b.matches.some((m) => isTokenMatch(m, b))) -
      Number(a.matches.some((m) => isTokenMatch(m, a)))
    );

  const totalMatchesCount = filteredLeagues.reduce(
    (acc, cur) => acc + cur.matches.length,
    0
  );

  return (
    <View style={styles.container}>
      {/* 7-Day Centered Date Strip (Past 3 days, Center, Next 3 days) */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={() => changeDateBy(-1)}
          style={styles.dateArrow}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-back" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.sevenDayRow}>
          {dateStrip.map((day) => {
            const active = day.iso === selectedDate;
            return (
              <TouchableOpacity
                key={day.iso}
                onPress={() => setSelectedDate(day.iso)}
                style={[styles.dayCell, active && styles.dayCellActive]}
                activeOpacity={0.75}
              >
                {day.isToday ? (
                  <Text style={[styles.todayPillText, active && { color: COLORS.volt }]}>
                    TODAY
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.dayDow, active && styles.dayTextActive]}>
                      {day.dow}
                    </Text>
                    <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                      {day.label}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => changeDateBy(1)}
          style={styles.dateArrow}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {(['all', 'following', 'live', 'upcoming', 'finished'] as FilterType[]).map((f) => {
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                {f === 'live' && liveCount > 0 && (
                  <View style={styles.livePulseDot} />
                )}
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f === 'all'
                    ? 'All'
                    : f === 'live'
                      ? `Live (${liveCount})`
                      : f === 'upcoming'
                        ? 'Upcoming'
                        : f === 'finished'
                          ? 'Finished'
                          : 'Following'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Matches List */}
      {loading ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 14, gap: 10 }}>
          <View style={{ width: 120, height: 12, borderRadius: 6, backgroundColor: COLORS.cardElevated }} />
          {[0, 1, 2, 3, 4].map((k) => (
            <View
              key={k}
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.cardBorder,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.cardElevated }} />
                <View style={{ width: 96, height: 12, borderRadius: 6, backgroundColor: COLORS.cardElevated }} />
              </View>
              <View style={{ width: 52, height: 22, borderRadius: 6, backgroundColor: COLORS.cardElevated }} />
              <View style={{ gap: 8, alignItems: 'flex-end' }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.cardElevated }} />
                <View style={{ width: 88, height: 12, borderRadius: 6, backgroundColor: COLORS.cardElevated }} />
              </View>
            </View>
          ))}
        </View>
      ) : totalMatchesCount === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="football-outline" size={48} color={COLORS.textDim} />
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'following'
              ? 'None of your followed clubs are playing on this date.'
              : `No ${activeFilter !== 'all' ? activeFilter : ''} matches scheduled for this date.`}
          </Text>
          {activeFilter !== 'all' && (
            <TouchableOpacity onPress={() => setActiveFilter('all')} style={styles.resetFilterBtn}>
              <Text style={styles.resetFilterText}>View All Matches</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}
          data={filteredLeagues}
          keyExtractor={(item, index) =>
            `league-${item.tournament_id || item.league_id || item.league || index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.volt}
              colors={[COLORS.volt]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.leagueSection}>
              <TouchableOpacity
                style={styles.leagueHeader}
                activeOpacity={item.league_id || item.tournament_id ? 0.7 : 1}
                onPress={() => {
                  if (item.source === 'local' && item.tournament_id) {
                    navigation.navigate('TournamentDetail', {
                      tournamentId: item.tournament_id,
                      tournamentName: item.league,
                    });
                    return;
                  }
                  if (item.league_id) {
                    navigation.navigate('MainTabs', {
                      screen: 'Leagues',
                      params: {
                        leagueId: item.league_id,
                        leagueName: item.league,
                      },
                    });
                  }
                }}
              >
                <Ionicons name="trophy-outline" size={14} color={COLORS.volt} style={{ marginRight: 6 }} />
                <Text style={styles.leagueName} numberOfLines={1}>
                  {item.league}
                </Text>
                {(item.league_id || item.tournament_id) && (
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textDim} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>

              {item.matches.map((m, idx) => (
                <MatchCard
                  key={`match-${m.event_id ?? idx}`}
                  match={m}
                  onPress={() => {
                    if (!m.event_id) return;
                    if (m.source === 'local' && m.tournament_id) {
                      navigation.navigate('TournamentMatch', {
                        tournamentId: m.tournament_id,
                        fixtureId: String(m.event_id),
                        tournamentName: item.league,
                      });
                      return;
                    }
                    navigation.navigate('MatchDetail', {
                      eventId: m.event_id,
                      matchSummary: m,
                    });
                  }}
                />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
};

export default MatchesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.bg,
  },
  dateArrow: { width: 26, height: 36, alignItems: 'center', justifyContent: 'center' },
  sevenDayRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 40,
  },
  dayCellActive: {
    backgroundColor: 'rgba(200, 255, 0, 0.10)',
    borderColor: COLORS.volt,
  },
  dayDow: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 9, letterSpacing: 0.3 },
  dayNum: { fontFamily: FONTS.bold, color: COLORS.textSecondary, fontSize: 10, marginTop: 1 },
  dayTextActive: { color: COLORS.volt },
  todayPillText: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 9, letterSpacing: 0.4 },
  filterBarWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  filterBar: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterChipActive: {
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    borderColor: COLORS.volt,
  },
  filterChipText: { fontFamily: FONTS.semibold, color: COLORS.textSecondary, fontSize: 12 },
  filterChipTextActive: { fontFamily: FONTS.bold, color: COLORS.volt },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.live, marginRight: 5 },
  leagueSection: { marginTop: 12 },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  leagueName: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 13, letterSpacing: 0.3 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 16, marginTop: 12 },
  emptySubtitle: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 13, marginTop: 4, textAlign: 'center' },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  resetFilterText: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 12 },
});