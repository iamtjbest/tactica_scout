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
  getPlayerCareer,
  getPlayerTransfers,
  getPlayerNationalTeam,
  getPlayerSeasonStats,
  formatFee,
  type PlayerCareerSeason,
  type PlayerTransfer,
  type PlayerSeasonStats,
  playerImageUrl,
  teamLogoUrl,
  PlayerDetail,
  RadarAxes,
} from '../services/api';

interface PlayerDetailScreenProps {
  route: any;
  navigation: any;
}

// Three states, not two: null = loading, [] = genuinely empty,
// degraded/failed = the fetch returned nothing. Collapsing these is how
// a page ends up telling a 15-year veteran he has no career.
type Loadable<T> = { data: T | null; degraded: boolean; failed: boolean };
const PENDING = { data: null, degraded: false, failed: false };

// Order here is the order they appear in the stats grid.
const STAT_FIELDS: [string, string][] = [
  ['appearances', 'APPS'], ['minutes_played', 'MINUTES'],
  ['goals', 'GOALS'], ['assists', 'ASSISTS'],
  ['shots', 'SHOTS'], ['shots_on_target', 'ON TARGET'],
  ['passes', 'PASSES'], ['key_passes', 'KEY PASSES'],
  ['tackles', 'TACKLES'], ['interceptions', 'INTERCEPTIONS'],
  ['duels_won', 'DUELS WON'], ['saves', 'SAVES'],
  ['yellow_cards', 'YELLOWS'], ['red_cards', 'REDS'],
];

