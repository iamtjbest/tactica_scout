// src/components/Header.tsx — Top tactical bar for Tactica Scout
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenProfile,
  showBack = false,
  onBack,
  title,
}) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 12);

  return (
    <View style={[styles.container, { paddingTop: topPadding + 6 }]}>
      <View style={styles.content}>
        {/* Left: Back button OR SCOUT Brand */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Text style={styles.brandText}>SCOUT</Text>
              </View>
            </View>
          )}
        </View>

        {/* Center: Search dead center (or Screen Title if provided on detail screens) */}
        <View style={styles.centerSection}>
          {title ? (
            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          ) : (
            <TouchableOpacity
              style={styles.searchBar}
              activeOpacity={0.8}
              onPress={onOpenSearch}
            >
              <Ionicons name="search" size={15} color={COLORS.textDim} style={{ marginRight: 6 }} />
              <Text style={styles.searchText} numberOfLines={1}>Search teams, players...</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Profile & Settings Icon */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.7}
            onPress={onOpenProfile}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="person-circle-outline" size={28} color={COLORS.volt} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
    zIndex: 100,
  },
  content: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  leftSection: {
    width: 84,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backBtn: {
    padding: 4,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderColor: 'rgba(212, 255, 0, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  brandText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  searchBar: {
    width: '100%',
    height: 36,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '500',
  },
  titleText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  rightSection: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  profileBtn: {
    padding: 2,
  },
});
