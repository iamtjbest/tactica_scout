// src/screens/authStyles.ts — shared chrome for the five auth screens
// so they don't drift apart visually.
import { Platform, StatusBar, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export function topPaddingFor(insetTop: number): number {
  return Math.max(insetTop, Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 12);
}

export const authStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 32 },
  navTitle: { flex: 1, textAlign: 'center', color: COLORS.text, fontSize: 16, fontWeight: '700' },
  body: { padding: 18, paddingTop: 28 },
  heading: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 15,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
    fontWeight: '700',
  },
  hint: { color: COLORS.textDim, fontSize: 11, marginTop: 6 },
  error: { color: COLORS.live, fontSize: 13, marginTop: 14, lineHeight: 18 },
  notice: { color: COLORS.volt, fontSize: 13, marginTop: 14 },
  submitBtn: {
    backgroundColor: COLORS.volt,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 26,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  linkRow: { marginTop: 20, alignItems: 'center' },
  linkText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 10 },
  link: { color: COLORS.volt, fontWeight: '700' },
});
