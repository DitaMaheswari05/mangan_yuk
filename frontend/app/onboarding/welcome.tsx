import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

const welcomeIllustration = require('../../assets/images/illustration-welcome.png');

const HIGHLIGHTS = [
  {
    title: 'Jelajahi Kawasan Kuliner',
    description: 'Temukan tenant legendaris di Sudirman Street Food langsung dari peta interaktif.',
  },
  {
    title: 'Dengarkan Cerita Kuliner',
    description: 'Putar kisah unik di balik setiap hidangan saat kamu mendekati lokasi tenant.',
  },
  {
    title: 'Rute & Stempel Kuliner',
    description: 'Susun rute sesuai waktu & budget, lalu kumpulkan stempel di Paspor Kulinermu!',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);

  const handleNext = async () => {
    await AppStateRepository.setOnboardingStep('locationRationale');
    setOnboardingStep('locationRationale');
    router.push('/onboarding/location');
  };

  return (
    <OnboardingScaffold
      stepIndex={1}
      title={"Selamat Datang di\n"}
      titleAccent="Mangan Yuk!"
      subtitle="Teman jalan kaki kulinermu di Sudirman Street Food. Jelajahi tenant, dengarkan cerita audio, dan kumpulkan stempel!"
      illustration={welcomeIllustration}
      primaryLabel="Mulai Jelajahi"
      onPrimaryPress={handleNext}
    >
      <View style={styles.cardList}>
        {HIGHLIGHTS.map((item) => (
          <View key={item.title} style={styles.featureCard}>
            <View style={styles.iconCircle}>
              <View style={styles.iconDot} />
            </View>
            <View style={styles.featureTextWrap}>
              <View style={styles.featureHeaderRow}>
                <Text style={styles.featureTitle} numberOfLines={1}>{item.title}</Text>
              </View>
              <Text style={styles.featureDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  cardList: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 100,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: {
    width: 12,
    height: 12,
    borderRadius: 100,
    backgroundColor: colors.primaryContainer,
  },
  featureTextWrap: {
    flex: 1,
    gap: 4,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featureTitle: {
    ...typography.textSmSemibold,
    color: colors.onSurface,
    // flexShrink: 1,
  },
  tagPill: {
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  tagPillText: {
    ...typography.textXsMedium,
    color: colors.primary,
  },
  featureDescription: {
    ...typography.textXsRegular,
    color: colors.onSurfaceVariant,
  },
});
