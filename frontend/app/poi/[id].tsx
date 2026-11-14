import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NarrationPlayer } from '@/components/poi/NarrationPlayer';
import { colors, fontFamily } from '@/constants/theme';
import { resolveAsset } from '@/features/audio';
import { getPoiById, isOpenAt } from '@/features/poi';
import { sanitizePoiId } from '@/lib/validation';
import { useVisitedPoiIds } from '@/features/visits';
import type { PhotoKind, Poi, TimeSlot } from '@/types/content';

const ACCENT = '#FF8316';
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const PHOTO_SLOTS: { kind: PhotoKind; label: string; icon: 'food' | 'storefront' | 'account-group' }[] = [
  { kind: 'food', label: 'Makanan', icon: 'food' },
  { kind: 'tenant', label: 'Tenant', icon: 'storefront' },
  { kind: 'ambience', label: 'Suasana', icon: 'account-group' },
];

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/** Gabung slot per hari: [{day:1, open:'10:00', close:'14:00'}, …] → 'Senin  10:00–14:00, 17:00–22:00'. */
function hoursByDay(slots: TimeSlot[]): { day: string; hours: string }[] {
  return DAY_NAMES.map((name, day) => {
    const daySlots = slots.filter((s) => s.day === day).sort((a, b) => a.open.localeCompare(b.open));
    return {
      day: name,
      hours: daySlots.length ? daySlots.map((s) => `${s.open}–${s.close}`).join(', ') : 'Tutup',
    };
  });
}

// F03 / PB08: Kartu detail POI multimodal (3 foto, menu & harga, jam buka, audio + transkrip), offline.
export default function PoiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cleanId = sanitizePoiId(id);
  const poi = cleanId ? getPoiById(cleanId) : undefined;
  const insets = useSafeAreaInsets();

  if (!poi) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Tenant tidak ditemukan</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  return <PoiDetail poi={poi} topInset={insets.top} bottomInset={insets.bottom} />;
}

