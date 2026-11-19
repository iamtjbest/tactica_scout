// src/screens/ProfileScreen.tsx - Account, Settings & FotMob-style Preferences Hub
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { getMe, isSignedIn, signOut, type ScoutUser } from '../services/api';

interface ProfileScreenProps {
  navigation: any;
}

const SCOUT_WEB_URL = 'https://scout.tacticaengine.com';
const SUPPORT_EMAIL = 'support@tacticaengine.com';
const ADS_EMAIL = 'partners@tacticaengine.com';
const PRIVACY_URL = 'https://scout.tacticaengine.com/privacy';

const SOCIAL_LINKS = [
  { label: 'X (Twitter)', icon: 'logo-twitter' as const, url: 'https://x.com/TacticaEngine' },
  { label: 'Instagram', icon: 'logo-instagram' as const, url: 'https://instagram.com/tacticaengine' },
  { label: 'TikTok', icon: 'logo-tiktok' as const, url: 'https://tiktok.com/@tacticaengine' },
  { label: 'YouTube', icon: 'logo-youtube' as const, url: 'https://youtube.com/@TacticaEngine' },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<ScoutUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [followModalOpen, setFollowModalOpen] = useState(false);

  // Notification preference toggles
  const [goalAlerts, setGoalAlerts] = useState(true);
  const [kickoffAlerts, setKickoffAlerts] = useState(true);
  const [breakingNews, setBreakingNews] = useState(true);
  const [weeklyPredictions, setWeeklyPredictions] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      if (await isSignedIn()) {
        const res = await getMe();
        setUser(res.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
    const unsub = navigation.addListener('focus', loadAccount);
    return unsub;
  }, [navigation, loadAccount]);

  const followed = Array.isArray(user?.followed_teams) ? user!.followed_teams : [];
  const followedTeamsCount = followed.filter(
    (t) => t.startsWith('team:') || t.startsWith('tournament-team:') || !t.includes(':')
  ).length;
  const followedLeaguesCount = followed.filter(
    (t) => t.startsWith('league:') || t.startsWith('tournament:')
  ).length;

  const handleShareScout = async () => {
    try {
      await Share.share({
        title: 'Scout by Tactica',
        message: `Track live scores, lineups, and pre-match AI win probabilities on Scout by Tactica: ${SCOUT_WEB_URL}`,
        url: SCOUT_WEB_URL,
      });
    } catch { }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to Open Link', 'Please try again later.');
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Tactica Scout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setUser(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Inset */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 44, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Card */}
        <View style={styles.accountCard}>
          {loading ? (
            <ActivityIndicator color={COLORS.volt} style={{ paddingVertical: 12 }} />
          ) : user ? (
            <View style={{ gap: 12 }}>
              <View style={styles.row}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(user.display_name || user.email || 'T')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {user.display_name || 'Scout Member'}
                  </Text>
                  <Text style={styles.accountEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleSignOut} style={styles.signOutPill}>
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.followSummaryStrip}>
                <View style={styles.followSummaryBox}>
                  <Text style={styles.followSummaryVal}>{followedTeamsCount}</Text>
                  <Text style={styles.followSummaryLbl}>TEAMS FOLLOWED</Text>
                </View>
                <View style={styles.followSummaryDivider} />
                <View style={styles.followSummaryBox}>
                  <Text style={styles.followSummaryVal}>{followedLeaguesCount}</Text>
                  <Text style={styles.followSummaryLbl}>LEAGUES FOLLOWED</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={styles.row}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person-outline" size={22} color={COLORS.volt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>Tactica Scout Account</Text>
                  <Text style={styles.accountEmail}>
                    Sign in to sync followed clubs, leagues, and match alerts.
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('SignIn')}
                >
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.navigate('SignUp')}
                >
                  <Text style={styles.secondaryBtnText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Preferences Section */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionHeader}>Preferences</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 0 }]}
              activeOpacity={0.75}
              onPress={() => setNotifModalOpen(true)}
            >
              <View style={styles.iconBox}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.volt} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Manage Notifications</Text>
                <Text style={styles.menuSub}>Live goals, kickoffs, and followed clubs</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Others Section */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionHeader}>Others</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity style={styles.menuRow} activeOpacity={0.75} onPress={handleShareScout}>
              <View style={styles.iconBox}>
                <Ionicons name="share-social-outline" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Share Scout</Text>
                <Text style={styles.menuSub}>Invite friends to track live scores &amp; ratings</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.75}
              onPress={() => setFollowModalOpen(true)}
            >
              <View style={styles.iconBox}>
                <Ionicons name="globe-outline" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Follow us</Text>
                <Text style={styles.menuSub}>X, Instagram, TikTok, and YouTube</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.75}
              onPress={() =>
                handleOpenUrl(`mailto:${ADS_EMAIL}?subject=Advertise%20on%20Tactica%20Scout`)
              }
            >
              <View style={styles.iconBox}>
                <Ionicons name="megaphone-outline" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Advertise with us</Text>
                <Text style={styles.menuSub}>Partner with Tactica Scout &amp; campus leagues</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.75}
              onPress={() =>
                handleOpenUrl(`mailto:${SUPPORT_EMAIL}?subject=Tactica%20Scout%20Support`)
              }
            >
              <View style={styles.iconBox}>
                <Ionicons name="help-buoy-outline" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Support</Text>
                <Text style={styles.menuSub}>Report a bug or request a competition</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.75}
              onPress={() => handleOpenUrl(PRIVACY_URL)}
            >
              <View style={styles.iconBox}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Privacy Policy</Text>
                <Text style={styles.menuSub}>How Tactica handles your account data</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
            </TouchableOpacity>

            <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
              <View style={styles.iconBox}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>App Version</Text>
                <Text style={styles.menuSub}>Tactica Scout for Android</Text>
              </View>
              <Text style={styles.versionBadge}>v{appVersion}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* MANAGE NOTIFICATIONS MODAL (FotMob-style) */}
      <Modal
        visible={notifModalOpen}
        animationType="slide"
        onRequestClose={() => setNotifModalOpen(false)}
      >
        <View style={styles.container}>
          <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
            <TouchableOpacity
              onPress={() => setNotifModalOpen(false)}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Notifications</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionHeader}>Following</Text>
              <View style={styles.menuGroup}>
                <View style={styles.menuRow}>
                  <Text style={[styles.menuLabel, { flex: 1 }]}>Teams</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{followedTeamsCount}</Text>
                    <Ionicons name="notifications-outline" size={13} color={COLORS.volt} />
                  </View>
                </View>
                <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.menuLabel, { flex: 1 }]}>Leagues &amp; Competitions</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{followedLeaguesCount}</Text>
                    <Ionicons name="notifications-outline" size={13} color={COLORS.volt} />
                  </View>
                </View>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.sectionHeader}>Match &amp; News Alerts</Text>
              <View style={styles.menuGroup}>
                <View style={styles.menuRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.menuLabel}>Live goal alerts</Text>
                    <Text style={styles.menuSub}>Instant alerts when your followed teams score</Text>
                  </View>
                  <Switch
                    value={goalAlerts}
                    onValueChange={setGoalAlerts}
                    trackColor={{ false: COLORS.cardBorder, true: COLORS.volt }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.menuRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.menuLabel}>Kickoff &amp; lineup reminders</Text>
                    <Text style={styles.menuSub}>Get notified 15 minutes before kickoff</Text>
                  </View>
                  <Switch
                    value={kickoffAlerts}
                    onValueChange={setKickoffAlerts}
                    trackColor={{ false: COLORS.cardBorder, true: COLORS.volt }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={styles.menuRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.menuLabel}>Enable breaking news</Text>
                    <Text style={styles.menuSub}>Top tactical stories and major transfer updates</Text>
                  </View>
                  <Switch
                    value={breakingNews}
                    onValueChange={setBreakingNews}
                    trackColor={{ false: COLORS.cardBorder, true: COLORS.volt }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.menuLabel}>Weekly Tactica prediction reminders</Text>
                    <Text style={styles.menuSub}>Pre-match model picks for weekend fixtures</Text>
                  </View>
                  <Switch
                    value={weeklyPredictions}
                    onValueChange={setWeeklyPredictions}
                    trackColor={{ false: COLORS.cardBorder, true: COLORS.volt }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* FOLLOW US BOTTOM SHEET (FotMob-style) */}
      <Modal
        visible={followModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFollowModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setFollowModalOpen(false)}
          style={styles.sheetBackdrop}
        >
          <View style={styles.sheetBox}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Follow us</Text>
            {SOCIAL_LINKS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.sheetRow}
                onPress={() => {
                  setFollowModalOpen(false);
                  handleOpenUrl(item.url);
                }}
              >
                <Ionicons name={item.icon} size={20} color={COLORS.text} />
                <Text style={styles.sheetRowText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setFollowModalOpen(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

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
  navTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    padding: 14,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.volt, fontSize: 18, fontWeight: '900' },
  accountName: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  accountEmail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  signOutPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  signOutText: { color: '#ef4444', fontSize: 11, fontWeight: '800' },
  followSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    paddingVertical: 10,
  },
  followSummaryBox: { flex: 1, alignItems: 'center' },
  followSummaryVal: { color: COLORS.volt, fontSize: 18, fontWeight: '900' },
  followSummaryLbl: { color: COLORS.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  followSummaryDivider: { width: 1, height: 26, backgroundColor: COLORS.cardBorder },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.volt,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0c0e12', fontSize: 13, fontWeight: '900' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  sectionHeader: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  menuSub: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
  versionBadge: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: COLORS.voltMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countPillText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  sheetBox: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sheetRowText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetCancelBtn: {
    marginTop: 12,
    alignItems: 'flex-end',
    paddingVertical: 6,
  },
  sheetCancelText: {
    color: COLORS.volt,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ProfileScreen;