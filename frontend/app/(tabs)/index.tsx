import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OsmMap } from '@/components/map/OsmMap';
import { INITIAL_CAMERA, RECENTER_ZOOM } from '@/constants/map';
import { colors, fontFamily, typography } from '@/constants/theme';
import areaJson from '@/data/area.json';
import { ExploreModeController, getNearbyPoisSorted } from '@/features/geofence';
import { haversineM, useUserLocation } from '@/features/location';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { getAll, getPois } from '@/features/poi';
import { useAppStore } from '@/store/useAppStore';
import type { Poi } from '@/types/content';

function formatDistanceLabel(meters: number | null): string {
  if (meters === null) return '';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<CameraRef | null>(null);

  const setPermissions = useAppStore((s) => s.setPermissions);

  // State lokasi pengguna (saat ini di-set ke Sudirman Street Food untuk testing dev)
  const { permission, position, areaStatus, distanceToAreaM } = useUserLocation();

  // Dataset POI (PB04 repository)
  const [pois, setPois] = useState<Poi[]>(() => getPois());
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);

  // State Mode Jelajah & Modal Sambutan (Figma Section pb3 #174:80571)
  const [exploreMode, setExploreMode] = useState(false);
  const [persistentNotifActive, setPersistentNotifActive] = useState(false);
  const [arrivedModalVisible, setArrivedModalVisible] = useState(false);
  const [poiSheetExpanded, setPoiSheetExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const hasShownArrivedModalRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getAll();
      if (active && res.ok) {
        setPois(res.data);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Daftar POI terdekat yang diurutkan berdasarkan jarak dari posisi pengguna
  const nearbyPois = useMemo(() => {
    if (!position || pois.length === 0) return [];
    return getNearbyPoisSorted(position.coordinate, pois, 6);
  }, [position, pois]);

  const nearestPoiInfo = nearbyPois[0] ?? null;

  // Hentikan pelacakan & hapus notifikasi permanen ketika komponen unmount
  useEffect(() => {
    return () => {
      void ExploreModeController.stop();
    };
  }, []);

  // Tampilkan modal sambutan saat pertama kali berada di dalam area SSF
  useEffect(() => {
    if (areaStatus === 'INSIDE' && !hasShownArrivedModalRef.current) {
      hasShownArrivedModalRef.current = true;
      setArrivedModalVisible(true);
    } else if (areaStatus === 'OUTSIDE') {
      hasShownArrivedModalRef.current = false;
      setArrivedModalVisible(false);
      if (exploreMode) {
        setExploreMode(false);
        setPersistentNotifActive(false);
        setSelectedPoi(null);
        void ExploreModeController.stop();
      }
    }
  }, [areaStatus, exploreMode]);

  const handleRecenterMap = useCallback(() => {
    const target = position?.coordinate ?? areaJson.center;
    mapRef.current?.easeTo({
      center: [target.longitude, target.latitude],
      zoom: RECENTER_ZOOM,
      duration: 450,
    });
  }, [position]);

  const handleFocusSsfArea = useCallback(() => {
    mapRef.current?.easeTo({ ...INITIAL_CAMERA, duration: 500 });
  }, []);

  const handleEnableLocation = async () => {
    const res = await PermissionService.requestLocationForeground();
    if (res.ok && res.data === 'granted') {
      await AppStateRepository.savePermissions({ locationForeground: 'granted' });
      setPermissions({ locationForeground: 'granted' });
    } else {
      await PermissionService.openAppSettings();
    }
  };

  /**
   * Mengaktifkan Mode Jelajah:
   * - Memulai pelacakan lokasi Mode Jelajah
   * - Menampilkan notifikasi permanen "Mode Jelajah Aktif"
   * - Mengubah tampilan ke Mode Jelajah sesuai Figma #174:43799
   */
  const handleActivateExploreMode = useCallback(async () => {
    setArrivedModalVisible(false);
    setExploreMode(true);
    setPersistentNotifActive(true);
    setSelectedPoi(null);
    setPoiSheetExpanded(false);

    handleRecenterMap();

    await ExploreModeController.start({
      initialPosition: position,
      pois,
      onEnterPoiGeofence: (poi) => {
        setSelectedPoi((prev) => prev ?? poi);
      },
    });
  }, [handleRecenterMap, pois, position]);

  /**
   * Mematikan Mode Jelajah:
   * - Menghentikan pelacakan lokasi Mode Jelajah
   * - Menghapus notifikasi permanen dari perangkat
   * - Mengembalikan UI Beranda ke mode standar
   */
  const handleDeactivateExploreMode = useCallback(async () => {
    setExploreMode(false);
    setPersistentNotifActive(false);
    setSelectedPoi(null);
    setPoiSheetExpanded(false);
    setIsPlayingAudio(false);

    await ExploreModeController.stop();
  }, []);

  const selectedPoiDistanceM = useMemo(() => {
    if (!selectedPoi || !position) return null;
    return Math.round(
      haversineM(position.coordinate, {
        latitude: selectedPoi.latitude,
        longitude: selectedPoi.longitude,
      }),
    );
  }, [selectedPoi, position]);

  // Teks status area & lokasi di header atas (mengikuti Figma pb3 #174:80571)
  const renderLocationHeaderContent = () => {
    if (permission !== 'granted') {
      return (
        <>
          <View style={styles.locationTextCol}>
            <Text style={styles.locationLabel}>Lokasimu</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              Izin lokasi tidak aktif
            </Text>
          </View>
          <View style={[styles.statusBadge, styles.statusBadgeNeutral]}>
            <Text style={styles.statusBadgeTextNeutral}>Tanpa Lokasi</Text>
          </View>
        </>
      );
    }

    if (areaStatus === 'INSIDE') {
      // State Mode Jelajah Aktif (Figma Frame #174:43799 / #174:43413 / #174:43619)
      if (exploreMode) {
        const activePoi = selectedPoi;
        const activeDist = selectedPoiDistanceM ?? nearestPoiInfo?.distanceM ?? 0;

        return (
          <>
            <View style={styles.locationTextCol}>
              <Text style={styles.locationLabel}>Mode Jelajah Aktif</Text>
              <Text style={styles.locationValueAccent} numberOfLines={1}>
                {activePoi ? `${activePoi.name} (~${activeDist}m)` : 'Jln. Sudirman'}
              </Text>
            </View>
            <Pressable
              onPress={handleDeactivateExploreMode}
              style={styles.closeExploreButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Matikan Mode Jelajah"
            >
              <Ionicons name="close" size={24} color="#1E1E1E" />
            </Pressable>
          </>
        );
      }

      // State Di Dalam Area SSF, Mode Jelajah Belum Aktif (Figma Frame #174:43354)
      return (
        <>
          <View style={styles.locationTextCol}>
            <Text style={styles.locationLabel}>Lokasimu</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              Jl. Sudirman
            </Text>
          </View>
          <View style={[styles.statusBadge, styles.statusBadgeInside]}>
            <View style={styles.statusDotInside} />
            <Text style={styles.statusBadgeTextInside}>Di dalam area SSF</Text>
          </View>
        </>
      );
    }

    if (areaStatus === 'OUTSIDE') {
      const distText = formatDistanceLabel(distanceToAreaM);
      return (
        <>
          <View style={styles.locationTextCol}>
            <Text style={styles.locationLabel}>Lokasimu</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              Jl. Tamansari
            </Text>
          </View>
          <View style={styles.distanceRightCol}>
            <Text style={styles.distanceRightText}>
              {distText ? `${distText} ke ` : 'Menuju '}Sudirman Street Food
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        <View style={styles.locationTextCol}>
          <Text style={styles.locationLabel}>Lokasimu</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {position
              ? `Akurasi GPS ±${Math.round(position.accuracyM)}m`
              : 'Mencari posisi GPS...'}
          </Text>
        </View>
        <View style={[styles.statusBadge, styles.statusBadgeNeutral]}>
          <Text style={styles.statusBadgeTextNeutral}>Memuat status SSF</Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Peta OSM + Batas Kawasan + Marker POI Dataset + Titik Pengguna & Radar Mode Jelajah */}
      <OsmMap
        mapRef={mapRef}
        pois={pois}
        userPosition={permission === 'granted' ? position : null}
        selectedPoiId={selectedPoi?.id ?? null}
        exploreMode={exploreMode}
        onSelectPoi={(poi) => {
          setSelectedPoi(poi);
          setPoiSheetExpanded(false);
        }}
        onMapPress={() => {
          setSelectedPoi(null);
          setPoiSheetExpanded(false);
        }}
      />

      {/* Header Kartu Atas (Sesuai Desain Figma pb3) */}
      <View style={[styles.topHeaderCard, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topHeaderContent}>
          {/* Baris 1: Ikon GPS + Info Lokasi / Mode Jelajah Aktif + Tombol Matikan */}
          <View style={styles.locationRow}>
            <Pressable
              onPress={handleRecenterMap}
              style={styles.gpsIconButton}
              accessibilityRole="button"
              accessibilityLabel="Pusatkan ke lokasi saya"
            >
              <Ionicons name="locate" size={18} color="#FF8316" />
            </Pressable>

            {renderLocationHeaderContent()}
          </View>

          {/* Baris 2: Search Bar + Tombol Filter */}
          <View style={styles.searchBarRow}>
            <Pressable
              style={styles.searchBarInput}
              onPress={() => router.push('/(tabs)/search')}
              accessibilityRole="search"
            >
              <Ionicons name="search-outline" size={18} color="#666666" />
              <Text style={styles.searchPlaceholder}>Cari tenant atau menu</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/search')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Filter tenant"
            >
              <Ionicons name="options-outline" size={21} color="#1E1E1E" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Indikator Notifikasi Permanen saat Mode Jelajah Aktif */}
      {exploreMode && persistentNotifActive ? (
        <View style={[styles.persistentNotifBanner, { top: insets.top + 138 }]}>
          <View style={styles.persistentNotifLeft}>
            <View style={styles.persistentPulseDot} />
            <View style={styles.persistentNotifTextCol}>
              <Text style={styles.persistentNotifTitle} numberOfLines={1}>
                Notifikasi Permanen · Mode Jelajah Aktif
              </Text>
              <Text style={styles.persistentNotifSubtitle} numberOfLines={1}>
                {nearestPoiInfo
                  ? `Dekat ${nearestPoiInfo.poi.name} (~${nearestPoiInfo.distanceM}m)`
                  : 'Melacak posisi & kuliner terdekat di SSF'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.persistentStopChip}
            onPress={handleDeactivateExploreMode}
            accessibilityRole="button"
            accessibilityLabel="Matikan Mode Jelajah dan hapus notifikasi"
          >
            <Text style={styles.persistentStopChipText}>Matikan</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Area Bawah: Tombol Mode Jelajah / Carousel Trigger POI / Bottom Sheet POI */}
      <View
        style={[
          styles.bottomOverlay,
          exploreMode && selectedPoi ? styles.bottomOverlaySheet : null,
        ]}
        pointerEvents="box-none"
      >
        {/* 1A. Saat Mode Jelajah AKTIF & POI dipilih → Bottom Sheet "Kamu Lagi di {POI}!" (Figma #174:43619 & #174:43413) */}
        {exploreMode && selectedPoi ? (
          <View style={styles.explorePoiSheet}>
            <Pressable
              style={styles.sheetDragHandleArea}
              onPress={() => setPoiSheetExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                poiSheetExpanded ? 'Ciutkan kartu POI' : 'Perluas kartu POI'
              }
            >
              <View style={styles.sheetDragHandle} />
            </Pressable>

            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetTitleCol}>
                <Text style={styles.sheetHeadingText} numberOfLines={1}>
                  Kamu Lagi di{' '}
                  <Text style={styles.sheetHeadingBold}>{selectedPoi.name}</Text>!
                </Text>
                <Text style={styles.sheetCategoryText} numberOfLines={1}>
                  Kategori: {selectedPoi.categoryLabel}
                </Text>
              </View>

              <View style={styles.sheetRightHeaderGroup}>
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={14} color="#FFCC24" />
                  <Text style={styles.ratingPillText}>4.5</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setSelectedPoi(null);
                    setPoiSheetExpanded(false);
                  }}
                  hitSlop={8}
                  style={styles.sheetCloseIcon}
                >
                  <Ionicons name="close" size={20} color="#707070" />
                </Pressable>
              </View>
            </View>

            {/* Audio Player Bar (Figma #174:43668 / #174:43478) */}
            <View style={styles.audioPlayerBar}>
              <Pressable
                onPress={() => setIsPlayingAudio((p) => !p)}
                style={styles.audioPlayBtn}
                accessibilityRole="button"
                accessibilityLabel={isPlayingAudio ? 'Jeda cerita audio' : 'Putar cerita audio'}
              >
                <Ionicons
                  name={isPlayingAudio ? 'pause-circle' : 'play-circle'}
                  size={36}
                  color="#FF8316"
                />
              </Pressable>
              <View style={styles.audioTrackBg}>
                <View
                  style={[
                    styles.audioTrackFill,
                    { width: isPlayingAudio ? '55%' : '32%' },
                  ]}
                />
              </View>
              <Text style={styles.audioDurationText}>1:00</Text>
            </View>

            {/* Konten Expanded sesuai Figma "Kartu POI Aktif" (#174:43413) */}
            {poiSheetExpanded ? (
              <View style={styles.sheetExpandedContent}>
                <Text style={styles.sheetStoryText}>
                  {selectedPoi.culturalStory ||
                    selectedPoi.description ||
                    `Temukan cita rasa khas dari ${selectedPoi.name} (${selectedPoi.categoryLabel}) yang menjadi salah satu kuliner favorit di kawasan Sudirman Street Food!`}
                </Text>

                {selectedPoi.menu && selectedPoi.menu.length > 0 ? (
                  <View style={styles.sheetMenuSection}>
                    <Text style={styles.sheetMenuHeading}>Menu</Text>
                    <View style={styles.sheetMenuRow}>
                      {selectedPoi.menu.slice(0, 3).map((item) => (
                        <View key={item.id} style={styles.sheetMenuCard}>
                          <View style={styles.sheetMenuThumb}>
                            <MaterialCommunityIcons
                              name="food"
                              size={24}
                              color="#FF8316"
                            />
                          </View>
                          <Text style={styles.sheetMenuItemName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.sheetMenuItemPrice}>
                            {formatRupiah(item.priceIdr)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.poiPreviewActions}>
                  <Pressable
                    style={styles.poiSecondaryButton}
                    onPress={() => router.push(`/poi/${selectedPoi.id}`)}
                  >
                    <Text style={styles.poiSecondaryButtonText}>Lihat Detail</Text>
                  </Pressable>
                  <Pressable
                    style={styles.poiPrimaryButton}
                    onPress={() => router.push(`/navigate/${selectedPoi.id}`)}
                  >
                    <Text style={styles.poiPrimaryButtonText}>Navigasi</Text>
                    <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.sheetCollapsedFooter}>
                <Pressable
                  style={styles.sheetExpandHintBtn}
                  onPress={() => setPoiSheetExpanded(true)}
                >
                  <Text style={styles.sheetExpandHintText}>
                    Lihat cerita & menu lengkap
                  </Text>
                  <Ionicons name="chevron-up" size={16} color="#FF8316" />
                </Pressable>
                <Pressable
                  style={styles.sheetQuickNavBtn}
                  onPress={() => router.push(`/navigate/${selectedPoi.id}`)}
                >
                  <Text style={styles.sheetQuickNavBtnText}>Navigasi</Text>
                  <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {/* 1B. Saat Mode Jelajah AKTIF & belum ada POI tunggal dibuka → Carousel Kartu Trigger POI (Figma #174:43799) */}
        {exploreMode && !selectedPoi && nearbyPois.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.triggerCarouselContent}
            style={styles.triggerCarouselScroll}
          >
            {nearbyPois.map(({ poi, distanceM }) => (
              <Pressable
                key={poi.id}
                style={styles.triggerPoiCard}
                onPress={() => {
                  setSelectedPoi(poi);
                  setPoiSheetExpanded(false);
                }}
              >
                <View style={styles.triggerPoiImagePlaceholder}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={40}
                    color="#FF8316"
                  />
                  <View style={styles.triggerRatingBadge}>
                    <Ionicons name="star" size={12} color="#FFCC24" />
                    <Text style={styles.triggerRatingText}>4.5</Text>
                  </View>
                </View>

                <View style={styles.triggerPoiInfoRow}>
                  <View style={styles.triggerPoiTextCol}>
                    <Text style={styles.triggerPoiName} numberOfLines={1}>
                      {poi.name}
                    </Text>
                    <Text style={styles.triggerPoiCategory} numberOfLines={1}>
                      {poi.categoryLabel}
                    </Text>
                  </View>
                  <Text style={styles.triggerPoiDistance}>~{distanceM}m</Text>
                </View>

                <Pressable
                  style={styles.triggerNavButton}
                  onPress={() => router.push(`/navigate/${poi.id}`)}
                >
                  <Text style={styles.triggerNavButtonText}>Navigasi</Text>
                  <Ionicons name="paper-plane-outline" size={15} color="#FFFFFF" />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* 1C. Kartu Preview POI ketika Mode Jelajah OFF tapi salah satu marker POI diklik */}
        {!exploreMode && selectedPoi ? (
          <View style={styles.poiPreviewCard}>
            <View style={styles.poiPreviewHeader}>
              <View style={styles.poiPreviewIconWrap}>
                <MaterialCommunityIcons name="storefront" size={24} color="#FF8316" />
              </View>
              <View style={styles.poiPreviewTitleCol}>
                <Text style={styles.poiPreviewTitle} numberOfLines={1}>
                  {selectedPoi.name}
                </Text>
                <Text style={styles.poiPreviewCategory} numberOfLines={1}>
                  Kategori: {selectedPoi.categoryLabel}
                </Text>
              </View>
              {selectedPoiDistanceM !== null ? (
                <Text style={styles.poiPreviewDistance}>~{selectedPoiDistanceM}m</Text>
              ) : null}
              <Pressable
                onPress={() => setSelectedPoi(null)}
                hitSlop={8}
                style={styles.poiPreviewClose}
              >
                <Ionicons name="close" size={18} color="#707070" />
              </Pressable>
            </View>

            <View style={styles.poiPreviewActions}>
              <Pressable
                style={styles.poiSecondaryButton}
                onPress={() => router.push(`/poi/${selectedPoi.id}`)}
              >
                <Text style={styles.poiSecondaryButtonText}>Lihat Detail</Text>
              </Pressable>
              <Pressable
                style={styles.poiPrimaryButton}
                onPress={() => router.push(`/navigate/${selectedPoi.id}`)}
              >
                <Text style={styles.poiPrimaryButtonText}>Navigasi</Text>
                <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 2. Banner Mode Tanpa Lokasi jika permission !== 'granted' */}
        {!selectedPoi && permission !== 'granted' ? (
          <View style={styles.noLocationBanner}>
            <View style={styles.noLocationTextCol}>
              <Text style={styles.noLocationTitle}>Mode Tanpa Lokasi</Text>
              <Text style={styles.noLocationBody}>
                Aktifkan izin lokasi untuk melihat titik biru posisimu dan status area Sudirman
                Street Food.
              </Text>
            </View>
            <Pressable style={styles.outsideCtaButton} onPress={handleEnableLocation}>
              <Text style={styles.outsideCtaButtonText}>Aktifkan Lokasi</Text>
              <Ionicons name="location-outline" size={16} color="#FF8316" />
            </Pressable>
          </View>
        ) : null}

        {/* 3. Kartu Oranye saat berada di LUAR area SSF (Figma Frame "Explore" #174:43274) */}
        {!selectedPoi && permission === 'granted' && areaStatus === 'OUTSIDE' ? (
          <View style={styles.outsideBannerCard}>
            <Image
              source={require('@/../assets/images/illustration-location.png')}
              style={styles.outsideIllustration}
              resizeMode="contain"
            />
            <View style={styles.outsideContentCol}>
              <Text style={styles.outsideBannerText}>
                Kamu belum berada di{' '}
                <Text style={styles.outsideBannerTextBold}>Sudirman Street Food</Text>. Yuk,
                kunjungi lokasinya untuk mulai menjelajah!
              </Text>
              <Pressable style={styles.outsideCtaButton} onPress={handleFocusSsfArea}>
                <Text style={styles.outsideCtaButtonText}>Mulai Navigasi</Text>
                <Ionicons name="paper-plane-outline" size={16} color="#FF8316" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 4. Tombol Floating "Mode Jelajah" saat di DALAM area SSF (Figma Frame #174:43354) */}
        {!selectedPoi &&
        permission === 'granted' &&
        areaStatus === 'INSIDE' &&
        !exploreMode ? (
          <Pressable
            style={styles.exploreModeFab}
            onPress={handleActivateExploreMode}
            accessibilityRole="button"
            accessibilityLabel="Aktifkan Mode Jelajah"
          >
            <Text style={styles.exploreModeFabText}>Mode Jelajah</Text>
            <Ionicons name="locate" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      {/* Modal Sambutan Saat Tiba di Area SSF (Figma Frame "Explore/Arrived" #174:43344) */}
      <Modal
        visible={arrivedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setArrivedModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.arrivedModalCard}>
            <Pressable
              style={styles.arrivedModalClose}
              onPress={() => setArrivedModalVisible(false)}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>

            <Image
              source={require('@/../assets/images/illustration-welcome.png')}
              style={styles.arrivedIllustrationImage}
              resizeMode="contain"
            />

            <Text style={styles.arrivedModalText}>
              Hore! Kamu sudah sampai di Sudirman Street Food. Aktifkan{' '}
              <Text style={styles.arrivedModalTextBold}>mode jelajah</Text> untuk pengalaman
              yang lebih intuitif.
            </Text>

            <Pressable style={styles.arrivedModalButton} onPress={handleActivateExploreMode}>
              <Text style={styles.arrivedModalButtonText}>Aktifkan Mode Jelajah</Text>
              <Ionicons name="locate" size={18} color="#FF8316" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeaderCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 16,
    paddingBottom: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  topHeaderContent: {
    gap: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
  },
  gpsIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextCol: {
    flex: 1,
    gap: 2,
  },
  locationLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  locationValue: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: '#1E1E1E',
  },
  locationValueAccent: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: '#FF8316',
  },
  closeExploreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeInside: {
    backgroundColor: '#FFF4EA',
    borderWidth: 1,
    borderColor: '#FFC69D',
  },
  statusDotInside: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF8316',
  },
  statusBadgeTextInside: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#FF8316',
  },
  statusBadgeNeutral: {
    backgroundColor: '#F0EDED',
  },
  statusBadgeTextNeutral: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4136',
  },
  distanceRightCol: {
    maxWidth: 124,
    alignItems: 'flex-end',
  },
  distanceRightText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#FF8316',
    textAlign: 'right',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    gap: 12,
  },
  searchBarInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: '100%',
  },
  searchPlaceholder: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },
  persistentNotifBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#303030',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  persistentNotifLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  persistentPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF8316',
  },
  persistentNotifTextCol: {
    flex: 1,
    gap: 1,
  },
  persistentNotifTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
  },
  persistentNotifSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
    color: '#E5E2E1',
  },
  persistentStopChip: {
    backgroundColor: '#FF8316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  persistentStopChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 106,
    alignItems: 'center',
  },
  bottomOverlaySheet: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  outsideBannerCard: {
    width: '100%',
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  outsideIllustration: {
    position: 'absolute',
    left: -14,
    bottom: -6,
    width: 133,
    height: 147,
  },
  outsideContentCol: {
    width: 216,
    maxWidth: '68%',
    alignItems: 'flex-end',
    gap: 10,
  },
  outsideBannerText: {
    width: '100%',
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  outsideBannerTextBold: {
    fontFamily: fontFamily.semibold,
  },
  outsideCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  outsideCtaButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#FF8316',
  },
  noLocationBanner: {
    width: '100%',
    backgroundColor: '#303030',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 5,
  },
  noLocationTextCol: {
    flex: 1,
    gap: 2,
  },
  noLocationTitle: {
    ...typography.textSmSemibold,
    color: '#FFFFFF',
  },
  noLocationBody: {
    ...typography.textXsRegular,
    color: '#E5E2E1',
  },
  exploreModeFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    width: 160,
    height: 48,
    borderRadius: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  exploreModeFabText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  triggerCarouselScroll: {
    width: '100%',
  },
  triggerCarouselContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 14,
    alignItems: 'center',
  },
  triggerPoiCard: {
    width: 189,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 6,
    gap: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  triggerPoiImagePlaceholder: {
    width: '100%',
    height: 118,
    borderRadius: 14,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  triggerRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 100,
  },
  triggerRatingText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#1E1E1E',
  },
  triggerPoiInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 6,
  },
  triggerPoiTextCol: {
    flex: 1,
    gap: 2,
  },
  triggerPoiName: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: '#1E1E1E',
  },
  triggerPoiCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  triggerPoiDistance: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  triggerNavButton: {
    width: '100%',
    height: 40,
    borderRadius: 30,
    backgroundColor: '#FF8316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  triggerNavButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: '#FFFFFF',
  },
  explorePoiSheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 112,
    gap: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  sheetDragHandleArea: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetDragHandle: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFC999',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitleCol: {
    flex: 1,
    gap: 2,
  },
  sheetHeadingText: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 26,
    color: '#FF8316',
  },
  sheetHeadingBold: {
    fontFamily: fontFamily.semibold,
    color: '#FF8316',
  },
  sheetCategoryText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#666666',
  },
  sheetRightHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8EC',
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 100,
  },
  ratingPillText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#404040',
  },
  sheetCloseIcon: {
    padding: 2,
  },
  audioPlayerBar: {
    height: 58,
    borderRadius: 12,
    backgroundColor: '#FFF4EA',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioPlayBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTrackBg: {
    flex: 1,
    height: 6,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  audioTrackFill: {
    height: '100%',
    borderRadius: 100,
    backgroundColor: '#FF8316',
  },
  audioDurationText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FF8316',
  },
  sheetCollapsedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetExpandHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  sheetExpandHintText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#FF8316',
  },
  sheetQuickNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sheetQuickNavBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  sheetExpandedContent: {
    gap: 14,
  },
  sheetStoryText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
  },
  sheetMenuSection: {
    gap: 8,
  },
  sheetMenuHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: '#FF8316',
  },
  sheetMenuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sheetMenuCard: {
    flex: 1,
    backgroundColor: '#FCF9F8',
    borderRadius: 10,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },
  sheetMenuThumb: {
    height: 54,
    borderRadius: 8,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetMenuItemName: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    color: '#1E1E1E',
  },
  sheetMenuItemPrice: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#FF8316',
  },
  poiPreviewCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  poiPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  poiPreviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiPreviewTitleCol: {
    flex: 1,
    gap: 2,
  },
  poiPreviewTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#1E1E1E',
  },
  poiPreviewCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  poiPreviewDistance: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#FF8316',
  },
  poiPreviewClose: {
    padding: 4,
  },
  poiPreviewActions: {
    flexDirection: 'row',
    gap: 10,
  },
  poiSecondaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF8316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiSecondaryButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#FF8316',
  },
  poiPrimaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  poiPrimaryButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  arrivedModalCard: {
    width: 293,
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 16,
    elevation: 8,
  },
  arrivedModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  arrivedIllustrationImage: {
    width: 227,
    height: 165,
    marginTop: 8,
  },
  arrivedModalText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  arrivedModalTextBold: {
    fontFamily: fontFamily.semibold,
  },
  arrivedModalButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  arrivedModalButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: '#FF8316',
  },
});
