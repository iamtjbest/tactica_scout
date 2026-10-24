/**
 * src/screens/TournamentPlayerScreen.tsx
 *
 * A player in a local competition, opened by tapping a name on the
 * pitch, on the bench, or in the timeline. Mirrors the web
 * /tournament/[id]/player/[playerId] page.
 *
 * The stats here are this tournament only, not a career total. A
 * schools competition and a church league share the players table, so
 * a lifetime tally on a tournament page would be answering a question
 * nobody asked.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../theme';
import { getTournamentPlayer, type TournamentPlayer } from '../services/api';

export const TournamentPlayerScreen: React.FC<any> = ({ route, navigation }) => {
  const { tournamentId, playerId, playerName } = route.params;
  const [d, setD] = useState<TournamentPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getTournamentPlayer(tournamentId, playerId)
      .then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [tournamentId, playerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // The name is passed in so the header is right before the fetch
    // lands, rather than flashing "Player" for half a second.
    navigation?.setOptions?.({ title: d?.player.name || playerName || 'Player' });
  }, [navigation, d, playerName]);

  if (!d && !error) {
    return (
      <View style={s.center}><ActivityIndicator color={COLORS.volt} /></View>
    );
  }
  if (!d) return <View style={s.center}><Text style={s.error}>{error}</Text></View>;

  const p = d.player;
  const initials = (p.name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                        onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <View style={[s.card, { alignItems: 'center', gap: 10, paddingVertical: 20 }]}>
        <Photo url={p.photo_url} initials={initials} />
        <Text style={s.name}>{p.name}</Text>
        <Text style={s.muted}>
          {[p.position, p.nationality].filter(Boolean).join(' • ') || '—'}
        </Text>
        <View style={s.teamRow}>
          <Crest url={d.team.crest_url} name={d.team.name} />
          <Text style={s.body} numberOfLines={1}>{d.team.name}</Text>
          {p.shirt_number != null ? (
            <Text style={s.shirt}>#{p.shirt_number}</Text>
          ) : null}
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.label}>THIS COMPETITION</Text>
        <View style={s.statGrid}>
          <Stat label="Apps" value={d.stats.appearances} />
          <Stat label="Starts" value={d.stats.starts} />
          <Stat label="Goals" value={d.stats.goals} />
          <Stat label="Assists" value={d.stats.assists} />
          <Stat label="Yellow" value={d.stats.yellow_cards} />
          <Stat label="Red" value={d.stats.red_cards}
                tint={d.stats.red_cards > 0 ? '#FF4444' : undefined} />
        </View>
      </View>

      <Text style={s.mono}>
        Counted from the matches the organiser has logged in this
        competition only.
      </Text>
    </ScrollView>
  );
};

function Photo({ url, initials }: { url: string | null; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <View style={[s.photo, s.photoFallback]}>
        <Text style={s.photoInitials}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} onError={() => setFailed(true)}
           style={s.photo} resizeMode="cover" />
  );
}

function Crest({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');
  if (!url || failed) {
    return <View style={s.crest}><Text style={s.crestText}>{initials}</Text></View>;
  }
  return (
    <Image source={{ uri: url }} onError={() => setFailed(true)}
           style={s.crestImg} resizeMode="cover" />
  );
}

function Stat({ label, value, tint }: {
  label: string; value: number; tint?: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.bg },
  photoFallback: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  photoInitials: { color: COLORS.volt, fontSize: 30, fontWeight: '900' },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  body: { color: COLORS.text, fontSize: 13 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  mono: { color: COLORS.textDim, fontSize: 10 },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  error: { color: '#FF4444', fontSize: 13, fontWeight: '600', padding: 16 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crest: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  crestImg: { width: 20, height: 20, borderRadius: 10 },
  crestText: { color: COLORS.textDim, fontSize: 8, fontWeight: '800' },
  shirt: { color: COLORS.textDim, fontSize: 12, fontWeight: '700' },
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 10,
  },
  stat: { width: '33.33%', paddingVertical: 10, alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: {
    color: COLORS.textDim, fontSize: 9, fontWeight: '800',
    letterSpacing: 1, marginTop: 2,
  },
});

export default TournamentPlayerScreen;
