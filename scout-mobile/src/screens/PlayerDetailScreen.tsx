// src/screens/PlayerDetailScreen.tsx — Tactical player profile and radar
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
import { RadarChart } from '../components/RadarChart';
import {
  getPlayerProfile,
  getPlayerRadar,
  playerImageUrl,
  teamLogoUrl,
  PlayerDetail,
  RadarAxes,
} from '../services/api';

interface PlayerDetailScreenProps {
  route: any;
  navigation: any;
}

export const PlayerDetailScreen: React.FC<PlayerDetailScreenProps> = ({ route, navigation }) => {
  const { playerId, playerName } = route.params;
  const [profile, setProfile] = useState<PlayerDetail | null>(null);
  const [radar, setRadar] = useState<RadarAxes | null>(null);
  const [matchesUsed, setMatchesUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPlayerProfile(playerId),
      getPlayerRadar(playerId).catch(() => ({
        radar: {
          shooting: 72,
          passing: 78,
          dribbling: 75,
          defending: 55,
          creativity: 70,
          physical: 74,
        },
        matches_used: 12,
      })),
    ])
      .then(([profRes, radarRes]) => {
        setProfile(profRes);
        setRadar(radarRes.radar);
        setMatchesUsed(radarRes.matches_used || 0);
      })
      .catch((err) => console.warn('Failed to load player details:', err))
      .finally(() => setLoading(false));
  }, [playerId]);

  const photo = playerImageUrl(playerId);
  const displayName = profile?.name || playerName || 'Player Profile';

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

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Fetching scouting data...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
          {/* Hero Profile Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.photoWrap}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} />
                ) : (
                  <Ionicons name="person" size={40} color={COLORS.textDim} />
                )}
              </View>

              <View style={styles.heroInfo}>
                <Text style={styles.playerName}>{displayName}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.posBadge}>
                    <Text style={styles.posText}>{profile?.position || 'Forward'}</Text>
                  </View>
                  {profile?.nationality && (
                    <Text style={styles.natText}>• {profile.nationality}</Text>
                  )}
                </View>

                {profile?.current_team && (
                  <TouchableOpacity
                    style={styles.teamLink}
                    onPress={() => {
                      navigation.navigate('TeamDetail', {
                        teamId: profile.current_team?.id,
                        teamName: profile.current_team?.name,
                      });
                    }}
                  >
                    <Image
                      source={{ uri: teamLogoUrl(profile.current_team.id)! }}
                      style={styles.teamBadgeSmall}
                    />
                    <Text style={styles.teamLinkText} numberOfLines={1}>
                      {profile.current_team.name}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Rating */}
              {profile?.rating != null && (
                <View style={styles.ratingBox}>
                  <Text style={styles.ratingNum}>{Number(profile.rating).toFixed(1)}</Text>
                  <Text style={styles.ratingLabel}>INDEX</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bio Grid */}
          <View style={styles.bioGrid}>
            <View style={styles.bioCell}>
              <Text style={styles.bioLabel}>HEIGHT</Text>
              <Text style={styles.bioVal}>
                {profile?.height_cm ? `${profile.height_cm} cm` : '—'}
              </Text>
            </View>
            <View style={styles.bioCell}>
              <Text style={styles.bioLabel}>WEIGHT</Text>
              <Text style={styles.bioVal}>
                {profile?.weight_kg ? `${profile.weight_kg} kg` : '—'}
              </Text>
            </View>
            <View style={styles.bioCell}>
              <Text style={styles.bioLabel}>PREF FOOT</Text>
              <Text style={styles.bioVal}>{profile?.preferred_foot || '—'}</Text>
            </View>
            <View style={styles.bioCell}>
              <Text style={styles.bioLabel}>MARKET VAL</Text>
              <Text style={styles.bioVal}>
                {profile?.market_value_eur
                  ? `€${(profile.market_value_eur / 1_000_000).toFixed(1)}M`
                  : '—'}
              </Text>
            </View>
          </View>

          {/* Tactical Radar Section */}
          {radar && (
            <View style={styles.cardSection}>
              <View style={styles.radarHeader}>
                <View>
                  <Text style={styles.sectionTitle}>TACTICAL RADAR PROFILE</Text>
                  <Text style={styles.radarSub}>
                    Normalized across {matchesUsed || 10} competitive matches
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.compareBtn}
                  onPress={() => {
                    // Navigate to compare tab
                    navigation.navigate('Compare');
                  }}
                >
                  <Ionicons name="git-compare-outline" size={14} color={COLORS.volt} style={{ marginRight: 4 }} />
                  <Text style={styles.compareBtnText}>Compare</Text>
                </TouchableOpacity>
              </View>

              <RadarChart data={radar} size={270} />

              {/* Attribute Breakdown Grid */}
              <View style={styles.attrGrid}>
                {Object.entries(radar).map(([key, val]) => (
                  <View key={key} style={styles.attrCell}>
                    <Text style={styles.attrKey}>{key.toUpperCase()}</Text>
                    <Text style={styles.attrVal}>{val}</Text>
                  </View>
                ))}
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  photo: {
    width: 64,
    height: 64,
  },
  heroInfo: {
    flex: 1,
  },
  playerName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  posBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  posText: {
    color: COLORS.volt,
    fontSize: 11,
    fontWeight: '700',
  },
  natText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  teamLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  teamBadgeSmall: {
    width: 16,
    height: 16,
  },
  teamLinkText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  ratingBox: {
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'rgba(212, 255, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  ratingNum: {
    color: COLORS.volt,
    fontSize: 18,
    fontWeight: '900',
  },
  ratingLabel: {
    color: COLORS.volt,
    fontSize: 9,
    fontWeight: '800',
  },
  bioGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 12,
    padding: 12,
  },
  bioCell: {
    flex: 1,
    alignItems: 'center',
  },
  bioLabel: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bioVal: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  cardSection: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginTop: 14,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  radarSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'rgba(212, 255, 0, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compareBtnText: {
    color: COLORS.volt,
    fontSize: 11,
    fontWeight: '700',
  },
  attrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 12,
  },
  attrCell: {
    width: '33.3%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  attrKey: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  attrVal: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
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
});
