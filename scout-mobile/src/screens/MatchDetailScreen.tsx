// src/screens/MatchDetailScreen.tsx — Comprehensive match breakdown
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
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import {
  getMatchDetail,
  teamLogoUrl,
  MatchDetail,
  MatchSummary,
} from '../services/api';

interface MatchDetailScreenProps {
  route: any;
  navigation: any;
}

type TabType = 'overview' | 'lineups' | 'stats' | 'h2h' | 'facts';

export const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({ route, navigation }) => {
  const { eventId, matchSummary } = route.params;
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    getMatchDetail(eventId)
      .then((data) => setDetail(data))
      .catch((err) => console.warn('Failed to load match detail:', err))
      .finally(() => setLoading(false));
  }, [eventId]);

  const home = detail?.home_team || matchSummary?.home_team || 'Home';
  const away = detail?.away_team || matchSummary?.away_team || 'Away';
  const homeId = detail?.home_team_id ?? matchSummary?.home_team_id;
  const awayId = detail?.away_team_id ?? matchSummary?.away_team_id;
  const homeScore = detail?.home_score ?? matchSummary?.home_score ?? 0;
  const awayScore = detail?.away_score ?? matchSummary?.away_score ?? 0;
  const isLive = detail?.status?.toLowerCase().includes('live') || matchSummary?.minute > 0;

  return (
    <View style={styles.container}>
      {/* Top Header Bar with Back Button */}
      <View style={styles.topNav}>
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
                {detail?.status === 'finished' ? 'FULL TIME' : detail?.event_date?.slice(0, 10) || 'UPCOMING'}
              </Text>
            )}

            <View style={styles.heroNumbers}>
              <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>{homeScore}</Text>
              <Text style={styles.heroColon}>-</Text>
              <Text style={[styles.heroScore, isLive && { color: COLORS.volt }]}>{awayScore}</Text>
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

        {/* Goal Scorers ticker if any */}
        {detail?.goalscorers && detail.goalscorers.length > 0 && (
          <View style={styles.scorersStrip}>
            {detail.goalscorers.map((g, idx) => (
              <View key={`goal-${idx}`} style={styles.scorerItem}>
                <Ionicons name="football" size={11} color={COLORS.volt} style={{ marginRight: 4 }} />
                <Text style={styles.scorerText}>
                  {g.player || 'Goal'} ({g.minute}')
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabsStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {(['overview', 'lineups', 'stats', 'h2h', 'facts'] as TabType[]).map((t) => {
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
              {/* Form Strip -- mirrors scout-web's TeamFormCard:
                  opponent crest, name and score, tappable through to the
                  match. Was W/D/L pills only, which told you a result
                  happened but not against whom. */}
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
                                {/* Fixed-width slot either way, so rows
                                    without a crest still line up. */}
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

              {/* Match Incidents */}
              <View style={[styles.cardSection, { marginTop: 12 }]}>
                <Text style={styles.sectionTitle}>KEY EVENTS & INCIDENTS</Text>
                {detail?.incidents && detail.incidents.length > 0 ? (
                  detail.incidents.map((inc: any, idx: number) => (
                    <View key={`inc-${idx}`} style={styles.incidentRow}>
                      <Text style={styles.incidentMin}>{inc.minute ? `${inc.minute}'` : '-'}</Text>
                      <View style={styles.incidentIconWrap}>
                        <Ionicons
                          name={
                            inc.incident_type === 'goal'
                              ? 'football'
                              : inc.incident_type === 'card'
                              ? 'square'
                              : 'swap-horizontal'
                          }
                          size={13}
                          color={
                            inc.incident_type === 'goal'
                              ? COLORS.volt
                              : inc.card_type === 'red'
                              ? COLORS.loss
                              : COLORS.draw
                          }
                        />
                      </View>
                      <Text style={styles.incidentDesc} numberOfLines={1}>
                        {inc.player_name || inc.text || inc.incident_type}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>No incidents recorded for this event.</Text>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: LINEUPS */}
          {activeTab === 'lineups' && (
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>TACTICAL LINEUPS</Text>
              {detail?.lineups && Object.keys(detail.lineups).length > 0 ? (
                <View>
                  <Text style={styles.lineupNote}>
                    Status: {detail.lineup_status || 'Not confirmed'}
                  </Text>
                  {/* Home and Away Lineup rosters */}
                  {['home', 'away'].map((side) => {
                    const squad = detail.lineups[side]?.players || [];
                    const teamTitle = side === 'home' ? home : away;
                    return (
                      <View key={side} style={{ marginTop: 12 }}>
                        <Text style={[styles.lineupSideTitle, { color: side === 'home' ? COLORS.volt : '#38bdf8' }]}>
                          {teamTitle}
                        </Text>
                        {squad.slice(0, 11).map((p: any, idx: number) => (
                          <TouchableOpacity
                            key={`player-${idx}`}
                            style={styles.lineupRow}
                            onPress={() => {
                              if (p.id) {
                                navigation.navigate('PlayerDetail', { playerId: p.id, playerName: p.name });
                              }
                            }}
                          >
                            <Text style={styles.shirtNum}>{p.shirt_number || idx + 1}</Text>
                            <Text style={styles.lineupPlayerName}>{p.name}</Text>
                            <Text style={styles.posBadge}>{p.position || '--'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noDataText}>Lineups have not been published yet.</Text>
              )}
            </View>
          )}

          {/* TAB 3: STATS */}
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

          {/* TAB 4: H2H */}
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

              {/* Recent Meetings */}
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

          {/* TAB 5: FACTS -- Tactica ratings from the main backend.
              Mirrors scout-web's FactsTab: same conditions, same copy.
              NEVER put a placeholder rating here. This used to fall back
              to a hardcoded '7.4' / '6.8', which meant every match in the
              app showed the same two invented numbers under Tactica's
              name. */}
          {activeTab === 'facts' && (
            <View style={styles.cardSection}>
              {(() => {
                const f = detail?.facts;
                const hasRatings = f?.home?.attack != null || f?.away?.attack != null;
                const hasProbs =
                  f?.home?.win_prob != null || f?.away?.win_prob != null;

                if (!f || (!hasRatings && !hasProbs)) {
                  return (
                    <>
                      <Text style={styles.sectionTitle}>TACTICA NUMBERS</Text>
                      <Text style={styles.factsEmpty}>
                        {f?.degraded
                          ? "Tactica ratings couldn't be loaded right now."
                          : "Tactica ratings aren't available for this match yet."}
                      </Text>
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
                        style={[styles.probFill, {
                          backgroundColor: color,
                          width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
                        }]}
                      />
                    </View>
                  </View>
                );

                return (
                  <>
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
                            Each figure is that side's own model run, so they won't
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
                        <Text style={styles.sectionTitle}>MODEL'S BEST SHAPE</Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
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
    width: 120,
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
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
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
  scorersStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scorerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTeamLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  formPills: {
    flexDirection: 'row',
    gap: 6,
  },
  formPill: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillW: { backgroundColor: COLORS.win },
  pillD: { backgroundColor: COLORS.draw },
  pillL: { backgroundColor: COLORS.loss },
  formPillText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
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
  lineupNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  lineupSideTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  lineupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  shirtNum: {
    width: 24,
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  lineupPlayerName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  posBadge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  factsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  factCard: {
    flex: 1,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  probHead: { flexDirection: 'row', alignItems: 'baseline',
              justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  probLabel: { color: COLORS.text, fontSize: 13, flex: 1 },
  probVal: { fontSize: 17, fontWeight: '900' },
  probTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.bg, overflow: 'hidden' },
  probFill: { height: '100%', borderRadius: 999 },
  baseTag: { color: COLORS.textDim, fontSize: 9, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, gap: 12 },
  ratingTeam: { color: COLORS.text, fontSize: 14, flexShrink: 1 },
  ratingVal: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  winProbBig: { color: COLORS.volt, fontSize: 32, fontWeight: '900', marginBottom: 6 },
  bestShape: { color: COLORS.text, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  formColumns: { flexDirection: 'row', gap: 12 },
  formColumn: { flex: 1, minWidth: 0 },
  formResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6,
                   borderRadius: 8, borderWidth: 1, paddingHorizontal: 8,
                   paddingVertical: 6, marginTop: 6 },
  formCrestSlot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  formCrest: { width: 16, height: 16 },
  formOpponent: { flex: 1, color: COLORS.text, fontSize: 11 },
  formScore: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  factsEmpty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  factLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  factVal: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  winProbTitle: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  winProbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardElevated,
    padding: 10,
    borderRadius: 8,
  },
  winProbText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
});
