// src/screens/SignInScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { authStyles as s, topPaddingFor } from './authStyles';
import { signInWithEmail } from '../services/auth';

export const SignInScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
      navigation.navigate('Profile');
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in.';
      setError(msg);
      // Unverified account: send them to finish rather than dead-end.
      if (msg.toLowerCase().includes('confirm your email')) {
        navigation.replace('Verify', { email: email.trim().toLowerCase() });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: topPaddingFor(insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Sign in</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={s.heading}>Welcome back</Text>
          <Text style={s.sub}>Sign in to pick up your followed teams.</Text>

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="Your password"
            placeholderTextColor={COLORS.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.submitBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={[s.linkText, s.link]}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
              <Text style={s.linkText}>
                No account? <Text style={s.link}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
