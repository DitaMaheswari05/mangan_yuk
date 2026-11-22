import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily } from '@/constants/theme';
import { CONTENT_ASSETS } from '@/data/assets';
import { sanitizeNumber, sanitizeTastes } from '@/lib/validation';
import { DEV_SUDIRMAN_COORDINATE, haversineM, useUserLocation } from '@/features/location';
import { getPois } from '@/features/poi';
import { ExploreModeController } from '@/features/geofence';
import {
  activeTrailStepIndex,
  createTrailSession,
  doneTrailSteps,
  jumpToTrailStep,
  pendingTrailSteps,
  planTrail,
  skipClosedTrailSteps,
  skipTrailStep,
  TrailSessionStore,
  useTrailSession,
  type TrailStep,
} from '@/features/trail';
import type { Poi, TasteTag } from '@/types/content';

const exitIllustration = require('../../assets/images/search.png');

function formatRupiah(val: number): string {
  return `Rp${val.toLocaleString('id-ID')}`;
}

const TASTE_DISPLAY_LABELS: Record<string, string> = {
  manis: 'Manis',
  pedas: 'Asin', // Di Trail UI disajikan sebagai Asin
  gurih: 'Gurih',
  segar: 'Segar',
  aromatik: 'Aromatik',
};

function formatBudgetK(val: number): string {
  if (val >= 1000) {
    const inK = val / 1000;
    return Number.isInteger(inK) ? `${inK}K` : `${inK.toFixed(1)}K`;
  }
  return `${val}`;
}

function getPreferenceDisplayText(tastes: TasteTag[]): string {
  if (!tastes || tastes.length === 0) {
    return 'Semua';
  }
  // Jika memilih ketiga opsi yang tersedia di form (manis, asin/pedas, gurih) atau >= 3 rasa
  const trailTasteOptions: TasteTag[] = ['manis', 'pedas', 'gurih'];
  const hasAllThree = trailTasteOptions.every((opt) => tastes.includes(opt));
  if (hasAllThree || tastes.length >= 3) {
    return 'Semua';
  }
  return tastes.map((t) => TASTE_DISPLAY_LABELS[t] || t).join(', ');
}

