// src/components/SearchModal.tsx — Global tactical search overlay
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { globalSearch, searchPlayers, teamLogoUrl, playerImageUrl } from '../services/api';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTeam: (teamId: number, teamName: string) => void;
  onSelectPlayer: (playerId: number, playerName: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  onSelectTeam,
  onSelectPlayer,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setTeams([]);
      setPlayers([]);
      setLoading(false);
      return;
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setTeams([]);
      setPlayers([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(trimmed);
        setTeams(res.teams || []);
        setPlayers(res.players || []);
      } catch (err) {
        // Fallback to player search if global search route differs
        try {
          const pRes = await searchPlayers(trimmed);
          setPlayers(pRes.results || []);
        } catch {}
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header Bar */}
          <View style={styles.inputHeader}>
            <View style={styles.inputWrapper}>
              <Ionicons name="search" size={18} color={COLORS.volt} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Search clubs, players, leagues..."
                placeholderTextColor={COLORS.textDim}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length > 0 && Platform.OS !== 'ios' && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Results List */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={COLORS.volt} size="small" />
              <Text style={styles.loadingText}>Searching data engine...</Text>
            </View>
          ) : query.trim().length >= 2 && teams.length === 0 && players.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="alert-circle-outline" size={40} color={COLORS.textDim} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>Try searching for another team or player name.</Text>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              data={[
                ...(teams.length > 0 ? [{ type: 'header', title: 'TEAMS' }] : []),
                ...teams.map((t) => ({ ...t, _type: 'team' })),
                ...(players.length > 0 ? [{ type: 'header', title: 'PLAYERS' }] : []),
                ...players.map((p) => ({ ...p, _type: 'player' })),
              ]}
              keyExtractor={(item, index) => `${item._type || item.type}-${item.id || item.title || index}`}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return <Text style={styles.sectionHeader}>{item.title}</Text>;
                }

                if (item._type === 'team') {
                  const logo = teamLogoUrl(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.itemRow}
                      onPress={() => {
                        onClose();
                        onSelectTeam(item.id, item.name);
                      }}
                    >
                      <View style={styles.avatarWrap}>
                        {logo ? (
                          <Image source={{ uri: logo }} style={styles.teamLogo} resizeMode="contain" />
                        ) : (
                          <Ionicons name="shield-outline" size={20} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSub}>{item.country || 'Club'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
                    </TouchableOpacity>
                  );
                }

                if (item._type === 'player') {
                  const photo = playerImageUrl(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.itemRow}
                      onPress={() => {
                        onClose();
                        onSelectPlayer(item.id, item.name);
                      }}
                    >
                      <View style={styles.avatarWrap}>
                        {photo ? (
                          <Image source={{ uri: photo }} style={styles.playerPhoto} />
                        ) : (
                          <Ionicons name="person" size={20} color={COLORS.textDim} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSub}>
                          {item.position || 'Player'} • {item.current_team?.name || item.current_team || item.nationality || 'Pro'}
                        </Text>
                      </View>
                      {item.rating != null && (
                        <View style={styles.ratingBadge}>
                          <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  );
                }

                return null;
              }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  cancelBtn: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: COLORS.volt,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  teamLogo: {
    width: 28,
    height: 28,
  },
  playerPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  itemSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    borderColor: 'rgba(212, 255, 0, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontSize: 13,
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
});
