import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, fontFamily, typography } from '@/constants/theme';
import { AppStateRepository, PermissionService } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

const notificationIllustration = require('../../assets/images/person.png');
const comingSoonBadge = require('../../assets/images/rocket.png');

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
        {/* Coming Soon Graphic Badge */}
        <Image
          source={comingSoonBadge}
          style={styles.comingSoonImage}
          resizeMode="contain"
        />

        {/* Text Header */}
        <View style={styles.textContainer}>
          <Text style={styles.previewSub}>Kamu sampai di:</Text>
          <Text style={styles.previewTitle} numberOfLines={1}>
            Mi dan Pho 1996
          </Text>
        </View>

        {/* White Action Pill Button */}
        <View style={styles.actionPill}>
          <View style={styles.playIconCircle}>
            <Ionicons name="play" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
          <Text style={styles.actionPillText} numberOfLines={1}>
            Dengarkan ceritanya!
          </Text>
        </View>
      </Animated.View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  comingSoonImage: {
    position: 'absolute',
    top: -4,
    right: -10,
    width: 128,
    height: 128,
    zIndex: 1,
  },
  textContainer: {
    alignItems: 'flex-start',
    gap: 2,
    zIndex: 2,
    maxWidth: '70%',
  },
  previewSub: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    opacity: 0.95,
    includeFontPadding: false,
  },
  previewTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 26,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  actionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 8,
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  playIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF8316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#FF8316',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
