import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { colors, fontFamily } from '@/constants/theme';
import { clearAllUserData, load } from '@/storage';
import { ExploreModeController } from '@/features/geofence';
import { AuthService } from '@/features/auth';
import { PreferenceRepository } from '@/features/onboarding';
import { resolveAsset } from '@/features/audio';
import { getPois } from '@/features/poi';
import { INITIAL_PASSPORT_STATE, PassportClient, type PassportState } from '@/features/passport';
import { useAppStore } from '@/store/useAppStore';
import { AppDialog, type DialogButton } from '@/components/ui/AppDialog';
import { EditPreferenceModal } from '@/components/ui/EditPreferenceModal';

const authIllustration = require('../../assets/images/person.png');
const PASSPORT_KEY = 'passport.v1';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const preferences = useAppStore((s) => s.preferences);
  const setPreferences = useAppStore((s) => s.setPreferences);

  const [passport, setPassport] = useState<PassportState>(INITIAL_PASSPORT_STATE);
  const [editPreferenceVisible, setEditPreferenceVisible] = useState(false);
  const pois = useMemo(() => getPois(), []);

  // Custom Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttons?: DialogButton[];
  }>({
    visible: false,
    title: '',
  });

  const showPopup = (
    title: string,
    message?: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    buttons?: DialogButton[],
  ) => {
    setDialogConfig({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  };

  const closePopup = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  // Load paspor untuk menghitung tenant dikunjungi & review
  const loadPassportData = useCallback(async () => {
    try {
      const summaryRes = await PassportClient.getPassport();
      if (summaryRes.ok) {
        setPassport({
          stamps: summaryRes.data.stamps,
          unlockedBadgeIds: summaryRes.data.unlockedBadgeIds,
          reviews: summaryRes.data.reviews,
        });
        return;
      }
    } catch {
      // Fallback local
    }
    const local = await PassportClient.loadLocalPassport();
    setPassport(local);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPassportData();
    }, [loadPassportData])
  );

  const visitedCount = Object.keys(passport.stamps).length;
  const totalPois = pois.length > 0 ? pois.length : 17;

  const handleLogout = () => {
    showPopup(
      'Keluar Akun',
      'Apakah kamu yakin ingin keluar dari akun ini?',
      'warning',
      [
        { text: 'Batal', style: 'cancel', onPress: closePopup },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            closePopup();
            await AuthService.logout();
            setUser(null);
            router.replace('/auth/login');
          },
        },
      ],
    );
  };

  const handleClearData = () => {
    showPopup(
      'Hapus Data & Reset Akun',
      'Tindakan ini akan menghapus seluruh riwayat stempel paspor kuliner, kunjungan, preferensi selera, dan sesi lokal dari perangkat ini.\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?',
      'warning',
      [
        { text: 'Batal', style: 'cancel', onPress: closePopup },
        {
          text: 'Hapus Semua Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await ExploreModeController.stop();
              await clearAllUserData();
              setUser(null);
              setOnboarded(false);
              setOnboardingStep('intro');
              showPopup('Selesai', 'Seluruh data pengguna dan sesi lokal telah dibersihkan.', 'success', [
                {
                  text: 'OK',
                  onPress: () => {
                    closePopup();
                    router.replace('/auth/login');
                  },
                },
              ]);
            } catch {
              showPopup('Gagal', 'Terjadi kesalahan saat menghapus data.', 'error');
            }
          },
        },
      ],
    );
  };

  // Label chips helper
  const tasteLabels = preferences.tasteTags.length > 0
    ? preferences.tasteTags.map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    : ['Manis', 'Pedas'];

  const foodLabels = preferences.foodTypes.length > 0
    ? preferences.foodTypes.map((f) => {
      if (f === 'makanan') return 'Makan berat';
      if (f === 'jajanan') return 'Camilan';
      return 'Minuman';
    })
    : ['Makan berat', 'Camilan'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Header */}
        <Text style={styles.pageTitle}>Profil</Text>

        {/* User Avatar & Info */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Ionicons name="person" size={48} color="#FF8316" />
          </View>
          <Text style={styles.userName}>{user ? user.displayName : 'User'}</Text>
          <Text style={styles.userEmail}>{user ? user.email : 'user@gmail.com'}</Text>
        </View>

        {/* Preferensi Kuliner Card (Orange Card) */}
        <View style={styles.preferenceCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Preferensi Kuliner</Text>
            <Pressable
              style={styles.editButton}
              onPress={() => setEditPreferenceVisible(true)}
              hitSlop={8}
            >
              <Text style={styles.editText}>Edit</Text>
              <Ionicons name="pencil-outline" size={14} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Selera rasa */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefGroupTitle}>Selera rasa</Text>
            <View style={styles.chipRow}>
              {tasteLabels.map((taste) => (
                <View key={taste} style={styles.chip}>
                  <Text style={styles.chipText}>{taste}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Jenis makanan */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefGroupTitle}>Jenis makanan</Text>
            <View style={styles.chipRow}>
              {foodLabels.map((food) => (
                <View key={food} style={styles.chip}>
                  <Text style={styles.chipText}>{food}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Status Filter Halal */}
          <View style={styles.halalStatusRow}>
            <Text style={styles.halalStatusText}>
              {preferences.halalOnly
                ? 'Sistem hanya menampilkan rekomendasi makanan halal.'
                : 'Menampilkan semua makanan (halal & non-halal).'}
            </Text>
          </View>
        </View>

        {/* Paspor Kuliner Section */}
        <View style={styles.passportSection}>
          <Pressable
            style={styles.passportHeaderRow}
            onPress={() => router.push('/passport')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.passportTitle}>Paspor Kuliner</Text>
              <Text style={styles.passportSubtitle}>
                <Text style={styles.passportCountBold}>{visitedCount}</Text>
                <Text style={styles.passportCountMuted}>/{totalPois} tenant dikunjungi</Text>
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#404040" />
          </Pressable>

          {/* Ulasan Terbaru / Preview Row */}
          {passport.reviews && passport.reviews.length > 0 ? (
            <View style={styles.passportPreviewRow}>
              {passport.reviews.slice(0, 3).map((rev) => {
                const poi = pois.find((p) => p.id === rev.poiId);
                const poiName = poi?.name ?? 'Tenant Kuliner';
                const photoAsset = rev.photoPath
                  ? { uri: rev.photoPath }
                  : resolveAsset(poi?.photos?.[0]?.assetKey);

                return (
                  <Pressable
                    key={rev.id}
                    style={styles.previewBox}
                    onPress={() => router.push('/passport')}
                  >
                    {photoAsset ? (
                      <Image
                        source={photoAsset}
                        style={styles.previewBoxImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.previewBoxPlaceholder}>
                        <Ionicons name="restaurant" size={24} color="#FFA044" />
                      </View>
                    )}
                    {/* Dark Overlay untuk keterbacaan teks */}
                    <View style={styles.previewBoxOverlay} />

                    {/* Stempel centang stempel ulasan */}
                    <View style={styles.previewStampBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#FF8316" />
                    </View>

                    <Text style={styles.previewBoxText} numberOfLines={2}>
                      {poiName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              style={styles.passportEmptyState}
              onPress={() => router.push('/passport')}
            >
              <View style={styles.passportEmptyIconCircle}>
                <Ionicons name="book-outline" size={22} color="#FF8316" />
              </View>
              <View style={styles.passportEmptyTextCol}>
                <Text style={styles.passportEmptyTitle}>Belum ada ulasan</Text>
                <Text style={styles.passportEmptySubtitle}>
                  Kunjungi tenant dan buat ulasan pertamamu untuk mengoleksi stempel!
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A6A6A6" />
            </Pressable>
          )}
        </View>

        {/* Action Buttons: Pengaturan & Keluar Akun */}
        <View style={styles.actionButtonsContainer}>
          <Pressable
            style={styles.settingButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            <Text style={styles.settingButtonText}>Pengaturan</Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF8316" />
            <Text style={styles.logoutButtonText}>Keluar Akun</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ManganYuk Pop-up Dialog */}
      <AppDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        buttons={dialogConfig.buttons}
        onDismiss={closePopup}
      />

      {/* Edit Preference White Modal with Orange Accents */}
      <EditPreferenceModal
        visible={editPreferenceVisible}
        onClose={() => setEditPreferenceVisible(false)}
        onSaved={() => {
          showPopup('Tersimpan', 'Preferensi kulinermu berhasil diperbarui!', 'success');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: 'stretch',
    gap: 16,
  },
  pageTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    color: '#1E1E1E',
    textAlign: 'center',
    marginTop: 2,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 3,
  },
  avatarWrapper: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFF0DC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFE0C2',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 4,
  },
  userName: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 24,
    color: '#FF8316',
    textAlign: 'center',
  },
  userEmail: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#666666',
    textAlign: 'center',
  },
  preferenceCard: {
    backgroundColor: '#FF8316',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  editText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
  },
  prefGroup: {
    gap: 4,
  },
  prefGroupTitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#FFF0DC',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: '#BD5200',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginVertical: 2,
  },
  halalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 0,
  },
  halalStatusText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    flex: 1,
    opacity: 0.95,
  },
  passportSection: {
    gap: 10,
  },
  passportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passportTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#404040',
  },
  passportSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  passportCountBold: {
    color: '#FF8316',
    fontFamily: fontFamily.semibold,
  },
  passportCountMuted: {
    color: '#808080',
    fontFamily: fontFamily.regular,
  },
  passportPreviewRow: {
    flexDirection: 'row',
    height: 104,
    gap: 10,
  },
  previewBox: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F5F5F5',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  previewBoxImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  previewBoxPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBoxOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  previewStampBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  previewBoxText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  passportEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
    gap: 14,
  },
  passportEmptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportEmptyTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  passportEmptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: '#333333',
    includeFontPadding: false,
  },
  passportEmptySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8A8A',
    includeFontPadding: false,
  },
  actionButtonsContainer: {
    gap: 8,
    marginTop: 2,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  settingButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  logoutButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FF8316',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  resetButtonText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#BA1A1A',
    textDecorationLine: 'underline',
  },
});
