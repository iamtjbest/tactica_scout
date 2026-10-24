// App.tsx — Tactica Scout mobile root navigation & theme (React Navigation v7 / Expo SDK 57)
import React, { useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';

import { COLORS } from './src/theme';
import { Header } from './src/components/Header';
import { SearchModal } from './src/components/SearchModal';

// Screens
import { MatchesScreen } from './src/screens/MatchesScreen';
import { CompareScreen } from './src/screens/CompareScreen';
import { LeaguesScreen } from './src/screens/LeaguesScreen';
import { NewsScreen } from './src/screens/NewsScreen';
import { MatchDetailScreen } from './src/screens/MatchDetailScreen';
import { TournamentDetailScreen } from './src/screens/TournamentDetailScreen';
import { TournamentMatchScreen } from './src/screens/TournamentMatchScreen';
import { TournamentPlayerScreen } from './src/screens/TournamentPlayerScreen';
import { TeamDetailScreen } from './src/screens/TeamDetailScreen';
import { TeamFixturesScreen } from './src/screens/TeamFixturesScreen';
import { PlayerDetailScreen } from './src/screens/PlayerDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { VerifyScreen } from './src/screens/VerifyScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';

// ── Types ─────────────────────────────────────────────────────────────
export type RootStackParamList = {
  MainTabs: undefined;
  MatchDetail: { eventId: number; matchSummary?: any };
  TeamDetail: { teamId: number; teamName: string };
  TeamFixtures: { teamId: number; teamName: string; filter: 'all' | 'upcoming' };
  PlayerDetail: { playerId: number; playerName: string };
  // Editor-hosted competitions. Both ids are uuids, not BSD integers,
  // so they are strings and must never be fed to the BSD routes above.
  TournamentDetail: { tournamentId: string; tournamentName?: string };
  TournamentMatch: { tournamentId: string; fixtureId: string };
  TournamentPlayer: { tournamentId: string; playerId: string; playerName?: string };
  Profile: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Verify: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

export type MainTabParamList = {
  Matches: undefined;
  Compare: undefined;
  Leagues: { leagueId?: number; leagueName?: string } | undefined;
  News: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Dark theme for React Navigation
const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.volt,
    background: COLORS.bg,
    card: COLORS.card,
    text: COLORS.text,
    border: COLORS.cardBorder,
    notification: COLORS.volt,
  },
};

// Main 4-Tab Navigator
function MainTabs({
  navigation,
  onOpenSearch,
}: {
  navigation: any;
  onOpenSearch: () => void;
}) {
  return (
    <Tab.Navigator
      screenOptions={{
        header: () => (
          <Header
            onOpenSearch={onOpenSearch}
            onOpenProfile={() => navigation.navigate('Profile')}
          />
        ),
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.volt,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Matches"
        component={MatchesScreen}
        options={{
          tabBarLabel: 'Matches',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'football' : 'football-outline'}
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Compare"
        component={CompareScreen}
        options={{
          tabBarLabel: 'Compare',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'git-compare' : 'git-compare-outline'}
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesScreen}
        options={{
          tabBarLabel: 'Leagues',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'trophy' : 'trophy-outline'}
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="News"
        component={NewsScreen}
        options={{
          tabBarLabel: 'News',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'newspaper' : 'newspaper-outline'}
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [searchVisible, setSearchVisible] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkNavTheme} ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.bg },
          }}
        >
          {/* Main tabs with universal top header */}
          <Stack.Screen name="MainTabs">
            {(props) => (
              <MainTabs
                {...props}
                onOpenSearch={() => setSearchVisible(true)}
              />
            )}
          </Stack.Screen>

          {/* Local competitions run through Scout Editor. They appear in
              the normal match list grouped like any other league; these
              are the screens a tap lands on. */}
          <Stack.Screen
            name="TournamentDetail"
            component={TournamentDetailScreen}
            options={{ headerShown: true, title: 'Competition',
                       animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TournamentMatch"
            component={TournamentMatchScreen}
            options={{ headerShown: true, title: 'Match',
                       animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TournamentPlayer"
            component={TournamentPlayerScreen}
            options={{ headerShown: true, title: 'Player',
                       animation: 'slide_from_right' }}
          />

          {/* Detail screens */}
          <Stack.Screen
            name="MatchDetail"
            component={MatchDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TeamDetail"
            component={TeamDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TeamFixtures"
            component={TeamFixturesScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PlayerDetail"
            component={PlayerDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />

          {/* Auth screens. Supabase owns signup, verification codes,
              sign-in and password resets -- the backend never sees a
              password. */}
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="Verify"
            component={VerifyScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>

        {/* Global Search Modal accessible from any tab */}
        <SearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelectTeam={(teamId, teamName) => {
            navigationRef.current?.navigate('TeamDetail', { teamId, teamName });
          }}
          onSelectPlayer={(playerId, playerName) => {
            navigationRef.current?.navigate('PlayerDetail', {
              playerId,
              playerName,
            });
          }}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    height: 58,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
