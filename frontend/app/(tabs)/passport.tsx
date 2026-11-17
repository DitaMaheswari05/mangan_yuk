import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@/constants/theme';
import { getPois } from '@/features/poi';
import {
  calculateTrailProgress,
  evaluateBadges,
  INITIAL_PASSPORT_STATE,
  recordStamp,
  type PassportState,
  type TrailProgress,
} from '@/features/passport';
import { load, save } from '@/storage';
import type { Poi, Trail } from '@/types/content';

const PASSPORT_KEY = 'passport.v1';

export default function PassportScreen() {
  const insets = useSafeAreaInsets();
  const pois = useMemo(() => getPois(), []);

  // Trails data (Jejak Jajanan Sudirman & Manis-manis Sudirman)
  const trails: Trail[] = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@/data/trails.json') as Trail[];
    } catch {
      return [];
    }
  }, []);

  const [passport, setPassport] = useState<PassportState>(INITIAL_PASSPORT_STATE);
  const [activeTab, setActiveTab] = useState<'stamps' | 'badges'>('stamps');
  const [selectedPoiModal, setSelectedPoiModal] = useState<Poi | null>(null);

  // Load paspor dari local storage
  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await load<PassportState>(PASSPORT_KEY, INITIAL_PASSPORT_STATE);
      if (active) setPassport(saved);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stampedPoiIds = Object.keys(passport.stamps);

  // Hitung progres tiap trail
  const trailProgressList: TrailProgress[] = useMemo(() => {
    return trails.map((t) => calculateTrailProgress(t, stampedPoiIds));
  }, [stampedPoiIds, trails]);

  // Evaluasi perolehan badge
  const { updatedState, newlyUnlockedBadges } = useMemo(() => {
    return evaluateBadges(trails, passport);
  }, [passport, trails]);

  const unlockedBadgeCount = passport.unlockedBadgeIds.length;


  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Paspor Kuliner sesuai Figma #112:37338 */}
      <View style={styles.header}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Paspor Kuliner</Text>
          <Text style={styles.headerSubtitle}>
            Koleksi stempel digital dan lencana dari setiap kuliner yang kamu jelajahi di Sudirman Street Food!
          </Text>
        </View>
        <View style={styles.passportStampBadge}>
          <MaterialCommunityIcons name="stamper" size={28} color="#FF8316" />
          <Text style={styles.stampBadgeCount}>{stampedPoiIds.length}</Text>
        </View>
      </View>

      {/* Tab Switcher: Stempel Tenant vs Lencana / Badge */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabItem, activeTab === 'stamps' && styles.tabItemActive]}
          onPress={() => setActiveTab('stamps')}
        >
          <MaterialCommunityIcons
            name="ticket-confirmation-outline"
            size={18}
            color={activeTab === 'stamps' ? '#FF8316' : '#707070'}
          />
          <Text style={[styles.tabText, activeTab === 'stamps' && styles.tabTextActive]}>
            Stempel Tenant ({stampedPoiIds.length}/{pois.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabItem, activeTab === 'badges' && styles.tabItemActive]}
          onPress={() => setActiveTab('badges')}
        >
          <MaterialCommunityIcons
            name="medal-outline"
            size={18}
            color={activeTab === 'badges' ? '#FF8316' : '#707070'}
          />
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>
            Lencana Trail ({unlockedBadgeCount}/{trails.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'stamps' ? (
          // ================= TAB 1: STEMPEL TENANT =================
          <View style={styles.tabContentSection}>
            {/* Kartu Ringkasan Progres Stempel */}
            <View style={styles.stampSummaryCard}>
              <View style={styles.stampProgressHeader}>
                <Text style={styles.stampProgressLabel}>Capaian Jelajah Kuliner</Text>
                <Text style={styles.stampProgressPercent}>
                  {Math.round((stampedPoiIds.length / Math.max(pois.length, 1)) * 100)}%
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (stampedPoiIds.length / Math.max(pois.length, 1)) * 100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.stampProgressHint}>
                {stampedPoiIds.length > 0
                  ? `Keren! Kamu sudah mencicipi ${stampedPoiIds.length} tenant kuliner.`
                  : 'Belum ada stempel. Aktifkan Mode Jelajah atau kunjungi tenant untuk mengoleksi!'}
              </Text>
            </View>

            {/* Grid Kartu Stempel Tenant */}
            <View style={styles.stampGrid}>
              {pois.map((poi) => {
                const stamp = passport.stamps[poi.id];
                const isCollected = !!stamp;

                return (
                  <Pressable
                    key={poi.id}
                    style={[styles.stampCard, isCollected && styles.stampCardCollected]}
                    onPress={() => setSelectedPoiModal(poi)}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.stampCircle,
                        isCollected && styles.stampCircleCollected,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isCollected ? 'seal' : 'storefront-outline'}
                        size={32}
                        color={isCollected ? '#FFFFFF' : '#C4B4AB'}
                      />
                      {isCollected ? (
                        <View style={styles.stampVisitBadge}>
                          <Text style={styles.stampVisitText}>{stamp.visitCount}x</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.stampPoiName,
                        isCollected && styles.stampPoiNameCollected,
                      ]}
                      numberOfLines={2}
                    >
                      {poi.name}
                    </Text>

                    <Text style={styles.stampStatusText}>
                      {isCollected ? 'Terkoleksi ✓' : 'Belum'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          // ================= TAB 2: LENCANA / BADGE TRAIL =================
          <View style={styles.tabContentSection}>
            {/* Daftar Trail Tematik */}
            <Text style={styles.sectionTitle}>Misi Trail Tematik</Text>
            {trailProgressList.map((tp) => {
              const matchedTrail = trails.find((t) => t.id === tp.trailId);
              const isUnlocked = tp.isCompleted;

              return (
                <View
                  key={tp.trailId}
                  style={[styles.badgeCard, isUnlocked && styles.badgeCardUnlocked]}
                >
                  <View style={styles.badgeHeaderRow}>
                    <View
                      style={[
                        styles.badgeIconCircle,
                        isUnlocked && styles.badgeIconCircleUnlocked,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isUnlocked ? 'shield-star' : 'shield-outline'}
                        size={34}
                        color={isUnlocked ? '#FFFFFF' : '#8E7164'}
                      />
                    </View>

                    <View style={styles.badgeInfoCol}>
                      <Text style={styles.badgeTitle}>
                        {matchedTrail?.badgeName || tp.trailName}
                      </Text>
                      <Text style={styles.badgeDesc} numberOfLines={2}>
                        {matchedTrail?.description}
                      </Text>
                    </View>

                    {isUnlocked ? (
                      <View style={styles.unlockedRibbon}>
                        <Text style={styles.unlockedRibbonText}>KLAIMED</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Progress Bar Misi */}
                  <View style={styles.trailProgressRow}>
                    <View style={styles.trailProgressBarBg}>
                      <View
                        style={[
                          styles.trailProgressBarFill,
                          { width: `${tp.percentage}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.trailProgressText}>
                      {tp.visitedCount}/{tp.totalPois} POI
                    </Text>
                  </View>

                  <View style={styles.badgeFooter}>
                    <Text style={styles.badgePoiListText}>
                      Syarat tenant:{' '}
                      {matchedTrail?.poiIds
                        .map((id) => pois.find((p) => p.id === id)?.name || id)
                        .join(', ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Detail Stempel Tenant */}
      <Modal
        visible={!!selectedPoiModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPoiModal(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedPoiModal ? (
            <View style={styles.modalCard}>
              <View style={styles.modalStamperIcon}>
                <MaterialCommunityIcons
                  name={passport.stamps[selectedPoiModal.id] ? 'seal' : 'storefront-outline'}
                  size={44}
                  color="#FF8316"
                />
              </View>

              <Text style={styles.modalPoiName}>{selectedPoiModal.name}</Text>
              <Text style={styles.modalPoiCategory}>
                {selectedPoiModal.categoryLabel} · {selectedPoiModal.zone}
              </Text>

              <View style={styles.modalDivider} />

              {passport.stamps[selectedPoiModal.id] ? (
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalInfoLabel}>Status Kunjungan:</Text>
                  <Text style={styles.modalInfoValue}>
                    Sudah dikunjungi {passport.stamps[selectedPoiModal.id].visitCount} kali
                  </Text>
                  <Text style={styles.modalInfoSub}>
                    Kunjungan pertama:{' '}
                    {new Date(
                      passport.stamps[selectedPoiModal.id].firstStampedAt
                    ).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              ) : (
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalInfoLabel}>Status Stempel:</Text>
                  <Text style={styles.modalInfoValue}>Belum terkoleksi</Text>
                  <Text style={styles.modalInfoSub}>
                    Kunjungi tenant ini selama minimal 3 menit atau gunakan panduan navigasi untuk mendapatkan stempel!
                  </Text>
                </View>
              )}

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedPoiModal(null)}
                >
                  <Text style={styles.modalCloseBtnText}>Tutup</Text>
                </Pressable>
                <Pressable
                  style={styles.modalNavBtn}
                  onPress={() => {
                    const id = selectedPoiModal.id;
                    setSelectedPoiModal(null);
                    router.push(`/navigate/${id}`);
                  }}
                >
                  <Ionicons name="navigate" size={14} color="#FFFFFF" />
                  <Text style={styles.modalNavBtnText}>Navigasi</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitleBox: {
    flex: 1,
    paddingRight: 14,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: '#351000',
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
    lineHeight: 16,
    marginTop: 4,
  },
  passportStampBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF4EA',
    borderWidth: 1.5,
    borderColor: '#FFDBCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBadgeCount: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#FF8316',
    marginTop: -4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    marginTop: 6,
    marginBottom: 10,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: '#FFF4EA',
  },
  tabText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#707070',
  },
  tabTextActive: {
    fontFamily: fontFamily.bold,
    color: '#FF8316',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tabContentSection: {
    gap: 16,
  },
  stampSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    gap: 8,
  },
  stampProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stampProgressLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#1B1B1C',
  },
  stampProgressPercent: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FF8316',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F0EDED',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8316',
    borderRadius: 4,
  },
  stampProgressHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  stampCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E2E1',
    elevation: 1,
  },
  stampCardCollected: {
    borderColor: '#FFDBCC',
    backgroundColor: '#FFFCFA',
  },
  stampCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F6F3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stampCircleCollected: {
    backgroundColor: '#FF8316',
  },
  stampVisitBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#2E9E4F',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  stampVisitText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  stampPoiName: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#707070',
    textAlign: 'center',
    minHeight: 34,
  },
  stampPoiNameCollected: {
    color: '#1B1B1C',
  },
  stampStatusText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#8E7164',
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#1B1B1C',
    marginVertical: 4,
  },
  badgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    gap: 12,
  },
  badgeCardUnlocked: {
    borderColor: '#FEC73A',
    backgroundColor: '#FFFCF2',
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badgeIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F6F3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconCircleUnlocked: {
    backgroundColor: '#FEC73A',
  },
  badgeInfoCol: {
    flex: 1,
  },
  badgeTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1B1B1C',
  },
  badgeDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
    marginTop: 2,
    lineHeight: 16,
  },
  unlockedRibbon: {
    backgroundColor: '#2E9E4F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlockedRibbonText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  trailProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trailProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0EDED',
    borderRadius: 3,
    overflow: 'hidden',
  },
  trailProgressBarFill: {
    height: '100%',
    backgroundColor: '#FEC73A',
    borderRadius: 3,
  },
  trailProgressText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: '#785A00',
  },
  badgeFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F6F3F2',
    paddingTop: 8,
  },
  badgePoiListText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
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
    padding: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalStamperIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    color: '#1B1B1C',
    textAlign: 'center',
  },
  modalPoiCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E2E1',
    width: '100%',
    marginVertical: 14,
  },
  modalInfoBox: {
    width: '100%',
    backgroundColor: '#FCF9F8',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  modalInfoLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: '#1B1B1C',
  },
  modalInfoValue: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FF8316',
  },
  modalInfoSub: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
    lineHeight: 15,
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  modalCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#1B1B1C',
  },
  modalNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#FF8316',
  },
  modalNavBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
