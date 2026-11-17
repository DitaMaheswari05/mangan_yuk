import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
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
import { CONTENT_ASSETS } from '@/data/assets';
import { useUserLocation } from '@/features/location';
import { getPois } from '@/features/poi';
import { searchPois, type SearchResultItem } from '@/features/search';
import type { FoodType, PriceBucket, TasteTag } from '@/types/content';

function formatRupiah(val: number): string {
  return `Rp${val.toLocaleString('id-ID')}`;
}

const CATEGORY_CHIPS = [
  { id: 'semua', label: 'Semua' },
  { id: 'mie', label: 'Mie & Kwetiau' },
  { id: 'nasi', label: 'Nasi' },
  { id: 'chinese', label: 'Chinese Food' },
  { id: 'soto', label: 'Soto & Sop' },
  { id: 'sate', label: 'Sate & Daging' },
  { id: 'jajanan', label: 'Camilan' },
  { id: 'minuman', label: 'Minuman' },
  { id: 'non-halal', label: 'Non-Halal' },
];

const PRICE_OPTIONS: { id: PriceBucket; label: string; sub: string }[] = [
  { id: 'under15k', label: '< Rp15.000', sub: 'Terjangkau' },
  { id: '15to30k', label: 'Rp15rb - Rp30rb', sub: 'Sedang' },
  { id: 'over30k', label: '> Rp30.000', sub: 'Kenyang' },
];

