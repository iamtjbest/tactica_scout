// src/screens/LeaguesScreen.tsx — Competitions & Standings view
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import {
  getLeagues,
  getStandings,
  getLeagueFixtures,
  getLeagueTopStats,
  playerImageUrl,
  teamLogoUrl,
  StandingsRow,
  MatchSummary,
  TopStatPlayer,
} from '../services/api';

interface LeaguesScreenProps {
  navigation: any;
  route?: any;
}

export const LeaguesScreen: React.FC<LeaguesScreenProps> = ({ navigation, route }) => {
  const [leagues, setLeagues] = useState<{ league_id: number; name: string }[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(
    route?.params?.leagueId || null
  );
  const [activeTab, setActiveTab] = useState<'table' | 'matches' | 'stats'>('table');

  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [fixtures, setFixtures] = useState<MatchSummary[]>([]);
  const [topScorers, setTopScorers] = useState<TopStatPlayer[]>([]);
  const [topAssists, setTopAssists] = useState<TopStatPlayer[]>([]);

  // Initial load leagues list
  useEffect(() => {
    getLeagues()
      .then((res) => {
        const list = res.leagues || [];
        setLeagues(list);
        if (!selectedLeagueId && list.length > 0) {
          setSelectedLeagueId(list[0].league_id);
        }
      })
      .catch((err) => console.warn('Failed to get leagues:', err));
  }, []);

  // Sync if route params change
  useEffect(() => {
    if (route?.params?.leagueId) {
      setSelectedLeagueId(route.params.leagueId);
    }
  }, [route?.params?.leagueId]);

  // Load league data when selectedLeagueId changes
  const loadLeagueData = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [stdRes, fixRes, topRes] = await Promise.all([
        getStandings(id).catch(() => ({ standings: [] })),
        getLeagueFixtures(id).catch(() => ({ matches: [] })),
        getLeagueTopStats(id).catch(() => ({ scorers: [], assists: [] })),
      ]);
      setStandings(stdRes.standings || []);
      setFixtures(fixRes.matches || []);
      setTopScorers(topRes.scorers || []);
      setTopAssists(topRes.assists || []);
    } catch (err) {
      console.warn('Failed to load league data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      loadLeagueData(selectedLeagueId);
    }
  }, [selectedLeagueId, loadLeagueData]);

  const activeLeague = leagues.find((l) => l.league_id === selectedLeagueId);

  return (
    <View style={styles.container}>
      {/* Horizontal League Pills */}
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
                onPress={() => setSelectedLeagueId(l.league_id)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {l.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tabs Row: Table | Matches | Stats */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'table' && styles.tabBtnActive]}
          onPress={() => setActiveTab('table')}
        >
          <Text style={[styles.tabText, activeTab === 'table' && styles.tabTextActive]}>
            Standings Table
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
            Fixtures
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'stats' && styles.tabBtnActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Top Leaders
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading competition data...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: Standings */}
          {activeTab === 'table' && (
            <View>
              {standings.length > 0 ? (
                <StandingsTable
                  standings={standings}
                  onSelectTeam={(teamId, teamName) => {
                    navigation.navigate('TeamDetail', { teamId, teamName });
                  }}
                />
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="alert-circle-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No standings data available for this competition.</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 2: Matches */}
          {activeTab === 'matches' && (
            <View style={{ marginTop: 10 }}>
              {fixtures.length > 0 ? (
                fixtures.map((m, idx) => (
                  <MatchCard
                    key={`league-fix-${m.event_id || idx}`}
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
                ))
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No fixtures scheduled.</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 3: Stats Leaders */}
          {activeTab === 'stats' && (
            <View style={{ marginTop: 10 }}>
              {/* Top Scorers */}
              <View style={styles.leaderCard}>
                <View style={styles.leaderHeader}>
                  <Ionicons name="football" size={16} color={COLORS.volt} style={{ marginRight: 6 }} />
                  <Text style={styles.leaderTitle}>TOP GOALSCORERS</Text>
                </View>
                {topScorers.length > 0 ? (
                  topScorers.slice(0, 5).map((p, idx) => (
                    <TouchableOpacity
                      key={`scorer-${p.player_id || idx}`}
                      style={styles.leaderRow}
                      onPress={() => {
                        navigation.navigate('PlayerDetail', { playerId: p.player_id, playerName: p.player_name });
                      }}
                    >
                      <Text style={styles.rankNum}>{idx + 1}</Text>
                      <View style={styles.playerAvatarWrap}>
                        {playerImageUrl(p.player_id) ? (
                          <Image source={{ uri: playerImageUrl(p.player_id)! }} style={styles.playerAvatar} />
                        ) : (
                          <Ionicons name="person" size={16} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaderPlayerName} numberOfLines={1}>{p.player_name}</Text>
                        <Text style={styles.leaderTeamName} numberOfLines={1}>{p.team_name}</Text>
                      </View>
                      <View style={styles.statValBadge}>
                        <Text style={styles.statValText}>{p.value}</Text>
                        <Text style={styles.statValSub}>G</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No scorer statistics available.</Text>
                )}
              </View>

              {/* Top Assists */}
              <View style={[styles.leaderCard, { marginTop: 14 }]}>
                <View style={styles.leaderHeader}>
                  <Ionicons name="flash-outline" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                  <Text style={[styles.leaderTitle, { color: '#38bdf8' }]}>TOP ASSISTS / PLAYMAKERS</Text>
                </View>
                {topAssists.length > 0 ? (
                  topAssists.slice(0, 5).map((p, idx) => (
                    <TouchableOpacity
                      key={`assist-${p.player_id || idx}`}
                      style={styles.leaderRow}
                      onPress={() => {
                        navigation.navigate('PlayerDetail', { playerId: p.player_id, playerName: p.player_name });
                      }}
                    >
                      <Text style={styles.rankNum}>{idx + 1}</Text>
                      <View style={styles.playerAvatarWrap}>
                        {playerImageUrl(p.player_id) ? (
                          <Image source={{ uri: playerImageUrl(p.player_id)! }} style={styles.playerAvatar} />
                        ) : (
                          <Ionicons name="person" size={16} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaderPlayerName} numberOfLines={1}>{p.player_name}</Text>
                        <Text style={styles.leaderTeamName} numberOfLines={1}>{p.team_name}</Text>
                      </View>
                      <View style={[styles.statValBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                        <Text style={[styles.statValText, { color: '#38bdf8' }]}>{p.value}</Text>
                        <Text style={[styles.statValSub, { color: '#38bdf8' }]}>A</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No assist statistics available.</Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
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
  pillActive: {
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    borderColor: COLORS.volt,
  },
  pillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: COLORS.volt,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.volt,
  },
  tabText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    minHeight: 200,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  leaderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
  },
  leaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 8,
    marginBottom: 8,
  },
  leaderTitle: {
    color: COLORS.volt,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rankNum: {
    width: 20,
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  playerAvatar: {
    width: 32,
    height: 32,
  },
  leaderPlayerName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  leaderTeamName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  statValBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'rgba(212, 255, 0, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  statValText: {
    color: COLORS.volt,
    fontSize: 13,
    fontWeight: '800',
  },
  statValSub: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '700',
  },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
