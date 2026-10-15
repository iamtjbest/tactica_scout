// src/components/StandingsTable.tsx — Mobile standings table
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { StandingsRow, teamLogoUrl } from '../services/api';

interface StandingsTableProps {
  standings: StandingsRow[];
  highlightTeamId?: number | null;
  onSelectTeam?: (teamId: number, teamName: string) => void;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  highlightTeamId,
  onSelectTeam,
}) => {
  const getZoneColor = (pos: number | null, zone: any) => {
    if (!pos) return 'transparent';
    const key = zone?.key?.toLowerCase() || '';
    if (key.includes('champions') || pos <= 4) return COLORS.ucl;
    if (key.includes('europa') || pos === 5) return COLORS.uel;
    if (key.includes('conference') || pos === 6) return COLORS.uecl;
    if (key.includes('relegat') || pos >= 18) return COLORS.relegation;
    return 'transparent';
  };

  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headCol, styles.colPos]}>#</Text>
        <Text style={[styles.headCol, styles.colTeam]}>CLUB</Text>
        <Text style={[styles.headCol, styles.colStat]}>P</Text>
        <Text style={[styles.headCol, styles.colStat]}>W</Text>
        <Text style={[styles.headCol, styles.colStat]}>D</Text>
        <Text style={[styles.headCol, styles.colStat]}>L</Text>
        <Text style={[styles.headCol, styles.colStat]}>GD</Text>
        <Text style={[styles.headCol, styles.colPts]}>PTS</Text>
      </View>

      {/* Table Body */}
      {standings.map((row, idx) => {
        const isHighlighted = highlightTeamId != null && row.team_id === highlightTeamId;
        const zoneColor = getZoneColor(row.position, row.zone);
        const logo = teamLogoUrl(row.team_id);

        return (
          <TouchableOpacity
            key={`standing-${row.team_id || idx}`}
            style={[
              styles.dataRow,
              idx % 2 === 1 && styles.evenRow,
              isHighlighted && styles.highlightedRow,
            ]}
            activeOpacity={onSelectTeam && row.team_id ? 0.7 : 1}
            onPress={() => {
              if (onSelectTeam && row.team_id) {
                onSelectTeam(row.team_id, row.team);
              }
            }}
          >
            {/* Left Zone Indicator Strip */}
            <View style={[styles.zoneStrip, { backgroundColor: zoneColor }]} />

            {/* Position */}
            <View style={styles.colPos}>
              <Text style={[styles.posText, isHighlighted && styles.highlightText]}>
                {row.position ?? idx + 1}
              </Text>
            </View>

            {/* Club Name & Badge */}
            <View style={[styles.colTeam, styles.teamCell]}>
              <View style={styles.badgeWrap}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.badge} resizeMode="contain" />
                ) : (
                  <Ionicons name="shield-outline" size={14} color={COLORS.textDim} />
                )}
              </View>
              <Text
                style={[styles.teamName, isHighlighted && styles.highlightTextBold]}
                numberOfLines={1}
              >
                {row.team}
              </Text>
            </View>

            {/* Stats */}
            <Text style={styles.colStat}>{row.played}</Text>
            <Text style={styles.colStat}>{row.won}</Text>
            <Text style={styles.colStat}>{row.drawn}</Text>
            <Text style={styles.colStat}>{row.lost}</Text>
            <Text style={[styles.colStat, { color: row.goal_diff > 0 ? COLORS.win : row.goal_diff < 0 ? COLORS.loss : COLORS.textDim }]}>
              {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
            </Text>
            <Text style={[styles.colPts, styles.ptsText, isHighlighted && styles.highlightPts]}>
              {row.points}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardElevated,
  },
  headCol: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    position: 'relative',
  },
  evenRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  highlightedRow: {
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.volt,
  },
  zoneStrip: {
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 3,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  colPos: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  colTeam: {
    flex: 1,
    paddingRight: 6,
  },
  teamCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeWrap: {
    width: 20,
    height: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 18,
    height: 18,
  },
  teamName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  colStat: {
    width: 24,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  colPts: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ptsText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  highlightText: {
    color: COLORS.volt,
  },
  highlightTextBold: {
    color: COLORS.volt,
    fontWeight: '800',
  },
  highlightPts: {
    color: COLORS.volt,
    fontSize: 13,
  },
});
