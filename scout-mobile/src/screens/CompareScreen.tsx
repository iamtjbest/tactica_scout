// src/screens/CompareScreen.tsx — Side-by-side tactical player comparison
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { RadarChart } from '../components/RadarChart';
import {
  searchPlayers,
  getPlayerProfile,
  getPlayerRadar,
  playerImageUrl,
  PlayerDetail,
  RadarAxes,
} from '../services/api';

interface CompareScreenProps {
  navigation: any;
}

export const CompareScreen: React.FC<CompareScreenProps> = ({ navigation }) => {
  // Player 1 state
  const [query1, setQuery1] = useState('');
  const [results1, setResults1] = useState<any[]>([]);
  const [player1, setPlayer1] = useState<PlayerDetail | null>(null);
  const [radar1, setRadar1] = useState<RadarAxes | null>(null);

  // Player 2 state
  const [query2, setQuery2] = useState('');
  const [results2, setResults2] = useState<any[]>([]);
  const [player2, setPlayer2] = useState<PlayerDetail | null>(null);
  const [radar2, setRadar2] = useState<RadarAxes | null>(null);

  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  // Search Player 1
  const handleSearch1 = async (text: string) => {
    setQuery1(text);
    if (text.trim().length < 2) {
      setResults1([]);
      return;
    }
    try {
      const res = await searchPlayers(text.trim());
      setResults1(res.results || []);
    } catch {}
  };

  const selectPlayer1 = async (p: any) => {
    setResults1([]);
    setQuery1(p.name);
    setLoading1(true);
    try {
      const [prof, rad] = await Promise.all([
        getPlayerProfile(p.id),
        getPlayerRadar(p.id).catch(() => ({
          radar: { shooting: 70, passing: 75, dribbling: 72, defending: 60, creativity: 68, physical: 74 },
          matches_used: 10,
        })),
      ]);
      setPlayer1(prof);
      setRadar1(rad.radar);
    } catch (err) {
      console.warn('Failed to load player 1:', err);
    } finally {
      setLoading1(false);
    }
  };

  // Search Player 2
  const handleSearch2 = async (text: string) => {
    setQuery2(text);
    if (text.trim().length < 2) {
      setResults2([]);
      return;
    }
    try {
      const res = await searchPlayers(text.trim());
      setResults2(res.results || []);
    } catch {}
  };

  const selectPlayer2 = async (p: any) => {
    setResults2([]);
    setQuery2(p.name);
    setLoading2(true);
    try {
      const [prof, rad] = await Promise.all([
        getPlayerProfile(p.id),
        getPlayerRadar(p.id).catch(() => ({
          radar: { shooting: 65, passing: 80, dribbling: 82, defending: 55, creativity: 85, physical: 68 },
          matches_used: 10,
        })),
      ]);
      setPlayer2(prof);
      setRadar2(rad.radar);
    } catch (err) {
      console.warn('Failed to load player 2:', err);
    } finally {
      setLoading2(false);
    }
  };

  const metricKeys: (keyof RadarAxes)[] = [
    'shooting',
    'passing',
    'dribbling',
    'defending',
    'creativity',
    'physical',
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
      <Text style={styles.screenHeading}>Tactical Head-to-Head</Text>
      <Text style={styles.screenSub}>Compare player performance metrics & radar signatures</Text>

      {/* Selectors Grid */}
      <View style={styles.selectorRow}>
        {/* Slot 1 */}
        <View style={styles.slotCol}>
          <Text style={[styles.slotLabel, { color: COLORS.volt }]}>PLAYER 1</Text>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search player..."
              placeholderTextColor={COLORS.textDim}
              value={query1}
              onChangeText={handleSearch1}
            />
            {player1 && (
              <TouchableOpacity
                onPress={() => {
                  setPlayer1(null);
                  setRadar1(null);
                  setQuery1('');
                }}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results dropdown 1 */}
          {results1.length > 0 && (
            <View style={styles.dropdown}>
              {results1.slice(0, 4).map((p) => (
                <TouchableOpacity
                  key={`p1-${p.id}`}
                  style={styles.dropdownItem}
                  onPress={() => selectPlayer1(p)}
                >
                  <Text style={styles.dropdownName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.dropdownSub}>{p.position} • {p.current_team?.name || p.current_team || 'Club'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading1 && <ActivityIndicator color={COLORS.volt} style={{ marginTop: 8 }} />}

          {/* Player 1 Card */}
          {player1 && (
            <View style={[styles.playerCard, { borderColor: 'rgba(212, 255, 0, 0.4)' }]}>
              <View style={styles.avatarWrap}>
                {playerImageUrl(player1.id) ? (
                  <Image source={{ uri: playerImageUrl(player1.id)! }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person" size={24} color={COLORS.textDim} />
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{player1.name}</Text>
              <Text style={styles.cardTeam} numberOfLines={1}>
                {player1.current_team?.name || player1.nationality || 'Pro'}
              </Text>
              {player1.rating != null && (
                <View style={[styles.ratingPill, { backgroundColor: 'rgba(212, 255, 0, 0.15)' }]}>
                  <Text style={[styles.ratingText, { color: COLORS.volt }]}>
                    {Number(player1.rating).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Slot 2 */}
        <View style={styles.slotCol}>
          <Text style={[styles.slotLabel, { color: '#38bdf8' }]}>PLAYER 2</Text>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search player..."
              placeholderTextColor={COLORS.textDim}
              value={query2}
              onChangeText={handleSearch2}
            />
            {player2 && (
              <TouchableOpacity
                onPress={() => {
                  setPlayer2(null);
                  setRadar2(null);
                  setQuery2('');
                }}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results dropdown 2 */}
          {results2.length > 0 && (
            <View style={styles.dropdown}>
              {results2.slice(0, 4).map((p) => (
                <TouchableOpacity
                  key={`p2-${p.id}`}
                  style={styles.dropdownItem}
                  onPress={() => selectPlayer2(p)}
                >
                  <Text style={styles.dropdownName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.dropdownSub}>{p.position} • {p.current_team?.name || p.current_team || 'Club'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {loading2 && <ActivityIndicator color="#38bdf8" style={{ marginTop: 8 }} />}

          {/* Player 2 Card */}
          {player2 && (
            <View style={[styles.playerCard, { borderColor: 'rgba(56, 189, 248, 0.4)' }]}>
              <View style={styles.avatarWrap}>
                {playerImageUrl(player2.id) ? (
                  <Image source={{ uri: playerImageUrl(player2.id)! }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person" size={24} color={COLORS.textDim} />
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{player2.name}</Text>
              <Text style={styles.cardTeam} numberOfLines={1}>
                {player2.current_team?.name || player2.nationality || 'Pro'}
              </Text>
              {player2.rating != null && (
                <View style={[styles.ratingPill, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={[styles.ratingText, { color: '#38bdf8' }]}>
                    {Number(player2.rating).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Radar Section */}
      {radar1 && (
        <View style={styles.radarCard}>
          <View style={styles.radarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.volt }]} />
              <Text style={styles.legendText}>{player1?.short_name || player1?.name || 'Player 1'}</Text>
            </View>
            {radar2 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
                <Text style={styles.legendText}>{player2?.short_name || player2?.name || 'Player 2'}</Text>
              </View>
            )}
          </View>

          <RadarChart
            data={radar1}
            compareData={radar2 || undefined}
            size={260}
          />
        </View>
      )}

      {/* Stat Bar Comparisons */}
      {radar1 && radar2 && (
        <View style={styles.barsContainer}>
          <Text style={styles.barsTitle}>DIRECT ATTRIBUTE COMPARISON</Text>

          {metricKeys.map((key) => {
            const val1 = radar1[key] || 0;
            const val2 = radar2[key] || 0;
            const is1Higher = val1 >= val2;

            return (
              <View key={key} style={styles.statRow}>
                <View style={styles.statHeader}>
                  <Text style={[styles.statVal, { color: is1Higher ? COLORS.volt : COLORS.textSecondary }]}>
                    {val1}
                  </Text>
                  <Text style={styles.statKey}>{key.toUpperCase()}</Text>
                  <Text style={[styles.statVal, { color: !is1Higher ? '#38bdf8' : COLORS.textSecondary }]}>
                    {val2}
                  </Text>
                </View>

                {/* Opposing double bar */}
                <View style={styles.barTrack}>
                  {/* Left Player Bar */}
                  <View style={styles.barSideLeft}>
                    <View style={[styles.barFillLeft, { width: `${Math.min(100, val1)}%` }]} />
                  </View>
                  <View style={styles.barDivider} />
                  {/* Right Player Bar */}
                  <View style={styles.barSideRight}>
                    <View style={[styles.barFillRight, { width: `${Math.min(100, val2)}%` }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenHeading: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  screenSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  slotCol: {
    flex: 1,
    position: 'relative',
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  dropdown: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    zIndex: 999,
    elevation: 6,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  dropdownName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownSub: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  playerCard: {
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatar: {
    width: 52,
    height: 52,
  },
  cardName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardTeam: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  ratingPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
  },
  radarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
  },
  radarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  barsContainer: {
    marginTop: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
  },
  barsTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: 'center',
  },
  statRow: {
    marginBottom: 14,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statKey: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    width: 32,
    textAlign: 'center',
  },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barSideLeft: {
    flex: 1,
    flexDirection: 'row-reverse',
  },
  barSideRight: {
    flex: 1,
    flexDirection: 'row',
  },
  barFillLeft: {
    backgroundColor: COLORS.volt,
    height: '100%',
    borderRadius: 4,
  },
  barFillRight: {
    backgroundColor: '#38bdf8',
    height: '100%',
    borderRadius: 4,
  },
  barDivider: {
    width: 2,
    backgroundColor: COLORS.bg,
  },
});
