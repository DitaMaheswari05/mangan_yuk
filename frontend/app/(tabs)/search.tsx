import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
import { searchPois, type SearchResultItem } from '@/features/search';
import type { FoodType, PriceBucket, TasteTag } from '@/types/content';

function formatRupiah(val: number): string {
  return `Rp${val.toLocaleString('id-ID')}`;
}

const PRICE_OPTIONS: { id: PriceBucket; label: string; sub: string }[] = [
  { id: 'under15k', label: '< Rp15.000', sub: 'Terjangkau' },
  { id: '15to30k', label: 'Rp15rb - Rp30rb', sub: 'Sedang' },
  { id: 'over30k', label: '> Rp30.000', sub: 'Kenyang' },
];

const TASTE_OPTIONS: { id: TasteTag; label: string; icon: string }[] = [
  { id: 'manis', label: 'Manis', icon: 'candy-outline' },
  { id: 'pedas', label: 'Pedas', icon: 'chili-hot' },
  { id: 'gurih', label: 'Gurih', icon: 'salt' },
  { id: 'segar', label: 'Segar', icon: 'cup-water' },
  { id: 'aromatik', label: 'Aromatik', icon: 'flower' },
];

const TYPE_OPTIONS: { id: FoodType; label: string }[] = [
  { id: 'makanan', label: 'Makanan Berat' },
  { id: 'minuman', label: 'Minuman' },
  { id: 'jajanan', label: 'Camilan / Jajanan' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();

  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FoodType | null>(null);
  const [selectedTaste, setSelectedTaste] = useState<TasteTag | null>(null);
  const [selectedPriceBucket, setSelectedPriceBucket] = useState<PriceBucket | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const pois = useMemo(() => getPois(), []);

  // Eksekusi mesin pencari toleran typo (Fuse.js) & filter
  const searchResponse = useMemo(() => {
    return searchPois(pois, {
      query,
      type: selectedType ?? undefined,
      taste: selectedTaste ?? undefined,
      priceBucket: selectedPriceBucket ?? undefined,
      openNow: openNowOnly || undefined,
      userCoordinate: position?.coordinate,
      sortBy: query.trim() ? 'relevance' : 'distance',
    });
  }, [pois, query, selectedType, selectedTaste, selectedPriceBucket, openNowOnly, position]);

  const results = searchResponse.results;

  const activeFilterCount =
    (selectedType ? 1 : 0) +
    (selectedTaste ? 1 : 0) +
    (selectedPriceBucket ? 1 : 0) +
    (openNowOnly ? 1 : 0);

  const resetFilters = () => {
    setSelectedType(null);
    setSelectedTaste(null);
    setSelectedPriceBucket(null);
    setOpenNowOnly(false);
  };

  const renderResultItem = ({ item }: { item: SearchResultItem }) => {
    const { poi, distanceM, matchedMenuNames } = item;

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/poi/${poi.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Buka detail tenant ${poi.name}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="storefront-outline" size={24} color="#FF8316" />
          </View>

          <View style={styles.cardTitleCol}>
            <Text style={styles.poiName} numberOfLines={1}>
              {poi.name}
            </Text>
            <Text style={styles.poiCategory} numberOfLines={1}>
              {poi.categoryLabel} · {poi.zone}
            </Text>
          </View>

          {distanceM !== undefined ? (
            <View style={styles.distanceBadge}>
              <Ionicons name="location-outline" size={12} color="#FF8316" />
              <Text style={styles.distanceText}>~{distanceM}m</Text>
            </View>
          ) : null}
        </View>

        {/* Highlight kecocokan menu / keyword jika pencarian typo/nama menu cocok */}
        {matchedMenuNames && matchedMenuNames.length > 0 ? (
          <View style={styles.matchedMenuBanner}>
            <Ionicons name="sparkles" size={12} color="#A14000" />
            <Text style={styles.matchedMenuText} numberOfLines={1}>
              Menu cocok: {matchedMenuNames.join(', ')}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.priceRange}>
            {poi.priceMinIdr > 0
              ? `${formatRupiah(poi.priceMinIdr)} - ${formatRupiah(poi.priceMaxIdr)}`
              : 'Harga variatif'}
          </Text>

          <Pressable
            style={styles.navButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/navigate/${poi.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Navigasi ke ${poi.name}`}
          >
            <Text style={styles.navButtonText}>Navigasi</Text>
            <Ionicons name="paper-plane-outline" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Pencarian */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Cari tenant, menu (mis: batagr), kuliner..."
              placeholderTextColor="#8E7164"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Input pencarian tenant dan menu"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hapus pencarian"
              >
                <Ionicons name="close-circle" size={18} color="#8E7164" />
              </Pressable>
            ) : null}
          </View>

          {/* Tombol Buka Filter */}
          <Pressable
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
            onPress={() => setFilterModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filter pencarian (${activeFilterCount} filter aktif)`}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? '#FFFFFF' : '#FF8316'}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Quick Filter Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsScroll}
        >
          {/* Chip Buka Sekarang */}
          <Pressable
            style={[styles.chip, openNowOnly && styles.chipActive]}
            onPress={() => setOpenNowOnly(!openNowOnly)}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={openNowOnly ? '#FFFFFF' : '#5A4136'}
            />
            <Text style={[styles.chipText, openNowOnly && styles.chipTextActive]}>
              Buka Sekarang
            </Text>
          </Pressable>

          {/* Chips Kategori Jenis */}
          {TYPE_OPTIONS.map((item) => {
            const active = selectedType === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedType(active ? null : item.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Chips Kategori Harga */}
          {PRICE_OPTIONS.map((item) => {
            const active = selectedPriceBucket === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedPriceBucket(active ? null : item.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Info Jumlah Hasil & Waktu Eksekusi Offline */}
      <View style={styles.statusBar}>
        <Text style={styles.statusCount}>
          Ditemukan <Text style={styles.statusCountBold}>{results.length}</Text> tenant
        </Text>
        <Text style={styles.statusSpeed}>
          ⚡ {searchResponse.executionTimeMs}ms (offline)
        </Text>
      </View>

      {/* Daftar Hasil Pencarian */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.poi.id}
        renderItem={renderResultItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="food-off-outline" size={48} color="#C4B4AB" />
            <Text style={styles.emptyTitle}>Tidak ada hasil ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba gunakan kata kunci lain atau periksa filter yang aktif.
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable style={styles.resetFilterBtn} onPress={resetFilters}>
                <Text style={styles.resetFilterBtnText}>Reset Semua Filter</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      {/* Modal Filter Lengkap Multi-Kategori */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Kuliner</Text>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal filter"
              >
                <Ionicons name="close" size={24} color="#1B1B1C" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Seksi Rentang Harga */}
              <Text style={styles.filterSectionTitle}>Rentang Budget</Text>
              <View style={styles.filterOptionsGrid}>
                {PRICE_OPTIONS.map((item) => {
                  const active = selectedPriceBucket === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.modalOptionCard, active && styles.modalOptionCardActive]}
                      onPress={() => setSelectedPriceBucket(active ? null : item.id)}
                    >
                      <Text
                        style={[styles.modalOptionLabel, active && styles.modalOptionLabelActive]}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={[styles.modalOptionSub, active && styles.modalOptionSubActive]}
                      >
                        {item.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Seksi Profil Rasa */}
              <Text style={styles.filterSectionTitle}>Profil Rasa</Text>
              <View style={styles.tasteChipsGrid}>
                {TASTE_OPTIONS.map((item) => {
                  const active = selectedTaste === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.tasteChip, active && styles.tasteChipActive]}
                      onPress={() => setSelectedTaste(active ? null : item.id)}
                    >
                      <Text
                        style={[styles.tasteChipText, active && styles.tasteChipTextActive]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Seksi Status Jam Buka */}
              <Text style={styles.filterSectionTitle}>Waktu Kunjungan</Text>
              <Pressable
                style={[styles.openNowRow, openNowOnly && styles.openNowRowActive]}
                onPress={() => setOpenNowOnly(!openNowOnly)}
              >
                <View style={styles.openNowTextCol}>
                  <Text style={styles.openNowTitle}>Buka Sekarang</Text>
                  <Text style={styles.openNowSubtitle}>Hanya tampilkan tenant yang sedang buka</Text>
                </View>
                <Ionicons
                  name={openNowOnly ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={openNowOnly ? '#FF8316' : '#8E7164'}
                />
              </Pressable>
            </ScrollView>

            {/* Tombol Terapkan / Reset */}
            <View style={styles.modalFooter}>
              <Pressable style={styles.modalResetBtn} onPress={resetFilters}>
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </Pressable>
              <Pressable
                style={styles.modalApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.modalApplyBtnText}>
                  Terapkan ({results.length} Tenant)
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF9F8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#1B1B1C',
    paddingVertical: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4EA',
    borderWidth: 1.5,
    borderColor: '#FFDBCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FF8316',
    borderColor: '#FF8316',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#BA1A1A',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filterBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  quickChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E2E1',
  },
  chipActive: {
    backgroundColor: '#FF8316',
    borderColor: '#FF8316',
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#5A4136',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  statusCount: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
  },
  statusCountBold: {
    fontFamily: fontFamily.bold,
    color: '#1B1B1C',
  },
  statusSpeed: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#A14000',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleCol: {
    flex: 1,
  },
  poiName: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#1B1B1C',
  },
  poiCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#FF8316',
  },
  matchedMenuBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFDBCC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  matchedMenuText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#571F00',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EDED',
  },
  priceRange: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#FF8316',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#1B1B1C',
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#707070',
    textAlign: 'center',
    marginTop: 4,
  },
  resetFilterBtn: {
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  resetFilterBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: '#1B1B1C',
  },
  modalBody: {
    flexGrow: 0,
  },
  filterSectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: '#1B1B1C',
    marginTop: 14,
    marginBottom: 10,
  },
  filterOptionsGrid: {
    gap: 8,
  },
  modalOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    backgroundColor: '#FCF9F8',
  },
  modalOptionCardActive: {
    backgroundColor: '#FFF4EA',
    borderColor: '#FF8316',
  },
  modalOptionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#1B1B1C',
  },
  modalOptionLabelActive: {
    color: '#FF8316',
  },
  modalOptionSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#707070',
  },
  modalOptionSubActive: {
    color: '#A14000',
  },
  tasteChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tasteChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 12,
    color: '#5A4136',
  },
  tasteChipTextActive: {
    color: '#FFFFFF',
  },
  openNowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E2E1',
    backgroundColor: '#FCF9F8',
  },
  openNowRowActive: {
    backgroundColor: '#FFF4EA',
    borderColor: '#FF8316',
  },
  openNowTextCol: {
    flex: 1,
  },
  openNowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#1B1B1C',
  },
  openNowSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#707070',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EDED',
  },
  modalResetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E2E1',
  },
  modalResetBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#707070',
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: '#FF8316',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  modalApplyBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
