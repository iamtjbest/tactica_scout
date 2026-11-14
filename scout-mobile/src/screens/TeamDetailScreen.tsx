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

const FIXTURES_PREVIEW = 10;

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

        if (teamRes && teamRes.primary_league_id) {
          try {
            const stdRes = await getStandings(teamRes.primary_league_id);
            if (stdRes && stdRes.standings) {
              setStandings(stdRes.standings);
            }
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
      {/* Top Header Bar with Back Button */}
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

      {/* Team Header Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroLogoWrap}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.heroLogo} resizeMode="contain" />
          ) : (
            <Ionicons name="shield-outline" size={32} color={COLORS.textDim} />
          )}
        </View>
        <View style={styles.heroInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={styles.heroTeamName} numberOfLines={1}>{displayName}</Text>
            <FollowButton
              teamName={displayName}
              token={`team:${teamId}:${displayName}`}
              size="sm"
            />
          </View>
          <Text style={styles.heroSubText} numberOfLines={1}>
            {team?.country || ''} {team?.venue ? `• ${team.venue}` : ''}
          </Text>
        </View>
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
          <Text style={styles.loadingText}>Loading team details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={{ gap: 14 }}>
              {/* Quick Info Box */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeader}>CLUB OVERVIEW</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Manager</Text>
                  <Text style={styles.infoVal}>{team?.manager_name || '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Stadium / Venue</Text>
                  <Text style={styles.infoVal}>{team?.venue || '—'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Capacity</Text>
                  <Text style={styles.infoVal}>{team?.venue_capacity ? team.venue_capacity.toLocaleString() : '—'}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoKey}>Primary League</Text>
                  <Text style={styles.infoVal}>{team?.primary_league_name || '—'}</Text>
                </View>
              </View>

              {/* Recent Form / Matches Preview */}
              {recentFixtures.length > 0 && (
                <View style={styles.infoCard}>
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <Text style={styles.cardHeader}>RECENT MATCHES</Text>
                    <TouchableOpacity onPress={() => setActiveTab('matches')}>
                      <Text style={styles.viewAllText}>View all →</Text>
                    </TouchableOpacity>
                  </View>
                  {recentFixtures.slice(0, 3).map((m, idx) => (
                    <MatchCard
                      key={`recent-${m.event_id || idx}`}
                      match={m}
                      onPress={() => m.event_id && navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m })}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: MATCHES */}
          {activeTab === 'matches' && (
            <View style={{ gap: 14 }}>
              {upcomingFixtures.length > 0 && (
                <View>
                  <Text style={styles.groupHeading}>UPCOMING FIXTURES</Text>
                  {upcomingFixtures.map((m, idx) => (
                    <MatchCard
                      key={`upc-${m.event_id || idx}`}
                      match={m}
                      onPress={() => m.event_id && navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m })}
                    />
                  ))}
                </View>
              )}
              {recentFixtures.length > 0 && (
                <View>
                  <Text style={styles.groupHeading}>FINISHED MATCHES</Text>
                  {recentFixtures.map((m, idx) => (
                    <MatchCard
                      key={`rec-${m.event_id || idx}`}
                      match={m}
                      onPress={() => m.event_id && navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m })}
                    />
                  ))}
                </View>
              )}
              {recentFixtures.length === 0 && upcomingFixtures.length === 0 && (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No fixtures available for this team.</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 3: SQUAD */}
          {activeTab === 'squad' && (
            <View style={styles.infoCard}>
              <Text style={styles.cardHeader}>SQUAD ROSTER</Text>
              {team?.squad && team.squad.length > 0 ? (
                team.squad.map((p, idx) => {
                  const pImg = playerImageUrl(p.id);
                  return (
                    <TouchableOpacity
                      key={`player-${p.id || idx}`}
                      style={styles.playerRow}
                      onPress={() => navigation.navigate('PlayerDetail', { playerId: p.id, playerName: p.name })}
                    >
                      <View style={styles.playerAvatarWrap}>
                        {pImg ? (
                          <Image source={{ uri: pImg }} style={styles.playerAvatar} />
                        ) : (
                          <Ionicons name="person" size={16} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.playerSub}>{p.position} {p.nationality ? `• ${p.nationality}` : ''}</Text>
                      </View>
                      {p.jersey_number != null && (
                        <Text style={styles.jerseyNum}>#{p.jersey_number}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noDataText}>No squad players recorded.</Text>
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
                  onSelectTeam={(tId, tName) => navigation.push('TeamDetail', { teamId: tId, teamName: tName })}
                />
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="trophy-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No competition table on file for this team.</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    gap: 14,
  },
  heroLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  heroLogo: { width: 34, height: 34 },
  heroInfo: { flex: 1, minWidth: 0 },
  heroTeamName: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  heroSubText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabLabel: { color: COLORS.textDim, fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: COLORS.text, fontWeight: '900' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, minHeight: 200 },
  loadingText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  emptyText: { color: COLORS.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
  },
  cardHeader: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoKey: { color: COLORS.textSecondary, fontSize: 13 },
  infoVal: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAllText: { color: COLORS.volt, fontSize: 12, fontWeight: '700' },
  groupHeading: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 10,
  },
  playerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerAvatar: { width: 32, height: 32 },
  playerName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  playerSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 1 },
  jerseyNum: { color: COLORS.textDim, fontSize: 13, fontWeight: '800' },
  noDataText: { color: COLORS.textDim, fontSize: 12, paddingVertical: 12, textAlign: 'center' },
});