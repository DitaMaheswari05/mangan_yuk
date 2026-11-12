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
  shouldTriggerDistanceAudioCue,
  useCompassHeading,
} from '@/features/navigation';
import { getPoiById } from '@/features/poi';
import { useVisitedPoiIds } from '@/features/visits';
import type { LatLng } from '@/lib/geo';

export default function NavigateScreen() {
  const { poiId } = useLocalSearchParams<{ poiId: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<CameraRef | null>(null);

  const targetPoi = useMemo(() => (poiId ? getPoiById(poiId) : undefined), [poiId]);
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

  // Hitung status navigasi (jarak, bearing, deviasi)
  const navStatus = useMemo(() => {
    if (!position || !targetPoi) return null;
    const targetCoord: LatLng = {
      latitude: targetPoi.latitude,
      longitude: targetPoi.longitude,
    };
    return computeNavigationStatus(
      position.coordinate,
      headingDeg,
      targetCoord,
      { arrivalThresholdM: 10, targetToleranceDeg: 30 }
    );
  }, [position, targetPoi, headingDeg]);

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
    if (position && targetPoi && mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: [position.coordinate.longitude, position.coordinate.latitude],
        zoomLevel: 18,
        animationDuration: 800,
      });
    }
  }, [position, targetPoi]);

  // Titik polyline rute
  const routePoints = useMemo(() => {
    if (!position || !targetPoi) return [];
    return [
      position.coordinate,
      { latitude: targetPoi.latitude, longitude: targetPoi.longitude },
    ];
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

        <View style={styles.headerTitleBox}>
          <Text style={styles.navSubLabel}>Navigasi Menuju</Text>
          <Text style={styles.navPoiName} numberOfLines={1}>
            {targetPoi.name}
          </Text>
        </View>

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

      {/* Floating Compass Dial (Kanan Atas / Tengah Layar) */}
      <View style={[styles.compassCard, { top: insets.top + (position && position.accuracyM > 30 ? 120 : 80) }]}>
        <View style={styles.compassDial}>
          <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: spin }] }]}>
            <Ionicons
              name="navigate"
              size={34}
              color={navStatus?.isOnTarget ? '#2E9E4F' : '#FF8316'}
            />
          </Animated.View>
        </View>
        <Text style={styles.compassLabel}>
          {!isCompassAvailable
            ? 'Kompas: Sensor N/A'
            : navStatus?.isOnTarget
            ? 'Arah Tepat ✓'
            : navStatus && navStatus.deviationDeg > 0
            ? 'Belok Kanan ↗'
            : 'Belok Kiri ↖'}
        </Text>
      </View>

      {/* Modal / Card Info Navigasi Bagian Bawah */}
      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
          // Status Sedang Dipandu
          <View>
            <View style={styles.infoRow}>
              <View style={styles.distanceBlock}>
                <Text style={styles.distanceValue}>
                  {navStatus ? navStatus.distanceM : '~'}
                </Text>
                <Text style={styles.distanceUnit}>meter lagi</Text>
              </View>

              <View style={styles.guidanceDivider} />

              <View style={styles.guidanceBlock}>
                <Text style={styles.guidanceInstruction} numberOfLines={2}>
                  {navStatus?.isOnTarget
                    ? 'Lurus terus mengikuti garis rute'
                    : navStatus && navStatus.deviationDeg > 0
                    ? `Arahkan langkah ${Math.abs(navStatus.deviationDeg)}° ke kanan`
                    : navStatus
                    ? `Arahkan langkah ${Math.abs(navStatus.deviationDeg)}° ke kiri`
                    : 'Menghitung rute...'}
                </Text>
                <Text style={styles.guidanceCategory}>
                  {targetPoi.categoryLabel} · {targetPoi.zone}
                </Text>
              </View>
            </View>

            {/* Tombol Aksi Bawah */}
            <View style={styles.actionRow}>
              <Pressable
                style={styles.detailLinkBtn}
                onPress={() => router.push(`/poi/${targetPoi.id}`)}
                accessibilityRole="button"
              >
                <Text style={styles.detailLinkText}>Lihat Info Tenant</Text>
              </Pressable>

              <Pressable
                style={styles.stopNavBtn}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Akhiri navigasi"
              >
                <Ionicons name="close-circle-outline" size={18} color="#BA1A1A" />
                <Text style={styles.stopNavBtnText}>Selesai</Text>
              </Pressable>
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  navSubLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  navPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#1B1B1C',
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
  compassCard: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
  compassDial: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF4EA',
    borderWidth: 1.5,
    borderColor: '#FFDBCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#5A4136',
    marginTop: 6,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    zIndex: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBlock: {
    alignItems: 'flex-start',
    minWidth: 80,
  },
  distanceValue: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 36,
    color: '#FF8316',
  },
  distanceUnit: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
  },
  guidanceDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E5E2E1',
    marginHorizontal: 16,
  },
  guidanceBlock: {
    flex: 1,
  },
  guidanceInstruction: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: '#1B1B1C',
    lineHeight: 20,
  },
  guidanceCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EDED',
  },
  detailLinkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  detailLinkText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#065CBB',
  },
  stopNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFDAD6',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  stopNavBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#BA1A1A',
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
