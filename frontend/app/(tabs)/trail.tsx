import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@/constants/theme';
import { useUserLocation } from '@/features/location';
import { getPois } from '@/features/poi';
import { planTrail } from '@/features/trail';
import type { TasteTag } from '@/types/content';

const DURATION_OPTIONS = [
  { value: 30, label: '30 menit' },
  { value: 60, label: '60 menit' },
  { value: 90, label: '>60 menit' },
];

const TASTE_OPTIONS: { id: TasteTag; label: string }[] = [
  { id: 'manis', label: 'Manis' },
  { id: 'pedas', label: 'Pedas' },
  { id: 'gurih', label: 'Gurih' },
  { id: 'segar', label: 'Segar' },
  { id: 'aromatik', label: 'Aromatik' },
];

export default function TrailScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();

  const [durationMin, setDurationMin] = useState<number>(60);
  const [budgetText, setBudgetText] = useState<string>('50000');
  const [selectedTastes, setSelectedTastes] = useState<TasteTag[]>(['gurih']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleTaste = (taste: TasteTag) => {
    setSelectedTastes((prev) =>
      prev.includes(taste) ? prev.filter((t) => t !== taste) : [...prev, taste]
    );
  };

  const handlePlanTrail = () => {
    setErrorMessage(null);
    const cleanedBudget = parseInt(budgetText.replace(/\D/g, ''), 10);

    if (isNaN(cleanedBudget) || cleanedBudget < 15000) {
      setErrorMessage('Budget minimal Rp15.000 untuk menyusun rute.');
      return;
    }

    const pois = getPois();
    const userCoord = position?.coordinate ?? {
      latitude: -6.92089,
      longitude: 107.600533,
    };

    const result = planTrail({
      userPosition: userCoord,
      pois,
      durationMin,
      budget: cleanedBudget,
      preferredTastes: selectedTastes,
    });

    if (!result.isValid || result.steps.length === 0) {
      setErrorMessage(
        result.message || 'Tidak dapat menyusun rute dengan durasi dan budget tersebut. Coba tingkatkan budget atau waktu.'
      );
      return;
    }

    // Arahkan ke layar itinerary dengan membawa parameter
    router.push({
      pathname: '/trail/itinerary',
      params: {
        durationMin: durationMin.toString(),
        budget: cleanedBudget.toString(),
        preferredTastes: selectedTastes.join(','),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Ilustrasi sesuai Figma #85:37684 */}
          <View style={styles.headerCard}>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Buat Rute Kulinermu!</Text>
              <Text style={styles.headerSubtitle}>
                Punya waktu dan budget terbatas? Pilih preferensimu dan dapatkan rute tenant yang bisa kamu kunjungi!
              </Text>
            </View>
            <View style={styles.headerIllustrationCircle}>
              <MaterialCommunityIcons name="compass-rose" size={60} color="#FF8316" />
            </View>
          </View>

          {/* Form Seksi 1: Durasi Waktu (Figma #90:36902) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Berapa lama waktu yang kamu punya?</Text>
            <View style={styles.durationOptionsRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = durationMin === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.durationChip, active && styles.durationChipActive]}
                    onPress={() => setDurationMin(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        active && styles.durationChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Form Seksi 2: Budget Maksimal (Figma #86:37717) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Budget maksimal kamu</Text>
            <View style={styles.budgetInputContainer}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color="#FF8316" />
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.budgetInput}
                keyboardType="numeric"
                value={budgetText}
                onChangeText={(text) => setBudgetText(text.replace(/\D/g, ''))}
                placeholder="Contoh: 50000"
                placeholderTextColor="#A08C82"
              />
            </View>
            <Text style={styles.budgetHint}>
              Estimasi pengeluaran untuk 2–3 tenant kuliner di Sudirman Street Food.
            </Text>
          </View>

          {/* Form Seksi 3: Preferensi Rasa (Figma #87:37890) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Preferensi Rasa</Text>
            <View style={styles.tasteChipsRow}>
              {TASTE_OPTIONS.map((opt) => {
                const active = selectedTastes.includes(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.tasteChip, active && styles.tasteChipActive]}
                    onPress={() => toggleTaste(opt.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                  >
                    <Text
                      style={[styles.tasteChipText, active && styles.tasteChipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#BA1A1A" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Tombol Mulai Rencanakan (Figma #89:37900) */}
          <Pressable
            style={styles.planButton}
            onPress={handlePlanTrail}
            accessibilityRole="button"
            accessibilityLabel="Mulai rencanakan rute kuliner"
          >
            <Text style={styles.planButtonText}>Mulai Rencanakan</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9F8',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 18,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF4EA',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFDBCC',
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: '#351000',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
    lineHeight: 17,
  },
  headerIllustrationCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    gap: 12,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: '#1B1B1C',
  },
  durationOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    backgroundColor: '#FCF9F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: {
    backgroundColor: '#FF8316',
    borderColor: '#FF8316',
  },
  durationChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#5A4136',
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E2E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FCF9F8',
    gap: 8,
  },
  currencyPrefix: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#FF8316',
  },
  budgetInput: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#1B1B1C',
    paddingVertical: 0,
  },
  budgetHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  tasteChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tasteChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    backgroundColor: '#FCF9F8',
  },
  tasteChipActive: {
    backgroundColor: '#FF8316',
    borderColor: '#FF8316',
  },
  tasteChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#5A4136',
  },
  tasteChipTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFDAD6',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#BA1A1A',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8316',
    borderRadius: 28,
    paddingVertical: 15,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  planButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
