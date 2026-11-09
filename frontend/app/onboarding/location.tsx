import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

const locationIllustration = require('../../assets/images/onboarding/illustration-location.png');

const LOCATION_REASONS = [
  {
    label: 'Posisi Real-time di Peta',
    detail: 'Menampilkan titik lokasimu dan jarak ke kawasan Sudirman Street Food.',
  },
  {
    label: 'Mode Jelajah Otomatis',
    detail: 'Mendeteksi saat kamu berada di dekat tenant untuk memunculkan kartu cerita kuliner.',
  },
  {
    label: 'Panduan Navigasi Jalan Kaki',
    detail: 'Mengarahkan langkahmu menuju gerai kuliner pilihan di dalam kawasan.',
  },
] as const;

export default function LocationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setPermissions = useAppStore((s) => s.setPermissions);

  const handleBack = async () => {
    await AppStateRepository.setOnboardingStep('intro');
    setOnboardingStep('intro');
    router.replace('/onboarding/welcome');
  };

  const handleAllowLocation = async () => {
    setLoading(true);
    try {
      const res = await PermissionService.requestLocationForeground();
      const status = res.ok ? res.data : 'denied';
      await AppStateRepository.savePermissions({ locationForeground: status });
      setPermissions({ locationForeground: status });

      if (status === 'granted') {
        await AppStateRepository.setOnboardingStep('notification');
        setOnboardingStep('notification');
        router.push('/onboarding/notification');
      } else {
        await AppStateRepository.setOnboardingStep('locationDenied');
        setOnboardingStep('locationDenied');
        router.push('/onboarding/no-location');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = async () => {
    await AppStateRepository.savePermissions({ locationForeground: 'denied' });
    setPermissions({ locationForeground: 'denied' });
    await AppStateRepository.setOnboardingStep('locationDenied');
    setOnboardingStep('locationDenied');
    router.push('/onboarding/no-location');
  };

  return (
    <OnboardingScaffold
      stepIndex={2}
      title="Aktifkan"
      titleAccent="Lokasimu"
      subtitle="Mangan Yuk membutuhkan akses lokasi agar bisa memandu perjalanan kulinermu secara akurat di lapangan."
      illustration={locationIllustration}
      onBack={handleBack}
      primaryLabel="Izinkan Lokasi"
      onPrimaryPress={handleAllowLocation}
      primaryLoading={loading}
      secondaryLabel="Nanti Saja"
      onSecondaryPress={handleSkipLocation}
    >
      <View style={styles.reasonCard}>
        <Text style={styles.reasonHeader}>Kenapa lokasi dibutuhkan?</Text>
        {LOCATION_REASONS.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.reasonRow,
              index < LOCATION_REASONS.length - 1 && styles.reasonRowBorder,
            ]}
          >
            <View style={styles.numberBadge}>
              <Text style={styles.numberBadgeText}>{index + 1}</Text>
            </View>
            <View style={styles.reasonContent}>
              <Text style={styles.reasonTitle}>{item.label}</Text>
              <Text style={styles.reasonDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  reasonCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 10,
  },
  reasonHeader: {
    ...typography.textSmSemibold,
    color: colors.primary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
  },
  reasonRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceVariant,
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 100,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  numberBadgeText: {
    ...typography.textXsBold,
    color: colors.primary,
  },
  reasonContent: {
    flex: 1,
    gap: 2,
  },
  reasonTitle: {
    ...typography.textSmMedium,
    color: colors.onSurface,
  },
  reasonDetail: {
    ...typography.textXsRegular,
    color: colors.onSurfaceVariant,
  },
});
