/**
 * src/screens/TournamentMatchScreen.tsx
 *
 * One match in a local competition: the team sheet, the timeline, and
 * crowd ratings. Mirrors the web
 * /tournament/[id]/match/[fixtureId] page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../theme';
import { buildLineupRows, lineupRowWidth } from '../lib/lineup';
import {
  getTournamentMatch, getMatchRatings, getMyVotes, ratePlayer, voteMotm,
  type TournamentMatch, type TournamentMatchEvent, type TournamentSheet,
  type MatchRatings, type MyVotes,
} from '../services/api';

type Tab = 'lineups' | 'timeline' | 'ratings';

/* Halves only, matching the backend and the BSD ratings tab. */
const STEPS = [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

const EVENT_LABEL: Record<string, string> = {
  goal: 'Goal', own_goal: 'Own goal', penalty: 'Penalty',
  penalty_scored: 'Penalty', penalty_missed: 'Pen missed',
  yellow: 'Yellow', yellow_card: 'Yellow', second_yellow: '2nd yellow',
  red: 'Red', red_card: 'Red', substitution: 'Sub', assist: 'Assist',
};

/**
 * A second yellow is a dismissal, so it reads red. A plain yellow was
 * rendering in the volt accent, which made a booking look like a goal.
 */
function eventTint(type: string): string {
  const t = String(type).toLowerCase();
  if (t === 'red' || t === 'red_card' || t.includes('second_yellow')) return '#FF4444';
  if (t.includes('yellow')) return '#FFC53D';
  if (t.includes('miss')) return COLORS.textSecondary;
  return COLORS.volt;
}

export const TournamentMatchScreen: React.FC<any> = ({ route, navigation }) => {
  const { tournamentId, fixtureId } = route.params;
  const [d, setD] = useState<TournamentMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('timeline');
  const [tabPicked, setTabPicked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getTournamentMatch(tournamentId, fixtureId)
      .then((x) => {
        setD(x); setError(null);
        // Open on the team sheet when there is one: that is what people
        // check before kickoff.
        if (!tabPicked && x.lineup_status === 'confirmed') setTab('lineups');
      })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  }, [tournamentId, fixtureId, tabPicked]);

  useEffect(() => { load(); }, [load]);

  const openPlayer = useCallback((id: string, name: string) => {
    navigation.navigate('TournamentPlayer', {
      tournamentId, playerId: id, playerName: name,
    });
  }, [navigation, tournamentId]);

  if (error && !d) return <Text style={s.error}>{error}</Text>;
  if (!d) return <View style={s.center}><ActivityIndicator color={COLORS.volt} /></View>;

  const fx = d.fixture;
  const live = ['live', 'ht'].includes(String(fx.status).toLowerCase());

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={COLORS.volt}
                        onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <View style={s.card}>
        <View style={s.row}>
          <TeamLine name={fx.home_team} crest={fx.home_crest} />
          <View style={{ alignItems: 'center' }}>
            <Text style={s.bigScore}>
              {fx.home_score ?? '–'} : {fx.away_score ?? '–'}
            </Text>
            <Text style={[s.mono, live && { color: '#FF4444' }]}>
              {live ? 'LIVE' : String(fx.status).toUpperCase()}
            </Text>
          </View>
          <TeamLine name={fx.away_team} crest={fx.away_crest} reverse />
        </View>
        <Text style={[s.mono, { textAlign: 'center', marginTop: 8 }]}>
          {fx.kickoff_at
            ? new Date(fx.kickoff_at).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })
            : ''}
          {fx.venue ? ` • ${fx.venue}` : ''}
          {fx.round ? ` • ${fx.round}` : ''}
        </Text>
      </View>

      <View style={s.tabs}>
        {(['lineups', 'timeline', 'ratings'] as Tab[]).map((x) => (
          <TouchableOpacity key={x}
            onPress={() => { setTab(x); setTabPicked(true); }}
            style={[s.pill, tab === x && s.pillOn]}>
            <Text style={[s.pillText, tab === x && s.pillTextOn]}>
              {x.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'lineups' && <Lineups d={d} openPlayer={openPlayer} />}
      {tab === 'timeline' && (
        <Timeline events={d.events} fx={fx} openPlayer={openPlayer} />
      )}
      {tab === 'ratings' && (
        <Ratings matchRef={fixtureId} match={d} openPlayer={openPlayer}
                 homeLabel={fx.home_team ?? 'Home'}
                 awayLabel={fx.away_team ?? 'Away'} />
      )}
    </ScrollView>
  );
};

function TeamLine({ name, crest, reverse }: {
  name: string | null; crest: string | null; reverse?: boolean;
}) {
  return (
    <View style={[s.row, { flex: 1 }, reverse && { flexDirection: 'row-reverse' }]}>
      <Crest url={crest} name={name ?? '?'} size={26} />
      <Text style={[s.teamName, reverse && { textAlign: 'right' }]} numberOfLines={2}>
        {name ?? 'Unknown'}
      </Text>
    </View>
  );
}

function Crest({ url, name, size = 20 }: {
  url: string | null; name: string; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join('');
    return (
      <View style={[s.crest, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={s.crestText}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} onError={() => setFailed(true)}
           style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
  );
}

/* ── team sheet on a pitch ──────────────────────────────────────── */
function Lineups({ d, openPlayer }: {
  d: TournamentMatch; openPlayer: (id: string, name: string) => void;
}) {
  const [side, setSide] = useState<'home' | 'away'>('home');

  if (d.lineup_status !== 'confirmed') {
    return (
      <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
        <Text style={s.cardTitle}>No team sheet yet</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>
          The organiser enters the starting XI and the bench from the editor.
          Once they do, everyone on it can be rated.
        </Text>
      </View>
    );
  }

  const sheet: TournamentSheet = d.lineups[side];
  const rows = buildLineupRows(sheet.starters, sheet.formation);

  return (
    <View style={{ gap: 10 }}>
      <View style={s.tabs}>
        {(['home', 'away'] as const).map((x) => (
          <TouchableOpacity key={x} onPress={() => setSide(x)}
                            style={[s.pill, { flex: 1 }, side === x && s.pillOn]}>
            <Text style={[s.pillText, side === x && s.pillTextOn]} numberOfLines={1}>
              {x === 'home' ? d.fixture.home_team : d.fixture.away_team}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.mono, { textAlign: 'center' }]}>{sheet.formation ?? '—'}</Text>

      <View style={s.pitch}>
        <View style={s.pitchHalfLine} />
        <View style={s.pitchCircle} />
        {rows.slice().reverse().map((row: any[], ri: number) => (
          <View key={ri} style={[s.pitchRow, { width: lineupRowWidth(row.length) }]}>
            {row.map((p: any) => (
              <TouchableOpacity
                key={p.player_id} style={s.pitchPlayer} activeOpacity={0.6}
                onPress={() => openPlayer(p.player_id, p.name)}
              >
                <View style={s.shirt}>
                  <Text style={s.shirtNum}>{p.shirt_number ?? ''}</Text>
                </View>
                <Text style={s.pitchName} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.label}>SUBSTITUTES</Text>
        {sheet.substitutes.length === 0 ? (
          <Text style={s.muted}>None named.</Text>
        ) : sheet.substitutes.map((p) => (
          <TouchableOpacity
            key={p.player_id} style={[s.row, { paddingVertical: 6 }]}
            activeOpacity={0.6}
            onPress={() => openPlayer(p.player_id, p.name)}
          >
            <Text style={[s.mono, { width: 28 }]}>
              {p.shirt_number != null ? `#${p.shirt_number}` : ''}
            </Text>
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Timeline({ events, fx, openPlayer }: {
  events: TournamentMatchEvent[]; fx: any;
  openPlayer: (id: string, name: string) => void;
}) {
  if (events.length === 0) {
    return (
      <Text style={s.muted}>
        Nothing logged yet. The organiser adds goals and cards as they happen.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {events.slice().sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)).map((e) => {
        const name = e.players
          ? `${e.players.first_name} ${e.players.last_name}`.trim() : '';
        return (
          <TouchableOpacity
            key={e.id} style={[s.card, s.row]} activeOpacity={e.players ? 0.6 : 1}
            disabled={!e.players}
            onPress={() => e.players && openPlayer(e.players.id, name)}
          >
            <Text style={[s.mono, { width: 30 }]}>
              {e.minute != null ? `${e.minute}'` : '--'}
            </Text>
            <Text style={[s.tag, { color: eventTint(e.type) }]}>
              {EVENT_LABEL[e.type] ?? e.type}
            </Text>
            <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{name || '—'}</Text>
            <Text style={s.mono} numberOfLines={1}>
              {e.side === 'home' ? fx.home_team : fx.away_team}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── ratings ────────────────────────────────────────────────────── */
function Ratings({ matchRef, match, homeLabel, awayLabel, openPlayer }: {
  matchRef: string; match: TournamentMatch; homeLabel: string; awayLabel: string;
  openPlayer: (id: string, name: string) => void;
}) {
  const [data, setData] = useState<MatchRatings | null>(null);
  const [mine, setMine] = useState<MyVotes | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getMatchRatings('local', matchRef)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
    getMyVotes('local', matchRef)
      .then((m) => { setMine(m); setSignedIn(true); })
      .catch(() => { setMine(null); setSignedIn(false); });
  }, [matchRef]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (!data && !error) return <ActivityIndicator color={COLORS.volt} />;
  if (!data) return <Text style={s.error}>{error}</Text>;

  // Everyone on the team sheet. Falls back to whoever appears in the
  // events when the organiser hasn't entered one.
  const seen = new Map<string, { name: string; side: 'home' | 'away' }>();
  for (const side of ['home', 'away'] as const) {
    const sheet = match.lineups?.[side];
    for (const p of [...(sheet?.starters ?? []), ...(sheet?.substitutes ?? [])]) {
      seen.set(p.player_id, { name: p.name, side });
    }
  }
  if (seen.size === 0) {
    for (const e of match.events) {
      if (!e.players) continue;
      seen.set(e.players.id, {
        name: `${e.players.first_name} ${e.players.last_name}`, side: e.side,
      });
    }
  }

  const byRef = new Map(data.players.map((p) => [p.player_ref, p]));
  const open = data.window.open;
  const entries = Array.from(seen.entries());
  const sides = [
    { label: homeLabel, refs: entries.filter(([, v]) => v.side === 'home').map(([k]) => k) },
    { label: awayLabel, refs: entries.filter(([, v]) => v.side === 'away').map(([k]) => k) },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.card, open && { borderColor: 'rgba(212,255,0,0.35)' }]}>
        <Text style={s.cardTitle}>{open ? 'Voting is open' : 'Voting is closed'}</Text>
        <Text style={s.muted}>
          {open
            ? 'Rate the players and pick your Man of the Match. Closes 30 minutes after full time.'
            : data.window.reason}
        </Text>
        {signedIn === false ? (
          <Text style={[s.muted, { marginTop: 4 }]}>Sign in to vote.</Text>
        ) : null}
      </View>

      {data.motm.total_votes > 0 ? (
        <View style={s.card}>
          <Text style={s.label}>
            MAN OF THE MATCH · {data.motm.total_votes}{' '}
            {data.motm.total_votes === 1 ? 'VOTE' : 'VOTES'}
          </Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {data.motm.leaders.map((m) => (
              <View key={m.player_ref} style={s.row}>
                <Text style={[s.body, { width: 92 }]} numberOfLines={1}>
                  {seen.get(m.player_ref)?.name ?? 'Player'}
                </Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${m.share}%` }]} />
                </View>
                <Text style={[s.mono, { width: 32, textAlign: 'right' }]}>{m.share}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      {seen.size === 0 ? (
        <Text style={s.muted}>
          Nobody to rate yet. The organiser hasn&apos;t entered a team sheet.
        </Text>
      ) : null}

      {sides.map((side) => side.refs.length === 0 ? null : (
        <View key={side.label} style={s.card}>
          <Text style={s.label}>{side.label.toUpperCase()}</Text>
          {side.refs.map((ref) => {
            const agg = byRef.get(ref);
            const my = mine?.ratings?.[ref];
            const isMotm = mine?.motm === ref;
            const canVote = open && signedIn === true;
            return (
              <View key={ref} style={s.playerRow}>
                <View style={s.row}>
                  <TouchableOpacity
                    style={{ flex: 1 }} activeOpacity={0.6}
                    onPress={() => openPlayer(ref, seen.get(ref)?.name ?? '')}
                  >
                    <Text style={s.body} numberOfLines={1}>{seen.get(ref)?.name}</Text>
                    <Text style={s.mono}>
                      {agg?.enough_votes
                        // The average is already the big number on the right.
                        ? `${agg.votes} ${agg.votes === 1 ? 'vote' : 'votes'}`
                        : agg
                          ? `${agg.votes} of ${data.min_votes} votes needed`
                          : 'No votes yet'}
                      {my != null ? ` · you gave ${my}` : ''}
                    </Text>
                  </TouchableOpacity>
                  {agg?.enough_votes ? <Text style={s.avg}>{agg.average}</Text> : null}
                  {canVote ? (
                    <TouchableOpacity disabled={busy != null}
                      onPress={() => act(`motm-${ref}`, () => voteMotm('local', matchRef, ref))}
                      style={[s.motmBtn, isMotm && s.motmBtnOn]}>
                      <Text style={[s.motmText, isMotm && { color: COLORS.volt }]}>MOTM</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {canVote ? (
                  <View style={s.steps}>
                    {STEPS.map((v) => (
                      <TouchableOpacity key={v} disabled={busy != null}
                        onPress={() => act(`${ref}-${v}`,
                          () => ratePlayer('local', matchRef, ref, v))}
                        style={[s.step, my === v && s.stepOn]}>
                        <Text style={[s.stepText, my === v && { color: COLORS.bg }]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}

      <Text style={s.mono}>
        An average appears once {data.min_votes} people have rated a player, so
        one person can&apos;t publish a score against someone on their own.
      </Text>
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
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { color: COLORS.text, fontSize: 13 },
  muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  mono: { color: COLORS.textDim, fontSize: 10 },
  label: { color: COLORS.volt, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  error: { color: '#FF4444', fontSize: 13, fontWeight: '600' },
  teamName: { color: COLORS.text, fontSize: 12, fontWeight: '700', flex: 1 },
  bigScore: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  tag: {
    color: COLORS.volt, fontSize: 9, fontWeight: '800',
    textTransform: 'uppercase', width: 56,
  },
  tabs: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: COLORS.card, alignItems: 'center',
  },
  pillOn: { borderColor: COLORS.cardBorderActive, backgroundColor: COLORS.voltMuted },
  pillText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  pillTextOn: { color: COLORS.volt },
  crest: {
    backgroundColor: COLORS.cardElevated, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  crestText: { color: COLORS.textSecondary, fontSize: 8, fontWeight: '700' },
  pitch: {
    backgroundColor: '#0F1A14', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 14,
    gap: 14, overflow: 'hidden',
  },
  pitchHalfLine: {
    position: 'absolute', left: 0, right: 0, top: '50%',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  pitchCircle: {
    position: 'absolute', alignSelf: 'center', top: '50%',
    width: 64, height: 64, marginTop: -32, borderRadius: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'center' },
  pitchPlayer: { alignItems: 'center', width: 58 },
  shirt: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.cardElevated,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  shirtNum: { color: COLORS.volt, fontSize: 11, fontWeight: '800' },
  pitchName: {
    color: COLORS.text, fontSize: 9, fontWeight: '600',
    marginTop: 3, textAlign: 'center',
  },
  playerRow: {
    paddingVertical: 10, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 8,
  },
  avg: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  barTrack: {
    flex: 1, height: 6, borderRadius: 999,
    backgroundColor: COLORS.cardElevated, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: COLORS.volt, borderRadius: 999 },
  motmBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  motmBtnOn: { borderColor: COLORS.volt, backgroundColor: COLORS.voltMuted },
  motmText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  step: {
    width: 38, height: 28, borderRadius: 6, backgroundColor: COLORS.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  stepOn: { backgroundColor: COLORS.volt },
  stepText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});

export default TournamentMatchScreen;
