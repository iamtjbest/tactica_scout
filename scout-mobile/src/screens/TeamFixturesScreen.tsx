// src/screens/TeamFixturesScreen.tsx — Full season fixture list for one team
// Reached from TeamDetailScreen's "View All" buttons (Overview = upcoming only,
// Matches tab = full season, recent + upcoming).
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StatusBar } from 'react-native';
import { COLORS } from '../theme';
import { MatchCard } from '../components/MatchCard';
import { getTeamFixtures, MatchSummary } from '../services/api';

interface TeamFixturesScreenProps {
  route: any;
  navigation: any;
}

export const TeamFixturesScreen: React.FC<TeamFixturesScreenProps> = ({ route, navigation }) => {
  const { teamId, teamName, filter } = route.params as { teamId: number; teamName: string; filter: 'all' | 'upcoming' };
  const [recent, setRecent] = useState<MatchSummary[]>([]);
  const [upcoming, setUpcoming] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 12);

  useEffect(() => {
    setLoading(true);
    getTeamFixtures(teamId)
      .then((res) => {
        setRecent(res.recent || []);
        setUpcoming(res.upcoming || []);
      })
      .catch((err) => console.warn('Failed to load team fixtures:', err))
      .finally(() => setLoading(false));
  }, [teamId]);

  const openMatch = (m: MatchSummary) => {
    if (m.event_id) {
      navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topNav, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {teamName} · {filter === 'upcoming' ? 'Upcoming' : 'All Fixtures'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}>
          {filter === 'all' && (
            <>
              <Text style={styles.sectionTitle}>RECENT</Text>
              {recent.length > 0 ? (
                recent.map((m, idx) => (
                  <MatchCard key={`recent-${m.event_id || idx}`} match={m} showCompetition onPress={() => openMatch(m)} />
                ))
              ) : (
                <Text style={styles.noDataText}>No recent results this season.</Text>
              )}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>UPCOMING</Text>
            </>
          )}
          {upcoming.length > 0 ? (
            upcoming.map((m, idx) => (
              <MatchCard key={`upcoming-${m.event_id || idx}`} match={m} showCompetition onPress={() => openMatch(m)} />
            ))
          ) : (
            <Text style={styles.noDataText}>No upcoming fixtures this season.</Text>
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
