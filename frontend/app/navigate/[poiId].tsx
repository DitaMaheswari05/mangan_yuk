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

  // Format estimasi waktu sesuai Figma (misal "1j 30mnt" atau "10 mnt")
  const etaFormatted = useMemo(() => {
    if (!navStatus) return '~ mnt';
    const totalMinutes = Math.max(1, Math.ceil(navStatus.distanceM / 60)); // asumsi ~60m/menit jalan kaki santai
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return mins > 0 ? `${hours}j ${mins}mnt` : `${hours}j`;
    }
    return `${totalMinutes} mnt`;
  }, [navStatus]);

  // Format jarak (misal "4.9 km" atau "250 m")
  const distanceFormatted = useMemo(() => {
    if (!navStatus) return '~';
    if (navStatus.distanceM >= 1000) {
      return `${(navStatus.distanceM / 1000).toFixed(1)} km`;
    }
    return `${navStatus.distanceM} m`;
  }, [navStatus]);

  // Teks instruksi manuver berikutnya
  const maneuverText = useMemo(() => {
    if (!navStatus) return 'lurus';
    if (navStatus.isOnTarget) return 'lurus terus';
    return navStatus.deviationDeg > 0 ? 'belok kanan' : 'belok kiri';
  }, [navStatus]);

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

      {/* Header Bar Navigasi Mengambang sesuai Figma #334:43229 */}
      <View style={[styles.topHeaderCard, { top: insets.top + 12 }]}>
        <Pressable
          style={styles.headerInfoCol}
          onPress={() => router.push(`/poi/${targetPoi.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Buka detail ${targetPoi.name}`}
        >
          <Text style={styles.navSubLabel}>Navigasi menuju</Text>
          <Text style={styles.navPoiName} numberOfLines={1}>
            {targetPoi.name}
          </Text>
        </Pressable>

        <Pressable
          style={styles.headerCloseBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Tutup navigasi"
        >
          <Ionicons name="close" size={26} color="#FF6B00" />
        </Pressable>
      </View>

      {/* Floating Recenter GPS Button di kanan bawah di atas bottom card */}
      <Pressable
        style={[styles.floatingGpsBtn, { bottom: Math.max(insets.bottom, 16) + 130 }]}
        onPress={handleRecenter}
        accessibilityRole="button"
        accessibilityLabel="Pusatkan peta ke posisi saat ini"
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#5A5A5A" />
      </Pressable>

      {/* Banner Sinyal GPS Lemah jika akurasi > 30m */}
      {position && position.accuracyM > 30 ? (
        <View style={[styles.gpsWarningBanner, { top: insets.top + 88 }]}>
          <Ionicons name="warning-outline" size={16} color="#BA1A1A" />
          <Text style={styles.gpsWarningText}>
            Sinyal GPS lemah (akurasi ~{Math.round(position.accuracyM)}m). Menunggu sinyal lebih presisi...
          </Text>
        </View>
      ) : null}

      {/* Modal / Card Info Navigasi Bagian Bawah */}
      <View style={[styles.bottomCardWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
          // Status Sedang Dipandu Sesuai Figma #334:43229
          <View style={styles.bottomCard}>
            {/* Kiri: Total Estimasi Waktu & Jarak */}
            <View style={styles.bottomLeftCol}>
              <Text style={styles.mainEtaText} numberOfLines={1}>
                {etaFormatted}
              </Text>
              <Text style={styles.mainDistanceText} numberOfLines={1}>
                {distanceFormatted}
              </Text>
            </View>

            {/* Kanan: Badge Oranye Manuver Belokan */}
            <View style={styles.maneuverBadge}>
              <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: spin }] }]}>
                <Ionicons
                  name={
                    navStatus?.isOnTarget
                      ? 'arrow-up'
                      : navStatus && navStatus.deviationDeg > 0
                        ? 'arrow-forward'
                        : 'arrow-back'
                  }
                  size={24}
                  color="#FFFFFF"
                />
              </Animated.View>
              <View style={styles.maneuverTextCol}>
                <Text style={styles.maneuverTimeText} numberOfLines={1}>
                  {navStatus ? `${Math.max(1, Math.ceil(navStatus.distanceM / 60))} menit lagi` : '~ mnt'}
                </Text>
                <Text style={styles.maneuverActionText} numberOfLines={1}>
                  {maneuverText}
                </Text>
              </View>
            </View>
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
  topHeaderCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  headerInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  navSubLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 18,
    color: '#666666',
  },
  navPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: '#1E1E1E',
    marginTop: 2,
  },
  headerCloseBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingGpsBtn: {
    position: 'absolute',
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 10,
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
  bottomCardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 22,
    paddingHorizontal: 22,
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  bottomLeftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  mainEtaText: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
    color: '#1E1E1E',
  },
  mainDistanceText: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    color: '#666666',
    marginTop: 4,
  },
  maneuverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maneuverTextCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  maneuverTimeText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 17,
    color: '#FFFFFF',
  },
  maneuverActionText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 15,
    color: '#FFFFFF',
  },
  arrivalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
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
