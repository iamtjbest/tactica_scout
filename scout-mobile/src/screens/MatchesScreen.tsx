// src/screens/MatchesScreen.tsx — Matches feed with date strip and filters
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
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

export const MatchesScreen: React.FC<MatchesScreenProps> = ({ navigation }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [leagues, setLeagues] = useState<LeagueMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [followedTeams, setFollowedTeams] = useState<string[]>([]);

  // Fetch followed clubs
  const loadFollowed = useCallback(async () => {
    try {
      const res = await getMe();
      setFollowedTeams(res.user?.followed_teams || []);
    } catch {}
  }, []);

  // Fetch matches for the day
  const fetchMatches = useCallback(async () => {
    try {
      const res = await getMatchesByDate(selectedDate);
      setLeagues(res.leagues || []);

      // Also get live scores count
      try {
        const liveRes = await getLiveScores();
        setLiveCount(liveRes.count || 0);
      } catch {}
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

  // Date controls
  const changeDateBy = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = () => {
    return selectedDate === new Date().toISOString().split('T')[0];
  };

  const setDateToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Filter matches
  const filterMatch = (m: MatchSummary): boolean => {
    const isLive =
      m.status?.toLowerCase().includes('live') ||
      m.status?.toLowerCase().includes('in_progress') ||
      (m.minute != null && m.minute > 0 && m.status !== 'finished');

    const isFinished =
      m.status?.toLowerCase() === 'finished' ||
      m.status?.toLowerCase() === 'ft' ||
      m.status?.toLowerCase() === 'ended';

    const isUpcoming = !isLive && !isFinished;

    if (activeFilter === 'live') return isLive;
    if (activeFilter === 'finished') return isFinished;
    if (activeFilter === 'upcoming') return isUpcoming;
    if (activeFilter === 'following') {
      return (
        followedTeams.includes(m.home_team) ||
        followedTeams.includes(m.away_team)
      );
    }
    return true; // 'all'
  };

  // Filter leagues with at least one matching match
  const filteredLeagues = leagues
    .map((l) => ({
      ...l,
      matches: l.matches.filter(filterMatch),
    }))
    .filter((l) => l.matches.length > 0);

  const totalMatchesCount = filteredLeagues.reduce(
    (acc, cur) => acc + cur.matches.length,
    0
  );

  return (
    <View style={styles.container}>
      {/* Date Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={() => changeDateBy(-1)}
          style={styles.dateArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={setDateToday}
          style={[styles.dateBadge, isToday() && styles.dateBadgeToday]}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={isToday() ? COLORS.volt : COLORS.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.dateText, isToday() && styles.dateTextToday]}>
            {selectedDate} {isToday() ? '(Today)' : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => changeDateBy(1)}
          style={styles.dateArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterBar}>
        {(['all', 'live', 'upcoming', 'finished', 'following'] as FilterType[]).map((f) => {
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
      </View>

      {/* Matches List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Fetching fixtures...</Text>
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
              {/* League Header */}
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
                    // There is no 'LeagueDetail' route. The Leagues tab is
                    // the league screen and already accepts these params.
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

              {/* League Match Cards */}
              {item.matches.map((m, idx) => (
                <MatchCard
                  key={`match-${m.event_id ?? idx}`}
                  match={m}
                  onPress={() => {
                    if (!m.event_id) return;
                    // A local competition's fixture has its own screen:
                    // its id is our uuid and nothing about it is BSD.
                    if (m.source === 'local' && m.tournament_id) {
                      navigation.navigate('TournamentMatch', {
                        tournamentId: m.tournament_id,
                        fixtureId: String(m.event_id),
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  dateArrow: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dateBadgeToday: {
    borderColor: 'rgba(212, 255, 0, 0.35)',
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dateTextToday: {
    color: COLORS.volt,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
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
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.volt,
    fontWeight: '700',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
    marginRight: 5,
  },
  leagueSection: {
    marginTop: 12,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  leagueName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  resetFilterText: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '700',
  },
});
