// src/screens/VerifyScreen.tsx — 6-digit code after signup.
import React, { useEffect, useState } from 'react';
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
import { resendSignupCode, verifySignupCode } from '../services/auth';

export const VerifyScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const email: string = route.params?.email || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  // Supabase enforces a 60s gap between code requests, so disable the
  // button rather than letting the user hit a rate-limit error.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await verifySignupCode(email, code);
      // Verified and signed in. Drop the whole auth stack.
      navigation.navigate('Profile');
    } catch (err: any) {
      setError(err.message || 'Failed to verify.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    try {
      await resendSignupCode(email);
      setNotice('New code sent. Check your inbox.');
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend.');
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: topPaddingFor(insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Verify email</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={s.heading}>Check your email</Text>
          <Text style={s.sub}>
            {email
              ? `We sent a 6-digit code to ${email}.`
              : 'Enter the 6-digit code we sent you.'}
          </Text>

          <Text style={s.label}>Code</Text>
          <TextInput
            style={[s.input, s.codeInput]}
            placeholder="000000"
            placeholderTextColor={COLORS.textDim}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Text style={s.hint}>Expires in 15 minutes.</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {notice ? <Text style={s.notice}>{notice}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, (loading || code.length !== 6) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.submitBtnText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || !email}>
              <Text style={[s.linkText, (cooldown > 0 || !email) && { opacity: 0.5 }]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
              <Text style={s.linkText}>
                Wrong email? <Text style={s.link}>Start over</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
