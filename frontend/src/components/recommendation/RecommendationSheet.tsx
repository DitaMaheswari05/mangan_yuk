import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@/constants/theme';
import { getPoiById } from '@/features/poi';
import { useExitRecommendation } from '@/features/recommendation/exit';

/** F07: sheet "3 Rekomendasi Berikutnya" setelah exit event. Dipasang sekali di root layout. */
export function RecommendationSheet() {
  const insets = useSafeAreaInsets();
  const { recommendation, dismiss } = useExitRecommendation();

  if (!recommendation) return null;

  const goTo = (poiId: string) => {
    dismiss();
    router.push(`/navigate/${poiId}`);
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Tutup rekomendasi" />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mau ke mana lagi?</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Setelah {recommendation.fromPoiName}, coba salah satu tenant ini.
            </Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tutup">
            <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {recommendation.items.map((item, index) => {
          const poi = getPoiById(item.poiId);
          return (
            <View key={item.poiId} style={styles.card}>
              <View style={styles.rank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.poiName} numberOfLines={1}>
                  {item.poiName}
                </Text>
                {poi ? (
                  <Text style={styles.category} numberOfLines={1}>
                    {poi.categoryLabel}
                  </Text>
                ) : null}
                <Text style={styles.reason}>{item.reason}</Text>
              </View>
              <Pressable
                style={styles.goButton}
                onPress={() => goTo(item.poiId)}
                accessibilityRole="button"
                accessibilityLabel={`Jadikan ${item.poiName} tujuan`}
              >
                <Text style={styles.goButtonText}>Jadikan Tujuan</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.laterButton} onPress={dismiss} accessibilityRole="button">
          <Text style={styles.laterText}>Nanti saja</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceDim,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.onSurface,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFixed,
  },
  rankText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.onPrimaryFixedVariant,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  poiName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
  category: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  reason: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.primary,
  },
  goButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  goButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  laterButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
});
