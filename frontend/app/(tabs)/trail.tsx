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
import { DEV_SUDIRMAN_COORDINATE, haversineM, useUserLocation } from '@/features/location';
import { getPois } from '@/features/poi';
import { planTrail } from '@/features/trail';
import type { TasteTag } from '@/types/content';

const unicornBanner = require('../../assets/images/happy.png');

const DURATION_OPTIONS = [
  { value: 30, label: '30 menit' },
  { value: 60, label: '60 menit' },
  { value: 90, label: '>60 menit' },
];

const TASTE_OPTIONS: { id: TasteTag; label: string }[] = [
  { id: 'manis', label: 'Manis' },
  { id: 'pedas', label: 'Asin' }, // Di Figma ditampilkan sebagai "Asin"
  { id: 'gurih', label: 'Gurih' },
];

export default function TrailScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();

  const [durationMin, setDurationMin] = useState<number>(30);
  const [budgetText, setBudgetText] = useState<string>('100000');
  const [selectedTastes, setSelectedTastes] = useState<TasteTag[]>(['manis']);
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
    const rawCoord = position?.coordinate ?? DEV_SUDIRMAN_COORDINATE;
    // Jika posisi pengguna > 300m dari pusat Sudirman Street Food (mis. merencanakan dari rumah/luar kawasan),
    // gunakan titik masuk Sudirman Street Food agar waktu tempuh dari luar kawasan tidak menghabiskan durasi trail.
    const isFarFromSSF = haversineM(rawCoord, DEV_SUDIRMAN_COORDINATE) > 300;
    const userCoord = isFarFromSSF ? DEV_SUDIRMAN_COORDINATE : rawCoord;

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
          {/* Header Ilustrasi sesuai Figma #251:80251 */}
          <View style={styles.headerCard}>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Buat Rute Kulinermu!</Text>
              <Text style={styles.headerSubtitle}>
                Punya waktu dan budget terbatas? Pilih preferensimu dan dapatkan rute tenant yang bisa kamu kunjungi!
              </Text>
            </View>
            <View style={styles.headerUnicornContainer}>
              <Image
                source={unicornBanner}
                style={[styles.headerUnicornImage, { width: 160, height: 160 }]}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Form Seksi 1: Durasi Waktu (Figma #251:80256) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Berapa lama waktu yang kamu punya?</Text>
            <View style={styles.durationOptionsRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = durationMin === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.durationChip, active ? styles.durationChipActive : styles.durationChipInactive]}
                    onPress={() => setDurationMin(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        active ? styles.durationChipTextActive : styles.durationChipTextInactive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Form Seksi 2: Budget Maksimal (Figma #251:80265) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Budget maksimal kamu</Text>
            <View style={styles.budgetInputContainer}>
              <Ionicons name="wallet-outline" size={20} color="#8E7164" />
              <Text style={styles.currencyPrefix}>Rp</Text>
              <TextInput
                style={styles.budgetInput}
                keyboardType="numeric"
                value={budgetText}
                onChangeText={(text) => setBudgetText(text.replace(/\D/g, ''))}
                placeholder="Contoh: Rp100.000"
                placeholderTextColor="#A6A6A6"
              />
            </View>
          </View>

          {/* Form Seksi 3: Preferensi Rasa (Figma #251:80279) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Preferensi Rasa</Text>
            <View style={styles.durationOptionsRow}>
              {TASTE_OPTIONS.map((opt) => {
                const active = selectedTastes.includes(opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.durationChip, active ? styles.durationChipActive : styles.durationChipInactive]}
                    onPress={() => toggleTaste(opt.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        active ? styles.durationChipTextActive : styles.durationChipTextInactive,
                      ]}
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

          {/* Tombol Mulai Rencanakan (Figma #251:80289) */}
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 24,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 140,
    paddingTop: 8,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 34,
    color: '#404040',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#A6A6A6',
  },
  headerUnicornContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUnicornImage: {
    width: 130,
    height: 130,
  },
  sectionCard: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#404040',
  },
  durationOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 40,
  },
  durationChip: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  durationChipActive: {
    backgroundColor: '#FFF0DC',
    borderWidth: 1,
    borderColor: '#FFC17E',
  },
  durationChipInactive: {
    backgroundColor: '#E6E6E6',
  },
  durationChipText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  durationChipTextActive: {
    color: '#E66B00',
    fontFamily: fontFamily.medium,
  },
  durationChipTextInactive: {
    color: '#FFFFFF',
  },
  budgetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#F5F5F5',
    gap: 10,
  },
  currencyPrefix: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#404040',
  },
  budgetInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#404040',
    paddingVertical: 0,
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
    gap: 8,
    backgroundColor: '#FF8316',
    borderRadius: 30,
    height: 48,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  planButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
