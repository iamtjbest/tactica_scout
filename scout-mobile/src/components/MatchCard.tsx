// src/components/MatchCard.tsx — Mobile Match card
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { MatchSummary, teamLogoUrl } from '../services/api';

interface MatchCardProps {
  match: MatchSummary;
  onPress: () => void;
  showCompetition?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onPress,
  showCompetition = false,
}) => {
  const isLive =
    match.status?.toLowerCase().includes('live') ||
    match.status?.toLowerCase().includes('in_progress') ||
    (match.minute != null && match.minute > 0 && match.status !== 'finished');

  const isFinished =
    match.status?.toLowerCase() === 'finished' ||
    match.status?.toLowerCase() === 'ft' ||
    match.status?.toLowerCase() === 'ended';

  // A local competition's team ids are our own uuids, not BSD team ids,
  // so BSD's badge CDN has no art for them and would always 404. Use
  // the crest the organiser uploaded instead.
  const isLocal = match.source === 'local';
  const homeLogo = isLocal ? match.home_crest ?? null : teamLogoUrl(match.home_team_id);
  const awayLogo = isLocal ? match.away_crest ?? null : teamLogoUrl(match.away_team_id);

  return (
    <TouchableOpacity
      style={[styles.card, isLive && styles.liveCard]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {showCompetition && match.competition && (
        <View style={styles.compHeader}>
          <Text style={styles.compText} numberOfLines={1}>
            {match.competition}
          </Text>
        </View>
      )}

      <View style={styles.contentRow}>
        {/* Home Team */}
        <View style={styles.teamCol}>
          <View style={styles.logoWrap}>
            {homeLogo ? (
              <Image source={{ uri: homeLogo }} style={styles.teamLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="shield-outline" size={18} color={COLORS.textDim} />
            )}
          </View>
          <Text style={styles.teamName} numberOfLines={1}>
            {match.home_team}
          </Text>
        </View>

        {/* Center Score / Status */}
        <View style={styles.centerCol}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.livePulse} />
              <Text style={styles.liveText}>
                {match.minute ? `${match.minute}'` : 'LIVE'}
              </Text>
            </View>
          ) : isFinished ? (
            <Text style={styles.statusText}>FT</Text>
          ) : (
            <Text style={styles.kickoffText}>
              {match.kickoff ? match.kickoff.slice(11, 16) || match.kickoff : 'VS'}
            </Text>
          )}

          <View style={styles.scoreRow}>
            {isFinished || isLive ? (
              <>
                <Text style={[styles.scoreNum, isLive && styles.liveScore]}>
                  {match.home_score ?? 0}
                </Text>
                <Text style={styles.scoreDivider}>-</Text>
                <Text style={[styles.scoreNum, isLive && styles.liveScore]}>
                  {match.away_score ?? 0}
                </Text>
              </>
            ) : (
              <Text style={styles.vsText}>VS</Text>
            )}
          </View>
        </View>

        {/* Away Team */}
        <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
          <View style={styles.logoWrap}>
            {awayLogo ? (
              <Image source={{ uri: awayLogo }} style={styles.teamLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="shield-outline" size={18} color={COLORS.textDim} />
            )}
          </View>
          <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>
            {match.away_team}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  liveCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: '#161214',
  },
  compHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 6,
    marginBottom: 8,
  },
  compText: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  teamLogo: {
    width: 24,
    height: 24,
  },
  teamName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '90%',
  },
  centerCol: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  liveScore: {
    color: COLORS.volt,
  },
  scoreDivider: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  vsText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  statusText: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  kickoffText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  livePulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.live,
    marginRight: 4,
  },
  liveText: {
    color: COLORS.live,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
