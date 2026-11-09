import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OsmMap } from '@/components/map/OsmMap';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';

// F01/F03: Beranda berisi peta OSM dengan marker POI.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);

  const handleBackToOnboarding = async () => {
    await AppStateRepository.resetOnboarding();
    setOnboarded(false);
    setOnboardingStep('intro');
    router.replace('/onboarding/welcome');
  };

  return (
    <View style={styles.container}>
      <OsmMap />
      <Pressable
        style={[styles.onboardingButton, { top: insets.top + 12 }]}
        onPress={handleBackToOnboarding}
      >
        <Text style={styles.onboardingButtonText}>← Back to Onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  onboardingButton: {
    position: 'absolute',
    left: 16,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  onboardingButtonText: {
    ...typography.textSmSemibold,
    color: colors.onPrimary,
  },
});
