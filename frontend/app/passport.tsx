import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fontFamily } from '@/constants/theme';
import { resolveAsset } from '@/features/audio';
import { getPois } from '@/features/poi';
import {
  calculateTrailProgress,
  INITIAL_PASSPORT_STATE,
  PassportClient,
  type PassportState,
  type PoiReview,
} from '@/features/passport';
import { CreateReviewModal } from '@/components/passport/CreateReviewModal';
import { ReviewDetailModal } from '@/components/passport/ReviewDetailModal';
import { StampBadge } from '@/components/passport/StampBadge';
import trailsJson from '@/data/trails.json';
import { formatRelativeTime } from '@/lib/time';
import type { Poi, Trail } from '@/types/content';

const mascotIllustration = require('@/assets/passport_mascot.png');
const THEMED_TRAILS = trailsJson as Trail[];

export default function PassportScreen() {
  const insets = useSafeAreaInsets();
  const pois = useMemo(() => getPois(), []);
  const poiMap = useMemo(() => new Map(pois.map((p) => [p.id, p])), [pois]);

  const [passport, setPassport] = useState<PassportState>(INITIAL_PASSPORT_STATE);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PoiReview | null>(null);

  const loadData = useCallback(async () => {
    try {
      const summaryRes = await PassportClient.getPassport();
      if (summaryRes.ok) {
        setPassport({
          stamps: summaryRes.data.stamps,
          unlockedBadgeIds: summaryRes.data.unlockedBadgeIds,
          reviews: summaryRes.data.reviews,
        });
      } else {
        const local = await PassportClient.loadLocalPassport();
        setPassport(local);
      }
    } catch {
      const local = await PassportClient.loadLocalPassport();
      setPassport(local);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const reviewsList = useMemo(() => {
    return passport.reviews ?? [];
  }, [passport.reviews]);

  const [expandedTrailId, setExpandedTrailId] = useState<string | null>(null);
  const stampedIds = useMemo(() => new Set(Object.keys(passport.stamps)), [passport.stamps]);

  const renderTrailCard = (trail: Trail) => {
    const progress = calculateTrailProgress(trail, stampedIds);
    const expanded = expandedTrailId === trail.id;

    return (
      <Pressable
        key={trail.id}
        style={styles.trailCard}
        onPress={() => setExpandedTrailId(expanded ? null : trail.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${trail.name}, ${progress.visitedCount} dari ${progress.totalPois} tenant distempel`}
      >
        <View style={styles.trailHeaderRow}>
          <Text style={styles.trailName} numberOfLines={1}>
            {trail.name}
          </Text>
          <Text style={styles.trailCount}>
            {progress.visitedCount}/{progress.totalPois}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#A6A6A6" />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.percentage}%` }]} />
        </View>

        <View style={styles.badgeRow}>
          <Ionicons
            name={progress.isCompleted ? 'ribbon' : 'ribbon-outline'}
            size={16}
            color={progress.isCompleted ? '#FF8316' : '#A6A6A6'}
          />
          <Text style={[styles.badgeText, progress.isCompleted && styles.badgeTextUnlocked]}>
            {progress.isCompleted ? trail.badgeName : `Kunci: ${trail.badgeName}`}
          </Text>
        </View>

        {expanded ? (
          <View style={styles.trailPoiList}>
            <Text style={styles.trailDescription}>{trail.description}</Text>
            {trail.poiIds.map((id) => {
              const done = stampedIds.has(id);
              return (
                <View key={id} style={styles.trailPoiRow}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={done ? '#FF8316' : '#CFCFCF'}
                  />
                  <Text style={[styles.trailPoiName, done && styles.trailPoiNameDone]} numberOfLines={1}>
                    {poiMap.get(id)?.name ?? id}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const listHeader = (
    <View style={styles.trailSection}>
      <Text style={styles.sectionTitle}>Trail Tematik</Text>
      {THEMED_TRAILS.map(renderTrailCard)}
      <Text style={[styles.sectionTitle, styles.reviewSectionTitle]}>Ulasanmu</Text>
    </View>
  );

  const renderReviewCard = ({ item }: { item: PoiReview }) => {
    const poi = poiMap.get(item.poiId);
    const poiName = poi?.name ?? 'Tenant Kuliner';

    // Foto review: dari upload user atau default photo tenant
    const imageSource = item.photoPath
      ? { uri: item.photoPath }
      : resolveAsset(poi?.photos?.[0]?.assetKey);

    return (
      <Pressable
        style={styles.reviewCard}
        onPress={() => setSelectedReview(item)}
        accessibilityRole="button"
        accessibilityLabel={`Buka stempel paspor ${poiName}`}
      >
        {/* Foto Thumbnail Sisi Kiri */}
        <View style={styles.cardThumbnailContainer}>
          {imageSource ? (
            <Image source={imageSource} style={styles.cardThumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.cardPlaceholder}>
              <Ionicons name="restaurant-outline" size={32} color="#FF8316" />
            </View>
          )}
        </View>

        {/* Informasi Ulasan Sisi Tengah */}
        <View style={styles.cardContentCol}>
          <Text style={styles.cardPoiName} numberOfLines={2}>
            {poiName}
          </Text>
          <Text style={styles.cardRelativeTime}>{formatRelativeTime(item.createdAt)}</Text>

          {/* Rating Pill */}
          <View style={styles.cardRatingPill}>
            <Ionicons name="star" size={13} color="#FFCC24" />
            <Text style={styles.cardRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Stempel Melingkar Paspor Kuliner di Sisi Kanan Kartu Sesuai Figma */}
        <View style={styles.stampBadgeContainer}>
          <StampBadge size={68} color="#E66B00" />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtnRow}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={20} color="#404040" />
          <Text style={styles.backBtnText}>Kembali</Text>
        </Pressable>
      </View>

      {/* Header Utama Paspor Kuliner + Maskot Unggah Ulasan Sesuai Figma #366:98430 */}
      <View style={styles.heroSection}>
        <View style={styles.heroTextBox}>
          <Text style={styles.heroTitle}>Paspor Kuliner</Text>
          <Text style={styles.heroSubtitle}>
            Unggah ulasanmu untuk mendapatkan stempel!
          </Text>
        </View>

        {/* Maskot Ilustrasi */}
        <Image
          source={mascotIllustration}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </View>

      {/* Daftar Kartu Stempel Ulasan Paspor atau Empty State */}
      <FlatList
        data={reviewsList}
        keyExtractor={(item) => item.id}
        renderItem={renderReviewCard}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContainer,
          reviewsList.length === 0 && styles.listContainerEmpty,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF8316']}
            tintColor="#FF8316"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada ulasan</Text>
          </View>
        }
      />

      {/* Floating Bottom Button: Tambah Ulasan Sesuai Figma */}
      <View style={[styles.bottomBtnWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={styles.addReviewBtn}
          onPress={() => setCreateModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Tambah ulasan baru"
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addReviewBtnText}>Tambah Ulasan</Text>
        </Pressable>
      </View>

      {/* Modal Buat Ulasan */}
      <CreateReviewModal
        allowAllTenants
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={(newReview) => {
          setPassport((prev) => ({
            ...prev,
            reviews: [newReview, ...(prev.reviews ?? [])],
          }));
          setSelectedReview(newReview);
        }}
      />

      {/* Modal Detail Tiket Paspor & Unduh Gambar */}
      <ReviewDetailModal
        visible={selectedReview !== null}
        onClose={() => setSelectedReview(null)}
        review={selectedReview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backBtnText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#404040',
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
    position: 'relative',
  },
  heroTextBox: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: '#404040',
  },
  heroSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#A6A6A6',
    marginTop: 2,
    maxWidth: 220,
  },
  mascotImage: {
    width: 120,
    height: 100,
    marginBottom: -6,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 10,
  },
  listContainerEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  trailSection: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: '#404040',
  },
  reviewSectionTitle: {
    marginTop: 8,
  },
  trailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F2F2F2',
    gap: 8,
  },
  trailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailName: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    color: '#1E1E1E',
  },
  trailCount: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#FF8316',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF4EA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FF8316',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#A6A6A6',
  },
  badgeTextUnlocked: {
    fontFamily: fontFamily.medium,
    color: '#E66B00',
  },
  trailPoiList: {
    gap: 6,
    paddingTop: 4,
  },
  trailDescription: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#7A7A7A',
    marginBottom: 2,
  },
  trailPoiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailPoiName: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#404040',
  },
  trailPoiNameDone: {
    color: '#A6A6A6',
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: '#A6A6A6',
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  cardThumbnailContainer: {
    width: 110,
    height: 98,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFF4EA',
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 60, // Space untuk stamp melingkar di sisi kanan
    justifyContent: 'center',
  },
  cardPoiName: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    color: '#1E1E1E',
  },
  cardRelativeTime: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#A6A6A6',
    marginTop: 2,
    marginBottom: 6,
  },
  cardRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  cardRatingText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#404040',
  },
  stampBadgeContainer: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    transform: [{ rotate: '-8deg' }],
  },
  bottomBtnWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#FF8316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addReviewBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
