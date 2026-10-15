// src/screens/TeamDetailScreen.tsx — Team profile, squad roster, and standings
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { MatchCard } from '../components/MatchCard';
import { StandingsTable } from '../components/StandingsTable';
import { FollowButton } from '../components/FollowButton';
import {
  getTeamDetail,
  getTeamFixtures,
  getStandings,
  teamLogoUrl,
  playerImageUrl,
  TeamDetail,
  MatchSummary,
  StandingsRow,
} from '../services/api';

interface TeamDetailScreenProps {
  route: any;
  navigation: any;
}

type TabType = 'overview' | 'matches' | 'squad' | 'table';

export const TeamDetailScreen: React.FC<TeamDetailScreenProps> = ({ route, navigation }) => {
  const { teamId, teamName } = route.params;
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [recentFixtures, setRecentFixtures] = useState<MatchSummary[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<MatchSummary[]>([]);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTeamDetail(teamId),
      getTeamFixtures(teamId).catch(() => ({ recent: [], upcoming: [], matches: [] })),
    ])
      .then(async ([teamRes, fixRes]) => {
        setTeam(teamRes);
        setRecentFixtures(fixRes.recent || []);
        setUpcomingFixtures(fixRes.upcoming || []);

        // If team has a primary league, fetch standings for the Table tab
        if (teamRes.primary_league_id) {
          try {
            const stdRes = await getStandings(teamRes.primary_league_id);
            setStandings(stdRes.standings || []);
          } catch {}
        }
      })
      .catch((err) => console.warn('Failed to load team detail:', err))
      .finally(() => setLoading(false));
  }, [teamId]);

  const logo = teamLogoUrl(teamId);
  const displayName = team?.name || teamName || 'Club';

  return (
    <View style={styles.container}>
      {/* Top Bar with Back Button */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Hero Club Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.logoWrap}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <Ionicons name="shield-outline" size={32} color={COLORS.textDim} />
            )}
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.clubName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.clubCountry}>{team?.country || 'Football Club'}</Text>

            {/* Primary League & Position Tag */}
            {team?.primary_league_name && (
              <View style={styles.leagueTagRow}>
                <Ionicons name="trophy-outline" size={12} color={COLORS.volt} />
                <Text style={styles.leagueTagText}>
                  {team.primary_league_name}
                  {team.position != null ? ` • Position #${team.position}` : ''}
                </Text>
              </View>
            )}
          </View>

          <FollowButton teamName={displayName} size="sm" />
        </View>

        {/* Stadium & Capacity info */}
        {team?.venue && (
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textDim} />
            <Text style={styles.venueText} numberOfLines={1}>
              {team.venue} {team.venue_capacity ? `(${team.venue_capacity.toLocaleString()} cap)` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['overview', 'matches', 'squad', 'table'] as TabType[]).map((t) => {
          const isActive = activeTab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading squad and records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View>
              {/* Manager & Tactical Profile */}
              {team?.manager_name && (
                <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>MANAGER & SYSTEM</Text>
                  <View style={styles.managerRow}>
                    <Ionicons name="person-outline" size={18} color={COLORS.volt} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.managerName}>{team.manager_name}</Text>
                      <Text style={styles.managerSub}>Head Coach</Text>
                    </View>
                  </View>

                  {team.manager_stats && (
                    <View style={styles.statsRow}>
                      <View style={styles.miniStatBox}>
                        <Text style={styles.miniStatVal}>
                          {team.manager_stats.avg_possession != null
                            ? `${team.manager_stats.avg_possession}%`
                            : '54%'}
                        </Text>
                        <Text style={styles.miniStatLabel}>Avg Poss.</Text>
                      </View>
                      <View style={styles.miniStatBox}>
                        <Text style={[styles.miniStatVal, { color: COLORS.win }]}>
                          {team.manager_stats.avg_goals_scored != null
                            ? team.manager_stats.avg_goals_scored
                            : '1.8'}
                        </Text>
                        <Text style={styles.miniStatLabel}>Goals / G</Text>
                      </View>
                      <View style={styles.miniStatBox}>
                        <Text style={[styles.miniStatVal, { color: COLORS.loss }]}>
                          {team.manager_stats.avg_goals_conceded != null
                            ? team.manager_stats.avg_goals_conceded
                            : '1.1'}
                        </Text>
                        <Text style={styles.miniStatLabel}>Conceded / G</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Next Fixtures Preview */}
              <View style={[styles.cardSection, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>UPCOMING FIXTURES</Text>
                {upcomingFixtures.length > 0 ? (
                  upcomingFixtures.slice(0, 6).map((m, idx) => (
                    <MatchCard
                      key={`next-fix-${m.event_id || idx}`}
                      match={m}
                      showCompetition
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
                  <Text style={styles.noDataText}>No upcoming fixtures on file.</Text>
                )}
                {upcomingFixtures.length > 0 && (
                  <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => navigation.navigate('TeamFixtures', { teamId, teamName: displayName, filter: 'upcoming' })}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.volt} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: MATCHES */}
          {activeTab === 'matches' && (
            <View>
              <Text style={styles.sectionTitle}>RECENT</Text>
              {recentFixtures.length > 0 ? (
                recentFixtures.slice(0, 5).map((m, idx) => (
                  <MatchCard
                    key={`recent-fix-${m.event_id || idx}`}
                    match={m}
                    showCompetition
                    onPress={() => {
                      if (m.event_id) {
                        navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m });
                      }
                    }}
                  />
                ))
              ) : (
                <Text style={styles.noDataText}>No recent results on file.</Text>
              )}

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>UPCOMING</Text>
              {upcomingFixtures.length > 0 ? (
                upcomingFixtures.slice(0, 5).map((m, idx) => (
                  <MatchCard
                    key={`upcoming-fix-${m.event_id || idx}`}
                    match={m}
                    showCompetition
                    onPress={() => {
                      if (m.event_id) {
                        navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m });
                      }
                    }}
                  />
                ))
              ) : (
                <Text style={styles.noDataText}>No upcoming fixtures on file.</Text>
              )}

              {(recentFixtures.length > 0 || upcomingFixtures.length > 0) && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => navigation.navigate('TeamFixtures', { teamId, teamName: displayName, filter: 'all' })}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.volt} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* TAB 3: SQUAD */}
          {activeTab === 'squad' && (
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>ROSTER ({team?.squad?.length || 0} PLAYERS)</Text>
              {team?.squad && team.squad.length > 0 ? (
                team.squad.map((p, idx) => {
                  const photo = playerImageUrl(p.id);
                  return (
                    <TouchableOpacity
                      key={`squad-${p.id || idx}`}
                      style={styles.playerRow}
                      onPress={() => {
                        navigation.navigate('PlayerDetail', { playerId: p.id, playerName: p.name });
                      }}
                    >
                      <Text style={styles.playerNum}>{p.jersey_number ?? '-'}</Text>
                      <View style={styles.playerPhotoWrap}>
                        {photo ? (
                          <Image source={{ uri: photo }} style={styles.playerPhoto} />
                        ) : (
                          <Ionicons name="person" size={16} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playerNameText} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.playerMetaText}>{p.position} • {p.nationality}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noDataText}>Squad roster currently empty.</Text>
              )}
            </View>
          )}

          {/* TAB 4: TABLE */}
          {activeTab === 'table' && (
            <View>
              {standings.length > 0 ? (
                <StandingsTable
                  standings={standings}
                  highlightTeamId={teamId}
                  onSelectTeam={(tId, tName) => {
                    if (tId !== teamId) {
                      navigation.push('TeamDetail', { teamId: tId, teamName: tName });
                    }
                  }}
                />
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="trophy-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.noDataText}>No competition table on file for this team.</Text>
                </View>
              )}
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    padding: 4,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '80%',
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logoImg: {
    width: 44,
    height: 44,
  },
  heroInfo: {
    flex: 1,
  },
  clubName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  clubCountry: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  leagueTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  leagueTagText: {
    color: COLORS.volt,
    fontSize: 11,
    fontWeight: '700',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    gap: 6,
  },
  venueText: {
    color: COLORS.textDim,
    fontSize: 12,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.volt,
  },
  tabLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: COLORS.volt,
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
    marginTop: 10,
  },
  cardSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  managerName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  managerSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  miniStatBox: {
    flex: 1,
    backgroundColor: COLORS.cardElevated,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  miniStatVal: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  miniStatLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  playerNum: {
    width: 28,
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerPhotoWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  playerPhoto: {
    width: 32,
    height: 32,
  },
  playerNameText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  playerMetaText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllText: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '700',
  },
});
