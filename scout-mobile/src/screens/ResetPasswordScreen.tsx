// src/screens/ResetPasswordScreen.tsx — code + new password.
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
import { resetPasswordWithCode } from '../services/auth';

export const ResetPasswordScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const email: string = route.params?.email || '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = code.length === 6 && password.length >= 12 && !loading;

  const handleSubmit = async () => {
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPasswordWithCode(email, code, password);
      // Verifying the code signs you in, so go straight through.
      navigation.navigate('Profile');
    } catch (err: any) {
      setError(err.message || 'Failed to reset the password.');
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
        <Text style={s.navTitle}>New password</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={s.heading}>Set a new password</Text>
          <Text style={s.sub}>
            {email ? `Enter the code we sent to ${email}.` : 'Enter the code we sent you.'}
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

          <Text style={s.label}>New password</Text>
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

          <Text style={s.label}>Confirm password</Text>
          <TextInput
            style={s.input}
            placeholder="Type it again"
            placeholderTextColor={COLORS.textDim}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
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
              <Text style={s.submitBtnText}>Set password</Text>
            )}
          </TouchableOpacity>

          <View style={s.linkRow}>
            <TouchableOpacity onPress={() => navigation.replace('ForgotPassword')}>
              <Text style={s.linkText}>
                Need a new code? <Text style={s.link}>Request one</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};
