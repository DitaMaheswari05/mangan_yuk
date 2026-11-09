import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '@/components/ui/OnboardingScaffold';
import { colors, typography } from '@/constants/theme';
import { AppStateRepository, PreferenceRepository } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';
import { FOOD_TYPES, TASTE_TAGS, type FoodType, type TasteTag } from '@/types/content';

const preferencesIllustration = require('../../assets/images/illustration-preferences.png');

const TASTE_LABELS: Record<TasteTag, string> = {
  manis: 'Manis',
  pedas: 'Pedas',
  gurih: 'Gurih',
  segar: 'Segar',
  aromatik: 'Aromatik',
};

const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  makanan: 'Makan Berat',
  jajanan: 'Camilan / Jajanan',
  minuman: 'Minuman',
};

export default function PreferencesScreen() {
  const router = useRouter();
  const [selectedTastes, setSelectedTastes] = useState<TasteTag[]>(['manis', 'gurih']);
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<FoodType[]>(['makanan']);
  const [halalOnly, setHalalOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const setOnboardingStep = useAppStore((s) => s.setOnboardingStep);
  const setPreferences = useAppStore((s) => s.setPreferences);

  useEffect(() => {
    let mounted = true;
    PreferenceRepository.get().then((res) => {
      if (mounted && res.ok) {
        if (res.data.tasteTags.length > 0) setSelectedTastes(res.data.tasteTags);
        if (res.data.foodTypes.length > 0) setSelectedFoodTypes(res.data.foodTypes);
        setHalalOnly(Boolean(res.data.halalOnly));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTaste = (tag: TasteTag) => {
    setSelectedTastes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const toggleFoodType = (ft: FoodType) => {
    setSelectedFoodTypes((prev) =>
      prev.includes(ft) ? prev.filter((item) => item !== ft) : [...prev, ft],
    );
  };

  const handleBack = async () => {
    await AppStateRepository.setOnboardingStep('notification');
    setOnboardingStep('notification');
    router.replace('/onboarding/notification');
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await PreferenceRepository.save({
        tasteTags: selectedTastes,
        foodTypes: selectedFoodTypes,
        halalOnly,
        skipped: false,
      });
      const prefRes = await PreferenceRepository.get();
      if (prefRes.ok) setPreferences(prefRes.data);
      await AppStateRepository.completeOnboarding();
      setOnboarded(true);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await PreferenceRepository.skip();
      const prefRes = await PreferenceRepository.get();
      if (prefRes.ok) setPreferences(prefRes.data);
      await AppStateRepository.completeOnboarding();
      setOnboarded(true);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      stepIndex={4}
      title="Pilih Selera"
      titleAccent="Kulinermu!"
      subtitle="Pilih cita rasa dan jenis hidangan favoritmu agar rekomendasi tenant dan rute kuliner makin pas."
      illustration={preferencesIllustration}
      onBack={handleBack}
      onSkip={handleSkip}
      primaryLabel="Mulai Sekarang"
      onPrimaryPress={handleFinish}
      primaryLoading={saving}
      secondaryLabel="Lewati & Lihat Semua"
      onSecondaryPress={handleSkip}
    >
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>Preferensi Rasa</Text>
        <View style={styles.chipRow}>
          {TASTE_TAGS.map((tag) => {
            const active = selectedTastes.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTaste(tag)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {TASTE_LABELS[tag]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>Jenis Makanan</Text>
        <View style={styles.chipRow}>
          {FOOD_TYPES.map((ft) => {
            const active = selectedFoodTypes.includes(ft);
            return (
              <Pressable
                key={ft}
                onPress={() => toggleFoodType(ft)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {FOOD_TYPE_LABELS[ft]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.halalRow}>
        <View style={styles.halalTextWrap}>
          <Text style={styles.halalTitle}>Hanya tampilkan makanan halal?</Text>
          <Text style={styles.halalSubtitle}>
            Dapat diubah kapan saja lewat halaman Profil
          </Text>
        </View>
        <Switch
          value={halalOnly}
          onValueChange={setHalalOnly}
          trackColor={{ false: colors.surfaceVariant, true: colors.tertiary }}
          thumbColor={colors.surfaceContainerLowest}
        />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    ...typography.textSmMedium,
    color: colors.onSurface,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primaryFixed,
    borderColor: colors.primaryContainer,
  },
  chipInactive: {
    backgroundColor: colors.surfaceContainerHighest,
    borderColor: colors.surfaceVariant,
  },
  chipText: {
    ...typography.textXsMedium,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipTextInactive: {
    color: colors.onSurfaceVariant,
  },
  halalRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  halalTextWrap: {
    flex: 1,
    gap: 2,
  },
  halalTitle: {
    ...typography.textSmMedium,
    color: colors.onSurface,
  },
  halalSubtitle: {
    ...typography.textXsRegular,
    color: colors.onSurfaceVariant,
  },
});