export const PlayerDetailScreen: React.FC<PlayerDetailScreenProps> = ({ route, navigation }) => {
  const { playerId, playerName } = route.params;
  const [profile, setProfile] = useState<PlayerDetail | null>(null);
  const [radar, setRadar] = useState<RadarAxes | null>(null);
  const [matchesUsed, setMatchesUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'season' | 'career' | 'transfers'>('season');
  const [career, setCareer] = useState<Loadable<PlayerCareerSeason[]>>(PENDING);
  const [transfers, setTransfers] = useState<Loadable<PlayerTransfer[]>>(PENDING);
  const [national, setNational] = useState<Loadable<any[]>>(PENDING);
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats | null>(null);
  const [seasonFailed, setSeasonFailed] = useState(false);

  useEffect(() => {
    setLoading(true);

    // The profile gates the screen. Everything else is additive and
    // catches its own failure, so one dead endpoint can't blank the page.
    getPlayerProfile(playerId)
      .then(setProfile)
      .catch((err) => console.warn('Failed to load player profile:', err))
      .finally(() => setLoading(false));

    // NO placeholder radar. This used to fall back to a hardcoded set of
    // attributes (shooting 72, passing 78, ...) captioned "normalized
    // across 12 competitive matches", which meant a failed fetch drew a
    // complete invented scouting profile and presented it as analysis.
    // A missing radar is correct; a fabricated one is not.
    getPlayerRadar(playerId)
      .then((r) => {
        setRadar(r?.radar ?? null);
        setMatchesUsed(r?.matches_used || 0);
      })
      .catch(() => {
        setRadar(null);
        setMatchesUsed(0);
      });

    getPlayerCareer(playerId)
      .then((r) => setCareer({ data: r.seasons || [], degraded: !!r.degraded, failed: false }))
      .catch(() => setCareer({ data: [], degraded: false, failed: true }));

    getPlayerTransfers(playerId)
      .then((r) => setTransfers({ data: r.transfers || [], degraded: !!r.degraded, failed: false }))
      .catch(() => setTransfers({ data: [], degraded: false, failed: true }));

    getPlayerNationalTeam(playerId)
      .then((r) => {
        // Backend hands back a list or an object depending on BSD's
        // shape, which the docs don't pin down. Take whichever is filled.
        const rows = (r.teams && r.teams.length ? r.teams : null) ?? (r.summary ? [r.summary] : []);
        setNational({ data: rows, degraded: !!r.degraded, failed: false });
      })
      .catch(() => setNational({ data: [], degraded: false, failed: true }));

    setSeasonFailed(false);
    getPlayerSeasonStats(playerId)
      .then(setSeasonStats)
      .catch(() => setSeasonFailed(true));
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
                    <Text style={styles.posText}>{profile?.position || '--'}</Text>
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
                    Normalized across {matchesUsed} competitive matches
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

          {/* ── Career / Transfers / International ───────────────────
              Mirrors scout-web's player page tabs. Three independent
              fetches: null = still loading, [] = genuinely empty,
              degraded = the fetch came back with nothing. Those three
              render differently on purpose, so the screen never claims a
              player has no career because one request failed. */}
          <View style={styles.cardSection}>
            <View style={styles.subTabRow}>
              {(['season', 'career', 'transfers'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSubTab(t)}
                  style={[styles.subTab, subTab === t && styles.subTabActive]}
                >
                  <Text style={[styles.subTabText, subTab === t && styles.subTabTextActive]}>
                    {t === 'season' ? 'STATS' : t.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {subTab === 'season' && (
              seasonFailed ? (
                <Text style={styles.subEmpty}>Couldn't load this right now.</Text>
              ) : !seasonStats ? (
                <Text style={styles.subEmpty}>Loading...</Text>
              ) : seasonStats.totals.appearances ? (
                <View style={styles.statGrid}>
                  {/* Only keys BSD actually reported. A stat it didn't send
                      comes back null and is skipped rather than shown as 0:
                      a midfielder with no saves hasn't made zero saves. */}
                  {STAT_FIELDS.filter(([k]) => seasonStats.totals[k] != null).map(([k, label]) => (
                    <View key={k} style={styles.statCell}>
                      <Text style={styles.statLabel}>{label}</Text>
                      <Text style={styles.statVal}>{String(seasonStats.totals[k])}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.subEmpty}>No match data for this season.</Text>
              )
            )}

            {subTab === 'career' && (
              career.data && career.data.length > 0 ? (
                career.data.map((s, i) => (
                  <View key={i} style={styles.careerRow}>
                    <Text style={styles.careerSeason}>{s.season ?? s.season_name ?? '--'}</Text>
                    <Text style={styles.careerClub} numberOfLines={1}>{s.team_name ?? '--'}</Text>
                    <Text style={styles.careerNum}>{s.appearances ?? '--'}</Text>
                    <Text style={[styles.careerNum, { color: COLORS.volt }]}>{s.goals ?? '--'}</Text>
                    <Text style={[styles.careerNum, { color: '#38bdf8' }]}>{s.assists ?? '--'}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.subEmpty}>
                  {career.failed || career.degraded
                    ? "Couldn't load this right now."
                    : career.data === null
                    ? 'Loading...'
                    : 'No career history on file.'}
                </Text>
              )
            )}

            {subTab === 'transfers' && (
              transfers.data && transfers.data.length > 0 ? (
                transfers.data.map((t, i) => {
                  const when = t.date ?? t.transfer_date;
                  return (
                    <View key={i} style={styles.transferRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.transferTeams} numberOfLines={1}>
                          {t.from_team_name ?? '--'} → {t.to_team_name ?? '--'}
                        </Text>
                        <Text style={styles.transferDate}>
                          {when
                            ? new Date(when).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })
                            : '--'}
                          {t.transfer_type ? ` • ${t.transfer_type}` : ''}
                        </Text>
                      </View>
                      {/* formatFee prints "Undisclosed" for a null fee and
                          "Free" only for a real published zero. */}
                      <Text style={styles.transferFee}>{formatFee(t.fee_eur)}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.subEmpty}>
                  {transfers.failed || transfers.degraded
                    ? "Couldn't load this right now."
                    : transfers.data === null
                    ? 'Loading...'
                    : 'No transfers on file.'}
                </Text>
              )
            )}
          </View>

          {/* International record. BSD's docs list the route but not its
              body shape, so this renders only the fields a row actually
              has rather than assuming a schema and printing blanks. */}
          {national.data && national.data.length > 0 && (
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>INTERNATIONAL</Text>
              {national.data.map((n: any, i: number) => (
                <View key={i} style={styles.natRow}>
                  <Text style={styles.natName} numberOfLines={1}>
                    {n.team_name ?? n.name ?? profile?.nationality ?? 'National team'}
                  </Text>
                  <Text style={styles.natStat}>
                    {n.appearances != null ? `${n.appearances} caps` : ''}
                    {n.appearances != null && n.goals != null ? '   ' : ''}
                    {n.goals != null ? `${n.goals} goals` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  subTabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  subTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: COLORS.cardBorder },
  subTabActive: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.cardBorderActive },
  subTabText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  subTabTextActive: { color: COLORS.volt },
  subEmpty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { width: '47%', backgroundColor: COLORS.cardElevated, borderRadius: 10,
              paddingVertical: 10, paddingHorizontal: 12 },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  statVal: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  careerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9,
               borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  careerSeason: { color: COLORS.textSecondary, fontSize: 11, width: 56 },
  careerClub: { color: COLORS.text, fontSize: 12, flex: 1 },
  careerNum: { color: COLORS.text, fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
                 borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  transferTeams: { color: COLORS.text, fontSize: 12 },
  transferDate: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  transferFee: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  natRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  natName: { color: COLORS.text, fontSize: 13, flex: 1 },
  natStat: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
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
