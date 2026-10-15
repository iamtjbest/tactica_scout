// src/components/FollowButton.tsx — Follow / Star toggle for clubs
// Properly handles unauthenticated state: shows sign-in prompt instead of
// silently flipping UI state that won't persist past a reload.
import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { getMe, updateFollowedTeams, getAuthToken } from '../services/api';

interface FollowButtonProps {
  teamName: string;
  size?: 'sm' | 'md';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  teamName,
  size = 'md',
}) => {
  const [isFollowed, setIsFollowed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  // On mount: check auth state AND whether the team is followed
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Quick local token check first to avoid a round-trip
        const token = await getAuthToken();
        if (!token) {
          if (active) setIsAuthenticated(false);
          return;
        }
        const res = await getMe();
        if (!active) return;
        setIsAuthenticated(true);
        const followed = res.user?.followed_teams || [];
        setIsFollowed(followed.includes(teamName));
      } catch {
        // Token exists but request failed (expired, network error etc.)
        if (active) setIsAuthenticated(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [teamName]);

  const handleToggle = async () => {
    // Guard: if not authenticated, show prompt — don't silently flip UI
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Create a free Tactica Scout account to follow clubs and build your personalised feed.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => {
              // Teams using this button need to navigate to Profile/Auth screen.
              // We emit a global event that the Profile modal can listen for.
              // For now, just inform clearly — navigation is handled by the parent
              // via the Profile icon in the top Header.
            },
          },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const res = await getMe();
      const current = res.user?.followed_teams || [];
      const updated = isFollowed
        ? current.filter((t) => t !== teamName)
        : [...current, teamName];
      await updateFollowedTeams(updated);
      setIsFollowed(!isFollowed);
    } catch (err: any) {
      // API call failed even though we thought we were authenticated
      // (e.g. expired token). Show an error — don't silently flip UI.
      Alert.alert(
        'Could Not Save',
        err?.message?.includes('401') || err?.message?.includes('403')
          ? 'Your session has expired. Please sign in again from the Profile screen.'
          : 'Failed to update your followed clubs. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        isFollowed ? styles.followedBtn : styles.unfollowedBtn,
      ]}
      onPress={handleToggle}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFollowed ? COLORS.volt : COLORS.textDim}
        />
      ) : (
        <>
          <Ionicons
            name={
              !isAuthenticated
                ? 'star-outline'
                : isFollowed
                ? 'star'
                : 'star-outline'
            }
            size={isSmall ? 14 : 16}
            color={
              !isAuthenticated
                ? COLORS.textDim
                : isFollowed
                ? COLORS.volt
                : COLORS.textSecondary
            }
            style={{ marginRight: isSmall ? 4 : 6 }}
          />
          <Text
            style={[
              styles.btnText,
              isSmall && styles.btnTextSmall,
              !isAuthenticated
                ? styles.unauthText
                : isFollowed
                ? styles.followedText
                : styles.unfollowedText,
            ]}
          >
            {!isAuthenticated
              ? 'Follow'
              : isFollowed
              ? 'Following'
              : 'Follow'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unfollowedBtn: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.cardBorder,
  },
  followedBtn: {
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'rgba(212, 255, 0, 0.3)',
  },
  btnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextSmall: {
    fontSize: 11,
  },
  unauthText: {
    color: COLORS.textDim,
  },
  unfollowedText: {
    color: COLORS.textSecondary,
  },
  followedText: {
    color: COLORS.volt,
  },
});