export default function TrailItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();
  const params = useLocalSearchParams<{
    durationMin?: string;
    budget?: string;
    preferredTastes?: string;
  }>();

  // Dari planner selalu ada parameter; dari notifikasi pengingat tidak ada → lanjutkan trail aktif.
  const isNewTrail = params.durationMin !== undefined;

  const pois = useMemo(() => getPois(), []);
  const rawCoord = position?.coordinate ?? DEV_SUDIRMAN_COORDINATE;
  const isFarFromSSF = haversineM(rawCoord, DEV_SUDIRMAN_COORDINATE) > 300;
  const userCoord = isFarFromSSF ? DEV_SUDIRMAN_COORDINATE : rawCoord;

  const storedSession = useTrailSession();
  const [started, setStarted] = useState(!isNewTrail);
  const startRequested = useRef(false);

  useEffect(() => {
    if (!isNewTrail || startRequested.current) return;
    startRequested.current = true;
    const durationMin = sanitizeNumber(params.durationMin, 60, 15, 360);
    const budget = sanitizeNumber(params.budget, 50000, 15000, 2000000);
    const preferredTastes = sanitizeTastes(params.preferredTastes, ['gurih']);
    const plan = planTrail({ userPosition: userCoord, pois, durationMin, budget, preferredTastes });
    void TrailSessionStore.start(
      createTrailSession(plan, { durationMin, budget, preferredTastes }, Date.now()),
    ).then(() => setStarted(true));
  }, [isNewTrail, params, pois, userCoord]);

  // Selama trail baru belum tersimpan, jangan tampilkan sesi lama yang masih ada di storage.
  const session = started ? storedSession : undefined;
  const steps = session?.steps ?? [];
  const activeStepIndex = session ? activeTrailStepIndex(session) : -1;
  const pendingCount = session ? pendingTrailSteps(session).length : 0;
  const doneSteps = session ? doneTrailSteps(session) : [];

  const durationMin = session?.durationMin ?? sanitizeNumber(params.durationMin, 60, 15, 360);
  const budget = session?.budget ?? sanitizeNumber(params.budget, 50000, 15000, 2000000);
  const preferredTastes = session?.preferredTastes ?? sanitizeTastes(params.preferredTastes, ['gurih']);

  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [poiToSkip, setPoiToSkip] = useState<Poi | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Runtime geofence hanya jalan saat Mode Jelajah aktif, jadi layar ini juga mengecek tenant tutup.
  const coordRef = useRef(userCoord);
  useEffect(() => {
    coordRef.current = userCoord;
  }, [userCoord]);
  const hasSession = session != null;
  useEffect(() => {
    if (!hasSession) return;
    const check = async () => {
      let skipped: string[] = [];
      let added: string[] = [];
      await TrailSessionStore.update((s) => {
        const res = skipClosedTrailSteps(s, pois, coordRef.current, Date.now());
        skipped = res.skippedPoiIds;
        added = res.addedPoiIds;
        return res.session;
      });
      if (skipped.length === 0) return;
      const nameOf = (id: string) => pois.find((p) => p.id === id)?.name ?? id;
      const replacement =
        added.length > 0 ? ` Pengganti: ${added.map(nameOf).join(', ')}.` : '';
      setNotice(`${skipped.map(nameOf).join(', ')} sudah tutup dan dilewati otomatis.${replacement}`);
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => clearInterval(timer);
  }, [hasSession, pois]);

  const handlePromptSkip = (poi: Poi) => {
    setPoiToSkip(poi);
    setSkipModalVisible(true);
  };

  const confirmSkipStep = async () => {
    if (!poiToSkip) return;
    const skipped = poiToSkip;
    setSkipModalVisible(false);
    setPoiToSkip(null);

    let added: string[] = [];
    let pendingAfter = 0;
    await TrailSessionStore.update((s) => {
      const res = skipTrailStep(s, skipped.id, pois, userCoord, Date.now());
      added = res.addedPoiIds;
      pendingAfter = pendingTrailSteps(res.session).length;
      return res.session;
    });

    if (added.length > 0) {
      const names = added.map((id) => pois.find((p) => p.id === id)?.name).filter(Boolean);
      setNotice(`Rute disusun ulang. Pengganti: ${names.join(', ')}.`);
    } else if (pendingAfter > 0) {
      setNotice('Rute disusun ulang dari posisimu sekarang.');
    } else {
      setNotice('Tidak ada tenant pengganti yang muat di sisa waktu dan budget.');
    }
  };

  // Langsung ke step tertentu: step pending sebelumnya dilewati tanpa susun ulang.
  const handleNavigateToStep = (targetIndex: number, poiId: string) => {
    setNotice(null);
    void TrailSessionStore.update((s) => jumpToTrailStep(s, targetIndex));
    router.push(`/navigate/${poiId}`);
  };

  const handleFinishTrail = () => {
    const elapsedMin = session ? Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000)) : 0;
    router.replace({
      pathname: '/trail/summary',
      params: {
        totalCost: doneSteps.reduce((sum, s) => sum + s.estimatedCostIdr, 0).toString(),
        totalMin: elapsedMin.toString(),
        visitedCount: doneSteps.length.toString(),
      },
    });
    void TrailSessionStore.end();
  };

  const handleReplan = () => {
    void TrailSessionStore.end();
    router.replace('/(tabs)/trail');
  };

  const exploreModeOff = session != null && pendingCount > 0 && !ExploreModeController.isActive();

  const renderStepItem = ({ item, index }: { item: TrailStep; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const status = session?.status[item.poi.id] ?? 'pending';
    const isDone = status === 'done';
    const isDeactivated = status === 'skipped';
    const isActive = index === activeStepIndex;

    // Foto tenant dari data POI
    const firstPhotoKey = item.poi.photos && item.poi.photos.length > 0 ? item.poi.photos[0].assetKey : null;
    const photoSource = firstPhotoKey ? CONTENT_ASSETS[firstPhotoKey] : null;

    // Ekstrak tag kategori & halal status
    const categoryName = item.poi.categoryLabel ? item.poi.categoryLabel.split('/')[0].trim() : 'Kuliner';
    const halalStatusText = item.poi.isHalal === false ? 'Non-Halal' : item.poi.isHalal === true ? 'Halal' : 'Umum';

    // Format rentang harga
    const priceText = `Rp${(item.poi.priceMinIdr || item.estimatedCostIdr).toLocaleString('id-ID')}–${(item.poi.priceMaxIdr || item.estimatedCostIdr * 1.5).toLocaleString('id-ID')}`;

    return (
      <View style={[styles.stepContainer, isLast && { paddingBottom: 4 }]}>
        {/* Indikator titik & garis timeline continuous */}
        <View style={styles.timelineCol}>
          {/* Garis putus-putus continuous yang menyambung antar kartu */}
          {steps.length > 1 && (
            <View
              style={[
                styles.timelineLineContainer,
                isFirst && { top: 24 },
                isLast && { height: 24, bottom: undefined },
              ]}
              pointerEvents="none"
            >
              <Svg height="100%" width="2" style={{ overflow: 'hidden' }}>
                <Path
                  d="M1 0 L1 1500"
                  stroke="#FF8316"
                  strokeWidth={2}
                  strokeDasharray={[4, 4]}
                />
              </Svg>
            </View>
          )}

          {/* Titik Bullet */}
          <View
            style={[
              styles.stepBullet,
              isDone
                ? styles.stepBulletDone
                : isDeactivated
                ? styles.stepBulletDeactivated
                : isActive
                  ? styles.stepBulletActive
                  : null,
            ]}
          />
        </View>

        {/* Kartu Detail Tenant Langkah */}
        <View
          style={[
            styles.stepCard,
            isDone
              ? styles.stepCardDone
              : isDeactivated
              ? styles.stepCardDeactivated
              : isActive
                ? styles.stepCardActive
                : null,
          ]}
        >
          <Pressable
            style={styles.cardMainRow}
            onPress={() => router.push(`/poi/${item.poi.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Buka detail tenant ${item.poi.name}`}
          >
            {/* Foto Thumbnail Tenant */}
            <View style={styles.thumbWrapper}>
              {photoSource ? (
                <Image source={photoSource} style={styles.tenantPhoto} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={28} color="#FF8316" />
                </View>
              )}

              {/* Rating Pill overlay di atas gambar */}
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color="#FFCC24" />
                <Text style={styles.ratingText}>4.5</Text>
              </View>
            </View>

            {/* Kolom Informasi Tenant */}
            <View style={styles.tenantInfoCol}>
              <View style={styles.nameAndTagsCol}>
                <Text
                  style={[styles.stepPoiName, isDeactivated && styles.textDeactivated]}
                  numberOfLines={1}
                >
                  {item.poi.name}
                </Text>

                <View style={styles.categoryHalalRow}>
                  <Text style={styles.categoryTagText}>{categoryName}</Text>
                  <View style={styles.tagDot} />
                  <Text style={styles.halalTagText}>{halalStatusText}</Text>
                </View>
              </View>

              {/* Rentang harga */}
              <View style={styles.priceRow}>
                <Text style={[styles.priceRangeText, isDeactivated && styles.priceDeactivated]}>
                  {priceText}
                </Text>
                <Text style={styles.perPersonText}>/orang</Text>
              </View>

              {/* Garis Divider tipis */}
              <View style={styles.cardInnerDivider} />

              {/* Jarak jalan & waktu */}
              <View style={styles.distanceWalkRow}>
                <Text style={styles.distanceText}>{item.distanceFromPreviousM}m</Text>
                <View style={styles.walkMetaBadge}>
                  <Ionicons name="walk" size={13} color="#A6A6A6" />
                  <Text style={styles.walkMinutesText}>~{item.estimatedWalkingMin} menit</Text>
                </View>
              </View>
            </View>
          </Pressable>

          {isDone ? (
            <View style={styles.deactivatedActionsRow}>
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FF8316" />
                <Text style={styles.doneBadgeText}>Selesai</Text>
              </View>
            </View>
          ) : isDeactivated ? null : isActive ? (
            <View style={styles.nonActiveActionsRow}>
              <Pressable
                style={styles.skipBtnSmall}
                onPress={() => handlePromptSkip(item.poi)}
                accessibilityRole="button"
                accessibilityLabel={`Lewati ${item.poi.name}`}
              >
                <Ionicons name="play-skip-forward-outline" size={15} color="#8E7164" />
                <Text style={styles.skipBtnSmallText}>Lewati</Text>
              </Pressable>
              <Pressable
                style={[styles.navStepBtnActive, styles.navStepBtnActiveFlex]}
                onPress={() => router.push(`/navigate/${item.poi.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Mulai navigasi ke ${item.poi.name}`}
              >
                <Text style={styles.navStepBtnActiveText}>Mulai Navigasi</Text>
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.nonActiveActionsRow}>
              <Pressable
                style={styles.skipBtnSmall}
                onPress={() => handlePromptSkip(item.poi)}
                accessibilityRole="button"
                accessibilityLabel={`Lewati ${item.poi.name}`}
              >
                <Ionicons name="play-skip-forward-outline" size={15} color="#8E7164" />
                <Text style={styles.skipBtnSmallText}>Lewati</Text>
              </Pressable>
              <Pressable
                style={styles.navStepBtnSmall}
                onPress={() => handleNavigateToStep(index, item.poi.id)}
                accessibilityRole="button"
                accessibilityLabel={`Navigasi ke ${item.poi.name}`}
              >
                <Text style={styles.navStepBtnSmallText}>Navigasi</Text>
                <Ionicons name="arrow-forward" size={15} color="#FF8316" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header Bar sesuai Figma */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtnRow}
          onPress={() => setExitModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={20} color="#404040" />
          <Text style={styles.backBtnText}>Kembali</Text>
        </Pressable>

        {/* <Pressable
          style={styles.finishTopBtn}
          onPress={handleFinishTrail}
          accessibilityRole="button"
        >
          <Text style={styles.finishTopBtnText}>Selesai</Text>
        </Pressable> */}
      </View>

      {/* Header Title & Subtitle */}
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Rute Kulinermu Siap!</Text>
        <Text style={styles.pageSubtitle}>
          Berikut rute kuliner yang sudah disusun sesuai pilihanmu. Yuk, mulai jelajahi!
        </Text>
      </View>

      {/* 3 Summary Badges sesuai Figma #251:80321 */}
      <View style={styles.summaryBadgesRow}>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeLabel}>waktu</Text>
          <View style={styles.summaryValueRow}>
            <Text style={styles.summaryBadgeBold}>{durationMin}</Text>
            <Text style={styles.summaryBadgeUnit}>mnt</Text>
          </View>
        </View>

        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeLabel}>budget</Text>
          <View style={styles.summaryValueRow}>
            <Text style={styles.summaryBudgetPrefix}>Rp</Text>
            <Text style={styles.summaryBadgeBold}>{formatBudgetK(budget)}</Text>
          </View>
        </View>

        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeLabel}>preferensi</Text>
          <Text style={styles.summaryBadgePreference} numberOfLines={1}>
            {getPreferenceDisplayText(preferredTastes)}
          </Text>
        </View>
      </View>

      {(notice || exploreModeOff) && (
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#8E7164" />
          <Text style={styles.noticeText}>
            {notice ?? 'Nyalakan Mode Jelajah di Beranda supaya tenant tercentang otomatis saat kamu mampir.'}
          </Text>
          {notice && (
            <Pressable
              onPress={() => setNotice(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Tutup info"
            >
              <Ionicons name="close" size={16} color="#8E7164" />
            </Pressable>
          )}
        </View>
      )}

      {/* Timeline List Container (Warna Krem #FFE0B8) */}
      <View style={styles.timelineListOuter}>
        <FlatList
          data={steps}
          keyExtractor={(item) => item.poi.id}
          renderItem={renderStepItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            steps.length > 0 && pendingCount === 0 ? (
              <View style={styles.allSkippedFooter}>
                <MaterialCommunityIcons
                  name={doneSteps.length > 0 ? 'flag-checkered' : 'map-marker-off'}
                  size={32}
                  color="#8E7164"
                />
                <Text style={styles.allSkippedText}>
                  {doneSteps.length > 0
                    ? `Trail selesai, ${doneSteps.length} tenant sudah kamu kunjungi`
                    : 'Semua tenant pada rute telah dilewati'}
                </Text>
                <Pressable
                  style={styles.replanBtn}
                  onPress={doneSteps.length > 0 ? handleFinishTrail : handleReplan}
                  accessibilityRole="button"
                >
                  <Text style={styles.replanBtnText}>
                    {doneSteps.length > 0 ? 'Lihat Ringkasan' : 'Rencanakan Ulang'}
                  </Text>
                </Pressable>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            session === undefined ? undefined : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="map-marker-off" size={48} color="#C4B4AB" />
                <Text style={styles.emptyTitle}>
                  {session ? 'Tidak ada tenant yang muat di rute ini' : 'Tidak ada trail yang sedang berjalan'}
                </Text>
                <Pressable style={styles.replanBtn} onPress={handleReplan} accessibilityRole="button">
                  <Text style={styles.replanBtnText}>Rencanakan Ulang</Text>
                </Pressable>
              </View>
            )
          }
        />
      </View>

      {/* Modal Dialog Konfirmasi Keluar Trail sesuai Figma #251:80538 */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardFigma}>
            <Pressable
              style={styles.modalCloseTopRight}
              onPress={() => setExitModalVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.modalFigmaTitle}>Mau Keluar dari Trail?</Text>

            <Image
              source={exitIllustration}
              style={styles.modalIllustration}
              resizeMode="contain"
            />

            <Text style={styles.modalFigmaSubtitle}>
              Kalau keluar, trailmu akan hilang
            </Text>

            <View style={styles.modalActionsCol}>
              <Pressable
                style={styles.modalBatalBtn}
                onPress={() => setExitModalVisible(false)}
              >
                <Text style={styles.modalBatalBtnText} numberOfLines={1}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalTetapKeluarBtn}
                onPress={() => {
                  setExitModalVisible(false);
                  void TrailSessionStore.end();
                  router.back();
                }}
              >
                <Text style={styles.modalTetapKeluarBtnText} numberOfLines={1}>
                  Tetap keluar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Dialog Konfirmasi Lewati Tenant */}
      <Modal
        visible={skipModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSkipModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardFigma}>
            <Pressable
              style={styles.modalCloseTopRight}
              onPress={() => setSkipModalVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>

            <View style={styles.skipModalIconContainer}>
              <Ionicons name="play-skip-forward" size={28} color="#FF8316" />
            </View>

            <Text style={styles.modalFigmaTitle}>Lewati Tenant Ini?</Text>

            <Text style={styles.modalFigmaSubtitle}>
              {poiToSkip
                ? `${poiToSkip.name} akan dilewati dan rute kuliner akan disusun ulang.`
                : 'Tenant akan dilewati dan rute kuliner akan disusun ulang.'}
            </Text>

            <View style={styles.modalActionsCol}>
              <Pressable
                style={styles.modalBatalBtn}
                onPress={() => setSkipModalVisible(false)}
              >
                <Text style={styles.modalBatalBtnText} numberOfLines={1}>
                  Batal
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalTetapKeluarBtn}
                onPress={() => void confirmSkipStep()}
              >
                <Text style={styles.modalTetapKeluarBtnText} numberOfLines={1}>
                  Ya, lewati
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
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
  finishTopBtn: {
    backgroundColor: '#FFF0DC',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFC17E',
  },
  finishTopBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FF8316',
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  pageTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    color: '#404040',
  },
  pageSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#A6A6A6',
  },
  summaryBadgesRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  summaryBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFF0DC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  summaryBadgeLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#A6A6A6',
    textAlign: 'center',
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
  },
  summaryBadgeBold: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: '#FF8316',
  },
  summaryBadgeUnit: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#FF8316',
  },
  summaryBudgetPrefix: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 20,
    color: '#FF8316',
  },
  summaryBadgePreference: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: '#FF8316',
    textAlign: 'center',
  },
  timelineListOuter: {
    flex: 1,
    backgroundColor: '#FFE0B8',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: 4,
  },
  stepContainer: {
    flexDirection: 'row',
    paddingBottom: 12,
  },
  timelineCol: {
    width: 28,
    alignItems: 'center',
    paddingTop: 16,
    position: 'relative',
  },
  timelineLineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 13,
    width: 2,
    zIndex: 1,
  },
  stepBullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FF8316',
    zIndex: 2,
  },
  stepBulletActive: {
    borderColor: '#FF8316',
    backgroundColor: '#FFFFFF',
    borderWidth: 3.5,
  },
  stepBulletDone: {
    borderColor: '#FF8316',
    backgroundColor: '#FF8316',
    borderWidth: 3.5,
  },
  stepBulletDeactivated: {
    borderColor: '#BDBDBD',
    backgroundColor: '#EEEEEE',
    borderWidth: 2.5,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFA044',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stepCardActive: {
    borderColor: '#FF8316',
  },
  stepCardDone: {
    backgroundColor: '#FFF8EF',
    borderColor: '#FFC17E',
  },
  stepCardDeactivated: {
    opacity: 0.58,
    backgroundColor: '#FAF9F8',
    borderColor: '#E2DDD8',
    shadowOpacity: 0.02,
    elevation: 0.5,
  },
  textDeactivated: {
    color: '#737373',
  },
  priceDeactivated: {
    color: '#9E8070',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbWrapper: {
    width: 97,
    height: 91,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  tenantPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DC',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#FFF0DC',
  },
  ratingText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 13,
    color: '#404040',
  },
  tenantInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  nameAndTagsCol: {
    gap: 5,
  },
  stepPoiName: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 18,
    color: '#404040',
  },
  categoryHalalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryTagText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  tagDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#A6A6A6',
  },
  halalTagText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceRangeText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 16,
    color: '#FF8316',
  },
  perPersonText: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  cardInnerDivider: {
    height: 0.5,
    backgroundColor: '#E6E6E6',
    marginVertical: 1,
  },
  distanceWalkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#A6A6A6',
  },
  walkMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  walkMinutesText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#A6A6A6',
  },
  navStepBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  navStepBtnActiveText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  nonActiveActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  skipBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  skipBtnSmallText: {
    fontFamily: fontFamily.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#8E7164',
  },
  navStepBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFF0DC',
  },
  navStepBtnSmallText: {
    fontFamily: fontFamily.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#FF8316',
  },
  deactivatedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  navStepBtnActiveFlex: {
    flex: 1,
    paddingHorizontal: 12,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0DC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  doneBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FF8316',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F3ECE7',
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#8E7164',
  },
  deactivatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3ECE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  deactivatedBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#8E7164',
  },
  allSkippedFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  allSkippedText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#8E7164',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#707070',
    textAlign: 'center',
    marginTop: 12,
  },
  replanBtn: {
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 16,
  },
  replanBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCardFigma: {
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 293,
    position: 'relative',
    gap: 12,
  },
  modalCloseTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 3,
  },
  modalFigmaTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalIllustration: {
    width: 200,
    height: 140,
  },
  skipModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalFigmaSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalActionsCol: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  modalBatalBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBatalBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#FF8316',
    textAlign: 'center',
    width: '100%',
  },
  modalTetapKeluarBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTetapKeluarBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
});
