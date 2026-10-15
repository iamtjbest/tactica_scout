// src/screens/ProfileScreen.tsx — User profile, settings, followed clubs & API server config
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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
  signIn,
  signUp,
  clearAuthToken,
  updateLanguage,
  updateFollowedTeams,
  getApiBase,
  setApiBase,
  resetApiBase,
  ScoutUser,
} from '../services/api';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [user, setUser] = useState<ScoutUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth form
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Server URL settings (Render / LAN)
  const [apiUrl, setApiUrl] = useState('');
  const [apiTesting, setApiTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const url = await getApiBase();
      setApiUrl(url);

      const me = await getMe();
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isSignUp) {
        await signUp(username.trim(), password.trim());
      } else {
        await signIn(username.trim(), password.trim());
      }
      setUsername('');
      setPassword('');
      await loadData();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setUser(null);
  };

  const handleLanguageChange = async (lang: string) => {
    try {
      await updateLanguage(lang);
      if (user) setUser({ ...user, language: lang });
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Could not update language preference.');
    }
  };

  const handleUnfollow = async (team: string) => {
    if (!user) return;
    const updated = user.followed_teams.filter((t) => t !== team);
    try {
      await updateFollowedTeams(updated);
      setUser({ ...user, followed_teams: updated });
    } catch {}
  };

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) return;
    setApiTesting(true);
    setApiStatus(null);
    try {
      const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      const testRes = await fetch(`${cleanUrl}/api/live-scores`);
      if (testRes.ok) {
        await setApiBase(cleanUrl);
        setApiStatus('Connected successfully!');
      } else {
        await setApiBase(cleanUrl);
        setApiStatus(`Connected with status ${testRes.status}`);
      }
    } catch (err: any) {
      setApiStatus('Could not reach server at this address.');
    } finally {
      setApiTesting(false);
    }
  };

  const handleResetApiUrl = async () => {
    await resetApiBase();
    const def = await getApiBase();
    setApiUrl(def);
    setApiStatus('Reset to default URL');
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 12);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topNav, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profile & Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 50 }}>
        {/* SECTION 1: AUTHENTICATION */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>TACTICA ACCOUNT</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.volt} />
          ) : user ? (
            <View>
              <View style={styles.userRow}>
                <Ionicons name="person-circle" size={44} color={COLORS.volt} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.usernameText}>{user.username}</Text>
                  <Text style={styles.userStatusText}>Scout Pro Member</Text>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                  <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.authToggle}>
                <TouchableOpacity
                  style={[styles.authTab, !isSignUp && styles.authTabActive]}
                  onPress={() => setIsSignUp(false)}
                >
                  <Text style={[styles.authTabText, !isSignUp && styles.authTabTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authTab, isSignUp && styles.authTabActive]}
                  onPress={() => setIsSignUp(true)}
                >
                  <Text style={[styles.authTabText, isSignUp && styles.authTabTextActive]}>
                    Create Account
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.authInput}
                placeholder="Username"
                placeholderTextColor={COLORS.textDim}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.authInput, { marginTop: 10 }]}
                placeholder="Password"
                placeholderTextColor={COLORS.textDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAuth}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SECTION 2: FOLLOWED CLUBS */}
        {user && (
          <View style={[styles.cardSection, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>
              FOLLOWED CLUBS ({user.followed_teams?.length || 0})
            </Text>
            {user.followed_teams && user.followed_teams.length > 0 ? (
              <View style={styles.followedChipsRow}>
                {user.followed_teams.map((teamName) => (
                  <View key={teamName} style={styles.followedChip}>
                    <Ionicons name="shield-outline" size={13} color={COLORS.volt} style={{ marginRight: 6 }} />
                    <Text style={styles.chipText}>{teamName}</Text>
                    <TouchableOpacity
                      onPress={() => handleUnfollow(teamName)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 6 }}
                    >
                      <Ionicons name="close-circle" size={16} color={COLORS.textDim} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>
                You are not following any clubs yet. Tap the star icon on any team or match to follow them.
              </Text>
            )}
          </View>
        )}

        {/* SECTION 3: LANGUAGE PREFERENCE */}
        <View style={[styles.cardSection, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>LANGUAGE / IDIOMA</Text>
          <View style={styles.langGrid}>
            {[
              { code: 'en', label: 'English' },
              { code: 'es', label: 'Español' },
              { code: 'fr', label: 'Français' },
              { code: 'de', label: 'Deutsch' },
            ].map((l) => {
              const isSelected = (user?.language || 'en') === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langBtn, isSelected && styles.langBtnActive]}
                  onPress={() => handleLanguageChange(l.code)}
                >
                  <Text style={[styles.langText, isSelected && styles.langTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SECTION 4: BACKEND SERVER CONFIG (Render / Local) */}
        <View style={[styles.cardSection, { marginTop: 14 }]}>
          <View style={styles.serverHeader}>
            <Text style={styles.sectionTitle}>BACKEND SERVER URL</Text>
            <Ionicons name="server-outline" size={16} color={COLORS.volt} />
          </View>
          <Text style={styles.serverHint}>
            Connect your mobile app to your Render-hosted backend or local PC IP.
          </Text>

          <TextInput
            style={styles.authInput}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://tactica-scout.onrender.com"
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="none"
          />

          {apiStatus && (
            <Text
              style={[
                styles.statusNotice,
                { color: apiStatus.includes('success') ? COLORS.win : COLORS.volt },
              ]}
            >
              {apiStatus}
            </Text>
          )}

          <View style={styles.serverBtnRow}>
            <TouchableOpacity
              style={styles.saveServerBtn}
              onPress={handleSaveApiUrl}
              disabled={apiTesting}
            >
              {apiTesting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveServerText}>Save & Test URL</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetServerBtn} onPress={handleResetApiUrl}>
              <Text style={styles.resetServerText}>Reset Default</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 15,
    fontWeight: '700',
  },
  cardSection: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  userStatusText: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logoutText: {
    color: COLORS.loss,
    fontSize: 12,
    fontWeight: '700',
  },
  authToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    padding: 4,
    marginBottom: 14,
  },
  authTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  authTabActive: {
    backgroundColor: COLORS.card,
  },
  authTabText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  authTabTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  authInput: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: COLORS.text,
    fontSize: 14,
  },
  errorText: {
    color: COLORS.loss,
    fontSize: 12,
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: COLORS.volt,
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  followedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  followedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  noDataText: {
    color: COLORS.textDim,
    fontSize: 12,
    lineHeight: 18,
  },
  langGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  langBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  langBtnActive: {
    borderColor: COLORS.volt,
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
  },
  langText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  langTextActive: {
    color: COLORS.volt,
    fontWeight: '800',
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  statusNotice: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  serverBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  saveServerBtn: {
    flex: 1,
    backgroundColor: COLORS.volt,
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveServerText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  resetServerBtn: {
    paddingHorizontal: 14,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetServerText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
});
