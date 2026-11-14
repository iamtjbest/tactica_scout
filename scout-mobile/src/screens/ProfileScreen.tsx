// src/screens/ProfileScreen.tsx — User profile & account settings
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import {
  getMe,
  updateLanguage,
  ScoutUser,
} from '../services/api';
import { isSignedIn, signOut } from '../services/auth';
import { useFocusEffect } from '@react-navigation/native';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 12);

  const [user, setUser] = useState<ScoutUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (await isSignedIn()) {
        const me = await getMe();
        setUser(me.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    Alert.alert("Signed out", "You have been signed out successfully.");
  };

  const handleLanguageChange = async (lang: string) => {
    try {
      await updateLanguage(lang);
      if (user) setUser({ ...user, language: lang });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update language');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topNav, { paddingTop: topPadding + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profile &amp; Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* TACTICA ACCOUNT SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>TACTICA ACCOUNT</Text>
          {user ? (
            <View style={{ gap: 12 }}>
              <View style={styles.userInfoRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(user.display_name || user.email || 'U')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.display_name || 'Tactica User'}
                  </Text>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {user.email || 'Signed in'}
                  </Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{user.role.toUpperCase()}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.outlineBtnText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.bodyText}>
                Sign in to sync your followed teams, players, and leagues across every device.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={() => navigation.navigate('SignIn')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.outlineBtn, { flex: 1 }]}
                  onPress={() => navigation.navigate('SignUp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.outlineBtnText}>Create account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* LANGUAGE / IDIOMA SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>LANGUAGE / IDIOMA</Text>
          <View style={styles.langRow}>
            {[
              { id: 'en', label: 'English' },
              { id: 'es', label: 'Español' },
              { id: 'fr', label: 'Français' },
              { id: 'de', label: 'Deutsch' },
            ].map((lang) => {
              const active = (user?.language || 'en') === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  style={[styles.langChip, active && styles.langChipActive]}
                  onPress={() => handleLanguageChange(lang.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
  },
  sectionHeader: {
    color: COLORS.volt,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  bodyText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.voltMuted,
    borderWidth: 1,
    borderColor: COLORS.cardBorderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.volt, fontSize: 18, fontWeight: '900' },
  userName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  userEmail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  roleBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.125)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: { color: '#38bdf8', fontSize: 10, fontWeight: '900' },
  primaryBtn: {
    backgroundColor: COLORS.volt,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 13, fontWeight: '900' },
  outlineBtn: {
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  outlineBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  langRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  langChipActive: { backgroundColor: COLORS.voltMuted, borderColor: COLORS.volt },
  langChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  langChipTextActive: { color: COLORS.volt, fontWeight: '800' },
});