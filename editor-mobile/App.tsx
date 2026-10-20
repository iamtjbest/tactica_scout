import "react-native-url-polyfill/auto";
import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { COLORS } from "./src/theme";
import { isSignedIn } from "./src/services/auth";
import SignInScreen from "./src/screens/SignInScreen";
import TournamentsScreen from "./src/screens/TournamentsScreen";
import TournamentDetailScreen from "./src/screens/TournamentDetailScreen";
import LiveScreen from "./src/screens/LiveScreen";
import BillingScreen from "./src/screens/BillingScreen";
import JoinScreen from "./src/screens/JoinScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import InboxScreen from "./src/screens/InboxScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const Stack = createNativeStackNavigator();

const theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.card,
    text: COLORS.text,
    border: COLORS.cardBorder,
    primary: COLORS.volt,
  },
};

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    isSignedIn().then(setSignedIn);
  }, []);

  if (signedIn === null) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.volt} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={signedIn ? "Dashboard" : "SignIn"}
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.card },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: "800" },
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="SignIn" component={SignInScreen}
                      options={{ title: "Sign in", headerShown: false }} />
        {/* The four tab destinations. They carry their own TabBar, so
            the header is just a title. */}
        <Stack.Screen name="Dashboard" component={DashboardScreen}
                      options={{ title: "Dashboard" }} />
        <Stack.Screen name="Tournaments" component={TournamentsScreen}
                      options={{ title: "My competitions" }} />
        <Stack.Screen name="Inbox" component={InboxScreen}
                      options={{ title: "Inbox" }} />
        <Stack.Screen name="Settings" component={SettingsScreen}
                      options={{ title: "Settings" }} />
        <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen}
                      options={{ title: "Tournament" }} />
        <Stack.Screen name="Live" component={LiveScreen}
                      options={{ title: "Live" }} />
        <Stack.Screen name="Billing" component={BillingScreen}
                      options={{ title: "Billing" }} />
        <Stack.Screen name="Join" component={JoinScreen}
                      options={{ title: "Join a tournament" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
