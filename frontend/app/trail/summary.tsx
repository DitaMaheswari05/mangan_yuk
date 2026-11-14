import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@/constants/theme';
import { sanitizeNumber } from '@/lib/validation';

function formatRupiah(val: number): string {
  return `Rp${val.toLocaleString('id-ID')}`;
}

export default function TrailSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    totalCost?: string;
    totalMin?: string;
    visitedCount?: string;
  }>();

  const totalCost = sanitizeNumber(params.totalCost, 45000, 0, 5000000);
  const totalMin = sanitizeNumber(params.totalMin, 50, 0, 1440);
  const visitedCount = sanitizeNumber(params.visitedCount, 3, 0, 100);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Sukses & Trofi */}
        <View style={styles.heroCard}>
          <View style={styles.trophyCircle}>
            <MaterialCommunityIcons name="trophy-award" size={54} color="#FFCC24" />
          </View>
          <Text style={styles.heroTitle}>Jelajah Trail Selesai!</Text>
          <Text style={styles.heroSubtitle}>
            Kamu telah menyelesaikan rute eksplorasi kuliner di Sudirman Street Food dengan sukses!
          </Text>
        </View>

        {/* Ringkasan Statistik */}
        <View style={styles.statsCard}>
          <Text style={styles.statsSectionTitle}>Statistik Jelajahmu</Text>

          <View style={styles.statRow}>
            <View style={styles.statIconBox}>
              <MaterialCommunityIcons name="storefront-check" size={22} color="#FF8316" />
            </View>
            <View style={styles.statTextBox}>
              <Text style={styles.statLabel}>Tenant Dikunjungi</Text>
              <Text style={styles.statValue}>{visitedCount} Tenant Kuliner</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statRow}>
            <View style={styles.statIconBox}>
              <MaterialCommunityIcons name="clock-check-outline" size={22} color="#FF8316" />
            </View>
            <View style={styles.statTextBox}>
              <Text style={styles.statLabel}>Waktu Dihabiskan</Text>
              <Text style={styles.statValue}>~{totalMin} Menit</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statRow}>
            <View style={styles.statIconBox}>
              <MaterialCommunityIcons name="cash-check" size={22} color="#FF8316" />
            </View>
            <View style={styles.statTextBox}>
              <Text style={styles.statLabel}>Estimasi Pengeluaran</Text>
              <Text style={styles.statValue}>{formatRupiah(totalCost)}</Text>
            </View>
          </View>
        </View>

        {/* Reward Paspor Kuliner Box */}
        <View style={styles.passportRewardCard}>
          <View style={styles.passportRewardHeader}>
            <MaterialCommunityIcons name="book-check" size={26} color="#785A00" />
            <Text style={styles.passportRewardTitle}>Stempel Paspor Bertambah!</Text>
          </View>
          <Text style={styles.passportRewardDesc}>
            Stempel dari tenant yang kamu kunjungi otomatis tersimpan di buku Paspor Kuliner digitalmu.
          </Text>
          <Pressable
            style={styles.openPassportBtn}
            onPress={() => router.replace('/(tabs)/passport')}
          >
            <Text style={styles.openPassportBtnText}>Lihat Paspor Kuliner</Text>
            <Ionicons name="arrow-forward" size={14} color="#785A00" />
          </Pressable>
        </View>

        {/* Tombol Kembali ke Beranda */}
        <Pressable
          style={styles.backHomeBtn}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
        >
          <Text style={styles.backHomeBtnText}>Kembali ke Beranda</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9F8',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#FFF4EA',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFDBCC',
  },
  trophyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: '#351000',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#8E7164',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    gap: 12,
  },
  statsSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1B1B1C',
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextBox: {
    flex: 1,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1B1B1C',
    marginTop: 2,
  },
  statDivider: {
    height: 1,
    backgroundColor: '#F0EDED',
  },
  passportRewardCard: {
    backgroundColor: '#FFDF9B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FEC73A',
  },
  passportRewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  passportRewardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#251A00',
  },
  passportRewardDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#5B4300',
    lineHeight: 17,
  },
  openPassportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  openPassportBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: '#785A00',
  },
  backHomeBtn: {
    backgroundColor: '#FF8316',
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  backHomeBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
