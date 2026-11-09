import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '@/constants/theme';
import { NavIcon } from '@/components/ui/NavIcon';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <NavIcon name="profile" color={colors.primaryContainer} size={36} />
        </View>
        <Text style={styles.title}>Profil Pengguna</Text>
        <Text style={styles.subtitle}>
          Kelola preferensi selera, riwayat kuliner, dan pengaturan akun.
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
