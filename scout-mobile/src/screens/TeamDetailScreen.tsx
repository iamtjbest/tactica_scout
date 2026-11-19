// src/screens/TeamDetailScreen.tsx - Full-page team profile for both pro clubs and local tournament teams
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
import { COLORS, FONTS } from '../theme';
import { MatchCard } from '../components/MatchCard';
import { StandingsTable } from '../components/StandingsTable';
import { FollowButton } from '../components/FollowButton';
import {
  getTeamDetail,
  getTeamFixtures,
  getLeagueFixtures,
  getStandings,
  getTournament,
  getTournamentTeam,
  teamLogoUrl,
  playerImageUrl,
  TeamDetail,
  MatchSummary,
  StandingsRow,
  PlayerSummary,
  TournamentDetail,
  TournamentStanding,
  TournamentFixture,
} from '../services/api';

interface TeamDetailScreenProps {
  route: any;
  navigation: any;
}

type TabType = 'overview' | 'table' | 'matches' | 'squad';

function formatMatchDate(kickoff?: string): string {
  if (!kickoff) return '';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return kickoff.slice(0, 16);
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function calcAge(dob?: string | null): string {
  if (!dob) return '-';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '-';
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return age > 10 && age < 60 ? String(age) : '-';
}

function ordinal(n?: number | null): string {
  if (n == null || n <= 0) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]} Place`;
}

function getPositionBucket(pos?: string | null): 'GK' | 'DEF' | 'MID' | 'FWD' | 'OTHER' {
  const p = String(pos || '').trim().toUpperCase();
  if (p === 'G' || p === 'GK' || p.includes('GOAL')) return 'GK';
  if (p === 'D' || p === 'DEF' || p.includes('DEF') || p.includes('BACK')) return 'DEF';
  if (p === 'M' || p === 'MID' || p.includes('MID')) return 'MID';
  if (p === 'F' || p === 'FWD' || p.includes('FORW') || p.includes('STRIK') || p.includes('ATT') || p.includes('WING')) return 'FWD';
  return 'OTHER';
}

function groupLabel(name?: string | null): string {
  const g = (name || '').trim();
  if (!g) return '';
  return /^group\b/i.test(g) ? g : `Group ${g}`;
}

function toLocalMatchSummary(
  fx: TournamentFixture,
  tournamentId: string,
  competitionName: string
): MatchSummary {
  return {
    event_id: fx.id,
    source: 'local',
    tournament_id: tournamentId,
    home_crest: fx.home_crest,
    away_crest: fx.away_crest,
    home_team: fx.home_team || 'TBD',
    away_team: fx.away_team || 'TBD',
    home_score: fx.home_score ?? 0,
    away_score: fx.away_score ?? 0,
    minute: 0,
    status: fx.status || 'scheduled',
    kickoff: fx.kickoff_at || undefined,
    competition: [competitionName, fx.round].filter(Boolean).join(' • '),
    round: fx.round,
  };
}

export const TeamDetailScreen: React.FC<TeamDetailScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    teamId,
    teamName,
    teamCrest,
    source,
    tournamentId,
  } = route.params || {};

  const isLocal = source === 'local' && Boolean(tournamentId);

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [localTourney, setLocalTourney] = useState<TournamentDetail | null>(null);
  const [localTeamExtra, setLocalTeamExtra] = useState<any>(null);
  const [localStandings, setLocalStandings] = useState<TournamentStanding[]>([]);
  const [localGroupTitle, setLocalGroupTitle] = useState<string>('');

  const [recentFixtures, setRecentFixtures] = useState<MatchSummary[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<MatchSummary[]>([]);
  const [allSeasonMatches, setAllSeasonMatches] = useState<MatchSummary[]>([]);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    let alive = true;
    setLoading(true);

    if (isLocal && tournamentId) {
      Promise.all([
        getTournament(tournamentId),
        teamId ? getTournamentTeam(tournamentId, String(teamId)) : Promise.resolve(null),
      ])
        .then(([tourneyRes, extraRes]) => {
          if (!alive) return;
          setLocalTourney(tourneyRes);
          setLocalTeamExtra(extraRes);

          const lowerName = String(teamName || '').toLowerCase();
          const matchedTeam = (tourneyRes.teams || []).find(
            (t) =>
              (teamId && t.team_id === String(teamId)) ||
              (lowerName && t.name.toLowerCase() === lowerName)
          );
          const resolvedId = matchedTeam?.team_id || (teamId ? String(teamId) : '');
          const resolvedName = matchedTeam?.name || teamName || 'Club';
          const resolvedLower = resolvedName.toLowerCase();

          // Find which standings table this team belongs to
          let activeRows: TournamentStanding[] = [];
          let grpHeading = tourneyRes.tournament.name;

          if (tourneyRes.group_tables && Object.keys(tourneyRes.group_tables).length > 0) {
            for (const gKey of Object.keys(tourneyRes.group_tables)) {
              const rows = tourneyRes.group_tables[gKey] || [];
              if (
                rows.some(
                  (r) =>
                    (resolvedId && r.team_id === resolvedId) ||
                    r.name.toLowerCase() === resolvedLower
                )
              ) {
                activeRows = rows;
                grpHeading = `${tourneyRes.tournament.name} (${groupLabel(gKey)})`;
                break;
              }
            }
          }
          if (activeRows.length === 0 && Array.isArray(tourneyRes.standings)) {
            activeRows = tourneyRes.standings;
          }

          setLocalStandings(activeRows);
          setLocalGroupTitle(grpHeading);

          // Collect all matches for this local team
          const fxList = (tourneyRes.fixtures || [])
            .filter(
              (fx) =>
                (resolvedId && (fx.home_team_id === resolvedId || fx.away_team_id === resolvedId)) ||
                String(fx.home_team || '').toLowerCase() === resolvedLower ||
                String(fx.away_team || '').toLowerCase() === resolvedLower
            )
            .slice()
            .sort((a, b) => (a.kickoff_at || '').localeCompare(b.kickoff_at || ''))
            .map((fx) => toLocalMatchSummary(fx, tournamentId, tourneyRes.tournament.name));

          setAllSeasonMatches(fxList);
          const isFin = (m: MatchSummary) =>
            ['finished', 'ft', 'ended', 'played'].includes(String(m.status || '').toLowerCase());
          setRecentFixtures(fxList.filter((m) => isFin(m)).reverse());
          setUpcomingFixtures(fxList.filter((m) => !isFin(m)));
        })
        .catch((err) => console.warn('Failed to load local team detail:', err))
        .finally(() => {
          if (alive) setLoading(false);
        });

      return () => { alive = false; };
    }

    // Standard Pro Club (BSD)
    Promise.all([
      getTeamDetail(teamId),
      getTeamFixtures(teamId).catch(() => ({ recent: [], upcoming: [], matches: [] })),
    ])
      .then(async ([teamRes, fixRes]) => {
        if (!alive) return;
        setTeam(teamRes);

        let leagueMatchesForClub: MatchSummary[] = [];
        if (teamRes && teamRes.primary_league_id) {
          const [stdRes, lgFixRes] = await Promise.all([
            getStandings(teamRes.primary_league_id).catch(() => null),
            getLeagueFixtures(teamRes.primary_league_id).catch(() => ({ matches: [] })),
          ]);
          if (alive && stdRes && Array.isArray(stdRes.standings)) {
            setStandings(stdRes.standings);
          }
          const lgList = Array.isArray(lgFixRes?.matches) ? lgFixRes.matches : [];
          const targetName = String(teamRes.name || teamName || '').toLowerCase();
          leagueMatchesForClub = lgList.filter((m) => {
            if (m.home_team_id != null && Number(m.home_team_id) === Number(teamId)) return true;
            if (m.away_team_id != null && Number(m.away_team_id) === Number(teamId)) return true;
            if (targetName) {
              if (String(m.home_team || '').toLowerCase() === targetName) return true;
              if (String(m.away_team || '').toLowerCase() === targetName) return true;
            }
            return false;
          });
        }

        if (!alive) return;

        const rawAll = Array.isArray(fixRes?.matches) ? fixRes.matches : [];
        const rawRecent = Array.isArray(fixRes?.recent) ? fixRes.recent : [];
        const rawUpcoming = Array.isArray(fixRes?.upcoming) ? fixRes.upcoming : [];

        const seen = new Set<string>();
        const merged: MatchSummary[] = [];
        for (const m of [...rawAll, ...rawUpcoming, ...rawRecent, ...leagueMatchesForClub]) {
          if (!m) continue;
          const key = m.event_id != null ? String(m.event_id) : `${m.home_team}-${m.away_team}-${m.kickoff}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(m);
        }

        merged.sort((a, b) => {
          const ta = a.kickoff ? new Date(a.kickoff).getTime() : 0;
          const tb = b.kickoff ? new Date(b.kickoff).getTime() : 0;
          return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
        });

        setAllSeasonMatches(merged);

        const isFin = (m: MatchSummary) =>
          ['finished', 'ft', 'ended', 'played'].includes(String(m.status || '').toLowerCase());

        setRecentFixtures(merged.filter((m) => isFin(m)).reverse());
        setUpcomingFixtures(merged.filter((m) => !isFin(m)));
      })
      .catch((err) => console.warn('Failed to load team detail:', err))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [isLocal, tournamentId, teamId, teamName]);

  // Resolve display info for local vs pro
  const lowerName = String(teamName || '').toLowerCase();
  const matchedLocalTeam = isLocal
    ? (localTourney?.teams || []).find(
      (t) =>
        (teamId && t.team_id === String(teamId)) ||
        (lowerName && t.name.toLowerCase() === lowerName)
    )
    : null;

  const displayName = isLocal
    ? matchedLocalTeam?.name || teamName || 'Club'
    : team?.name || teamName || 'Club';

  const logo = isLocal
    ? matchedLocalTeam?.crest_url || teamCrest || null
    : teamLogoUrl(teamId);

  const countryText = isLocal
    ? localTourney?.tournament?.country || ''
    : team?.country || '';

  const localStandingIdx = isLocal
    ? localStandings.findIndex(
      (r) =>
        (matchedLocalTeam?.team_id && r.team_id === matchedLocalTeam.team_id) ||
        r.name.toLowerCase() === displayName.toLowerCase()
    )
    : -1;
  const localRank = localStandingIdx >= 0 ? localStandings[localStandingIdx]?.position : null;
  const localSnapStart = localStandingIdx >= 0 ? Math.max(0, localStandingIdx - 2) : 0;
  const localSnapshot = localStandings.slice(localSnapStart, localSnapStart + 4);

  const clubIndex = !isLocal
    ? standings.findIndex((r) => Number(r.team_id) === Number(teamId))
    : -1;
  const proRank = clubIndex >= 0 ? standings[clubIndex]?.position : team?.position ?? null;
  const snapshotStart = clubIndex >= 0 ? Math.max(0, clubIndex - 2) : 0;
  const standingsSnapshot = standings.slice(snapshotStart, snapshotStart + 5);

  const nextMatch = upcomingFixtures[0] || null;
  const followingUpcoming = upcomingFixtures.slice(1, 5);

  // Squad & Leaders
  const proSquadList = Array.isArray(team?.squad) ? team!.squad : [];
  const localRawSquad: any[] = Array.isArray(localTeamExtra?.players)
    ? localTeamExtra.players
    : Array.isArray(localTeamExtra?.squad)
      ? localTeamExtra.squad
      : Array.isArray(matchedLocalTeam?.players)
        ? matchedLocalTeam!.players!
        : [];

  const localTopScorer = isLocal
    ? (localTourney?.top_scorers || []).find(
      (p) => p.team_name.toLowerCase() === displayName.toLowerCase()
    )
    : null;
  const localTopAssister = isLocal
    ? (localTourney?.top_assists || []).find(
      (p) => p.team_name.toLowerCase() === displayName.toLowerCase()
    )
    : null;

  const proTopScorer = !isLocal
    ? proSquadList.filter((p) => (p.goals ?? 0) > 0).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))[0]
    : null;
  const proTopAssister = !isLocal
    ? proSquadList.filter((p) => (p.assists ?? 0) > 0).sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0]
    : null;

  const proSquadGroups: { title: string; players: PlayerSummary[] }[] = [
    { title: 'GOALKEEPERS', players: proSquadList.filter((p) => getPositionBucket(p.position) === 'GK') },
    { title: 'DEFENDERS', players: proSquadList.filter((p) => getPositionBucket(p.position) === 'DEF') },
    { title: 'MIDFIELDERS', players: proSquadList.filter((p) => getPositionBucket(p.position) === 'MID') },
    { title: 'FORWARDS', players: proSquadList.filter((p) => getPositionBucket(p.position) === 'FWD') },
    { title: 'OTHER', players: proSquadList.filter((p) => getPositionBucket(p.position) === 'OTHER') },
  ].filter((g) => g.players.length > 0);

  const openMatch = (m: MatchSummary) => {
    if (!m.event_id) return;
    if (isLocal && tournamentId) {
      navigation.navigate('TournamentMatch', {
        tournamentId,
        fixtureId: String(m.event_id),
        tournamentName: localTourney?.tournament?.name,
      });
      return;
    }
    navigation.navigate('MatchDetail', { eventId: m.event_id, matchSummary: m });
  };

  const followToken = isLocal
    ? `tournament-team:${tournamentId}:${matchedLocalTeam?.team_id || teamId || displayName}:${displayName}`
    : `team:${teamId}:${displayName}`;

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
        <Text style={styles.navTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Team Hero Header (Matches scout-web Team Profile Header) */}
      <View style={styles.heroCard}>
        <View style={styles.heroLogoWrap}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.heroLogo} resizeMode="contain" />
          ) : (
            <Ionicons name="shield-outline" size={32} color={COLORS.textDim} />
          )}
        </View>
        <View style={styles.heroInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={styles.heroTeamName} numberOfLines={1}>{displayName}</Text>
            <FollowButton teamName={displayName} token={followToken} size="sm" />
          </View>

          <Text style={styles.heroSubText} numberOfLines={1}>
            {countryText}
            {!isLocal && team?.venue ? ` • ${team.venue}` : ''}
            {!isLocal && team?.venue_capacity ? ` (${team.venue_capacity.toLocaleString()})` : ''}
          </Text>

          {/* Competition Pill + Rank */}
          {(isLocal ? Boolean(localGroupTitle) : Boolean(team?.primary_league_name)) && (
            <TouchableOpacity
              onPress={() => {
                if (isLocal && tournamentId) {
                  navigation.navigate('TournamentDetail', {
                    tournamentId,
                    tournamentName: localTourney?.tournament?.name,
                  });
                } else if (team?.primary_league_id) {
                  navigation.navigate('MainTabs', {
                    screen: 'Leagues',
                    params: {
                      leagueId: team.primary_league_id,
                      leagueName: team.primary_league_name,
                    },
                  });
                }
              }}
              style={styles.leaguePill}
            >
              <Ionicons name="trophy-outline" size={11} color={COLORS.volt} />
              <Text style={styles.leaguePillText} numberOfLines={1}>
                {isLocal ? localGroupTitle : team?.primary_league_name}
              </Text>
              {(isLocal ? localRank : proRank) != null && (
                <Text style={styles.leagueRankText}>
                  {ordinal(isLocal ? localRank : proRank)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 4 Underline Tabs: Overview | Table | Matches | Squad */}
      <View style={styles.tabRow}>
        {(['overview', 'table', 'matches', 'squad'] as TabType[]).map((t) => {
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
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Loading team details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={{ gap: 14 }}>
              {/* Next Match Hero Card */}
              {nextMatch && (
                <TouchableOpacity
                  style={styles.nextMatchCard}
                  activeOpacity={0.8}
                  onPress={() => openMatch(nextMatch)}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardHeader} numberOfLines={1}>
                      {(nextMatch.competition || (isLocal ? localTourney?.tournament?.name : team?.primary_league_name) || 'NEXT MATCH').toUpperCase()}
                    </Text>
                    <Text style={styles.nextMatchDate}>{formatMatchDate(nextMatch.kickoff)}</Text>
                  </View>
                  <View style={styles.nextMatchTeamsRow}>
                    <View style={styles.nextMatchSide}>
                      {(isLocal ? nextMatch.home_crest : teamLogoUrl(nextMatch.home_team_id)) ? (
                        <Image
                          source={{ uri: (isLocal ? nextMatch.home_crest : teamLogoUrl(nextMatch.home_team_id))! }}
                          style={{ width: 38, height: 38, borderRadius: 6 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name="shield-outline" size={26} color={COLORS.textDim} />
                      )}
                      <Text style={styles.nextMatchTeamName} numberOfLines={2}>
                        {nextMatch.home_team}
                      </Text>
                    </View>
                    <Text style={styles.nextMatchVs}>VS</Text>
                    <View style={styles.nextMatchSide}>
                      {(isLocal ? nextMatch.away_crest : teamLogoUrl(nextMatch.away_team_id)) ? (
                        <Image
                          source={{ uri: (isLocal ? nextMatch.away_crest : teamLogoUrl(nextMatch.away_team_id))! }}
                          style={{ width: 38, height: 38, borderRadius: 6 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name="shield-outline" size={26} color={COLORS.textDim} />
                      )}
                      <Text style={styles.nextMatchTeamName} numberOfLines={2}>
                        {nextMatch.away_team}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* Upcoming Fixtures Preview */}
              {followingUpcoming.length > 0 && (
                <View style={styles.infoCard}>
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <Text style={[styles.cardHeader, { marginBottom: 0 }]}>UPCOMING FIXTURES</Text>
                    <TouchableOpacity onPress={() => setActiveTab('matches')}>
                      <Text style={styles.viewAllText}>View All →</Text>
                    </TouchableOpacity>
                  </View>
                  {followingUpcoming.map((m, idx) => (
                    <MatchCard
                      key={`upc-prev-${m.event_id ?? idx}`}
                      match={m}
                      showDate
                      onPress={() => openMatch(m)}
                    />
                  ))}
                </View>
              )}

              {/* Recent Form */}
              <View style={styles.infoCard}>
                <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                  <Text style={[styles.cardHeader, { marginBottom: 0 }]}>RECENT FORM</Text>
                  {recentFixtures.length > 0 && (
                    <TouchableOpacity onPress={() => setActiveTab('matches')}>
                      <Text style={styles.viewAllText}>All Results →</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {recentFixtures.length > 0 ? (
                  recentFixtures.slice(0, 5).map((m, idx) => (
                    <MatchCard
                      key={`recent-${m.event_id ?? idx}`}
                      match={m}
                      showDate
                      onPress={() => openMatch(m)}
                    />
                  ))
                ) : (
                  <Text style={styles.noDataTextLeft}>No recent matches.</Text>
                )}
              </View>

              {/* Standings Snapshot */}
              {isLocal && localSnapshot.length > 0 && (
                <View style={styles.infoCard}>
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <Text style={[styles.cardHeader, { marginBottom: 0 }]}>STANDINGS SNAPSHOT</Text>
                    <TouchableOpacity onPress={() => setActiveTab('table')}>
                      <Text style={styles.viewAllText}>Full Table →</Text>
                    </TouchableOpacity>
                  </View>
                  <LocalStandingsCard
                    rows={localSnapshot}
                    highlightTeamName={displayName}
                    compact
                    onSelectTeam={(row) =>
                      navigation.push('TeamDetail', {
                        source: 'local',
                        tournamentId,
                        teamId: row.team_id,
                        teamName: row.name,
                        teamCrest: row.crest_url,
                      })
                    }
                  />
                </View>
              )}

              {!isLocal && standingsSnapshot.length > 0 && (
                <View style={styles.infoCard}>
                  <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                    <Text style={[styles.cardHeader, { marginBottom: 0 }]}>STANDINGS SNAPSHOT</Text>
                    <TouchableOpacity onPress={() => setActiveTab('table')}>
                      <Text style={styles.viewAllText}>Full Table →</Text>
                    </TouchableOpacity>
                  </View>
                  <StandingsTable
                    standings={standingsSnapshot}
                    highlightTeamId={teamId}
                    onSelectTeam={(tId, tName) =>
                      navigation.push('TeamDetail', { teamId: tId, teamName: tName })
                    }
                  />
                </View>
              )}

              {/* Key Squad Leaders (Always shown like scout-web) */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeader}>KEY SQUAD LEADERS</Text>
                <View style={styles.leaderRow}>
                  <View style={styles.leaderIconWrap}>
                    <Ionicons name="football" size={14} color={COLORS.volt} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderTag}>TOP SCORER</Text>
                    <Text style={styles.playerName}>
                      {isLocal
                        ? localTopScorer?.player_name || 'N/A'
                        : proTopScorer?.name || 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.leaderBigVal}>
                    {isLocal
                      ? localTopScorer?.value ?? '-'
                      : proTopScorer?.goals ?? '-'}
                  </Text>
                </View>
                <View style={styles.leaderRow}>
                  <View style={styles.leaderIconWrap}>
                    <Ionicons name="radio-button-on" size={14} color="#38bdf8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderTag}>MOST ASSISTS</Text>
                    <Text style={styles.playerName}>
                      {isLocal
                        ? localTopAssister?.player_name || 'N/A'
                        : proTopAssister?.name || 'N/A'}
                    </Text>
                  </View>
                  <Text style={styles.leaderBigVal}>
                    {isLocal
                      ? localTopAssister?.value ?? '-'
                      : proTopAssister?.assists ?? '-'}
                  </Text>
                </View>
                <View style={[styles.leaderRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.leaderIconWrap}>
                    <Ionicons name="star" size={14} color="#fbbf24" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderTag}>HIGHEST RATED</Text>
                    <Text style={styles.playerName}>N/A</Text>
                  </View>
                  <Text style={styles.leaderBigVal}>-</Text>
                </View>
              </View>

              {/* Club Information (Matches scout-web) */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeader}>CLUB INFORMATION</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>FULL NAME</Text>
                  <Text style={styles.infoVal}>{displayName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>MANAGER</Text>
                  <Text style={styles.infoVal}>
                    {isLocal
                      ? localTeamExtra?.manager || matchedLocalTeam?.manager || 'Not available'
                      : team?.manager_name || 'Not available'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>STADIUM</Text>
                  <Text style={styles.infoVal}>
                    {isLocal
                      ? localTeamExtra?.stadium || matchedLocalTeam?.stadium || 'Not available'
                      : team?.venue || 'Not available'}
                  </Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoKey}>COUNTRY</Text>
                  <Text style={styles.infoVal}>{countryText || 'Not available'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: TABLE */}
          {activeTab === 'table' && (
            <View>
              {isLocal ? (
                localStandings.length > 0 ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.cardHeader}>{localGroupTitle.toUpperCase()}</Text>
                    <LocalStandingsCard
                      rows={localStandings}
                      highlightTeamName={displayName}
                      onSelectTeam={(row) =>
                        navigation.push('TeamDetail', {
                          source: 'local',
                          tournamentId,
                          teamId: row.team_id,
                          teamName: row.name,
                          teamCrest: row.crest_url,
                        })
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.centerBox}>
                    <Ionicons name="trophy-outline" size={36} color={COLORS.textDim} />
                    <Text style={styles.emptyText}>No competition table available yet.</Text>
                  </View>
                )
              ) : standings.length > 0 ? (
                <StandingsTable
                  standings={standings}
                  highlightTeamId={teamId}
                  onSelectTeam={(tId, tName) =>
                    navigation.push('TeamDetail', { teamId: tId, teamName: tName })
                  }
                />
              ) : (
                <View style={styles.centerBox}>
                  <Ionicons name="trophy-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No competition table on file for this team.</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 3: MATCHES */}
          {activeTab === 'matches' && (
            <View style={{ gap: 14 }}>
              {upcomingFixtures.length > 0 && (
                <View>
                  <Text style={styles.groupHeading}>
                    UPCOMING FIXTURES ({upcomingFixtures.length})
                  </Text>
                  {upcomingFixtures.map((m, idx) => (
                    <MatchCard
                      key={`upc-${m.event_id ?? idx}`}
                      match={m}
                      showDate
                      showCompetition
                      onPress={() => openMatch(m)}
                    />
                  ))}
                </View>
              )}
              {recentFixtures.length > 0 && (
                <View>
                  <Text style={styles.groupHeading}>
                    PLAYED RESULTS ({recentFixtures.length})
                  </Text>
                  {recentFixtures.map((m, idx) => (
                    <MatchCard
                      key={`rec-${m.event_id ?? idx}`}
                      match={m}
                      showDate
                      showCompetition
                      onPress={() => openMatch(m)}
                    />
                  ))}
                </View>
              )}
              {allSeasonMatches.length === 0 && (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={36} color={COLORS.textDim} />
                  <Text style={styles.emptyText}>No fixtures available for this team.</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: SQUAD */}
          {activeTab === 'squad' && (
            <View style={{ gap: 14 }}>
              {isLocal ? (
                localRawSquad.length > 0 ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.cardHeader}>SQUAD ROSTER</Text>
                    {localRawSquad.map((p: any, idx: number) => {
                      const pName = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player';
                      const pId = p.id || p.player_id;
                      return (
                        <TouchableOpacity
                          key={`loc-p-${pId ?? idx}`}
                          style={styles.playerRow}
                          disabled={!pId}
                          onPress={() =>
                            pId &&
                            navigation.navigate('TournamentPlayer', {
                              tournamentId,
                              playerId: String(pId),
                              playerName: pName,
                            })
                          }
                        >
                          <Text style={styles.jerseyCol}>
                            {p.shirt_number ?? p.jersey_number ?? '-'}
                          </Text>
                          <View style={styles.playerAvatarWrap}>
                            {p.photo_url ? (
                              <Image source={{ uri: p.photo_url }} style={styles.playerAvatar} />
                            ) : (
                              <Ionicons name="person" size={16} color={COLORS.textDim} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.playerName} numberOfLines={1}>{pName}</Text>
                            <Text style={styles.playerSub}>
                              {(p.position || 'PLAYER').toUpperCase()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.infoCard}>
                    <Text style={styles.noDataText}>
                      No squad players published for this team yet.
                    </Text>
                  </View>
                )
              ) : proSquadGroups.length > 0 ? (
                proSquadGroups.map((group) => (
                  <View key={group.title} style={styles.infoCard}>
                    <Text style={styles.cardHeader}>{group.title}</Text>
                    <View style={styles.squadColHeader}>
                      <Text style={[styles.squadColLabel, { width: 28 }]}>#</Text>
                      <Text style={[styles.squadColLabel, { flex: 1 }]}>PLAYER</Text>
                      <Text style={[styles.squadColLabel, { width: 34, textAlign: 'center' }]}>POS</Text>
                      <Text style={[styles.squadColLabel, { width: 34, textAlign: 'right' }]}>AGE</Text>
                    </View>
                    {group.players.map((p, idx) => {
                      const pImg = playerImageUrl(p.id);
                      return (
                        <TouchableOpacity
                          key={`player-${p.id ?? idx}`}
                          style={styles.playerRow}
                          onPress={() =>
                            navigation.navigate('PlayerDetail', {
                              playerId: p.id,
                              playerName: p.name,
                            })
                          }
                        >
                          <Text style={styles.jerseyCol}>
                            {p.jersey_number != null ? p.jersey_number : '-'}
                          </Text>
                          <View style={styles.playerAvatarWrap}>
                            {pImg ? (
                              <Image source={{ uri: pImg }} style={styles.playerAvatar} />
                            ) : (
                              <Ionicons name="person" size={16} color={COLORS.textDim} />
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                            <Text style={styles.playerSub} numberOfLines={1}>
                              {(p.nationality || '').toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.posCol}>{p.position || '-'}</Text>
                          <Text style={styles.ageCol}>{calcAge(p.date_of_birth)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              ) : (
                <View style={styles.infoCard}>
                  <Text style={styles.noDataText}>No squad players recorded.</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

function LocalStandingsCard({
  rows,
  highlightTeamName,
  compact = false,
  onSelectTeam,
}: {
  rows: TournamentStanding[];
  highlightTeamName: string;
  compact?: boolean;
  onSelectTeam: (row: TournamentStanding) => void;
}) {
  return (
    <View>
      <View style={styles.locTblHeader}>
        <Text style={[styles.locTblHeadText, { width: 20 }]}>#</Text>
        <Text style={[styles.locTblHeadText, { flex: 1 }]}>TEAM</Text>
        <Text style={[styles.locTblHeadText, styles.locCol]}>P</Text>
        {!compact && <Text style={[styles.locTblHeadText, styles.locCol]}>W</Text>}
        {!compact && <Text style={[styles.locTblHeadText, styles.locCol]}>D</Text>}
        {!compact && <Text style={[styles.locTblHeadText, styles.locCol]}>L</Text>}
        <Text style={[styles.locTblHeadText, styles.locColWide]}>GD</Text>
        <Text style={[styles.locTblHeadText, styles.locColWide]}>PTS</Text>
      </View>
      {rows.map((r) => {
        const isMe = r.name.toLowerCase() === highlightTeamName.toLowerCase();
        return (
          <TouchableOpacity
            key={r.team_id || r.name}
            style={[styles.locTblRow, isMe && styles.locTblRowHighlight]}
            activeOpacity={0.75}
            onPress={() => onSelectTeam(r)}
          >
            <Text style={[styles.locTblCell, { width: 20 }, isMe && { color: COLORS.volt, fontWeight: '800' }]}>
              {r.position}
            </Text>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {r.crest_url ? (
                <Image source={{ uri: r.crest_url }} style={{ width: 18, height: 18, borderRadius: 4 }} resizeMode="cover" />
              ) : (
                <Ionicons name="shield-outline" size={14} color={COLORS.textDim} />
              )}
              <Text
                style={[styles.locTblTeam, isMe && { color: COLORS.volt, fontWeight: '800' }]}
                numberOfLines={1}
              >
                {r.name}
              </Text>
            </View>
            <Text style={[styles.locTblCell, styles.locCol]}>{r.played}</Text>
            {!compact && <Text style={[styles.locTblCell, styles.locCol]}>{r.won}</Text>}
            {!compact && <Text style={[styles.locTblCell, styles.locCol]}>{r.drawn}</Text>}
            {!compact && <Text style={[styles.locTblCell, styles.locCol]}>{r.lost}</Text>}
            <Text style={[styles.locTblCell, styles.locColWide]}>
              {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
            </Text>
            <Text style={[styles.locTblPts, styles.locColWide]}>{r.points}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default TeamDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 16, maxWidth: '75%' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    gap: 14,
  },
  heroLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  heroLogo: { width: 38, height: 38 },
  heroInfo: { flex: 1, minWidth: 0 },
  heroTeamName: { fontFamily: FONTS.display, color: COLORS.text, fontSize: 18, flex: 1 },
  heroSubText: { fontFamily: FONTS.regular, color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  leaguePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 7,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  leaguePillText: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontSize: 11,
    flexShrink: 1,
  },
  leagueRankText: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 11,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.volt },
  tabLabel: { fontFamily: FONTS.medium, color: COLORS.textDim, fontSize: 11 },
  tabLabelActive: { fontFamily: FONTS.bold, color: COLORS.volt },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, minHeight: 200 },
  loadingText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  emptyText: { color: COLORS.textDim, fontSize: 13, marginTop: 8, textAlign: 'center' },
  nextMatchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    padding: 14,
  },
  nextMatchDate: {
    fontFamily: FONTS.bold,
    color: COLORS.volt,
    fontSize: 11,
  },
  nextMatchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: 6,
  },
  nextMatchSide: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  nextMatchTeamName: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontSize: 12,
    textAlign: 'center',
  },
  nextMatchVs: {
    fontFamily: FONTS.bold,
    color: COLORS.textDim,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
  },
  cardHeader: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
  squadColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  squadColLabel: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 10, letterSpacing: 0.6 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoKey: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 11, letterSpacing: 0.5 },
  infoVal: { fontFamily: FONTS.semibold, color: COLORS.text, fontSize: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  viewAllText: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 12 },
  groupHeading: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 10, letterSpacing: 1.3, marginBottom: 6 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  leaderIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderTag: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 9, letterSpacing: 0.8 },
  leaderBigVal: { fontFamily: FONTS.bold, color: COLORS.volt, fontSize: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 8,
  },
  jerseyCol: { fontFamily: FONTS.bold, width: 24, color: COLORS.textDim, fontSize: 12 },
  playerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerAvatar: { width: 32, height: 32 },
  playerName: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 13 },
  playerSub: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 10, marginTop: 1, letterSpacing: 0.4 },
  posCol: { fontFamily: FONTS.bold, width: 34, color: COLORS.text, fontSize: 12, textAlign: 'center' },
  ageCol: { fontFamily: FONTS.semibold, width: 34, color: COLORS.textSecondary, fontSize: 12, textAlign: 'right' },
  noDataText: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, paddingVertical: 12, textAlign: 'center' },
  noDataTextLeft: { fontFamily: FONTS.regular, color: COLORS.textDim, fontSize: 12, paddingVertical: 6 },
  locTblHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  locTblHeadText: { fontFamily: FONTS.bold, color: COLORS.textDim, fontSize: 10 },
  locTblRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
  },
  locTblRowHighlight: {
    backgroundColor: 'rgba(200, 255, 0, 0.10)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.volt,
  },
  locTblTeam: { fontFamily: FONTS.semibold, color: COLORS.text, fontSize: 12, flex: 1 },
  locTblCell: { fontFamily: FONTS.regular, color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
  locTblPts: { fontFamily: FONTS.bold, color: COLORS.text, fontSize: 12, textAlign: 'center' },
  locCol: { width: 22, textAlign: 'center' },
  locColWide: { width: 30, textAlign: 'center' },
});