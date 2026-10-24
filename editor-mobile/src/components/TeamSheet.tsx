/**
 * src/components/TeamSheet.tsx
 *
 * Team sheet entry, pitchside. Mirrors editor-web/components/TeamSheet.
 *
 * Tap a name once to put him in the XI, again to move him to the bench,
 * again to take him out. One target per player, no drag, no pickers:
 * this gets filled in standing up, on a phone, often on a bad
 * connection, from a piece of paper a captain just handed over.
 *
 * The sheet is what Scout rates.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme';
import {
  getLineup, setLineup, clearLineup,
  type FixtureLineup, type SideSheet, type SquadEntry,
} from '../services/api';

type Pick = 'none' | 'starter' | 'substitute';

const FORMATIONS = [
  '4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2', '3-4-3', '5-3-2', '4-5-1',
];

export default function TeamSheet({ fixtureId, homeName, awayName }: {
  fixtureId: string; homeName: string; awayName: string;
}) {
  const [data, setData] = useState<FixtureLineup | null>(null);
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Held locally until Save, so a half-filled sheet on a dropping
  // connection isn't written a row at a time.
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [shirts, setShirts] = useState<Record<string, number | null>>({});
  const [formation, setFormation] = useState('');

  const load = useCallback(() => {
    getLineup(fixtureId)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [fixtureId]);

  useEffect(() => { load(); }, [load]);

  // Reset the working copy whenever the side or the server data
  // changes, so switching sides never carries one team's picks to the
  // other.
  useEffect(() => {
    if (!data) return;
    const sh0 = data.lineups[side];
    const p: Record<string, Pick> = {};
    const sh: Record<string, number | null> = {};
    for (const r of sh0.starters) { p[r.player_id] = 'starter'; sh[r.player_id] = r.shirt_number; }
    for (const r of sh0.substitutes) { p[r.player_id] = 'substitute'; sh[r.player_id] = r.shirt_number; }
    setPicks(p); setShirts(sh); setFormation(sh0.formation ?? ''); setSaved(false);
  }, [data, side]);

  if (error && !data) return <Text style={s.error}>{error}</Text>;
  if (!data) return <ActivityIndicator color={COLORS.volt} style={{ marginTop: 20 }} />;

  const sheet: SideSheet = data.lineups[side];
  const squad = sheet.squad;
  const starters = squad.filter((r) => picks[r.players?.id ?? ''] === 'starter');
  const subs = squad.filter((r) => picks[r.players?.id ?? ''] === 'substitute');

  const cycle = (pid: string) => {
    setSaved(false);
    setPicks((prev) => {
      const now = prev[pid] ?? 'none';
      // Eleven is eleven. Rather than refusing the tap, the twelfth
      // goes to the bench, which is almost always what was meant.
      const next: Pick =
        now === 'none'
          ? (starters.length >= 11 ? 'substitute' : 'starter')
          : now === 'starter' ? 'substitute' : 'none';
      return { ...prev, [pid]: next };
    });
  };

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const pack = (role: Pick) =>
        squad
          .filter((r) => picks[r.players?.id ?? ''] === role)
          .map((r) => ({
            player_id: r.players!.id,
            shirt_number: shirts[r.players!.id] ?? r.jersey_number ?? null,
            position: r.position ?? null,
          }));
      await setLineup(fixtureId, {
        tournament_team_id: sheet.tournament_team_id,
        formation: formation || null,
        starters: pack('starter'),
        substitutes: pack('substitute'),
      });
      setSaved(true);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const wipe = async () => {
    setBusy(true); setError(null);
    try { await clearLineup(fixtureId, sheet.tournament_team_id); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <Text style={s.label}>TEAM SHEET</Text>
        <Text style={s.muted}>
          Tap a name: once for the XI, again for the bench, again to remove.
          Everyone named here can be rated by fans in Scout.
        </Text>
      </View>

      <View style={s.tabs}>
        {(['home', 'away'] as const).map((x) => (
          <TouchableOpacity key={x} onPress={() => setSide(x)}
                            style={[s.pill, { flex: 1 }, side === x && s.pillOn]}>
            <Text style={[s.pillText, side === x && s.pillTextOn]} numberOfLines={1}>
              {x === 'home' ? homeName : awayName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.row}>
        <Text style={[s.count, starters.length === 11
          ? { color: COLORS.win } : { color: '#FFB830' }]}>
          {starters.length}/11 starting
        </Text>
        <Text style={s.mono}>{subs.length} on the bench</Text>
      </View>

      <View style={s.card}>
        <Text style={s.mono}>FORMATION</Text>
        <View style={s.wrapRow}>
          {FORMATIONS.map((f) => (
            <TouchableOpacity key={f}
              onPress={() => { setFormation(f === formation ? '' : f); setSaved(false); }}
              style={[s.fPill, formation === f && s.fPillOn]}>
              <Text style={[s.fText, formation === f && { color: COLORS.bg }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {squad.length === 0 ? (
        <Text style={s.muted}>
          Nobody registered to this team yet. Add players in the web editor first.
        </Text>
      ) : (
        <View style={s.card}>
          {squad.map((r: SquadEntry) => {
            const pid = r.players?.id ?? '';
            const pick = picks[pid] ?? 'none';
            return (
              <View key={r.id} style={s.playerRow}>
                <TouchableOpacity onPress={() => cycle(pid)}
                  style={[
                    s.pickBtn,
                    pick === 'starter' ? s.pickXI
                      : pick === 'substitute' ? s.pickBench : s.pickOut,
                  ]}>
                  <Text style={[
                    s.pickText,
                    pick === 'starter' ? { color: COLORS.bg }
                      : pick === 'substitute' ? { color: '#00E5FF' }
                      : { color: COLORS.textSecondary },
                  ]}>
                    {pick === 'starter' ? 'XI' : pick === 'substitute' ? 'BENCH' : 'OUT'}
                  </Text>
                </TouchableOpacity>
                <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>
                  {r.players?.first_name} {r.players?.last_name}
                </Text>
                <TextInput
                  value={String(shirts[pid] ?? r.jersey_number ?? '')}
                  onChangeText={(v) => {
                    setSaved(false);
                    setShirts({ ...shirts, [pid]: v === '' ? null : Number(v) });
                  }}
                  keyboardType="number-pad"
                  placeholder="#"
                  placeholderTextColor={COLORS.textDim}
                  style={s.shirtInput}
                />
              </View>
            );
          })}
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {saved && !error ? (
        <Text style={[s.body, { color: COLORS.win }]}>Team sheet saved.</Text>
      ) : null}

      <TouchableOpacity style={[s.btn, busy && { opacity: 0.5 }]}
                        disabled={busy} onPress={save}>
        <Text style={s.btnText}>{busy ? 'Saving...' : 'Save team sheet'}</Text>
      </TouchableOpacity>

      {sheet.starters.length > 0 || sheet.substitutes.length > 0 ? (
        <TouchableOpacity disabled={busy} onPress={wipe}>
          <Text style={s.danger}>Clear this side</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.cardBorder, gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  body: { color: COLORS.text, fontSize: 13 },
  muted: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  mono: { color: COLORS.textDim, fontSize: 10 },
  count: { fontSize: 12, fontWeight: '800' },
  error: { color: '#FF4444', fontSize: 13, fontWeight: '600' },
  danger: { color: '#FF4444', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
    borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center',
  },
  pillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  pillTextOn: { color: COLORS.volt },
  fPill: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
  },
  fPillOn: { backgroundColor: COLORS.volt },
  fText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  pickBtn: {
    width: 62, paddingVertical: 7, borderRadius: 7, alignItems: 'center',
  },
  pickXI: { backgroundColor: COLORS.volt },
  pickBench: { backgroundColor: 'rgba(0,229,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)' },
  pickOut: { backgroundColor: COLORS.cardElevated },
  pickText: { fontSize: 10, fontWeight: '800' },
  shirtInput: {
    width: 46, backgroundColor: COLORS.cardElevated, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.cardBorder, paddingVertical: 6,
    color: COLORS.text, fontSize: 12, textAlign: 'center',
  },
  btn: {
    backgroundColor: COLORS.volt, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center',
  },
  btnText: { color: COLORS.bg, fontWeight: '800', fontSize: 14 },
});
