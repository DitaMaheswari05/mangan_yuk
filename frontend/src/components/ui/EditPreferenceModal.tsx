import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/constants/theme';
import { PreferenceRepository, type UserPreferences } from '@/features/onboarding';
import { useAppStore } from '@/store/useAppStore';
import { FOOD_TYPES, TASTE_TAGS, type FoodType, type TasteTag } from '@/types/content';

const TASTE_LABELS: Record<TasteTag, string> = {
  manis: 'Manis',
  pedas: 'Pedas',
  gurih: 'Gurih',
  segar: 'Segar',
  aromatik: 'Aromatik',
};

const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  makanan: 'Makan berat',
  jajanan: 'Camilan',
  minuman: 'Minuman',
};

type EditPreferenceModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved?: (updated: UserPreferences) => void;
};

export function EditPreferenceModal({
  visible,
  onClose,
  onSaved,
}: EditPreferenceModalProps) {
  const preferences = useAppStore((s) => s.preferences);
  const setPreferences = useAppStore((s) => s.setPreferences);

  const [tastes, setTastes] = useState<TasteTag[]>(preferences.tasteTags);
  const [foods, setFoods] = useState<FoodType[]>(preferences.foodTypes);
  const [halal, setHalal] = useState<boolean>(preferences.halalOnly);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTastes(preferences.tasteTags.length > 0 ? preferences.tasteTags : ['manis', 'pedas']);
      setFoods(preferences.foodTypes.length > 0 ? preferences.foodTypes : ['makanan', 'jajanan']);
      setHalal(Boolean(preferences.halalOnly));
    }
  }, [visible, preferences]);

  const toggleTaste = (taste: TasteTag) => {
    setTastes((prev) =>
      prev.includes(taste)
        ? prev.length > 1
          ? prev.filter((t) => t !== taste)
          : prev
        : [...prev, taste],
    );
  };

  const toggleFood = (food: FoodType) => {
    setFoods((prev) =>
      prev.includes(food)
        ? prev.length > 1
          ? prev.filter((f) => f !== food)
          : prev
        : [...prev, food],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedPrefs: UserPreferences = {
        ...preferences,
        tasteTags: tastes,
        foodTypes: foods,
        halalOnly: halal,
        skipped: false,
        updatedAt: new Date().toISOString(),
      };

      // Simpan ke Zustand global store
      setPreferences(updatedPrefs);

      // Simpan ke persistent storage / backend API persistence
      await PreferenceRepository.save({
        tasteTags: tastes,
        foodTypes: foods,
        halalOnly: halal,
      });

      if (onSaved) onSaved(updatedPrefs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.accentBadge}>
                <Ionicons name="restaurant-outline" size={18} color="#FF8316" />
              </View>
              <Text style={styles.title}>Edit Preferensi Kuliner</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6C7278" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Selera Rasa */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selera Rasa</Text>
              <Text style={styles.sectionSubtitle}>Pilih rasa yang kamu sukai (min. 1)</Text>
              <View style={styles.chipRow}>
                {TASTE_TAGS.map((taste) => {
                  const isSelected = tastes.includes(taste);
                  return (
                    <Pressable
                      key={taste}
                      onPress={() => toggleTaste(taste)}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {TASTE_LABELS[taste]}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Jenis Makanan */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jenis Makanan</Text>
              <Text style={styles.sectionSubtitle}>Pilih kategori hidangan (min. 1)</Text>
              <View style={styles.chipRow}>
                {FOOD_TYPES.map((food) => {
                  const isSelected = foods.includes(food);
                  return (
                    <Pressable
                      key={food}
                      onPress={() => toggleFood(food)}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {FOOD_TYPE_LABELS[food]}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Switch Halal */}
            <View style={styles.halalRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.halalTitle}>Hanya Makanan Halal</Text>
                <Text style={styles.halalSubtitle}>Saring rekomendasi tenant halal saja</Text>
              </View>
              <Switch
                value={halal}
                onValueChange={setHalal}
                trackColor={{ false: '#E0E0E0', true: '#FF8316' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    color: '#1A1C1E',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: '#1A1C1E',
  },
  sectionSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#808080',
    marginTop: -2,
    marginBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EDF1F3',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#FF8316',
    borderColor: '#FF8316',
  },
  chipText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#6C7278',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chipTextSelected: {
    fontFamily: fontFamily.medium,
    color: '#FFFFFF',
  },
  halalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF9F3',
    borderWidth: 1,
    borderColor: '#FFE0C2',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  halalTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#1A1C1E',
  },
  halalSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#6C7278',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EDED',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#6C7278',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: '#FF8316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
