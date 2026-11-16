import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@/constants/theme';
import { stepToHref } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

// Entry point: cek sesi autentikasi dan onboarding saat launch.
// 1. Belum login → /auth/login
// 2. Sudah login tapi belum selesai onboarding → /onboarding/{step}
// 3. Sudah login dan sudah selesai onboarding → /(tabs)
export default function Index() {
  const hydrated = useAppStore((s) => s.hydrated);
  const user = useAppStore((s) => s.user);
  const onboarded = useAppStore((s) => s.onboarded);
  const onboardingStep = useAppStore((s) => s.onboardingStep);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primaryContainer} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  return <Redirect href={onboarded ? '/(tabs)' : stepToHref(onboardingStep)} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
