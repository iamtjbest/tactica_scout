// src/screens/MatchDetailScreen.tsx - Comprehensive match breakdown
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import {
  getMatchDetail,
  teamLogoUrl,
  getMatchFacts,
  type MatchFacts,
  MatchDetail,
} from '../services/api';
import RatingsTab from '../components/RatingsTab';
import { buildLineupRows, lineupRowWidth, lineupPlayerId } from '../lib/lineup';

interface MatchDetailScreenProps {
  route: any;
  navigation: any;
}

type TabType = 'overview' | 'timeline' | 'lineups' | 'ratings' | 'stats' | 'h2h' | 'facts';

function formatKickoffFull(iso?: string): string {
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

function formatHeroKickoff(iso?: string): string {
  if (!iso) return 'UPCOMING';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

export const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { eventId, matchSummary } = route.params;
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [facts, setFacts] = useState<MatchFacts | null>(null);
  const [factsFailed, setFactsFailed] = useState(false);

  useEffect(() => {
    getMatchDetail(eventId)
      .then((data) => setDetail(data))
      .catch((err) => console.warn('Failed to load match detail:', err))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    let alive = true;
    setFacts(null);
    setFactsFailed(false);
    getMatchFacts(eventId)
      .then((f: MatchFacts) => { if (alive) setFacts(f); })
      .catch(() => { if (alive) setFactsFailed(true); });
    return () => { alive = false; };
  }, [eventId]);

  const home = detail?.home_team || matchSummary?.home_team || 'Home';
  const away = detail?.away_team || matchSummary?.away_team || 'Away';
  const homeId = detail?.home_team_id ?? matchSummary?.home_team_id;
  const awayId = detail?.away_team_id ?? matchSummary?.away_team_id;
  const homeScore = detail?.home_score ?? matchSummary?.home_score ?? 0;
  const awayScore = detail?.away_score ?? matchSummary?.away_score ?? 0;
  const statusStr = String(detail?.status || matchSummary?.status || '').toLowerCase();
  const isLive = statusStr.includes('live') || statusStr.includes('in_progress') || (matchSummary?.minute > 0 && statusStr !== 'finished');
  const isFinished = ['finished', 'ft', 'ended', 'played'].includes(statusStr);
  const kickoffIso = detail?.event_date || matchSummary?.kickoff;

  const incidents = Array.isArray(detail?.incidents) ? detail!.incidents : [];
  const rawScorers = Array.isArray(detail?.goalscorers) ? detail!.goalscorers : [];

  const isHomeEvent = (item: any): boolean => {
    if (typeof item?.is_home === 'boolean') return item.is_home;
    if (item?.side === 'home') return true;
    if (item?.side === 'away') return false;
    if (homeId != null && item?.team_id != null) return Number(item.team_id) === Number(homeId);
    if (awayId != null && item?.team_id != null) return Number(item.team_id) !== Number(awayId);
    const teamStr = String(item?.team || item?.team_name || '').toLowerCase();
    if (teamStr && home && teamStr === home.toLowerCase()) return true;
    return true;
  };

  const goalSource =
    rawScorers.length > 0
      ? rawScorers
      : incidents.filter((inc: any) =>
        String(inc.type || inc.incident_type || '').toLowerCase().includes('goal')
      );

  const homeGoals = goalSource.filter((g: any) => isHomeEvent(g));
  const awayGoals = goalSource.filter((g: any) => !isHomeEvent(g));

  const keyIncidents = incidents.filter((inc: any) => {
    const t = String(inc.type || inc.incident_type || '').toLowerCase();
    return t.includes('goal') || t.includes('card') || t.includes('yellow') || t.includes('red') || t.includes('penalty');
  });

  const sortedTimeline = [...incidents].sort((a: any, b: any) => {
    const aMin = a.minute ?? (a.period_second != null ? Math.floor(a.period_second / 60) : 0);
    const bMin = b.minute ?? (b.period_second != null ? Math.floor(b.period_second / 60) : 0);
    return bMin - aMin;
  });

  const isConfirmedLineup = String(detail?.lineup_status || '').toLowerCase() === 'confirmed';

  return (
    <View style={styles.container}>
      {/* Top Header Bar with Safe Area Inset */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {detail?.competition || matchSummary?.competition || 'Match Breakdown'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Match Score Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.scoreRow}>
          {/* Home */}
          <TouchableOpacity
            style={styles.teamHero}
            onPress={() => homeId && navigation.navigate('TeamDetail', { teamId: homeId, teamName: home })}
          >
            <View style={styles.heroLogoWrap}>
              {teamLogoUrl(homeId) ? (
                <Image source={{ uri: teamLogoUrl(homeId)! }} style={styles.heroLogo} resizeMode="contain" />
              ) : (
                <Ionicons name="shield-outline" size={24} color={COLORS.textDim} />
              )}
            </View>
            <Text style={styles.heroTeamName} numberOfLines={2}>{home}</Text>
          </TouchableOpacity>

          {/* Center Score & Minute */}
          <View style={styles.heroCenter}>
            {isLive ? (
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {detail?.minute ? `${detail.minute}'` : 'LIVE'}
                </Text>
              </View>
            ) : (
              <Text style={styles.statusTag}>
                {isFinished ? 'FULL TIME' : formatHeroKickoff(kickoffIso)}
              </Text>
            )}

            <View style={styles.heroNumbers}>
              {isFinished || isLive ? (
                <>
                  <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>{homeScore}</Text>
                  <Text style={styles.heroColon}>-</Text>
                  <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>{awayScore}</Text>
                </>
              ) : (
                <Text style={styles.heroVsText}>VS</Text>
              )}
            </View>
            {detail?.venue ? (
              <Text style={styles.venueText} numberOfLines={1}>
                <Ionicons name="location-outline" size={10} color={COLORS.textDim} /> {detail.venue}
              </Text>
            ) : null}
          </View>

          {/* Away */}
          <TouchableOpacity
            style={styles.teamHero}
            onPress={() => awayId && navigation.navigate('TeamDetail', { teamId: awayId, teamName: away })}
          >
            <View style={styles.heroLogoWrap}>
              {teamLogoUrl(awayId) ? (
                <Image source={{ uri: teamLogoUrl(awayId)! }} style={styles.heroLogo} resizeMode="contain" />
              ) : (
                <Ionicons name="shield-outline" size={24} color={COLORS.textDim} />
              )}
            </View>
            <Text style={styles.heroTeamName} numberOfLines={2}>{away}</Text>
          </TouchableOpacity>
        </View>

        {/* Goalscorers Underneath Their Respective Teams */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <View style={styles.scorersSplitStrip}>
            <View style={styles.scorersColLeft}>
              {homeGoals.map((g: any, idx: number) => {
                const name = g.player || g.player_name || g.scorer || 'Goal';
                const min = g.minute ?? (g.period_second != null ? Math.floor(g.period_second / 60) : '');
                return (
                  <View key={`hg-${idx}`} style={styles.scorerLine}>
                    <Ionicons name="football" size={11} color={COLORS.volt} />
                    <Text style={styles.scorerText} numberOfLines={1}>
                      {name} {min !== '' ? `(${min}')` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.scorersColRight}>
              {awayGoals.map((g: any, idx: number) => {
                const name = g.player || g.player_name || g.scorer || 'Goal';
                const min = g.minute ?? (g.period_second != null ? Math.floor(g.period_second / 60) : '');
                return (
                  <View key={`ag-${idx}`} style={styles.scorerLine}>
                    <Text style={[styles.scorerText, { textAlign: 'right' }]} numberOfLines={1}>
                      {name} {min !== '' ? `(${min}')` : ''}
                    </Text>
                    <Ionicons name="football" size={11} color={COLORS.volt} />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabsStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {(['overview', 'timeline', 'lineups', 'ratings', 'stats', 'h2h', 'facts'] as TabType[]).map((t) => {
            const isActive = activeTab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Fetching tactical data...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View>
              {/* Match Info Card (Matches Web Kickoff / Round / Venue Block) */}
              {(kickoffIso || detail?.round || detail?.venue || detail?.referee) && (
                <View style={[styles.cardSection, { marginBottom: 12, gap: 6 }]}>
                  {!!kickoffIso && (
                    <Text style={styles.metaLine}>
                      <Text style={styles.metaKey}>Kickoff: </Text>
                      {formatKickoffFull(kickoffIso)}
                    </Text>
                  )}
                  {!!detail?.round && (
                    <Text style={styles.metaLine}>
                      <Text style={styles.metaKey}>Round: </Text>
                      {detail.round}
                    </Text>
                  )}
                  {!!detail?.venue && (
                    <Text style={styles.metaLine}>
                      <Text style={styles.metaKey}>Venue: </Text>
                      {detail.venue}
                    </Text>
                  )}
                  {!!detail?.referee && (
                    <Text style={styles.metaLine}>
                      <Text style={styles.metaKey}>Referee: </Text>
                      {detail.referee}
                    </Text>
                  )}
                </View>
              )}

              {facts &&
                (facts.home?.win_prob != null || facts.away?.win_prob != null) && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setActiveTab('facts')}
                    style={[styles.cardSection, { marginBottom: 12 }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>TACTICA WIN PROBABILITY</Text>
                      <Text style={{ color: COLORS.volt, fontSize: 11, fontWeight: '700' }}>Full ratings →</Text>
                    </View>
                    <View style={{ flexDirection: 'row', height: 6, borderRadius: 999, backgroundColor: COLORS.bg, overflow: 'hidden', gap: 2 }}>
                      <View style={{ width: `${facts.home?.win_prob ?? 0}%`, backgroundColor: COLORS.volt }} />
                      {facts.draw_prob != null && (
                        <View style={{ width: `${facts.draw_prob}%`, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                      )}
                      <View style={{ width: `${facts.away?.win_prob ?? 0}%`, backgroundColor: '#38bdf8' }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: COLORS.volt, fontSize: 12, fontWeight: '800' }}>
                        {facts.home?.win_prob?.toFixed(1)}%
                      </Text>
                      {facts.draw_prob != null && (
                        <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' }}>
                          Draw {facts.draw_prob.toFixed(1)}%
                        </Text>
                      )}
                      <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '800' }}>
                        {facts.away?.win_prob?.toFixed(1)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

              {/* Team Form */}
              {((detail?.home_form?.length || 0) > 0 ||
                (detail?.away_form?.length || 0) > 0) && (
                  <View style={styles.cardSection}>
                    <Text style={styles.sectionTitle}>TEAM FORM</Text>
                    <View style={styles.formColumns}>
                      {[
                        { label: home, id: homeId, rows: detail?.home_form || [] },
                        { label: away, id: awayId, rows: detail?.away_form || [] },
                      ].map((col, ci) => (
                        <View key={`fc-${ci}`} style={styles.formColumn}>
                          <Text
                            style={styles.formTeamLabel}
                            numberOfLines={1}
                            onPress={() =>
                              col.id &&
                              navigation.navigate('TeamDetail', {
                                teamId: col.id,
                                teamName: col.label,
                              })
                            }
                          >
                            {col.label}
                          </Text>

                          {col.rows.length === 0 ? (
                            <Text style={styles.factsEmpty}>No recent form yet.</Text>
                          ) : (
                            col.rows.map((f, i) => {
                              const score = f.is_home
                                ? `${f.own_score ?? '-'}-${f.opp_score ?? '-'}`
                                : `${f.opp_score ?? '-'}-${f.own_score ?? '-'}`;
                              const tone =
                                f.result === 'W'
                                  ? styles.pillW
                                  : f.result === 'D'
                                    ? styles.pillD
                                    : styles.pillL;
                              return (
                                <TouchableOpacity
                                  key={f.event_id ?? `f-${ci}-${i}`}
                                  activeOpacity={f.event_id ? 0.6 : 1}
                                  disabled={!f.event_id}
                                  onPress={() =>
                                    f.event_id &&
                                    navigation.navigate('MatchDetail', {
                                      eventId: f.event_id,
                                    })
                                  }
                                  style={[styles.formResultRow, tone]}
                                >
                                  <View style={styles.formCrestSlot}>
                                    {f.opponent_id != null && (
                                      <Image
                                        source={{ uri: teamLogoUrl(f.opponent_id) || '' }}
                                        style={styles.formCrest}
                                        resizeMode="contain"
                                      />
                                    )}
                                  </View>
                                  <Text style={styles.formOpponent} numberOfLines={1}>
                                    {f.opponent}
                                  </Text>
                                  <Text style={styles.formScore}>{score}</Text>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

              {/* Key Events & Incidents (Goals & Cards only) */}
              <View style={[styles.cardSection, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>KEY EVENTS &amp; INCIDENTS</Text>
                {keyIncidents.length > 0 ? (
                  keyIncidents.map((inc: any, idx: number) => {
                    const type = String(inc.type || inc.incident_type || '').toLowerCase();
                    const minute = inc.minute ?? (inc.period_second != null ? Math.floor(inc.period_second / 60) : '-');
                    const player = inc.player || inc.player_name || inc.scorer || inc.text || 'Event';
                    const isHome = isHomeEvent(inc);

                    let iconName: keyof typeof Ionicons.glyphMap = 'football';
                    let tint = COLORS.volt;
                    if (type.includes('red')) {
                      iconName = 'square';
                      tint = '#FF4444';
                    } else if (type.includes('yellow') || type.includes('card')) {
                      iconName = 'square';
                      tint = '#FFC53D';
                    }

                    return (
                      <View key={inc.id || `key-inc-${idx}`} style={styles.incidentRow}>
                        <Text style={styles.incidentMin}>{minute}&apos;</Text>
                        <View style={styles.incidentIconWrap}>
                          <Ionicons name={iconName} size={13} color={tint} />
                        </View>
                        <Text style={[styles.incidentDesc, { fontWeight: '600' }]} numberOfLines={1}>
                          {player}
                        </Text>
                        <Text style={{ color: COLORS.textDim, fontSize: 10, maxWidth: 90 }} numberOfLines={1}>
                          {isHome ? home : away}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>No goals or cards recorded for this match.</Text>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: SPLIT CENTER-SPINE TIMELINE */}
          {activeTab === 'timeline' && (
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
                sortedTimeline.map((inc: any, idx: number) => {
                  const type = String(inc.type || inc.incident_type || '').toLowerCase();
                  const minute = inc.minute ?? (inc.period_second != null ? Math.floor(inc.period_second / 60) : '-');
                  const player = inc.player || inc.player_name || inc.scorer || '';
                  const textLabel = inc.text || type.toUpperCase().replace(/_/g, ' ');

                  if (type.includes('period')) {
                    return (
                      <View key={inc.id || `tl-p-${idx}`} style={styles.periodRow}>
                        <View style={styles.periodPill}>
                          <Text style={styles.periodText}>
                            {minute}&apos; {textLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  const isHome = isHomeEvent(inc);
                  let iconName: keyof typeof Ionicons.glyphMap = 'time-outline';
                  let tint = COLORS.text;
                  let title = textLabel;

                  if (type.includes('goal')) {
                    iconName = 'football';
                    tint = COLORS.volt;
                    title = player || 'Goal';
                  } else if (type.includes('red')) {
                    iconName = 'square';
                    tint = '#FF4444';
                    title = player || 'Red Card';
                  } else if (type.includes('yellow') || type.includes('card')) {
                    iconName = 'square';
                    tint = '#FFC53D';
                    title = player || 'Yellow Card';
                  } else if (type.includes('sub')) {
                    iconName = 'swap-horizontal';
                    tint = '#38bdf8';
                    title = inc.player_in ? `In: ${inc.player_in}` : player || 'Substitution';
                  }

                  const subDetail = type.includes('sub')
                    ? inc.player_out
                      ? `Out: ${inc.player_out}`
                      : ''
                    : inc.assist
                      ? `Assist: ${inc.assist}`
                      : '';

                  return (
                    <View key={inc.id || `tl-${idx}`} style={styles.spineRow}>
                      <View style={styles.spineSideLeft}>
                        {isHome && (
                          <View style={styles.spineEventCardLeft}>
                            <View style={styles.spineEventTitleRow}>
                              <Text style={[styles.spinePlayerName, { color: tint }]} numberOfLines={1}>
                                {title}
                              </Text>
                              <Ionicons name={iconName} size={13} color={tint} style={{ marginLeft: 5 }} />
                            </View>
                            {!!subDetail && (
                              <Text style={styles.spineSubText} numberOfLines={1}>
                                {subDetail}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>

                      <View style={styles.spineCenter}>
                        <View style={styles.spineLine} />
                        <View style={styles.spineMinuteBadge}>
                          <Text style={styles.spineMinuteText}>{minute}&apos;</Text>
                        </View>
                      </View>

                      <View style={styles.spineSideRight}>
                        {!isHome && (
                          <View style={styles.spineEventCardRight}>
                            <View style={styles.spineEventTitleRow}>
                              <Ionicons name={iconName} size={13} color={tint} style={{ marginRight: 5 }} />
                              <Text style={[styles.spinePlayerName, { color: tint }]} numberOfLines={1}>
                                {title}
                              </Text>
                            </View>
                            {!!subDetail && (
                              <Text style={styles.spineSubText} numberOfLines={1}>
                                {subDetail}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noDataText}>No key events (goals, cards, subs) reported yet.</Text>
              )}
            </View>
          )}

          {/* TAB 3: LINEUPS */}
          {activeTab === 'lineups' && (
            <View style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>TACTICAL LINEUPS</Text>
                {detail?.lineups && Object.keys(detail.lineups).length > 0 && (
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
                      {isConfirmedLineup ? 'CONFIRMED LINEUP' : 'PREDICTED LINEUP'}
                    </Text>
                  </View>
                )}
              </View>

              {detail?.lineups && Object.keys(detail.lineups).length > 0 ? (
                <View>
                  {['home', 'away'].map((side) => {
                    const sideData: any = (detail.lineups as any)[side] || {};
                    const squad: any[] = sideData.players || [];
                    const teamTitle = side === 'home' ? home : away;
                    const rows = buildLineupRows(squad.slice(0, 11), sideData.formation);
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
                          {!!sideData.formation && (
                            <Text style={styles.formationLabel}>{sideData.formation}</Text>
                          )}
                        </View>

                        <View style={styles.pitch}>
                          <View style={styles.pitchHalfLine} />
                          <View style={styles.pitchCircle} />
                          {rows.slice().reverse().map((row, ri) => (
                            <View
                              key={`row-${ri}`}
                              style={[styles.pitchRow, { width: lineupRowWidth(row.length) }]}
                            >
                              {row.map((p: any, pi: number) => {
                                const pid = lineupPlayerId(p);
                                return (
                                  <TouchableOpacity
                                    key={`p-${ri}-${pi}`}
                                    style={styles.pitchPlayer}
                                    disabled={pid == null}
                                    onPress={() =>
                                      navigation.navigate('PlayerDetail', {
                                        playerId: pid,
                                        playerName: p.name ?? p.short_name,
                                      })
                                    }
                                  >
                                    <View style={styles.shirt}>
                                      <Text style={styles.shirtNumText}>
                                        {p.shirt_number ?? p.number ?? ''}
                                      </Text>
                                    </View>
                                    <Text style={styles.pitchName} numberOfLines={1}>
                                      {p.short_name ?? p.name ?? ''}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noDataText}>Lineups have not been published yet.</Text>
              )}
            </View>
          )}

          {/* TAB 4: RATINGS */}
          {activeTab === 'ratings' && (
            <RatingsTab
              source="bsd"
              matchRef={String(eventId)}
              lineups={detail?.lineups}
              homeLabel={home}
              awayLabel={away}
              navigation={navigation}
            />
          )}

          {/* TAB 5: STATS */}
          {activeTab === 'stats' && (
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>MATCH STATISTICS</Text>
              {detail?.stats && Array.isArray(detail.stats) && detail.stats.length > 0 ? (
                detail.stats.map((s: any, idx: number) => (
                  <View key={`stat-${idx}`} style={styles.statMetricRow}>
                    <Text style={styles.statNumLeft}>{s.home}</Text>
                    <Text style={styles.statMetricName}>{s.name || s.type}</Text>
                    <Text style={styles.statNumRight}>{s.away}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Live match statistics currently unavailable.</Text>
              )}
            </View>
          )}

          {/* TAB 6: H2H */}
          {activeTab === 'h2h' && (
            <View>
              {detail?.h2h?.summary && (
                <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>HEAD-TO-HEAD HISTORY</Text>
                  <View style={styles.h2hSummaryRow}>
                    <View style={styles.h2hStatBox}>
                      <Text style={[styles.h2hStatNum, { color: COLORS.volt }]}>
                        {detail.h2h.summary.home_wins ?? 0}
                      </Text>
                      <Text style={styles.h2hStatLabel}>{home} Wins</Text>
                    </View>
                    <View style={styles.h2hStatBox}>
                      <Text style={[styles.h2hStatNum, { color: COLORS.draw }]}>
                        {detail.h2h.summary.draws ?? 0}
                      </Text>
                      <Text style={styles.h2hStatLabel}>Draws</Text>
                    </View>
                    <View style={styles.h2hStatBox}>
                      <Text style={[styles.h2hStatNum, { color: '#38bdf8' }]}>
                        {detail.h2h.summary.away_wins ?? 0}
                      </Text>
                      <Text style={styles.h2hStatLabel}>{away} Wins</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={[styles.cardSection, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>RECENT MEETINGS</Text>
                {detail?.h2h?.recent_matches && detail.h2h.recent_matches.length > 0 ? (
                  detail.h2h.recent_matches.map((m, idx) => (
                    <View key={`h2h-m-${idx}`} style={styles.recentMeetingRow}>
                      <Text style={styles.meetingDate}>{m.date?.slice(0, 10)}</Text>
                      <Text style={styles.meetingTeams} numberOfLines={1}>
                        {m.home_team} {m.home_score} - {m.away_score} {m.away_team}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No past encounters on file.</Text>
                )}
              </View>
            </View>
          )}

          {/* TAB 7: FACTS */}
          {activeTab === 'facts' && (
            <View style={styles.cardSection}>
              {(() => {
                const f = facts;
                const hasRatings = f?.home?.attack != null || f?.away?.attack != null;
                const hasProbs =
                  f?.home?.win_prob != null || f?.away?.win_prob != null;

                if (factsFailed) {
                  return (
                    <>
                      <Text style={styles.sectionTitle}>TACTICA NUMBERS</Text>
                      <Text style={styles.factsEmpty}>
                        Tactica ratings couldn&apos;t be loaded right now.
                      </Text>
                    </>
                  );
                }
                if (!f) {
                  return (
                    <>
                      <Text style={styles.sectionTitle}>TACTICA NUMBERS</Text>
                      <Text style={styles.factsEmpty}>
                        Loading ratings... the model may be waking up.
                      </Text>
                    </>
                  );
                }
                if (!hasRatings && !hasProbs) {
                  const message =
                    f.unavailable_reason === 'no_prematch_snapshot'
                      ? "No pre-match numbers were saved for this match. Ratings calculated now would include this match's own result, so they wouldn't be pre-match numbers."
                      : f.degraded
                        ? "Tactica ratings couldn't be loaded right now."
                        : "Tactica ratings aren't available for this match yet.";
                  return (
                    <>
                      <Text style={styles.sectionTitle}>TACTICA NUMBERS</Text>
                      <Text style={styles.factsEmpty}>{message}</Text>
                    </>
                  );
                }

                const Bar = ({ label, value, color }: any) => (
                  <View style={{ marginBottom: 12 }}>
                    <View style={styles.probHead}>
                      <Text style={styles.probLabel} numberOfLines={1}>{label}</Text>
                      <Text style={[styles.probVal, { color }]}>
                        {value != null ? `${value.toFixed(1)}%` : '--'}
                      </Text>
                    </View>
                    <View style={styles.probTrack}>
                      <View
                        style={[
                          styles.probFill,
                          {
                            backgroundColor: color,
                            width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );

                return (
                  <>
                    {f.provisional && (
                      <Text style={[styles.factsEmpty, { marginBottom: 12 }]}>
                        Provisional. These update until kickoff gets close,
                        then they&apos;re locked in.
                      </Text>
                    )}
                    {f.frozen && (
                      <Text style={[styles.factsEmpty, { marginBottom: 12 }]}>
                        Pre-match numbers, locked in before kickoff.
                      </Text>
                    )}

                    {hasProbs && (
                      <>
                        <Text style={styles.sectionTitle}>WIN PROBABILITY</Text>
                        <Bar label={detail?.home_team} value={f.home?.win_prob} color={COLORS.volt} />
                        {f.draw_prob != null && (
                          <Bar label="Draw" value={f.draw_prob} color={COLORS.textSecondary} />
                        )}
                        <Bar label={detail?.away_team} value={f.away?.win_prob} color="#38bdf8" />
                        {f.draw_prob == null && (
                          <Text style={styles.factsEmpty}>
                            Each figure is that side&apos;s own model run, so they won&apos;t
                            always total 100.
                          </Text>
                        )}
                      </>
                    )}

                    <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                      TACTICA RATINGS
                    </Text>
                    <View style={styles.ratingRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                        <Text style={styles.ratingTeam} numberOfLines={1}>{detail?.home_team}</Text>
                        {f.home?.live_rating === false && f.home?.attack != null && (
                          <Text style={styles.baseTag}>BASE</Text>
                        )}
                      </View>
                      <Text style={styles.ratingVal}>
                        ATK <Text style={{ color: COLORS.volt }}>{f.home?.attack ?? '--'}</Text>
                        {'   '}
                        DEF <Text style={{ color: '#38bdf8' }}>{f.home?.defence ?? '--'}</Text>
                      </Text>
                    </View>
                    <View style={styles.ratingRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                        <Text style={styles.ratingTeam} numberOfLines={1}>{detail?.away_team}</Text>
                        {f.away?.live_rating === false && f.away?.attack != null && (
                          <Text style={styles.baseTag}>BASE</Text>
                        )}
                      </View>
                      <Text style={styles.ratingVal}>
                        ATK <Text style={{ color: COLORS.volt }}>{f.away?.attack ?? '--'}</Text>
                        {'   '}
                        DEF <Text style={{ color: '#38bdf8' }}>{f.away?.defence ?? '--'}</Text>
                      </Text>
                    </View>

                    {!!f.best_formation && (
                      <View style={{ marginTop: 18 }}>
                        <Text style={styles.sectionTitle}>MODEL&apos;S BEST SHAPE</Text>
                        <Text style={styles.bestShape}>{f.best_formation}</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  lineupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lineupBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineupBadgeConfirmed: {
    backgroundColor: 'rgba(200, 255, 0, 0.14)',
    borderColor: COLORS.volt,
  },
  lineupBadgePredicted: {
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderColor: '#fbbf24',
  },
  lineupBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  formationLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
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
  pitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'center',
  },
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
  },
  shirtNumText: { color: COLORS.volt, fontSize: 11, fontWeight: '800' },
  pitchName: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamHero: {
    flex: 1,
    alignItems: 'center',
  },
  heroLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroLogo: {
    width: 36,
    height: 36,
  },
  heroTeamName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroCenter: {
    width: 126,
    alignItems: 'center',
  },
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
  liveText: {
    color: COLORS.live,
    fontSize: 11,
    fontWeight: '800',
  },
  statusTag: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  heroNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroScore: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
  },
  heroVsText: {
    color: COLORS.textDim,
    fontSize: 22,
    fontWeight: '900',
  },
  heroColon: {
    color: COLORS.textDim,
    fontSize: 24,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  venueText: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 6,
  },
  metaLine: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  metaKey: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  scorersSplitStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    flexDirection: 'row',
    gap: 12,
  },
  scorersColLeft: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  scorersColRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  scorerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scorerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tabsStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardElevated,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.volt,
  },
  tabLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: COLORS.volt,
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
  cardSection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  formTeamLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  pillW: { backgroundColor: COLORS.win },
  pillD: { backgroundColor: COLORS.draw },
  pillL: { backgroundColor: COLORS.loss },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  incidentMin: {
    width: 32,
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  incidentIconWrap: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  incidentDesc: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timelineTeamHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  periodRow: {
    alignItems: 'center',
    marginVertical: 10,
  },
  periodPill: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  periodText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  spineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  spineSideLeft: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 8,
    paddingVertical: 4,
  },
  spineSideRight: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 8,
    paddingVertical: 4,
  },
  spineEventCardLeft: {
    alignItems: 'flex-end',
  },
  spineEventCardRight: {
    alignItems: 'flex-start',
  },
  spineEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinePlayerName: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  spineSubText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  spineCenter: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: COLORS.cardBorder,
  },
  spineMinuteBadge: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  spineMinuteText: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
  },
  lineupSideTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  statMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statNumLeft: {
    color: COLORS.volt,
    fontSize: 13,
    fontWeight: '800',
    width: 40,
    textAlign: 'left',
  },
  statMetricName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  statNumRight: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    width: 40,
    textAlign: 'right',
  },
  h2hSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  h2hStatBox: {
    alignItems: 'center',
  },
  h2hStatNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  h2hStatLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  recentMeetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  meetingDate: {
    width: 80,
    color: COLORS.textDim,
    fontSize: 11,
  },
  meetingTeams: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  probHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 5,
  },
  probLabel: { color: COLORS.text, fontSize: 13, flex: 1 },
  probVal: { fontSize: 17, fontWeight: '900' },
  probTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.bg, overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 999 },
  baseTag: { color: COLORS.textDim, fontSize: 9, fontWeight: '700' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 12,
  },
  ratingTeam: { color: COLORS.text, fontSize: 14, flexShrink: 1 },
  ratingVal: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  bestShape: { color: COLORS.text, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  formColumns: { flexDirection: 'row', gap: 12 },
  formColumn: { flex: 1, minWidth: 0 },
  formResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  formCrestSlot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  formCrest: { width: 16, height: 16 },
  formOpponent: { flex: 1, color: COLORS.text, fontSize: 11 },
  formScore: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  factsEmpty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
});