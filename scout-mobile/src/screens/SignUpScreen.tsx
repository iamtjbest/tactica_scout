// src/screens/SignUpScreen.tsx
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
import { signUpWithEmail } from '../services/auth';

export const SignUpScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 12 && !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(email, password, {
        displayName: displayName.trim() || undefined,
      });
      // No session yet -- Supabase has emailed a code. Replace rather
      // than push, so Back doesn't land on a half-finished signup form.
      navigation.replace('Verify', { email: email.trim().toLowerCase() });
    } catch (err: any) {
      setError(err.message || 'Failed to sign up.');
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
        <Text style={s.navTitle}>Create account</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={s.heading}>Sign up</Text>
          <Text style={s.sub}>Create an account to follow teams and players.</Text>

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

          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            placeholder="Optional"
            placeholderTextColor={COLORS.textDim}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="At least 12 characters"
            placeholderTextColor={COLORS.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
          />
          <Text style={s.hint}>At least 12 characters.</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.submitBtnText}>Sign up</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <TouchableOpacity onPress={() => navigation.replace('SignIn')}>
              <Text style={s.linkText}>
                Already have an account? <Text style={s.link}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
