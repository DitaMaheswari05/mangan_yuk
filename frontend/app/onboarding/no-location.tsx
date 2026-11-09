import React, { useEffect } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

const locationIllustration = require('../../assets/images/onboarding/illustration-location.png');

export default function NoLocationScreen() {
  const router = useRouter();
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setPermissions = useAppStore((s) => s.setPermissions);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const status = await PermissionService.getLocationStatus();
        if (status === 'granted') {
          await AppStateRepository.savePermissions({ locationForeground: 'granted' });
          setPermissions({ locationForeground: 'granted' });
          await AppStateRepository.setOnboardingStep('notification');
          setOnboardingStep('notification');
          router.replace('/onboarding/notification');
        }
      }
    });
    return () => sub.remove();
  }, [router, setOnboardingStep, setPermissions]);

  const handleBack = async () => {
    await AppStateRepository.setOnboardingStep('locationRationale');
    setOnboardingStep('locationRationale');
    router.replace('/onboarding/location');
  };

  const handleOpenSettings = async () => {
    await PermissionService.openAppSettings();
  };

  const handleContinueWithoutLocation = async () => {
    await AppStateRepository.savePermissions({ locationForeground: 'denied' });
    setPermissions({ locationForeground: 'denied' });
    await AppStateRepository.setOnboardingStep('notification');
    setOnboardingStep('notification');
    router.push('/onboarding/notification');
  };

  return (
    <OnboardingScaffold
      stepIndex={2}
      title="Lokasi Belum"
      titleAccent="Diaktifkan"
      subtitle="Tanpa izin lokasi, fitur deteksi otomatis saat mendekati tenant (Mode Jelajah) tidak dapat berjalan."
      illustration={locationIllustration}
      illustrationVariant="error"
      onBack={handleBack}
      primaryLabel="Buka Pengaturan"
      onPrimaryPress={handleOpenSettings}
      secondaryLabel="Lanjut tanpa Lokasi"
      onSecondaryPress={handleContinueWithoutLocation}
    >
      <View style={styles.warningBanner}>
        <Text style={styles.warningTitle}>Apa yang tetap bisa kamu lakukan?</Text>
        <Text style={styles.warningText}>
          • Menjelajahi seluruh daftar tenant dan menu di Sudirman Street Food.{'\n'}
          • Membaca cerita kuliner dan memutar audio narasi secara manual.{'\n'}
          • Menyusun rencana rute kuliner (Trail Planner) kapan saja.
        </Text>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>Tips</Text>
        <Text style={styles.noteDescription}>
          Kamu selalu bisa mengaktifkan izin lokasi belakangan melalui menu Pengaturan untuk menikmati Mode Jelajah penuh.
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    backgroundColor: colors.errorContainer,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.error,
    gap: 6,
  },
  warningTitle: {
    ...typography.textSmBold,
    color: colors.onErrorContainer,
  },
  warningText: {
    ...typography.textXsRegular,
    color: colors.onErrorContainer,
    lineHeight: 18,
  },
  noteCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 4,
  },
  noteLabel: {
    ...typography.textXsSemibold,
    color: colors.primary,
  },
  noteDescription: {
    ...typography.textXsRegular,
    color: colors.onSurfaceVariant,
  },
});
