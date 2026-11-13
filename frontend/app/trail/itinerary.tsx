import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@/constants/theme';
import { useUserLocation } from '@/features/location';
import { getPois } from '@/features/poi';
import {
  planTrail,
  skipTrailStep,
  type TrailPlanResult,
  type TrailStep,
} from '@/features/trail';
import type { TasteTag } from '@/types/content';

function formatRupiah(val: number): string {
  return `Rp${val.toLocaleString('id-ID')}`;
}

export default function TrailItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();
  const params = useLocalSearchParams<{
    durationMin?: string;
    budget?: string;
    preferredTastes?: string;
  }>();

  const durationMin = parseInt(params.durationMin || '60', 10);
  const budget = parseInt(params.budget || '50000', 10);
  const preferredTastes = (params.preferredTastes ? params.preferredTastes.split(',') : ['gurih']) as TasteTag[];

  const pois = useMemo(() => getPois(), []);
  const userCoord = position?.coordinate ?? {
    latitude: -6.92089,
    longitude: 107.600533,
  };

  // State plan & steps
  const initialPlan = useMemo(() => {
    return planTrail({
      userPosition: userCoord,
      pois,
      durationMin,
      budget,
      preferredTastes,
    });
  }, [userCoord, pois, durationMin, budget, preferredTastes]);

  const [steps, setSteps] = useState<TrailStep[]>(initialPlan.steps);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // Hitung ulang total biaya & estimasi waktu saat step diubah/dilewati
  const totalCost = useMemo(
    () => steps.reduce((sum, s) => sum + s.estimatedCostIdr, 0),
    [steps]
  );
  const totalMin = useMemo(
    () => steps.reduce((sum, s) => sum + s.allocatedVisitMin + s.estimatedWalkingMin, 0),
    [steps]
  );

  // Fitur SB-4.4: Lewati Tenant
  const handleSkipStep = (poiIdToSkip: string) => {
    Alert.alert(
      'Lewati Tenant Ini?',
      'Rute akan disusun ulang secara otomatis dengan tenant terdekat lainnya yang masih sesuai budget.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lewati',
          style: 'destructive',
          onPress: () => {
            const nextSkipped = [...skippedIds, poiIdToSkip];
            setSkippedIds(nextSkipped);

            const currentPlanResult: TrailPlanResult = {
              steps,
              totalEstimatedCostIdr: totalCost,
              totalEstimatedMin: totalMin,
              isValid: true,
            };
            const nextPlan = skipTrailStep(
              currentPlanResult,
              poiIdToSkip,
              pois,
              userCoord
            );
            setSteps(nextPlan.steps);
          },
        },
      ]
    );
  };

  // Navigasi ke ringkasan trail
  const handleFinishTrail = () => {
    router.push({
      pathname: '/trail/summary',
      params: {
        totalCost: totalCost.toString(),
        totalMin: totalMin.toString(),
        visitedCount: steps.length.toString(),
      },
    });
  };

  const renderStepItem = ({ item, index }: { item: TrailStep; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;

    return (
      <View style={styles.stepContainer}>
        {/* Kolom Indikator Nomor & Garis Titik (Figma #91:37063) */}
        <View style={styles.timelineCol}>
          <View style={[styles.stepBadge, isFirst && styles.stepBadgeActive]}>
            <Text style={[styles.stepBadgeText, isFirst && styles.stepBadgeTextActive]}>
              {item.stepNumber}
            </Text>
          </View>
          {!isLast ? <View style={styles.timelineDashedLine} /> : null}
        </View>

        {/* Kartu Detail Tenant Langkah */}
        <View style={[styles.stepCard, isFirst && styles.stepCardActive]}>
          <View style={styles.stepCardHeader}>
            <View style={styles.stepCardTitleCol}>
              <Text style={styles.stepPoiName} numberOfLines={1}>
                {item.poi.name}
              </Text>
              <Text style={styles.stepPoiCategory}>
                {item.poi.categoryLabel} · {item.poi.zone}
              </Text>
            </View>

            <View style={styles.stepTimeBadge}>
              <MaterialCommunityIcons name="clock-outline" size={13} color="#FF8316" />
              <Text style={styles.stepTimeText}>~{item.allocatedVisitMin} mnt</Text>
            </View>
          </View>

          {/* Info Jarak Jalan & Estimasi Biaya */}
          <View style={styles.stepMetaRow}>
            <View style={styles.stepMetaItem}>
              <MaterialCommunityIcons name="walk" size={16} color="#8E7164" />
              <Text style={styles.stepMetaText}>
                {item.distanceFromPreviousM}m (~{item.estimatedWalkingMin} mnt jalan)
              </Text>
            </View>
            <Text style={styles.stepCostText}>{formatRupiah(item.estimatedCostIdr)}</Text>
          </View>

          {/* Tombol Aksi per Tenant */}
          <View style={styles.stepActionsRow}>
            {/* Tombol Lewati Tenant (SB-4.4) */}
            <Pressable
              style={styles.skipBtn}
              onPress={() => handleSkipStep(item.poi.id)}
              accessibilityRole="button"
              accessibilityLabel={`Lewati tenant ${item.poi.name}`}
            >
              <Ionicons name="play-skip-forward-outline" size={14} color="#8E7164" />
              <Text style={styles.skipBtnText}>Lewati</Text>
            </Pressable>

            {/* Tombol Mulai Navigasi ke Tenant Ini */}
            <Pressable
              style={styles.navStepBtn}
              onPress={() => router.push(`/navigate/${item.poi.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Navigasi ke ${item.poi.name}`}
            >
              <Text style={styles.navStepBtnText}>Navigasi</Text>
              <Ionicons name="paper-plane-outline" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => setExitModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Keluar dari trail"
        >
          <Ionicons name="arrow-back" size={22} color="#1B1B1C" />
        </Pressable>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Rute Kulinermu Siap!</Text>
          <Text style={styles.headerSubtitle}>
            {steps.length} tenant terpilih sesuai preferensi dan budgetmu.
          </Text>
        </View>

        <Pressable
          style={styles.finishTopBtn}
          onPress={handleFinishTrail}
          accessibilityRole="button"
        >
          <Text style={styles.finishTopBtnText}>Selesai</Text>
        </Pressable>
      </View>

      {/* Ringkasan Baris Atas (Figma #91:37084) */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Tenant</Text>
          <Text style={styles.summaryValue}>{steps.length} Tempat</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Estimasi Waktu</Text>
          <Text style={styles.summaryValue}>~{totalMin} Menit</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Estimasi</Text>
          <Text style={styles.summaryValue}>{formatRupiah(totalCost)}</Text>
        </View>
      </View>

      {/* Daftar Langkah Itinerary */}
      <FlatList
        data={steps}
        keyExtractor={(item) => item.poi.id}
        renderItem={renderStepItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="map-marker-off" size={48} color="#C4B4AB" />
            <Text style={styles.emptyTitle}>Semua tenant pada rute telah dilewati</Text>
            <Pressable
              style={styles.replanBtn}
              onPress={() => router.replace('/(tabs)/trail')}
            >
              <Text style={styles.replanBtnText}>Rencanakan Ulang</Text>
            </Pressable>
          </View>
        }
      />

      {/* Floating Bottom Bar: Mulai Langkah Pertama */}
      {steps.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={styles.startNavigationBtn}
            onPress={() => router.push(`/navigate/${steps[0].poi.id}`)}
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.startNavigationBtnText}>
              Mulai Navigasi ke Step 1 ({steps[0].poi.name})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Modal Dialog Konfirmasi Keluar Trail (Figma #113:37748) */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <MaterialCommunityIcons name="alert-octagon" size={36} color="#BA1A1A" />
            </View>
            <Text style={styles.modalTitle}>Mau Keluar dari Trail?</Text>
            <Text style={styles.modalSubtitle}>
              Jika kamu keluar sekarang, susunan rencana rute kuliner ini akan ditutup.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setExitModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={styles.modalExitBtn}
                onPress={() => {
                  setExitModalVisible(false);
                  router.back();
                }}
              >
                <Text style={styles.modalExitBtnText}>Tetap Keluar</Text>
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
    backgroundColor: '#FCF9F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E2E1',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#1B1B1C',
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  finishTopBtn: {
    backgroundColor: '#FFF4EA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFDBCC',
  },
  finishTopBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#FF8316',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    elevation: 1,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  summaryValue: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#FF8316',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E2E1',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineCol: {
    width: 36,
    alignItems: 'center',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E2E1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepBadgeActive: {
    backgroundColor: '#FF8316',
  },
  stepBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#5A4136',
  },
  stepBadgeTextActive: {
    color: '#FFFFFF',
  },
  timelineDashedLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#FFDBCC',
    marginVertical: 4,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    marginLeft: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  stepCardActive: {
    borderColor: '#FF8316',
    backgroundColor: '#FFFCFA',
  },
  stepCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepCardTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  stepPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1B1B1C',
  },
  stepPoiCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
    marginTop: 2,
  },
  stepTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepTimeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#FF8316',
  },
  stepMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F6F3F2',
  },
  stepMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepMetaText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
  },
  stepCostText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#FF8316',
  },
  stepActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E2E1',
  },
  skipBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#8E7164',
  },
  navStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  navStepBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: '#FFFFFF',
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E2E1',
    elevation: 8,
  },
  startNavigationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF8316',
    paddingVertical: 14,
    borderRadius: 24,
  },
  startNavigationBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: '#1B1B1C',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#5A4136',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#1B1B1C',
  },
  modalExitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#BA1A1A',
    alignItems: 'center',
  },
  modalExitBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
