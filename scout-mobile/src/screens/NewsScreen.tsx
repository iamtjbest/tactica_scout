// src/screens/NewsScreen.tsx — Tactical news & analytical briefs
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { getNews, NewsItem } from '../services/api';

export const NewsScreen: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async (isRefresh = false) => {
    if (!isRefresh) setError(null);
    try {
      const res = await getNews();
      setNews(res.items || []);
      setError(null);
    } catch (err: any) {
      // Distinguish connection errors from server errors so we can show the
      // right message — don't spam the LogBox with a console.warn.
      const msg =
        err?.message?.includes('ConnectException') ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('Network request failed')
          ? 'Could not reach the Tactica server.\nCheck your connection or verify the API URL in Settings.'
          : `Failed to load news: ${err?.message ?? 'Unknown error'}`;
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews(true);
  };

  const openArticle = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => console.warn('Could not open URL:', err));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tactical Feed</Text>
        <Text style={styles.headerSub}>Curated match analysis, tactical breakdowns & updates</Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.volt} />
          <Text style={styles.loadingText}>Fetching tactical briefs...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={44} color={COLORS.textDim} />
          <Text style={styles.emptyTitle}>Connection Error</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchNews(); }}>
            <Ionicons name="refresh" size={14} color={COLORS.bg} style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : news.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="newspaper-outline" size={44} color={COLORS.textDim} />
          <Text style={styles.emptyTitle}>No stories available</Text>
          <Text style={styles.emptySub}>Check back soon for latest scouting analysis.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
          data={news}
          keyExtractor={(item, index) => `news-${index}-${item.title?.slice(0, 10)}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.volt}
              colors={[COLORS.volt]}
            />
          }
          renderItem={({ item }) => {
            const isMedium = item.source === 'medium';
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => openArticle(item.url)}
              >
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.sourceBadge,
                      isMedium ? styles.mediumBadge : styles.xBadge,
                    ]}
                  >
                    <Ionicons
                      name={isMedium ? 'document-text-outline' : 'logo-twitter'}
                      size={11}
                      color={isMedium ? COLORS.volt : '#38bdf8'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.sourceText,
                        { color: isMedium ? COLORS.volt : '#38bdf8' },
                      ]}
                    >
                      {isMedium ? 'Medium Tactical' : 'X Analysis'}
                    </Text>
                  </View>

                  <Text style={styles.dateText}>{item.published || 'Recent'}</Text>
                </View>

                <Text style={styles.titleText}>{item.title}</Text>
                {item.excerpt ? (
                  <Text style={styles.excerptText} numberOfLines={3}>
                    {item.excerpt}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.readMoreText}>Read breakdown</Text>
                  <Ionicons name="arrow-forward" size={13} color={COLORS.volt} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  mediumBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  xBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateText: {
    color: COLORS.textDim,
    fontSize: 11,
  },
  titleText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  excerptText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  readMoreText: {
    color: COLORS.volt,
    fontSize: 12,
    fontWeight: '700',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: COLORS.volt,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: 13,
  },
});