const TASTE_OPTIONS: { id: TasteTag; label: string }[] = [
  { id: 'manis', label: 'Manis' },
  { id: 'pedas', label: 'Pedas' },
  { id: 'gurih', label: 'Gurih' },
  { id: 'segar', label: 'Segar' },
  { id: 'aromatik', label: 'Aromatik' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [selectedTaste, setSelectedTaste] = useState<TasteTag | null>(null);
  const [selectedPriceBucket, setSelectedPriceBucket] = useState<PriceBucket | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const pois = useMemo(() => getPois(), []);

  // Eksekusi mesin pencari toleran typo (Fuse.js) & filter
  const searchResponse = useMemo(() => {
    return searchPois(pois, {
      query,
      taste: selectedTaste ?? undefined,
      priceBucket: selectedPriceBucket ?? undefined,
      openNow: openNowOnly || undefined,
      userCoordinate: position?.coordinate,
      sortBy: query.trim() ? 'relevance' : 'distance',
    });
  }, [pois, query, selectedTaste, selectedPriceBucket, openNowOnly, position]);

  // Filter kategori horizontal chip
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'semua') {
      return searchResponse.results;
    }

    return searchResponse.results.filter(({ poi }) => {
      const cl = poi.categoryLabel.toLowerCase();
      const menuNames = poi.menu.map((m) => m.name.toLowerCase()).join(' ');
      const dishCats = poi.menu.map((m) => (m.dishCategory || '').toLowerCase());
      const ptype = poi.type;

      switch (selectedCategory) {
        case 'mie':
          return (
            cl.includes('mie') ||
            cl.includes('kwetiau') ||
            menuNames.includes('mie') ||
            menuNames.includes('kwetiau') ||
            dishCats.includes('mie') ||
            dishCats.includes('kwetiau-bihun')
          );
        case 'nasi':
          return (
            cl.includes('nasi') ||
            menuNames.includes('nasi') ||
            dishCats.includes('nasi')
          );
        case 'chinese':
          return (
            cl.includes('chinese') ||
            cl.includes('bak kut') ||
            cl.includes('claypot') ||
            cl.includes('kwetiau')
          );
        case 'soto':
          return (
            cl.includes('soto') ||
            cl.includes('bakso') ||
            cl.includes('sop') ||
            dishCats.includes('soto-sup')
          );
        case 'sate':
          return (
            cl.includes('sate') ||
            cl.includes('babi') ||
            cl.includes('bebek') ||
            cl.includes('samcan') ||
            dishCats.includes('sate')
          );
        case 'jajanan':
          return (
            ptype === 'jajanan' ||
            cl.includes('gorengan') ||
            cl.includes('pempek') ||
            cl.includes('kuo tie') ||
            cl.includes('bacang') ||
            cl.includes('cakue') ||
            dishCats.includes('gorengan') ||
            dishCats.includes('dimsum-bakpao') ||
            dishCats.includes('pempek')
          );
        case 'minuman':
          return (
            ptype === 'minuman' ||
            cl.includes('kopi') ||
            cl.includes('jus') ||
            cl.includes('susu') ||
            cl.includes('bir') ||
            dishCats.includes('kopi') ||
            dishCats.includes('jus-es-buah') ||
            dishCats.includes('susu') ||
            dishCats.includes('teh') ||
            dishCats.includes('minuman-lain')
          );
        case 'non-halal':
          return poi.isHalal === false;
        default:
          return true;
      }
    });
  }, [searchResponse.results, selectedCategory]);

  const activeFilterCount =
    (selectedCategory !== 'semua' ? 1 : 0) +
    (selectedTaste ? 1 : 0) +
    (selectedPriceBucket ? 1 : 0) +
    (openNowOnly ? 1 : 0);

  const resetFilters = () => {
    setSelectedCategory('semua');
    setSelectedTaste(null);
    setSelectedPriceBucket(null);
    setOpenNowOnly(false);
  };

  const renderResultItem = ({ item }: { item: SearchResultItem }) => {
    const { poi, distanceM, matchedMenuNames } = item;

    const firstPhotoKey = poi.photos && poi.photos.length > 0 ? poi.photos[0].assetKey : null;
    const photoSource = firstPhotoKey ? CONTENT_ASSETS[firstPhotoKey] : null;

    const categoryName = poi.categoryLabel ? poi.categoryLabel.split('/')[0].trim() : 'Kuliner';
    const halalStatusText = poi.isHalal === false ? 'Non-Halal' : poi.isHalal === true ? 'Halal' : 'Umum';

    const priceText = `Rp${(poi.priceMinIdr || 15000).toLocaleString('id-ID')}–${(poi.priceMaxIdr || 50000).toLocaleString('id-ID')}`;

    const walkingMin =
      distanceM !== undefined
        ? Math.max(1, Math.ceil(distanceM / 60))
        : poi.avgVisitMin
          ? Math.min(5, Math.ceil(poi.avgVisitMin / 5))
          : 3;

    return (
      <Pressable
        style={styles.poiCard}
        onPress={() => router.push(`/poi/${poi.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Buka detail tenant ${poi.name}`}
      >
        {/* Foto Thumbnail & Rating Badge */}
        <View style={styles.thumbWrapper}>
          {photoSource ? (
            <Image source={photoSource} style={styles.tenantPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={26} color="#FF8316" />
            </View>
          )}

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#FFCC24" />
            <Text style={styles.ratingText}>4.5</Text>
          </View>
        </View>

        {/* Kolom Informasi Tenant */}
        <View style={styles.tenantInfoCol}>
          <View style={styles.nameAndTagsCol}>
            <Text style={styles.poiName} numberOfLines={1}>
              {poi.name}
            </Text>

            <View style={styles.categoryHalalRow}>
              <Text style={styles.categoryTagText}>{categoryName}</Text>
              <View style={styles.tagDot} />
              <Text style={styles.halalTagText}>{halalStatusText}</Text>
            </View>
          </View>

          {/* Rentang Harga */}
          <View style={styles.priceRow}>
            <Text style={styles.priceRangeText}>{priceText}</Text>
            <Text style={styles.perPersonText}>/orang</Text>
          </View>

          {/* Divider */}
          <View style={styles.cardInnerDivider} />

          {/* Jarak jalan & waktu */}
          <View style={styles.distanceWalkRow}>
            <Text style={styles.distanceText}>
              {distanceM !== undefined ? `${distanceM}m` : '200m'}
            </Text>
            <View style={styles.walkMetaBadge}>
              <Ionicons name="walk" size={13} color="#A6A6A6" />
              <Text style={styles.walkMinutesText}>{walkingMin} menit</Text>
            </View>

            {matchedMenuNames && matchedMenuNames.length > 0 ? (
              <View style={styles.matchedTag}>
                <Ionicons name="sparkles" size={10} color="#FF8316" />
                <Text style={styles.matchedTagText} numberOfLines={1}>
                  {matchedMenuNames[0]}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Block sesuai Figma #251:80045 */}
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Jelajahi Kuliner</Text>

        {/* Kategori Horizontal Scroll Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {CATEGORY_CHIPS.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  active ? styles.categoryChipActive : styles.categoryChipInactive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                accessibilityRole="button"
                accessibilityLabel={`Kategori ${cat.label}`}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active ? styles.categoryChipTextActive : styles.categoryChipTextInactive,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search Bar Input dengan Filter Button */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#666666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari tenant atau menu"
            placeholderTextColor="#666666"
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
              style={{ paddingRight: 4 }}
            >
              <Ionicons name="close-circle" size={17} color="#A6A6A6" />
            </Pressable>
          ) : null}

          {/* Tombol Filter */}
          <Pressable
            style={styles.filterBtn}
            onPress={() => setFilterModalVisible(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Filter pencarian (${activeFilterCount} aktif)`}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? '#FF8316' : '#666666'}
            />
            {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>
      </View>

      {/* Info Bar: Hasil Pencarian */}
      <View style={styles.statusBar}>
        <Text style={styles.statusCount}>
          Ditemukan <Text style={styles.statusCountBold}>{filteredResults.length}</Text> tenant
        </Text>
        <Text style={styles.statusSpeed}>
          {searchResponse.executionTimeMs}ms (offline)
        </Text>
      </View>

      {/* Daftar Kartu Tenant */}
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.poi.id}
        renderItem={renderResultItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="food-off-outline" size={44} color="#C4B4AB" />
            <Text style={styles.emptyTitle}>Tidak ada hasil ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba gunakan kata kunci lain atau pilih kategori kuliner yang berbeda.
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
                <Ionicons name="close" size={24} color="#404040" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Seksi Rentang Budget */}
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
                  size={22}
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
                  Terapkan ({filteredResults.length} Tenant)
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
    backgroundColor: '#FFFFFF',
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 12,
  },
  pageTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 30,
    color: '#404040',
    marginBottom: 2,
  },
  categoryChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  categoryChipActive: {
    backgroundColor: '#FF8316',
  },
  categoryChipInactive: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  categoryChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  categoryChipTextInactive: {
    color: '#707070',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#404040',
    paddingVertical: 0,
  },
  filterBtn: {
    paddingLeft: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF8316',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  statusCount: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8E7164',
  },
  statusCountBold: {
    fontFamily: fontFamily.semibold,
    color: '#404040',
  },
  statusSpeed: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#FF8316',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 12,
  },
  poiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFF0DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbWrapper: {
    width: 97,
    height: 91,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  tenantPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DC',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#FFF0DC',
  },
  ratingText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 13,
    color: '#404040',
  },
  tenantInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3.5,
  },
  nameAndTagsCol: {
    gap: 3,
  },
  poiName: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 19,
    color: '#404040',
  },
  categoryHalalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryTagText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  tagDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#A6A6A6',
  },
  halalTagText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceRangeText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 16,
    color: '#FF8316',
  },
  perPersonText: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    lineHeight: 14,
    color: '#A6A6A6',
  },
  cardInnerDivider: {
    height: 0.5,
    backgroundColor: '#E6E6E6',
    marginVertical: 1,
  },
  distanceWalkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#A6A6A6',
  },
  walkMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  walkMinutesText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#A6A6A6',
  },
  matchedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0DC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    maxWidth: 100,
  },
  matchedTagText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: '#FF8316',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: '#404040',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#A6A6A6',
    textAlign: 'center',
    maxWidth: 240,
  },
  resetFilterBtn: {
    backgroundColor: '#FF8316',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  resetFilterBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.44)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE8',
  },
  modalTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    color: '#404040',
  },
  modalBody: {
    paddingVertical: 6,
  },
  filterSectionTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#404040',
    marginBottom: 6,
    marginTop: 8,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  modalOptionCard: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  modalOptionCardActive: {
    borderColor: '#FF8316',
    backgroundColor: '#FFF0DC',
  },
  modalOptionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#404040',
  },
  modalOptionLabelActive: {
    color: '#FF8316',
  },
  modalOptionSub: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: '#A6A6A6',
    marginTop: 1,
  },
  modalOptionSubActive: {
    color: '#FF8316',
  },
  tasteChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tasteChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#F9F9F9',
  },
  tasteChipActive: {
    borderColor: '#FF8316',
    backgroundColor: '#FFF0DC',
  },
  tasteChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    color: '#707070',
  },
  tasteChipTextActive: {
    color: '#FF8316',
  },
  openNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#F9F9F9',
    marginTop: 2,
  },
  openNowRowActive: {
    borderColor: '#FF8316',
    backgroundColor: '#FFF0DC',
  },
  openNowTextCol: {
    flex: 1,
  },
  openNowTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    color: '#404040',
  },
  openNowSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    color: '#A6A6A6',
    marginTop: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE8',
  },
  modalResetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  modalResetBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#707070',
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: '#FF8316',
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalApplyBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