function PoiDetail({ poi, topInset, bottomInset }: { poi: Poi; topInset: number; bottomInset: number }) {
  const { width } = useWindowDimensions();
  const visited = useVisitedPoiIds().has(poi.id);
  const openNow = useMemo(() => isOpenAt(poi, new Date()), [poi]);
  const hours = useMemo(() => hoursByDay(poi.openingHours), [poi.openingHours]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const today = new Date().getDay();

  // 3 slot foto: pakai foto sesuai jenis bila ada, selain itu placeholder.
  const photos = PHOTO_SLOTS.map((slot, i) => {
    const ref = poi.photos.find((p) => p.kind === slot.kind) ?? poi.photos[i];
    return { slot, ref, source: resolveAsset(ref?.assetKey) };
  });

  const story = poi.audio?.transcript || poi.culturalStory || poi.description;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 32 }}>
        {/* Foto */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {photos.map(({ slot, ref, source }) =>
              source ? (
                <Image
                  key={slot.kind}
                  source={source}
                  style={{ width, height: 240 }}
                  resizeMode="cover"
                  accessibilityLabel={ref?.caption ?? `Foto ${slot.label.toLowerCase()} ${poi.name}`}
                />
              ) : (
                <View key={slot.kind} style={[styles.photoPlaceholder, { width }]}>
                  <MaterialCommunityIcons name={slot.icon} size={48} color={ACCENT} />
                  <Text style={styles.photoPlaceholderText}>Foto {slot.label.toLowerCase()} segera hadir</Text>
                </View>
              ),
            )}
          </ScrollView>
          <View style={styles.dots}>
            {photos.map((p, i) => (
              <View key={p.slot.kind} style={[styles.dot, i === photoIndex && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: topInset + 8 }]}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
          >
            <Ionicons name="arrow-back" size={22} color="#1E1E1E" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Judul & status */}
          <Text style={styles.title}>{poi.name}</Text>
          <Text style={styles.category}>{poi.categoryLabel}</Text>
          <View style={styles.badgeRow}>
            <Badge
              icon="time-outline"
              label={openNow ? 'Buka sekarang' : 'Tutup'}
              tone={openNow ? 'good' : 'muted'}
            />
            {poi.isHalal === true ? <Badge icon="checkmark-circle-outline" label="Halal" tone="good" /> : null}
            {visited ? <Badge icon="footsteps-outline" label="Sudah dikunjungi" tone="good" /> : null}
            <Badge icon="pricetag-outline" label={`${rupiah(poi.priceMinIdr)} – ${rupiah(poi.priceMaxIdr)}`} />
          </View>

          {/* Audio narasi + transkrip */}
          <Text style={styles.sectionTitle}>Cerita Kuliner</Text>
          <NarrationPlayer poi={poi} showSkip />
          {story ? (
            <Text style={styles.storyText}>{story}</Text>
          ) : (
            <Text style={styles.mutedText}>Cerita budaya tenant ini sedang disiapkan.</Text>
          )}

          {/* Menu */}
          <Text style={styles.sectionTitle}>Menu & Harga</Text>
          {poi.menu.length ? (
            poi.menu.map((m) => (
              <View key={m.id} style={styles.menuRow}>
                <View style={styles.menuNameCol}>
                  <Text style={styles.menuName}>
                    {m.name}
                    {m.isSignature ? '  ' : ''}
                    {m.isSignature ? <Ionicons name="star" size={12} color="#FFB800" /> : null}
                  </Text>
                  {m.tastes.length ? <Text style={styles.menuTastes}>{m.tastes.join(' · ')}</Text> : null}
                </View>
                <Text style={styles.menuPrice}>{rupiah(m.priceIdr)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>Menu belum tersedia.</Text>
          )}

          {/* Jam operasional */}
          <Text style={styles.sectionTitle}>Jam Operasional</Text>
          {poi.openingHours.length ? (
            hours.map((h, day) => (
              <View key={h.day} style={styles.hourRow}>
                <Text style={[styles.hourDay, day === today && styles.hourToday]}>{h.day}</Text>
                <Text style={[styles.hourValue, day === today && styles.hourToday]}>{h.hours}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>Jam operasional belum tersedia.</Text>
          )}

          <Pressable
            style={[styles.primaryBtn, styles.navigateBtn]}
            onPress={() => router.push(`/navigate/${poi.id}`)}
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Arahkan ke Tenant</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Badge({
  icon,
  label,
  tone = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'good' | 'muted' | 'neutral';
}) {
  const color = tone === 'good' ? '#1E7B3A' : tone === 'muted' ? '#8A8A8A' : '#5A4136';
  return (
    <View style={[styles.badge, tone === 'good' && styles.badgeGood]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background,
  },
  emptyTitle: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onSurface },
  photoPlaceholder: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF4EA',
  },
  photoPlaceholderText: { fontFamily: fontFamily.regular, fontSize: 12, color: '#A86A3A' },
  dots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' },
  dotActive: { width: 16, backgroundColor: ACCENT },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.onSurface },
  category: { fontFamily: fontFamily.regular, fontSize: 14, color: '#707070', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
  },
  badgeGood: { backgroundColor: '#E5F5EA' },
  badgeText: { fontFamily: fontFamily.medium, fontSize: 12 },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.onSurface,
    marginTop: 24,
    marginBottom: 10,
  },
  storyText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#3A3A3A',
    marginTop: 12,
  },
  mutedText: { fontFamily: fontFamily.regular, fontSize: 13, color: '#8A8A8A', marginTop: 4 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    gap: 12,
  },
  menuNameCol: { flex: 1 },
  menuName: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.onSurface },
  menuTastes: { fontFamily: fontFamily.regular, fontSize: 12, color: '#8A8A8A', marginTop: 2 },
  menuPrice: { fontFamily: fontFamily.semibold, fontSize: 14, color: ACCENT },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  hourDay: { fontFamily: fontFamily.regular, fontSize: 14, color: '#5A5A5A' },
  hourValue: { fontFamily: fontFamily.regular, fontSize: 14, color: '#5A5A5A' },
  hourToday: { fontFamily: fontFamily.semibold, color: colors.onSurface },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  navigateBtn: { marginTop: 28 },
  primaryBtnText: { fontFamily: fontFamily.semibold, fontSize: 15, color: '#FFFFFF' },
});
