// Data dari GET /v1/pois/:poiId/reviews, dengan fallback ke ulasan yang tersimpan di perangkat.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CreateReviewModal } from '@/components/passport/CreateReviewModal';
import { colors, fontFamily } from '@/constants/theme';
import { PassportClient, type PoiReview, type PoiReviewsResult } from '@/features/passport';
import { useVisitedPoiIds } from '@/features/visits';
import { formatRelativeTime } from '@/lib/time';
import type { Poi } from '@/types/content';

const ACCENT = '#FF8316';
const PREVIEW_COUNT = 3;

/** Foto ulasan hanya ditampilkan jika berupa URI yang bisa dimuat langsung. */
const isLoadableUri = (path: string | null): path is string =>
  path != null && /^(file|content|https?):/i.test(path);

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={rating >= n ? 'star' : rating >= n - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color="#FFB800"
        />
      ))}
    </View>
  );
}

export function PoiReviewsSection({ poi }: { poi: Poi }) {
  const [data, setData] = useState<PoiReviewsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const visited = useVisitedPoiIds().has(poi.id);

  const load = useCallback(async () => {
    const res = await PassportClient.getPoiReviews(poi.id);
    setData(res.ok ? res.data : null);
    setLoading(false);
  }, [poi.id]);

  // Muat ulang setiap layar kembali fokus, mis. setelah menambah ulasan dari halaman Paspor.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const menuName = (id: string) => poi.menu.find((m) => m.id === id)?.name;
  const reviews = data?.reviews ?? [];
  const stats = data?.stats;
  const visibleReviews = showAll ? reviews : reviews.slice(0, PREVIEW_COUNT);

  const renderReview = (r: PoiReview) => {
    const menus = r.menuItemIds.map(menuName).filter((n): n is string => Boolean(n));
    return (
      <View key={r.id} style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={14} color={ACCENT} />
          </View>
          <View style={styles.reviewHeaderText}>
            <Text style={styles.reviewer} numberOfLines={1}>
              {r.userDisplayName || 'Kamu'}
            </Text>
            <View style={styles.reviewMeta}>
              <Stars rating={r.rating} size={12} />
              <Text style={styles.reviewDate}>{formatRelativeTime(r.createdAt)}</Text>
            </View>
          </View>
        </View>

        {r.reviewText ? <Text style={styles.reviewText}>{r.reviewText}</Text> : null}

        {menus.length > 0 ? (
          <View style={styles.menuChips}>
            {menus.map((name) => (
              <View key={name} style={styles.menuChip}>
                <Ionicons name="restaurant-outline" size={11} color="#A86A3A" />
                <Text style={styles.menuChipText}>{name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isLoadableUri(r.photoPath) ? (
          <Image
            source={{ uri: r.photoPath }}
            style={styles.reviewPhoto}
            resizeMode="cover"
            accessibilityLabel={`Foto ulasan ${poi.name}`}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Ulasan Pengunjung</Text>
        {visited ? (
          <Pressable
            onPress={() => setModalVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Tulis ulasan untuk ${poi.name}`}
          >
            <Text style={styles.writeLink}>Tulis ulasan</Text>
          </Pressable>
        ) : null}
      </View>
      {!visited ? (
        <Text style={styles.visitHint}>Kunjungi tenant ini dulu untuk bisa menulis ulasan.</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={ACCENT} style={styles.loading} />
      ) : !stats || stats.totalReviews === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {visited
              ? 'Belum ada ulasan. Jadilah yang pertama dan dapatkan stempel paspor!'
              : 'Belum ada ulasan untuk tenant ini.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.average}>{stats.averageRating.toFixed(1)}</Text>
            <View style={styles.summaryRight}>
              <Stars rating={stats.averageRating} size={16} />
              <Text style={styles.summaryCount}>{stats.totalReviews} ulasan</Text>
            </View>
          </View>

          {stats.popularMenus.length > 0 ? (
            <View style={styles.popularBox}>
              <Text style={styles.popularTitle}>Paling sering dipesan</Text>
              {stats.popularMenus.slice(0, 3).map((m) => (
                <View key={m.menuItemId} style={styles.popularRow}>
                  <Text style={styles.popularName} numberOfLines={1}>
                    {menuName(m.menuItemId) ?? m.name}
                  </Text>
                  <Text style={styles.popularCount}>{m.reviewCount}×</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.reviewList}>{visibleReviews.map(renderReview)}</View>

          {reviews.length > PREVIEW_COUNT ? (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              style={styles.moreBtn}
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>
                {showAll ? 'Tampilkan lebih sedikit' : `Lihat semua ${reviews.length} ulasan`}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      <CreateReviewModal
        visible={modalVisible}
        initialPoiId={poi.id}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          void load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onSurface },
  writeLink: { fontFamily: fontFamily.medium, fontSize: 13, color: ACCENT },
  visitHint: { fontFamily: fontFamily.regular, fontSize: 12, color: '#8A8A8A', marginBottom: 10 },
  loading: { marginVertical: 12 },
  emptyBox: {
    backgroundColor: '#FFF4EA',
    borderRadius: 12,
    padding: 14,
  },
  emptyText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: '#A86A3A' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  average: { fontFamily: fontFamily.bold, fontSize: 32, color: colors.onSurface },
  summaryRight: { gap: 2 },
  summaryCount: { fontFamily: fontFamily.regular, fontSize: 12, color: '#707070' },
  stars: { flexDirection: 'row', gap: 1 },
  popularBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surfaceContainerLow,
    gap: 6,
  },
  popularTitle: { fontFamily: fontFamily.medium, fontSize: 12, color: '#5A4136' },
  popularRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  popularName: { flex: 1, fontFamily: fontFamily.regular, fontSize: 13, color: colors.onSurface },
  popularCount: { fontFamily: fontFamily.semibold, fontSize: 13, color: ACCENT },
  reviewList: { marginTop: 12, gap: 10 },
  reviewCard: {
    borderWidth: 1,
    borderColor: '#F2F2F2',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHeaderText: { flex: 1 },
  reviewer: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.onSurface },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  reviewDate: { fontFamily: fontFamily.regular, fontSize: 11, color: '#A6A6A6' },
  reviewText: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: '#3A3A3A' },
  menuChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  menuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF4EA',
  },
  menuChipText: { fontFamily: fontFamily.regular, fontSize: 11, color: '#A86A3A' },
  reviewPhoto: { width: '100%', height: 160, borderRadius: 10 },
  moreBtn: { alignSelf: 'center', paddingVertical: 10 },
  moreText: { fontFamily: fontFamily.medium, fontSize: 13, color: ACCENT },
});
