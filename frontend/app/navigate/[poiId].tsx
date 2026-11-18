import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OsmMap } from '@/components/map/OsmMap';
import { colors, fontFamily } from '@/constants/theme';
import { TtsService } from '@/features/audio/tts';
import { useUserLocation } from '@/features/location';
import {
  computeNavigationStatus,
  computeRouteNavigationStatus,
  remainingRoute,
  shouldTriggerDistanceAudioCue,
  useCompassHeading,
  useWalkingRoute,
} from '@/features/navigation';
import { getPoiById } from '@/features/poi';
import { sanitizePoiId } from '@/lib/validation';
import { useVisitedPoiIds, VisitRepository } from '@/features/visits';
import { completeTrailStep, TrailSessionStore, useTrailSession } from '@/features/trail';
import type { LatLng } from '@/lib/geo';

export default function NavigateScreen() {
  const { poiId } = useLocalSearchParams<{ poiId: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<CameraRef | null>(null);

  const cleanPoiId = useMemo(() => sanitizePoiId(poiId), [poiId]);
  const targetPoi = useMemo(() => (cleanPoiId ? getPoiById(cleanPoiId) : undefined), [cleanPoiId]);
  const visitedPoiIds = useVisitedPoiIds();

  // Lokasi & Heading Kompas
  const { position, permission } = useUserLocation();
  const { headingDeg, isAvailable: isCompassAvailable } = useCompassHeading();

  // State audio & kedatangan
  const [hasArrivedState, setHasArrivedState] = useState(false);
  const prevDistanceRef = useRef<number | null>(null);
  const hasSpokenArrivalRef = useRef(false);

  // Animasi rotasi panah kompas
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const targetCoord = useMemo<LatLng | null>(
    () =>
      targetPoi ? { latitude: targetPoi.latitude, longitude: targetPoi.longitude } : null,
    [targetPoi],
  );

  // Rute jalan kaki mengikuti jalan (OSRM); null → fallback garis lurus.
  const { route: walkingRoute } = useWalkingRoute(position?.coordinate ?? null, targetCoord);

  // Titik polyline rute: sisa rute jalan dari posisi user, atau garis lurus jika rute belum ada.
  const routePoints = useMemo(() => {
    if (!position || !targetCoord) return [];
    if (walkingRoute) return remainingRoute(walkingRoute, position.coordinate);
    return [position.coordinate, targetCoord];
  }, [position, targetCoord, walkingRoute]);

  // Hitung status navigasi (jarak, bearing, deviasi)
  const navStatus = useMemo(() => {
    if (!position || !targetCoord) return null;
    const opts = { arrivalThresholdM: 10, targetToleranceDeg: 30 };
    if (walkingRoute) {
      return computeRouteNavigationStatus(
        position.coordinate,
        headingDeg,
        targetCoord,
        routePoints,
        opts,
      );
    }
    return computeNavigationStatus(position.coordinate, headingDeg, targetCoord, opts);
  }, [position, targetCoord, headingDeg, walkingRoute, routePoints]);

  // Efek rotasi panah kompas (menghadap ke target)
  // Deviasi = bearing - heading. Jika heading=0 dan bearing=90, deviasi = 90 (panah mengarah ke kanan)
  useEffect(() => {
    if (navStatus !== null) {
      Animated.spring(rotateAnim, {
        toValue: navStatus.deviationDeg,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
    }
  }, [navStatus?.deviationDeg, rotateAnim]);

  // Pemicu Audio Cue: setiap pengurangan 20m & audio saat tiba di tujuan (<=10m)
  useEffect(() => {
    if (!navStatus || !targetPoi) return;

    const currentDist = navStatus.distanceM;

    // 1. Cek kedatangan (AC F06-3: <= 10m)
    if (navStatus.hasArrived && !hasSpokenArrivalRef.current) {
      hasSpokenArrivalRef.current = true;
      setHasArrivedState(true);
      void TtsService.speakArrivalCue(targetPoi.name);
      // Catat kunjungan dan selesaikan step di trail session jika sedang aktif
      void VisitRepository.markVisited(targetPoi.id);
      void TrailSessionStore.update((s) => completeTrailStep(s, targetPoi.id, Date.now()));
      // Auto-redirect langsung ke halaman detail tenant
      router.replace({
        pathname: '/poi/[id]',
        params: { id: targetPoi.id, fromTrail: '1' },
      });
      return;
    }

    // 2. Cek audio cue pengurangan 20m
    if (prevDistanceRef.current !== null && !navStatus.hasArrived) {
      const shouldCue = shouldTriggerDistanceAudioCue(prevDistanceRef.current, currentDist, 20);
      if (shouldCue) {
        let dirText = 'lurus';
        if (navStatus.deviationDeg > 20) dirText = 'kanan';
        else if (navStatus.deviationDeg < -20) dirText = 'kiri';

        void TtsService.speakNavigationCue(currentDist, dirText);
      }
    }

    prevDistanceRef.current = currentDist;
  }, [navStatus, targetPoi]);

  // Center kamera ke posisi user dan target
  const handleRecenter = useCallback(() => {
    if (position && targetPoi) {
      mapRef.current?.easeTo({
        center: [position.coordinate.longitude, position.coordinate.latitude],
        zoom: 18,
        duration: 800,
      });
    }
  }, [position, targetPoi]);

  if (!targetPoi) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Tenant tujuan tidak ditemukan</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  const spin = rotateAnim.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return (
    <View style={styles.container}>
      {/* Peta Fullscreen dengan polyline garis rute */}
      <OsmMap
        mapRef={mapRef}
        userPosition={position}
        selectedPoiId={targetPoi.id}
        visitedPoiIds={visitedPoiIds}
        routePoints={routePoints}
      />

      {/* Header Bar Navigasi Mengambang */}
      <View style={[styles.topHeader, { top: insets.top + 10 }]}>
        <Pressable
          style={styles.circleBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Keluar dari mode navigasi"
        >
          <Ionicons name="arrow-back" size={22} color="#1B1B1C" />
        </Pressable>

        <Pressable
          style={styles.headerTitleBox}
          onPress={() => router.push(`/poi/${targetPoi.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Buka detail ${targetPoi.name}`}
        >
          <Text style={styles.navSubLabel}>Navigasi Menuju</Text>
          <View style={styles.headerPoiRow}>
            <Text style={styles.navPoiName} numberOfLines={1}>
              {targetPoi.name}
            </Text>
            <Ionicons name="information-circle-outline" size={16} color="#FF8316" />
          </View>
        </Pressable>

        <Pressable
          style={styles.circleBtn}
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="Pusatkan peta ke posisi saat ini"
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#FF8316" />
        </Pressable>
      </View>

      {/* Banner Sinyal GPS Lemah jika akurasi > 30m */}
      {position && position.accuracyM > 30 ? (
        <View style={[styles.gpsWarningBanner, { top: insets.top + 76 }]}>
          <Ionicons name="warning-outline" size={16} color="#BA1A1A" />
          <Text style={styles.gpsWarningText}>
            Sinyal GPS lemah (akurasi ~{Math.round(position.accuracyM)}m). Menunggu sinyal lebih presisi...
          </Text>
        </View>
      ) : null}

      {/* Modal / Card Info Navigasi Bagian Bawah */}
      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        {hasArrivedState || (navStatus && navStatus.hasArrived) ? (
          // Status Sudah Sampai (AC F06-3: <= 10m)
          <View style={styles.arrivalBox}>
            <View style={styles.arrivalIconCircle}>
              <Ionicons name="checkmark-done" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.arrivalTextBox}>
              <Text style={styles.arrivalTitle}>Kamu sudah sampai!</Text>
              <Text style={styles.arrivalSubtitle}>
                Kamu berada dalam jarak ≤10m dari {targetPoi.name}.
              </Text>
            </View>
            <Pressable
              style={styles.openPoiBtn}
              onPress={() => router.replace(`/poi/${targetPoi.id}`)}
              accessibilityRole="button"
            >
              <Text style={styles.openPoiBtnText}>Buka Detail</Text>
            </Pressable>
          </View>
        ) : (
          // Status Sedang Dipandu: Kiri (Arah Belokan/Kompas) - Tengah (ETA & Jarak) - Kanan (Tombol X)
          <View style={styles.compactNavRow}>
            {/* Kiri: Arah Panah & Panduan Arah */}
            <View style={styles.directionSection}>
              <View style={styles.directionDial}>
                <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: spin }] }]}>
                  <Ionicons
                    name="navigate"
                    size={28}
                    color={navStatus?.isOnTarget ? '#2E9E4F' : '#FF8316'}
                  />
                </Animated.View>
              </View>
              <Text style={styles.directionLabel} numberOfLines={1}>
                {!isCompassAvailable
                  ? 'Kompas N/A'
                  : navStatus?.isOnTarget
                    ? 'Arah Tepat'
                    : navStatus && navStatus.deviationDeg > 0
                      ? 'Belok Kanan'
                      : 'Belok Kiri'}
              </Text>
            </View>

            {/* Tengah: ETA Utama & Jarak Sisa Meter */}
            <View style={styles.compactCenterBlock}>
              <View style={styles.etaRow}>
                <Text style={styles.compactEtaValue}>
                  {navStatus ? Math.max(1, Math.ceil(navStatus.distanceM / 60)) : '~'}
                </Text>
                <Text style={styles.compactEtaUnit}>min</Text>
              </View>
              <Text style={styles.compactSubMeta}>
                {navStatus
                  ? navStatus.distanceM >= 1000
                    ? `${(navStatus.distanceM / 1000).toFixed(1)} km`
                    : `${navStatus.distanceM} m`
                  : '~ m'}
              </Text>
            </View>

            {/* Kanan: Tombol X Bulat untuk Selesaikan Navigasi */}
            <Pressable
              style={styles.closeCircleBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Selesaikan navigasi"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9F8',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FCF9F8',
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: '#1B1B1C',
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#FF8316',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  topHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  headerTitleBox: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  navSubLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 14,
    color: '#8E7164',
  },
  navPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 18,
    color: '#1B1B1C',
  },
  headerPoiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  gpsWarningBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFDAD6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 9,
  },
  gpsWarningText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#BA1A1A',
  },
  arrowContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 18,
    paddingHorizontal: 22,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 10,
  },
  compactNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2,
  },
  directionSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  directionDial: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF4EA',
    borderWidth: 1.5,
    borderColor: '#FFDBCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 20,
    color: '#5A4136',
    marginTop: 4,
    textAlign: 'center',
  },
  compactCenterBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  compactEtaValue: {
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 38,
    color: '#1B1B1C',
  },
  compactEtaUnit: {
    fontFamily: fontFamily.medium,
    fontSize: 18,
    lineHeight: 22,
    color: '#1B1B1C',
  },
  compactSubMeta: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 18,
    color: '#707070',
    marginTop: 2,
  },
  closeCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#A61C1C',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  arrivalBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrivalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E9E4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  arrivalTextBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  arrivalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: '#1B1B1C',
  },
  arrivalSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#5A5A5A',
    textAlign: 'center',
    marginTop: 4,
  },
  openPoiBtn: {
    backgroundColor: '#FF8316',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  openPoiBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
