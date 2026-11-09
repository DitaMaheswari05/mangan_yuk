import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OsmMap } from '@/components/map/OsmMap';
import { INITIAL_REGION } from '@/constants/map';
import { colors, fontFamily, typography } from '@/constants/theme';
import areaJson from '@/data/area.json';
import {
  haversineM,
  useUserLocation,
  type AreaStatus,
  type UserPosition,
} from '@/features/location';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { getAll, getPois } from '@/features/poi';
import { useAppStore } from '@/store/useAppStore';
import type { Poi } from '@/types/content';

type SimMode = 'gps' | 'inside' | 'outside';

function formatDistanceLabel(meters: number | null): string {
  if (meters === null) return '';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}

// F01/F03 & PB03/PB04: Beranda berisi peta OSM, titik biru + lingkaran akurasi,
// status "Di dalam / di luar area SSF", dan marker POI dari dataset.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setPermissions = useAppStore((s) => s.setPermissions);

  // State lokasi dari sensor perangkat (PB03 hook)
  const liveLocation = useUserLocation();

  // Dataset POI (PB04 repository)
  const [pois, setPois] = useState<Poi[]>(() => getPois());
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);

  // State interaksi UI sesuai Figma pb3 (Arrived Modal & Mode Jelajah)
  const [exploreMode, setExploreMode] = useState(false);
  const [arrivedModalVisible, setArrivedModalVisible] = useState(false);
  const hasShownArrivedModalRef = useRef(false);

  // Mode simulasi dev untuk memudahkan pengetesan INSIDE / OUTSIDE di emulator
  const [simMode, setSimMode] = useState<SimMode>('gps');

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

  // Hitung state efektif (live GPS vs simulasi dev jika dipilih)
  const effectiveLocation = useMemo<{
    permission: typeof liveLocation.permission;
    position: UserPosition | null;
    areaStatus: AreaStatus;
    distanceToAreaM: number | null;
  }>(() => {
    if (simMode === 'inside') {
      const pos: UserPosition = {
        coordinate: {
          latitude: areaJson.center.latitude + 0.00012,
          longitude: areaJson.center.longitude - 0.00008,
        },
        accuracyM: 14,
        timestamp: Date.now(),
      };
      return {
        permission: 'granted',
        position: pos,
        areaStatus: 'INSIDE',
        distanceToAreaM: Math.round(haversineM(pos.coordinate, areaJson.center)),
      };
    }

    if (simMode === 'outside') {
      // Simulasi posisi di Jl. Tamansari (~1.3 km dari Sudirman Street Food)
      const pos: UserPosition = {
        coordinate: {
          latitude: -6.9102,
          longitude: 107.6055,
        },
        accuracyM: 18,
        timestamp: Date.now(),
      };
      return {
        permission: 'granted',
        position: pos,
        areaStatus: 'OUTSIDE',
        distanceToAreaM: Math.round(haversineM(pos.coordinate, areaJson.center)),
      };
    }

    return {
      permission: liveLocation.permission,
      position: liveLocation.position,
      areaStatus: liveLocation.areaStatus,
      distanceToAreaM: liveLocation.distanceToAreaM,
    };
  }, [liveLocation, simMode]);

  const { permission, position, areaStatus, distanceToAreaM } = effectiveLocation;

  // Tampilkan modal sambutan saat pengguna masuk ke area SSF pertama kali (Figma Explore/Arrived)
  useEffect(() => {
    if (areaStatus === 'INSIDE' && !hasShownArrivedModalRef.current) {
      hasShownArrivedModalRef.current = true;
      setArrivedModalVisible(true);
    } else if (areaStatus === 'OUTSIDE') {
      hasShownArrivedModalRef.current = false;
      setArrivedModalVisible(false);
      setExploreMode(false);
    }
  }, [areaStatus]);

  // Cari POI terdekat dari posisi pengguna
  const nearestPoiInfo = useMemo(() => {
    if (!position || pois.length === 0) return null;
    let bestPoi = pois[0];
    let bestDist = haversineM(position.coordinate, {
      latitude: bestPoi.latitude,
      longitude: bestPoi.longitude,
    });

    for (let i = 1; i < pois.length; i++) {
      const d = haversineM(position.coordinate, {
        latitude: pois[i].latitude,
        longitude: pois[i].longitude,
      });
      if (d < bestDist) {
        bestDist = d;
        bestPoi = pois[i];
      }
    }

    return { poi: bestPoi, distanceM: Math.round(bestDist) };
  }, [position, pois]);

  const handleRecenterMap = () => {
    const target = position?.coordinate ?? areaJson.center;
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.0025,
        longitudeDelta: 0.0025,
      },
      450,
    );
  };

  const handleFocusSsfArea = () => {
    mapRef.current?.animateToRegion(INITIAL_REGION, 500);
  };

  const handleEnableLocation = async () => {
    const res = await PermissionService.requestLocationForeground();
    if (res.ok && res.data === 'granted') {
      await AppStateRepository.savePermissions({ locationForeground: 'granted' });
      setPermissions({ locationForeground: 'granted' });
    } else {
      await PermissionService.openAppSettings();
    }
  };

  const handleBackToOnboarding = async () => {
    await AppStateRepository.resetOnboarding();
    setOnboarded(false);
    setOnboardingStep('intro');
    router.replace('/onboarding/welcome');
  };

  const handleActivateExploreMode = () => {
    setArrivedModalVisible(false);
    setExploreMode(true);
    if (nearestPoiInfo) {
      setSelectedPoi(nearestPoiInfo.poi);
    }
    handleFocusSsfArea();
  };

  // Teks status area & lokasi di header atas (mengikuti kontrak PB03 + Figma)
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
      if (exploreMode) {
        const activePoi = selectedPoi ?? nearestPoiInfo?.poi;
        const activeDist =
          activePoi && position
            ? Math.round(
                haversineM(position.coordinate, {
                  latitude: activePoi.latitude,
                  longitude: activePoi.longitude,
                }),
              )
            : nearestPoiInfo?.distanceM ?? 0;

        return (
          <>
            <View style={styles.locationTextCol}>
              <Text style={styles.locationLabel}>Mode Jelajah Aktif · Di dalam area SSF</Text>
              <Text style={styles.locationValueAccent} numberOfLines={1}>
                {activePoi ? `${activePoi.name} (~${activeDist}m)` : 'Jl. Sudirman'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setExploreMode(false);
                setSelectedPoi(null);
              }}
              style={styles.closeExploreButton}
              accessibilityRole="button"
              accessibilityLabel="Tutup Mode Jelajah"
            >
              <Ionicons name="close" size={22} color="#1E1E1E" />
            </Pressable>
          </>
        );
      }

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
            <Text style={styles.locationLabel}>Lokasimu · Di luar area SSF</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              Di luar area{distText ? ` · ${distText}` : ''}
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

    // areaStatus === 'UNKNOWN' (menunggu fix pertama atau akurasi > 30m)
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

  const selectedPoiDistanceM = useMemo(() => {
    if (!selectedPoi || !position) return null;
    return Math.round(
      haversineM(position.coordinate, {
        latitude: selectedPoi.latitude,
        longitude: selectedPoi.longitude,
      }),
    );
  }, [selectedPoi, position]);

  return (
    <View style={styles.container}>
      {/* Peta OSM + Batas Kawasan + Marker POI Dataset + Titik Biru & Lingkaran Akurasi */}
      <OsmMap
        mapRef={mapRef}
        pois={pois}
        userPosition={permission === 'granted' ? position : null}
        selectedPoiId={selectedPoi?.id ?? null}
        onSelectPoi={(poi) => setSelectedPoi(poi)}
        onMapPress={() => setSelectedPoi(null)}
      />

      {/* Header Kartu Atas (Sesuai Desain Figma pb3) */}
      <View style={[styles.topHeaderCard, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topHeaderContent}>
          {/* Baris 1: Ikon GPS + Info Lokasi + Status Di Dalam / Di Luar Area SSF */}
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

      {/* Bar Kontrol Simulasi & Info Jumlah POI (memudahkan demo di emulator) */}
      <View style={[styles.floatingChipsRow, { top: insets.top + 146 }]}>
        <Pressable style={styles.poiCountChip} onPress={handleFocusSsfArea}>
          <MaterialCommunityIcons name="storefront-outline" size={14} color="#FF8316" />
          <Text style={styles.poiCountChipText}>{pois.length} POI Aktif</Text>
        </Pressable>

        <View style={styles.simPillGroup}>
          <Pressable
            onPress={() => setSimMode('gps')}
            style={[styles.simPill, simMode === 'gps' && styles.simPillActive]}
          >
            <Text style={[styles.simPillText, simMode === 'gps' && styles.simPillTextActive]}>
              GPS
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSimMode('inside')}
            style={[styles.simPill, simMode === 'inside' && styles.simPillActive]}
          >
            <Text
              style={[styles.simPillText, simMode === 'inside' && styles.simPillTextActive]}
            >
              Dalam SSF
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSimMode('outside')}
            style={[styles.simPill, simMode === 'outside' && styles.simPillActive]}
          >
            <Text
              style={[styles.simPillText, simMode === 'outside' && styles.simPillTextActive]}
            >
              Luar SSF
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.resetOnboardingChip} onPress={handleBackToOnboarding}>
          <Ionicons name="refresh" size={12} color="#5A4136" />
          <Text style={styles.resetOnboardingChipText}>Onboarding</Text>
        </Pressable>
      </View>

      {/* Area Bawah: Banner Status / Kartu POI / Tombol Mode Jelajah */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {/* 1. Kartu Preview POI ketika salah satu marker POI diklik (Figma Explore Trigger/Card) */}
        {selectedPoi ? (
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

        {/* 2. Banner Mode Tanpa Lokasi jika permission !== 'granted' (PB03 home_ui_rules) */}
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
            <View style={styles.outsideMascotBadge}>
              <MaterialCommunityIcons name="map-marker-distance" size={38} color="#FFFFFF" />
            </View>
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
          <Pressable style={styles.exploreModeFab} onPress={handleActivateExploreMode}>
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

            <View style={styles.arrivedIllustrationWrap}>
              <MaterialCommunityIcons name="food-fork-drink" size={64} color="#FFFFFF" />
            </View>

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
    shadowColor: '#000000',
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
  distanceRightCol: {
    maxWidth: 126,
    alignItems: 'flex-end',
  },
  distanceRightText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#FF8316',
    textAlign: 'right',
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
    backgroundColor: '#F5F5F5',
  },
  statusBadgeTextNeutral: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  closeExploreButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 45,
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
  floatingChipsRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  poiCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  poiCountChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#1E1E1E',
  },
  simPillGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 999,
    padding: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  simPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  simPillActive: {
    backgroundColor: '#FF8316',
  },
  simPillText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#5A4136',
  },
  simPillTextActive: {
    color: '#FFFFFF',
  },
  resetOnboardingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  resetOnboardingChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#5A4136',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 106,
    alignItems: 'center',
  },
  outsideBannerCard: {
    width: '100%',
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  outsideMascotBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outsideContentCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 10,
  },
  outsideBannerText: {
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
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
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
    width: 164,
    height: 48,
    borderRadius: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  exploreModeFabText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  poiPreviewCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
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
    gap: 12,
  },
  poiPreviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4EA',
    borderWidth: 1,
    borderColor: '#FFC69D',
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
    color: '#666666',
  },
  poiPreviewDistance: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
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
    paddingVertical: 24,
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
  },
  arrivedIllustrationWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
