import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

const notificationIllustration = require('../../assets/images/illustration-notification.png');

export default function NotificationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setPermissions = useAppStore((s) => s.setPermissions);

  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const enterAnimation = Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    });

    enterAnimation.start(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(2200),
          Animated.timing(bounceAnim, {
            toValue: 1.04,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 1,
            friction: 3,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
  }, [bounceAnim]);

  const handleBack = async () => {
    await AppStateRepository.setOnboardingStep('locationRationale');
    setOnboardingStep('locationRationale');
    router.replace('/onboarding/location');
  };

  const advanceToPreferences = async () => {
    await AppStateRepository.setOnboardingStep('preference');
    setOnboardingStep('preference');
    router.push('/onboarding/preferences');
  };

  const handleAllowNotification = async () => {
    setLoading(true);
    try {
      const res = await PermissionService.requestNotification();
      const status = res.ok ? res.data : 'denied';
      await AppStateRepository.savePermissions({ notification: status });
      setPermissions({ notification: status });
      await advanceToPreferences();
    } finally {
      setLoading(false);
    }
  };

  const handleSkipNotification = async () => {
    await AppStateRepository.savePermissions({ notification: 'denied' });
    setPermissions({ notification: 'denied' });
    await advanceToPreferences();
  };

  return (
    <OnboardingScaffold
      stepIndex={3}
      title="Jangan Lewatkan"
      titleAccent="Cerita Kuliner!"
      subtitle="Dapatkan notifikasi otomatis saat kamu berjalan melewati tenant legendaris dan langsung dengarkan narasi audionya."
      illustration={notificationIllustration}
      onBack={handleBack}
      onSkip={handleSkipNotification}
      primaryLabel="Aktifkan Notifikasi"
      onPrimaryPress={handleAllowNotification}
      primaryLoading={loading}
      secondaryLabel="Lewati untuk Sekarang"
      onSecondaryPress={handleSkipNotification}
    >
      <Animated.View
        style={[
          styles.previewCard,
          {
            transform: [
              {
                translateY: bounceAnim.interpolate({
                  inputRange: [0, 1, 1.04],
                  outputRange: [24, 0, -4],
                }),
              },
              {
                scale: bounceAnim.interpolate({
                  inputRange: [0, 1, 1.04],
                  outputRange: [0.92, 1, 1.03],
                }),
              },
            ],
            opacity: bounceAnim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 1, 1],
            }),
          },
        ]}
      >
        <Text style={styles.previewTitle}>
          Kamu lagi di dekat <Text style={styles.previewHighlight}>Mi dan Pho 1996</Text>!
        </Text>
        <Text style={styles.previewSub}>
          Ketuk untuk mendengarkan kisah kuliner & rekomendasi menu andalannya.
        </Text>

        <View style={styles.audioBar}>
          <View style={styles.playCircle}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.audioDuration}>01:00</Text>
        </View>
      </Animated.View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 8,
  },
  previewTitle: {
    ...typography.textMdSemibold,
    color: colors.onSurface,
  },
  previewHighlight: {
    color: colors.primaryContainer,
  },
  previewSub: {
    ...typography.textXsRegular,
    color: colors.onSurfaceVariant,
  },
  audioBar: {
    marginTop: 4,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 100,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    ...typography.textXsBold,
    color: colors.onPrimary,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 100,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
  },
  progressFill: {
    width: '42%',
    height: '100%',
    borderRadius: 100,
    backgroundColor: colors.primaryContainer,
  },
  audioDuration: {
    ...typography.textXsMedium,
    color: colors.primary,
  },
});
