import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '@/constants/theme';
import { NavIcon } from '@/components/ui/NavIcon';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <NavIcon name="search" color={colors.primaryContainer} size={36} />
        </View>
        <Text style={styles.title}>Cari Tenant & Menu</Text>
        <Text style={styles.subtitle}>
          Temukan makanan favoritmu berdasarkan rasa, kategori, atau nama tenant.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...typography.subHeadline32,
    fontSize: 24,
    color: colors.onSurface,
  },
  subtitle: {
    ...typography.textSmRegular,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
