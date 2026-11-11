import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
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

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { position } = useUserLocation();

  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FoodType | null>(null);
  const [selectedTaste, setSelectedTaste] = useState<TasteTag | null>(null);
  const [selectedPriceBucket, setSelectedPriceBucket] = useState<PriceBucket | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);

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

  const renderResultItem = ({ item }: { item: SearchResultItem }) => {
    const { poi, distanceM, matchedFields, matchedMenuNames } = item;

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
          </View>
        }
      />
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
    paddingBottom: 8,
  },
  searchBar: {
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
    color: '#A14000',
  },
  statusSpeed: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: '#8E7164',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0EDED',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFDBCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleCol: {
    flex: 1,
    gap: 2,
  },
  poiName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: '#1B1B1C',
  },
  poiCategory: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#707070',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF2EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#FF8316',
  },
  matchedMenuBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFECE4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchedMenuText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: '#A14000',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F6F3F2',
  },
  priceRange: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#5A4136',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8316',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: '#1B1B1C',
  },
  emptySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#707070',
    textAlign: 'center',
    lineHeight: 18,
  },
});
