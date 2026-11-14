import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fontFamily, typography } from '@/constants/theme';
import { NavIcon } from '@/components/ui/NavIcon';
import { clearAllUserData } from '@/storage';
import { ExploreModeController } from '@/features/geofence';
import { useAppStore } from '@/store/useAppStore';

export default function ProfileScreen() {
  const [clearing, setClearing] = useState(false);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);

  const handleClearData = () => {
    Alert.alert(
      'Hapus Data & Reset Akun',
      'Tindakan ini akan menghapus seluruh riwayat stempel paspor kuliner, kunjungan, preferensi selera, dan token sesi lokal dari perangkat ini.\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua Data',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await ExploreModeController.stop();
              await clearAllUserData();
              setOnboarded(false);
              setOnboardingStep('intro');
              Alert.alert('Selesai', 'Seluruh data pengguna dan sesi lokal telah dibersihkan.');
              router.replace('/onboarding/welcome');
            } catch {
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus data.');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <NavIcon name="profile" color={colors.primaryContainer} size={36} />
        </View>
        <Text style={styles.title}>Profil Pengguna</Text>
        <Text style={styles.subtitle}>
          Kelola preferensi selera, riwayat kuliner, dan pengaturan privasi data.
        </Text>

        {/* Informasi Privasi & Keamanan (MASVS-PRIVACY) */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9E4F" />
            <Text style={styles.privacyTitle}>Privasi & Keamanan Data</Text>
          </View>
          <Text style={styles.privacyText}>
            Mangan Yuk memproses lokasi perangkat secara lokal untuk mendeteksi kawasan Sudirman Street Food.
            Koordinat pribadimu tidak pernah dibagikan atau dijual ke pihak ketiga.
          </Text>
        </View>

        {/* Tombol Hapus Data & Reset (Right to be Forgotten) */}
        <Pressable
          style={[styles.deleteButton, clearing && styles.buttonDisabled]}
          onPress={handleClearData}
          disabled={clearing}
          accessibilityRole="button"
          accessibilityLabel="Hapus semua data dan reset akun"
        >
          <Ionicons name="trash-outline" size={18} color="#BA1A1A" />
          <Text style={styles.deleteButtonText}>
            {clearing ? 'Membersihkan...' : 'Hapus Semua Data Lokal & Reset'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...typography.subHeadline32,
    fontSize: 24,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.textSmRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 8,
  },
  privacyCard: {
    alignSelf: 'stretch',
    backgroundColor: '#F3FAF5',
    borderWidth: 1,
    borderColor: '#C6E8D1',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#1B5E20',
  },
  privacyText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: '#2E5939',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: '#FFDAD6',
    borderWidth: 1,
    borderColor: '#FFB4AB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: '#BA1A1A',
  },
});
