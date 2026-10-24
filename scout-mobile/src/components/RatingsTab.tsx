/**
 * src/components/RatingsTab.tsx
 *
 * Crowd player ratings and Man of the Match, mirroring the web Ratings
 * tab. Signed-in only, one vote per person per player, and no average
 * shown until the backend's floor is met, so one person cannot publish
 * a score against a named player on their own.
 *
 * The voting window (75' to 30 minutes after full time) is decided by
 * the backend and only displayed here. A client-side window is a
 * suggestion.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme';
import {
  getMatchRatings, getMyVotes, ratePlayer, voteMotm,
  type RatingSource, type MatchRatings, type MyVotes,
} from '../services/api';
import { lineupPlayerId } from '../lib/lineup';

/* Halves only. 7.4 is false precision on a human judgement, and the
   backend rejects anything finer. */
const STEPS = [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

export default function RatingsTab({
  source, matchRef, lineups, homeLabel, awayLabel,
}: {
  source: RatingSource;
  matchRef: string;
  lineups: any;
  homeLabel: string;
  awayLabel: string;
  navigation?: any;
}) {
  const [data, setData] = useState<MatchRatings | null>(null);
  const [mine, setMine] = useState<MyVotes | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getMatchRatings(source, matchRef)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
    getMyVotes(source, matchRef)
      .then((m) => { setMine(m); setSignedIn(true); })
      .catch(() => { setMine(null); setSignedIn(false); });
  }, [source, matchRef]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (!data && !error) {
    return (
      <View style={s.section}>
        <ActivityIndicator color={COLORS.volt} />
      </View>
    );
  }
  if (!data) return <Text style={s.error}>{error}</Text>;

  const sides = [
    { label: homeLabel, players: (lineups?.home?.players ?? []).slice(0, 11) },
    { label: awayLabel, players: (lineups?.away?.players ?? []).slice(0, 11) },
  ];
  const anyone = sides.some((x) => x.players.length > 0);
  const all = [...sides[0].players, ...sides[1].players];
  const byRef = new Map((data.players ?? []).map((p) => [p.player_ref, p]));
  const open = data.window.open;

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.card, open ? { borderColor: 'rgba(212,255,0,0.35)' } : null]}>
        <Text style={s.title}>{open ? 'Voting is open' : 'Voting is closed'}</Text>
        <Text style={s.muted}>
          {open
            ? 'Rate anyone who played and pick your Man of the Match. Closes 30 minutes after full time.'
            : data.window.reason}
        </Text>
        {signedIn === false ? (
          <Text style={[s.muted, { marginTop: 6 }]}>
            Sign in to vote. One account, one vote per player.
          </Text>
        ) : null}
      </View>

      {data.motm.total_votes > 0 ? (
        <View style={s.card}>
          <Text style={s.label}>
            MAN OF THE MATCH · {data.motm.total_votes}{' '}
            {data.motm.total_votes === 1 ? 'VOTE' : 'VOTES'}
          </Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {data.motm.leaders.map((m) => {
              const p = all.find((x: any) => String(lineupPlayerId(x)) === m.player_ref);
              return (
                <View key={m.player_ref} style={s.row}>
                  <Text style={s.motmName} numberOfLines={1}>
                    {p?.short_name ?? p?.name ?? 'Player'}
                  </Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${m.share}%` }]} />
                  </View>
                  <Text style={s.share}>{m.share}%</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {!anyone ? (
        <Text style={s.muted}>No lineup published yet, so there&apos;s nobody to rate.</Text>
      ) : null}

      {sides.map((side) =>
        side.players.length === 0 ? null : (
          <View key={side.label} style={s.card}>
            <Text style={s.label}>{side.label.toUpperCase()}</Text>
            {side.players.map((p: any, i: number) => {
              const ref = String(lineupPlayerId(p) ?? '');
              const agg = byRef.get(ref);
              const my = mine?.ratings?.[ref];
              const isMotm = mine?.motm === ref;
              const canVote = open && signedIn === true && ref !== '';

              return (
                <View key={ref || i} style={s.playerRow}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.playerName} numberOfLines={1}>
                        {p.short_name ?? p.name ?? 'Unknown'}
                      </Text>
                      <Text style={s.dim}>
                        {agg?.enough_votes
                          ? `${agg.average} avg · ${agg.votes} votes`
                          : agg
                            ? `${agg.votes} of ${data.min_votes} votes needed`
                            : 'No votes yet'}
                        {my != null ? ` · you gave ${my}` : ''}
                      </Text>
                    </View>
                    {agg?.enough_votes ? (
                      <Text style={s.avg}>{agg.average}</Text>
                    ) : null}
                    {canVote ? (
                      <TouchableOpacity
                        disabled={busy != null}
                        onPress={() => act(`motm-${ref}`, () => voteMotm(source, matchRef, ref))}
                        style={[s.motmBtn, isMotm && s.motmBtnOn]}
                      >
                        <Text style={[s.motmBtnText, isMotm && { color: COLORS.volt }]}>
                          MOTM
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {canVote ? (
                    <View style={s.steps}>
                      {STEPS.map((v) => (
                        <TouchableOpacity
                          key={v}
                          disabled={busy != null}
                          onPress={() => act(`${ref}-${v}`, () => ratePlayer(source, matchRef, ref, v))}
                          style={[s.step, my === v && s.stepOn]}
                        >
                          <Text style={[s.stepText, my === v && { color: COLORS.bg }]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )
      )}

      <Text style={s.dim}>
        An average appears once {data.min_votes} people have rated a player, so
        one person can&apos;t publish a score against someone on their own.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { padding: 24, alignItems: 'center' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  dim: { color: COLORS.textDim, fontSize: 11 },
  error: { color: '#FF4444', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerRow: {
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
  },
  playerName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  avg: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  motmName: { color: COLORS.text, fontSize: 11, width: 92 },
  barTrack: {
    flex: 1, height: 6, borderRadius: 999,
    backgroundColor: COLORS.cardElevated, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: COLORS.volt, borderRadius: 999 },
  share: { color: COLORS.textSecondary, fontSize: 11, width: 34, textAlign: 'right' },
  motmBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  motmBtnOn: { borderColor: COLORS.volt, backgroundColor: COLORS.voltMuted },
  motmBtnText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  step: {
    width: 38, height: 28, borderRadius: 6, backgroundColor: COLORS.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  stepOn: { backgroundColor: COLORS.volt },
  stepText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});
