// src/screens/TournamentMatchScreen.tsx - Local tournament match breakdown with clickable teams & Tactica Pre-Match Model
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { buildLineupRows, lineupRowWidth } from '../lib/lineup';
import {
  getTournamentMatch,
  getTournamentMatchFacts,
  getMatchRatings,
  getMyVotes,
  ratePlayer,
  voteMotm,
  type TournamentMatch,
  type TournamentMatchModel,
  type TournamentSheet,
  type MatchRatings,
  type MyVotes,
} from '../services/api';

type Tab = 'overview' | 'timeline' | 'lineups' | 'ratings';

const STEPS = [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];

const EVENT_LABEL: Record<string, string> = {
  goal: 'Goal',
  own_goal: 'Own Goal',
  penalty: 'Penalty',
  penalty_scored: 'Penalty',
  penalty_missed: 'Pen Missed',
  penalty_saved: 'Pen Saved',
  yellow: 'Yellow Card',
  yellow_card: 'Yellow Card',
  second_yellow: '2nd Yellow',
  red: 'Red Card',
  red_card: 'Red Card',
  substitution: 'Substitution',
  assist: 'Assist',
};

function formatKickoffFull(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${datePart}, ${timePart}`;
}

function formatHeroKickoff(iso?: string | null): string {
  if (!iso) return 'UPCOMING';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function getEventIconAndTint(type: string): { icon: keyof typeof Ionicons.glyphMap; tint: string } {
  const t = String(type || '').toLowerCase();
  if (t.includes('goal') || t === 'penalty' || t === 'penalty_scored') {
    return { icon: 'football', tint: COLORS.volt };
  }
  if (t === 'red' || t === 'red_card' || t.includes('second_yellow')) {
    return { icon: 'square', tint: '#FF4444' };
  }
  if (t.includes('yellow')) {
    return { icon: 'square', tint: '#FFC53D' };
  }
  if (t.includes('sub')) {
    return { icon: 'swap-horizontal', tint: '#38bdf8' };
  }
  return { icon: 'time-outline', tint: COLORS.textSecondary };
}

function normalizeModel(raw?: TournamentMatchModel | null) {
  const homeProb = raw?.home?.win_prob ?? raw?.home_win_prob ?? 36.5;
  const drawProb = raw?.draw_prob ?? 27;
  const awayProb = raw?.away?.win_prob ?? raw?.away_win_prob ?? 36.5;
  const homeAtk = raw?.home?.attack ?? raw?.home_attack ?? 54;
  const homeDef = raw?.home?.defence ?? raw?.home_defence ?? 54;
  const awayAtk = raw?.away?.attack ?? raw?.away_attack ?? 54;
  const awayDef = raw?.away?.defence ?? raw?.away_defence ?? 54;
  return { homeProb, drawProb, awayProb, homeAtk, homeDef, awayAtk, awayDef };
}

export const TournamentMatchScreen: React.FC<any> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { tournamentId, fixtureId, tournamentName } = route.params;
  const [d, setD] = useState<TournamentMatch | null>(null);
  const [modelData, setModelData] = useState<TournamentMatchModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const load = useCallback(() => {
    getTournamentMatch(tournamentId, fixtureId)
      .then((x) => {
        setD(x);
        setError(null);
        const embedded = x.facts || x.prediction || x.pre_match_model || x.model || null;
        if (embedded) {
          setModelData(embedded);
        } else {
          getTournamentMatchFacts(tournamentId, fixtureId)
            .then((f) => { if (f) setModelData(f); })
            .catch(() => { });
        }
      })
      .catch((e) => setError(e?.message || 'Failed to load match.'))
      .finally(() => setRefreshing(false));
  }, [tournamentId, fixtureId]);

  useEffect(() => {
    load();
  }, [load]);

  const liveStatus = String(d?.fixture?.status || '').toLowerCase();
  useEffect(() => {
    if (!['live', 'ht'].includes(liveStatus)) return;
    const timer = setInterval(() => load(), 25_000);
    return () => clearInterval(timer);
  }, [liveStatus, load]);

  const openPlayer = useCallback(
    (id: string, name: string) => {
      navigation.navigate('TournamentPlayer', {
        tournamentId,
        playerId: id,
        playerName: name,
      });
    },
    [navigation, tournamentId]
  );

  const openLocalTeam = useCallback(
    (teamId: string | null | undefined, name: string, crest: string | null) => {
      navigation.navigate('TeamDetail', {
        source: 'local',
        tournamentId,
        teamId: teamId || undefined,
        teamName: name,
        teamCrest: crest,
      });
    },
    [navigation, tournamentId]
  );

  const fx = d?.fixture;
  const home = fx?.home_team || 'Home';
  const away = fx?.away_team || 'Away';
  const statusStr = String(fx?.status || '').toLowerCase();
  const isLive = ['live', 'ht', 'in_progress'].includes(statusStr);
  const isFinished = ['finished', 'ft', 'ended', 'played'].includes(statusStr);
  const events = Array.isArray(d?.events) ? d!.events : [];

  const goalEvents = events.filter((e) => {
    const t = String(e.type || '').toLowerCase();
    return t === 'goal' || t === 'own_goal' || t === 'penalty' || t === 'penalty_scored';
  });
  const homeGoals = goalEvents.filter((e) => e.side === 'home');
  const awayGoals = goalEvents.filter((e) => e.side === 'away');

  const keyIncidents = events.filter((e) => {
    const t = String(e.type || '').toLowerCase();
    return t.includes('goal') || t.includes('card') || t.includes('yellow') || t.includes('red') || t.includes('penalty');
  });

  const sortedTimeline = [...events].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  const isConfirmedLineup = String(d?.lineup_status || '').toLowerCase() === 'confirmed';

  const model = normalizeModel(modelData);
  const homeShort = home.split(/\s+/)[0].toUpperCase();
  const awayShort = away.split(/\s+/)[0].toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Safe-Area Navigation Bar */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {tournamentName || fx?.round || 'Match Breakdown'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {error && !d ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !d || !fx ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Fetching match data...</Text>
        </View>
      ) : (
        <>
          {/* Match Score Hero Card (Both Teams Clickable) */}
          <View style={styles.heroCard}>
            <View style={styles.scoreRow}>
              <TouchableOpacity
                style={styles.teamHero}
                activeOpacity={0.75}
                onPress={() => openLocalTeam(fx.home_team_id, home, fx.home_crest)}
              >
                <View style={styles.heroLogoWrap}>
                  <Crest url={fx.home_crest} name={home} size={36} />
                </View>
                <Text style={styles.heroTeamName} numberOfLines={2}>
                  {home}
                </Text>
              </TouchableOpacity>

              <View style={styles.heroCenter}>
                {isLive ? (
                  <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {statusStr === 'ht' ? 'HT' : 'LIVE'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.statusTag}>
                    {isFinished ? 'FULL TIME' : formatHeroKickoff(fx.kickoff_at)}
                  </Text>
                )}

                <View style={styles.heroNumbers}>
                  {isFinished || isLive ? (
                    <>
                      <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>
                        {fx.home_score ?? 0}
                      </Text>
                      <Text style={styles.heroColon}>-</Text>
                      <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>
                        {fx.away_score ?? 0}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.heroVsText}>VS</Text>
                  )}
                </View>

                {fx.venue ? (
                  <Text style={styles.venueText} numberOfLines={1}>
                    <Ionicons name="location-outline" size={10} color={COLORS.textDim} /> {fx.venue}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.teamHero}
                activeOpacity={0.75}
                onPress={() => openLocalTeam(fx.away_team_id, away, fx.away_crest)}
              >
                <View style={styles.heroLogoWrap}>
                  <Crest url={fx.away_crest} name={away} size={36} />
                </View>
                <Text style={styles.heroTeamName} numberOfLines={2}>
                  {away}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Split Goalscorers */}
            {(homeGoals.length > 0 || awayGoals.length > 0) && (
              <View style={styles.scorersSplitStrip}>
                <View style={styles.scorersColLeft}>
                  {homeGoals.map((g, idx) => {
                    const name = g.players
                      ? `${g.players.first_name} ${g.players.last_name}`.trim()
                      : 'Goal';
                    const og = String(g.type).toLowerCase() === 'own_goal' ? ' (OG)' : '';
                    return (
                      <View key={`hg-${g.id || idx}`} style={styles.scorerLine}>
                        <Ionicons name="football" size={11} color={COLORS.volt} />
                        <Text style={styles.scorerText} numberOfLines={1}>
                          {name}{og} {g.minute != null ? `(${g.minute}')` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.scorersColRight}>
                  {awayGoals.map((g, idx) => {
                    const name = g.players
                      ? `${g.players.first_name} ${g.players.last_name}`.trim()
                      : 'Goal';
                    const og = String(g.type).toLowerCase() === 'own_goal' ? ' (OG)' : '';
                    return (
                      <View key={`ag-${g.id || idx}`} style={styles.scorerLine}>
                        <Text style={[styles.scorerText, { textAlign: 'right' }]} numberOfLines={1}>
                          {name}{og} {g.minute != null ? `(${g.minute}')` : ''}
                        </Text>
                        <Ionicons name="football" size={11} color={COLORS.volt} />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Underline Tabs Bar */}
          <View style={styles.tabsStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12 }}
            >
              {(['overview', 'timeline', 'lineups', 'ratings'] as Tab[]).map((t) => {
                const isActive = tab === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                    onPress={() => setTab(t)}
                  >
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Tab Body */}
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: 50 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={COLORS.volt}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            {/* TAB 1: OVERVIEW */}
            {tab === 'overview' && (
              <View style={{ gap: 12 }}>
                {/* TACTICA PRE-MATCH MODEL CARD (Matches scout-web) */}
                <View style={[styles.cardSection, { borderColor: COLORS.cardBorderActive }]}>
                  <View style={styles.modelHeaderRow}>
                    <Text style={styles.modelTitle}>TACTICA PRE-MATCH MODEL</Text>
                    <Text style={styles.modelSub}>See the game before kickoff</Text>
                  </View>

                  <View style={styles.modelBarTrack}>
                    <View style={{ flex: Math.max(5, model.homeProb), backgroundColor: COLORS.volt }} />
                    <View style={{ flex: Math.max(5, model.drawProb), backgroundColor: 'rgba(255,255,255,0.28)' }} />
                    <View style={{ flex: Math.max(5, model.awayProb), backgroundColor: 'rgba(148,163,184,0.35)' }} />
                  </View>

                  <View style={styles.modelProbRow}>
                    <View>
                      <Text style={styles.modelProbLabel}>HOME</Text>
                      <Text style={[styles.modelProbVal, { color: COLORS.volt }]}>
                        {model.homeProb}%
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.modelProbLabel}>DRAW</Text>
                      <Text style={styles.modelProbVal}>{model.drawProb}%</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.modelProbLabel}>AWAY</Text>
                      <Text style={styles.modelProbVal}>{model.awayProb}%</Text>
                    </View>
                  </View>

                  <View style={styles.modelRatingsRow}>
                    <View style={styles.modelRatingPill}>
                      <Text style={styles.modelRatingTeam} numberOfLines={1}>{homeShort}</Text>
                      <Text style={styles.modelRatingStat}>
                        ATK <Text style={styles.modelRatingNum}>{model.homeAtk}</Text>
                        {'  '}
                        DEF <Text style={styles.modelRatingNum}>{model.homeDef}</Text>
                      </Text>
                    </View>
                    <View style={styles.modelRatingPill}>
                      <Text style={styles.modelRatingTeam} numberOfLines={1}>{awayShort}</Text>
                      <Text style={styles.modelRatingStat}>
                        ATK <Text style={styles.modelRatingNum}>{model.awayAtk}</Text>
                        {'  '}
                        DEF <Text style={styles.modelRatingNum}>{model.awayDef}</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Match Info Card */}
                {(fx.kickoff_at || fx.round || fx.group_name || fx.venue) && (
                  <View style={[styles.cardSection, { gap: 6 }]}>
                    {!!fx.kickoff_at && (
                      <Text style={styles.metaLine}>
                        <Text style={styles.metaKey}>Kickoff: </Text>
                        {formatKickoffFull(fx.kickoff_at)}
                      </Text>
                    )}
                    {!!(fx.group_name || fx.round) && (
                      <Text style={styles.metaLine}>
                        <Text style={styles.metaKey}>Round: </Text>
                        {[fx.group_name, fx.round].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                    {!!fx.venue && (
                      <Text style={styles.metaLine}>
                        <Text style={styles.metaKey}>Venue: </Text>
                        {fx.venue}
                      </Text>
                    )}
                  </View>
                )}

                {/* Key Events & Incidents */}
                <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>KEY EVENTS &amp; INCIDENTS</Text>
                  {keyIncidents.length > 0 ? (
                    keyIncidents.map((inc, idx) => {
                      const { icon, tint } = getEventIconAndTint(inc.type);
                      const player = inc.players
                        ? `${inc.players.first_name} ${inc.players.last_name}`.trim()
                        : EVENT_LABEL[inc.type] || inc.type;
                      const activePlayer = inc.players ?? inc.related_player;
                      return (
                        <TouchableOpacity
                          key={inc.id || `key-${idx}`}
                          style={styles.incidentRow}
                          disabled={!activePlayer}
                          onPress={() => activePlayer && openPlayer(activePlayer.id, player)}
                        >
                          <Text style={styles.incidentMin}>
                            {inc.minute != null ? `${inc.minute}'` : '-'}
                          </Text>
                          <View style={styles.incidentIconWrap}>
                            <Ionicons name={icon} size={13} color={tint} />
                          </View>
                          <Text style={[styles.incidentDesc, { fontWeight: '600' }]} numberOfLines={1}>
                            {player}
                          </Text>
                          <Text style={{ color: COLORS.textDim, fontSize: 10, maxWidth: 90 }} numberOfLines={1}>
                            {inc.side === 'home' ? home : away}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.noDataText}>No goals or cards recorded for this match.</Text>
                  )}
                </View>
              </View>
            )}

            {/* TAB 2: SPLIT CENTER-SPINE TIMELINE */}
            {tab === 'timeline' && (
              <View style={styles.cardSection}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={[styles.timelineTeamHeader, { color: COLORS.volt }]} numberOfLines={1}>
                    {home}
                  </Text>
                  <Text style={styles.sectionTitle}>TIMELINE</Text>
                  <Text style={[styles.timelineTeamHeader, { color: '#38bdf8', textAlign: 'right' }]} numberOfLines={1}>
                    {away}
                  </Text>
                </View>

                {sortedTimeline.length > 0 ? (
                  sortedTimeline.map((e, idx) => {
                    const isHome = e.side === 'home';
                    const { icon, tint } = getEventIconAndTint(e.type);
                    const name = e.players
                      ? `${e.players.first_name} ${e.players.last_name}`.trim()
                      : '';
                    const relatedName = e.related_player
                      ? `${e.related_player.first_name} ${e.related_player.last_name}`.trim()
                      : '';
                    const activePlayer = e.players ?? e.related_player;

                    const title =
                      e.type === 'substitution'
                        ? relatedName
                          ? `In: ${relatedName}`
                          : 'Substitution'
                        : name || EVENT_LABEL[e.type] || e.type;

                    const subDetail =
                      e.type === 'substitution'
                        ? name
                          ? `Out: ${name}`
                          : ''
                        : e.type === 'goal' && relatedName
                          ? `Assist: ${relatedName}`
                          : e.type === 'penalty_saved' && relatedName
                            ? `Saved by: ${relatedName}`
                            : '';

                    return (
                      <View key={e.id || `tl-${idx}`} style={styles.spineRow}>
                        <View style={styles.spineSideLeft}>
                          {isHome && (
                            <TouchableOpacity
                              style={styles.spineEventCardLeft}
                              disabled={!activePlayer}
                              onPress={() => activePlayer && openPlayer(activePlayer.id, name || relatedName)}
                            >
                              <View style={styles.spineEventTitleRow}>
                                <Text style={[styles.spinePlayerName, { color: tint }]} numberOfLines={1}>
                                  {title}
                                </Text>
                                <Ionicons name={icon} size={13} color={tint} style={{ marginLeft: 5 }} />
                              </View>
                              {!!subDetail && (
                                <Text style={styles.spineSubText} numberOfLines={1}>
                                  {subDetail}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.spineCenter}>
                          <View style={styles.spineLine} />
                          <View style={styles.spineMinuteBadge}>
                            <Text style={styles.spineMinuteText}>
                              {e.minute != null ? `${e.minute}'` : '--'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.spineSideRight}>
                          {!isHome && (
                            <TouchableOpacity
                              style={styles.spineEventCardRight}
                              disabled={!activePlayer}
                              onPress={() => activePlayer && openPlayer(activePlayer.id, name || relatedName)}
                            >
                              <View style={styles.spineEventTitleRow}>
                                <Ionicons name={icon} size={13} color={tint} style={{ marginRight: 5 }} />
                                <Text style={[styles.spinePlayerName, { color: tint }]} numberOfLines={1}>
                                  {title}
                                </Text>
                              </View>
                              {!!subDetail && (
                                <Text style={styles.spineSubText} numberOfLines={1}>
                                  {subDetail}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>
                    No key events (goals, cards, subs) reported yet.
                  </Text>
                )}
              </View>
            )}

            {/* TAB 3: LINEUPS */}
            {tab === 'lineups' && (
              <View style={styles.cardSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>TACTICAL LINEUPS</Text>
                  <View
                    style={[
                      styles.lineupBadge,
                      isConfirmedLineup ? styles.lineupBadgeConfirmed : styles.lineupBadgePredicted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.lineupBadgeText,
                        { color: isConfirmedLineup ? COLORS.volt : '#fbbf24' },
                      ]}
                    >
                      {isConfirmedLineup ? 'CONFIRMED LINEUP' : 'PENDING LINEUP'}
                    </Text>
                  </View>
                </View>

                {isConfirmedLineup ? (
                  <View>
                    {(['home', 'away'] as const).map((side) => {
                      const sheet: TournamentSheet | undefined = d.lineups?.[side];
                      if (!sheet) return null;
                      const teamTitle = side === 'home' ? home : away;
                      const rows = buildLineupRows(sheet.starters || [], sheet.formation);
                      return (
                        <View key={side} style={{ marginTop: 14 }}>
                          <View style={styles.lineupHeadRow}>
                            <Text
                              style={[
                                styles.lineupSideTitle,
                                { color: side === 'home' ? COLORS.volt : '#38bdf8' },
                              ]}
                            >
                              {teamTitle}
                            </Text>
                            {!!sheet.formation && (
                              <Text style={styles.formationLabel}>{sheet.formation}</Text>
                            )}
                          </View>

                          <View style={styles.pitch}>
                            <View style={styles.pitchHalfLine} />
                            <View style={styles.pitchCircle} />
                            {rows.slice().reverse().map((row: any[], ri: number) => (
                              <View
                                key={`row-${ri}`}
                                style={[styles.pitchRow, { width: lineupRowWidth(row.length) }]}
                              >
                                {row.map((p: any, pi: number) => (
                                  <TouchableOpacity
                                    key={p.player_id || `p-${ri}-${pi}`}
                                    style={styles.pitchPlayer}
                                    onPress={() => openPlayer(p.player_id, p.name)}
                                  >
                                    <View style={styles.shirt}>
                                      {p.photo_url ? (
                                        <Image source={{ uri: p.photo_url }} style={StyleSheet.absoluteFill} />
                                      ) : null}
                                      <Text style={styles.shirtNumText}>{p.shirt_number ?? ''}</Text>
                                    </View>
                                    <Text style={styles.pitchName} numberOfLines={1}>
                                      {p.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ))}
                          </View>

                          {Array.isArray(sheet.substitutes) && sheet.substitutes.length > 0 && (
                            <View style={styles.benchWrap}>
                              <Text style={styles.benchTitle}>SUBSTITUTES</Text>
                              {sheet.substitutes.map((p) => (
                                <TouchableOpacity
                                  key={p.player_id}
                                  style={styles.benchRow}
                                  onPress={() => openPlayer(p.player_id, p.name)}
                                >
                                  <Crest url={p.photo_url} name={p.name} size={24} />
                                  <Text style={styles.benchNum}>
                                    {p.shirt_number != null ? `#${p.shirt_number}` : ''}
                                  </Text>
                                  <Text style={styles.benchName} numberOfLines={1}>
                                    {p.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>
                    No team sheet yet. The organiser enters the starting XI and the bench from the editor.
                  </Text>
                )}
              </View>
            )}

            {/* TAB 4: RATINGS */}
            {tab === 'ratings' && (
              <Ratings
                matchRef={fixtureId}
                match={d}
                openPlayer={openPlayer}
                homeLabel={home}
                awayLabel={away}
              />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

function Crest({ url, name, size = 24 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    const initials = (name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    return (
      <View style={[styles.crestFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.crestText, { fontSize: Math.max(8, Math.floor(size * 0.34)) }]}>
          {initials}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      resizeMode="contain"
    />
  );
}

function Ratings({
  matchRef,
  match,
  homeLabel,
  awayLabel,
  openPlayer,
}: {
  matchRef: string;
  match: TournamentMatch;
  homeLabel: string;
  awayLabel: string;
  openPlayer: (id: string, name: string) => void;
}) {
  const [data, setData] = useState<MatchRatings | null>(null);
  const [mine, setMine] = useState<MyVotes | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getMatchRatings('local', matchRef)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => setError(e?.message || 'Could not load ratings.'));
    getMyVotes('local', matchRef)
      .then((m) => {
        setMine(m);
        setSignedIn(true);
      })
      .catch(() => {
        setMine(null);
        setSignedIn(false);
      });
  }, [matchRef]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      load();
    } catch (e: any) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  if (!data && !error) return <ActivityIndicator color={COLORS.volt} style={{ padding: 24 }} />;
  if (!data) return <Text style={styles.errorText}>{error}</Text>;

  const seen = new Map<string, { name: string; side: 'home' | 'away' }>();
  for (const side of ['home', 'away'] as const) {
    const sheet = match.lineups?.[side];
    for (const p of [...(sheet?.starters ?? []), ...(sheet?.substitutes ?? [])]) {
      seen.set(p.player_id, { name: p.name, side });
    }
  }
  if (seen.size === 0) {
    for (const e of match.events || []) {
      if (!e.players) continue;
      seen.set(e.players.id, {
        name: `${e.players.first_name} ${e.players.last_name}`.trim(),
        side: e.side,
      });
    }
  }

  const byRef = new Map((data.players || []).map((p) => [p.player_ref, p]));
  const open = data.window.open;
  const entries = Array.from(seen.entries());
  const sides = [
    { label: homeLabel, refs: entries.filter(([, v]) => v.side === 'home').map(([k]) => k) },
    { label: awayLabel, refs: entries.filter(([, v]) => v.side === 'away').map(([k]) => k) },
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.cardSection, open && { borderColor: COLORS.cardBorderActive }]}>
        <Text style={styles.sectionTitle}>{open ? 'VOTING IS OPEN' : 'VOTING IS CLOSED'}</Text>
        <Text style={styles.ratingMuted}>
          {open
            ? 'Rate the players and pick your Man of the Match. Closes 30 minutes after full time.'
            : data.window.reason || 'Voting is not currently open for this match.'}
        </Text>
        {signedIn === false && (
          <Text style={[styles.ratingMuted, { marginTop: 4, color: COLORS.volt }]}>
            Sign in from Settings to submit votes.
          </Text>
        )}
      </View>

      {data.motm.total_votes > 0 && (
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>
            MAN OF THE MATCH · {data.motm.total_votes}{' '}
            {data.motm.total_votes === 1 ? 'VOTE' : 'VOTES'}
          </Text>
          <View style={{ gap: 8 }}>
            {data.motm.leaders.map((m) => (
              <View key={m.player_ref} style={styles.motmRow}>
                <Text style={[styles.incidentDesc, { width: 92, flex: 0 }]} numberOfLines={1}>
                  {seen.get(m.player_ref)?.name ?? 'Player'}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${m.share}%` }]} />
                </View>
                <Text style={styles.motmPct}>{m.share}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {seen.size === 0 ? (
        <View style={styles.cardSection}>
          <Text style={styles.noDataText}>
            Nobody to rate yet. Lineups have not been published for this match.
          </Text>
        </View>
      ) : (
        sides.map((side) =>
          side.refs.length === 0 ? null : (
            <View key={side.label} style={styles.cardSection}>
              <Text style={styles.sectionTitle}>{side.label.toUpperCase()}</Text>
              {side.refs.map((ref) => {
                const agg = byRef.get(ref);
                const my = mine?.ratings?.[ref];
                const isMotm = mine?.motm === ref;
                const canVote = open && signedIn === true;
                return (
                  <View key={ref} style={styles.ratePlayerRow}>
                    <View style={styles.motmRow}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => openPlayer(ref, seen.get(ref)?.name ?? '')}
                      >
                        <Text style={styles.incidentDesc} numberOfLines={1}>
                          {seen.get(ref)?.name}
                        </Text>
                        <Text style={styles.ratingSub}>
                          {agg?.enough_votes
                            ? `${agg.votes} ${agg.votes === 1 ? 'vote' : 'votes'}`
                            : agg
                              ? `${agg.votes} of ${data.min_votes} votes needed`
                              : 'No votes yet'}
                          {my != null ? ` · you gave ${my}` : ''}
                        </Text>
                      </TouchableOpacity>
                      {agg?.enough_votes && (
                        <Text style={styles.avgScore}>{agg.average ?? agg.rating}</Text>
                      )}
                      {canVote && (
                        <TouchableOpacity
                          disabled={busy != null}
                          onPress={() => act(`motm-${ref}`, () => voteMotm('local', matchRef, ref))}
                          style={[styles.motmBtn, isMotm && styles.motmBtnOn]}
                        >
                          <Text style={[styles.motmText, isMotm && { color: COLORS.volt }]}>
                            MOTM
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {canVote && (
                      <View style={styles.steps}>
                        {STEPS.map((v) => (
                          <TouchableOpacity
                            key={v}
                            disabled={busy != null}
                            onPress={() =>
                              act(`${ref}-${v}`, () => ratePlayer('local', matchRef, ref, v))
                            }
                            style={[styles.step, my === v && styles.stepOn]}
                          >
                            <Text style={[styles.stepText, my === v && { color: COLORS.bg }]}>
                              {v}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 4 },
  navTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '80%',
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamHero: { flex: 1, alignItems: 'center' },
  heroLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTeamName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroCenter: { width: 126, alignItems: 'center' },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
    marginRight: 5,
  },
  liveText: { color: COLORS.live, fontSize: 11, fontWeight: '800' },
  statusTag: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  heroNumbers: { flexDirection: 'row', alignItems: 'center' },
  heroScore: { color: COLORS.text, fontSize: 32, fontWeight: '900' },
  heroVsText: { color: COLORS.textDim, fontSize: 22, fontWeight: '900' },
  heroColon: { color: COLORS.textDim, fontSize: 24, fontWeight: '700', marginHorizontal: 8 },
  venueText: { color: COLORS.textDim, fontSize: 10, marginTop: 6 },
  scorersSplitStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    flexDirection: 'row',
    gap: 12,
  },
  scorersColLeft: { flex: 1, alignItems: 'flex-start', gap: 4 },
  scorersColRight: { flex: 1, alignItems: 'flex-end', gap: 4 },
  scorerLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scorerText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  tabsStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardElevated,
  },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tabLabelActive: { color: COLORS.volt },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  errorText: { color: '#FF4444', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cardSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modelTitle: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  modelSub: {
    color: COLORS.textDim,
    fontSize: 10,
  },
  modelBarTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 12,
  },
  modelProbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelProbLabel: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modelProbVal: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  modelRatingsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modelRatingPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  modelRatingTeam: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  modelRatingStat: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  modelRatingNum: {
    color: COLORS.text,
    fontWeight: '900',
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  metaLine: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  metaKey: { color: COLORS.textSecondary, fontWeight: '500' },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  incidentMin: { width: 32, color: COLORS.textDim, fontSize: 12, fontWeight: '700' },
  incidentIconWrap: { width: 24, alignItems: 'center', marginRight: 8 },
  incidentDesc: { color: COLORS.text, fontSize: 13, fontWeight: '500', flex: 1 },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timelineTeamHeader: { flex: 1, fontSize: 11, fontWeight: '800' },
  spineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  spineSideLeft: { flex: 1, alignItems: 'flex-end', paddingRight: 8, paddingVertical: 4 },
  spineSideRight: { flex: 1, alignItems: 'flex-start', paddingLeft: 8, paddingVertical: 4 },
  spineEventCardLeft: { alignItems: 'flex-end' },
  spineEventCardRight: { alignItems: 'flex-start' },
  spineEventTitleRow: { flexDirection: 'row', alignItems: 'center' },
  spinePlayerName: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  spineSubText: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  spineCenter: { width: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  spineLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: COLORS.cardBorder },
  spineMinuteBadge: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  spineMinuteText: { color: COLORS.volt, fontSize: 10, fontWeight: '800' },
  lineupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lineupBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  lineupBadgeConfirmed: { backgroundColor: 'rgba(200, 255, 0, 0.14)', borderColor: COLORS.volt },
  lineupBadgePredicted: { backgroundColor: 'rgba(251, 191, 36, 0.14)', borderColor: '#fbbf24' },
  lineupBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  lineupSideTitle: { fontSize: 13, fontWeight: '800' },
  formationLabel: { color: COLORS.textSecondary, fontSize: 11, fontFamily: 'monospace' },
  pitch: {
    backgroundColor: '#0F1A14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    gap: 14,
    overflow: 'hidden',
  },
  pitchHalfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  pitchCircle: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    width: 64,
    height: 64,
    marginTop: -32,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'center' },
  pitchPlayer: { alignItems: 'center', width: 58 },
  shirt: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shirtNumText: { color: COLORS.volt, fontSize: 11, fontWeight: '800' },
  pitchName: { color: COLORS.text, fontSize: 9, fontWeight: '600', marginTop: 3, textAlign: 'center' },
  benchWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    gap: 6,
  },
  benchTitle: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  benchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  benchNum: { color: COLORS.textDim, fontSize: 11, fontWeight: '700', width: 28 },
  benchName: { color: COLORS.text, fontSize: 12, fontWeight: '600', flex: 1 },
  crestFallback: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestText: { color: COLORS.textSecondary, fontWeight: '800' },
  noDataText: { color: COLORS.textDim, fontSize: 12, paddingVertical: 10, textAlign: 'center' },
  ratingMuted: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  ratingSub: { color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  motmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  motmPct: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', width: 34, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: COLORS.cardElevated, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.volt, borderRadius: 999 },
  ratePlayerRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  avgScore: { color: COLORS.volt, fontSize: 15, fontWeight: '900' },
  motmBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  motmBtnOn: { borderColor: COLORS.volt, backgroundColor: COLORS.voltMuted },
  motmText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  step: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOn: { backgroundColor: COLORS.volt },
  stepText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});

export default TournamentMatchScreen;