import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fontFamily } from '@/constants/theme';
import { getPois } from '@/features/poi';
import { PassportClient, type CreatePoiReviewInput, type PoiReview } from '@/features/passport';
import { useVisitedPoiIds } from '@/features/visits';
import type { MenuItem, Poi } from '@/types/content';

interface CreateReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newReview: PoiReview) => void;
  initialPoiId?: string;
}

export function CreateReviewModal({
  visible,
  onClose,
  onSuccess,
  initialPoiId,
}: CreateReviewModalProps) {
  const insets = useSafeAreaInsets();
  // Ulasan hanya untuk tenant yang pernah dikunjungi (tercatat lewat dwell).
  const visitedIds = useVisitedPoiIds();
  const pois = useMemo(() => getPois().filter((p) => visitedIds.has(p.id)), [visitedIds]);

  const [selectedPoiId, setSelectedPoiId] = useState<string>(initialPoiId ?? '');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPoiPicker, setShowPoiPicker] = useState(false);
  const [showMenuPicker, setShowMenuPicker] = useState(false);

  const selectedPoi = useMemo(() => {
    return pois.find((p) => p.id === selectedPoiId) || pois[0];
  }, [pois, selectedPoiId]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Dibutuhkan', 'Mohon izinkan akses galeri foto untuk mengunggah foto review.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memilih foto.');
    }
  };

  const toggleMenuItem = (menuId: string) => {
    setSelectedMenuItems((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedPoi) {
      Alert.alert('Perhatian', 'Pilih tenant terlebih dahulu.');
      return;
    }

    try {
      setIsSubmitting(true);
      const input: CreatePoiReviewInput = {
        poiId: selectedPoi.id,
        rating,
        reviewText: reviewText.trim() || null,
        photoPath: photoUri || null,
        menuItemIds: selectedMenuItems,
      };

      const res = await PassportClient.submitReview(input);
      if (!res.ok) {
        Alert.alert('Gagal', res.error.message || 'Gagal menyimpan ulasan.');
        setIsSubmitting(false);
        return;
      }

      // Reset Form
      setReviewText('');
      setPhotoUri(null);
      setSelectedMenuItems([]);
      setRating(5);

      onSuccess(res.data.review);
      onClose();
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan sistem saat mengirim ulasan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.backBtnRow} onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#404040" />
            <Text style={styles.backBtnText}>Kembali</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Judul Layar */}
          <View style={styles.headerBlock}>
            <Text style={styles.pageTitle}>Buat Ulasan Resto</Text>
          </View>

          {/* 1. Pilih Tenant */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Pilih Tenant Kuliner</Text>
            {pois.length === 0 ? (
              <Text style={styles.noVisitText}>
                Kamu belum mengunjungi tenant mana pun. Mampir dulu ke tenant, lalu tulis ulasannya di sini.
              </Text>
            ) : (
            <Pressable
              style={styles.dropdownBtn}
              onPress={() => setShowPoiPicker(!showPoiPicker)}
            >
              <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                {selectedPoi ? selectedPoi.name : 'Pilih Resto / Tenant'}
              </Text>
              <Ionicons
                name={showPoiPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666666"
              />
            </Pressable>
            )}

            {showPoiPicker && (
              <View style={styles.dropdownListContainer}>
                <ScrollView
                  style={styles.dropdownScrollView}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {pois.map((poi) => (
                    <Pressable
                      key={poi.id}
                      style={[
                        styles.dropdownListItem,
                        poi.id === selectedPoi?.id && styles.dropdownListItemActive,
                      ]}
                      onPress={() => {
                        setSelectedPoiId(poi.id);
                        setSelectedMenuItems([]);
                        setShowPoiPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownListItemText,
                          poi.id === selectedPoi?.id && styles.dropdownListItemTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {poi.name}
                      </Text>
                      {poi.id === selectedPoi?.id && (
                        <Ionicons name="checkmark" size={16} color="#FF8316" />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 2. Rating Resto (Bintang 1..5) Sesuai Figma */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Rating Resto</Text>
            <View style={styles.starRow}>
              {([1, 2, 3, 4, 5] as const).map((starVal) => {
                const isActive = starVal <= rating;
                return (
                  <Pressable
                    key={starVal}
                    onPress={() => setRating(starVal)}
                    hitSlop={6}
                    style={styles.starBtn}
                  >
                    <Ionicons
                      name="star"
                      size={42}
                      color={isActive ? '#FFA044' : '#D9D9D9'}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 3. Udah Cobain Apa Aja? (Pilih Menu) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Udah Cobain Apa Aja?</Text>
            <Pressable
              style={styles.dropdownBtn}
              onPress={() => setShowMenuPicker(!showMenuPicker)}
            >
              <Text
                style={[
                  styles.dropdownSelectedText,
                  selectedMenuItems.length === 0 && styles.placeholderText,
                ]}
                numberOfLines={1}
              >
                {selectedMenuItems.length > 0
                  ? `${selectedMenuItems.length} menu dipilih`
                  : 'Kamu bisa pilih beberapa menu'}
              </Text>
              <Ionicons
                name={showMenuPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666666"
              />
            </Pressable>

            {/* Chip Menu yang sudah dipilih */}
            {selectedMenuItems.length > 0 && (
              <View style={styles.selectedMenuChipsRow}>
                {selectedMenuItems.map((menuId) => {
                  const item = selectedPoi?.menu.find((m) => m.id === menuId);
                  return (
                    <View key={menuId} style={styles.menuChipBadge}>
                      <Text style={styles.menuChipText} numberOfLines={1}>
                        {item ? item.name : menuId}
                      </Text>
                      <Pressable onPress={() => toggleMenuItem(menuId)} hitSlop={4}>
                        <Ionicons name="close" size={14} color="#8F3D00" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {showMenuPicker && selectedPoi && (
              <View style={styles.dropdownListContainer}>
                {selectedPoi.menu.length === 0 ? (
                  <Text style={styles.emptyMenuText}>Belum ada daftar menu terdaftar.</Text>
                ) : (
                  <ScrollView
                    style={styles.dropdownScrollView}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {selectedPoi.menu.map((menu) => {
                      const isChecked = selectedMenuItems.includes(menu.id);
                      return (
                        <Pressable
                          key={menu.id}
                          style={[styles.menuSelectItem, isChecked && styles.menuSelectItemActive]}
                          onPress={() => toggleMenuItem(menu.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.menuSelectName}>{menu.name}</Text>
                            <Text style={styles.menuSelectPrice}>
                              Rp{menu.priceIdr.toLocaleString('id-ID')}
                            </Text>
                          </View>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isChecked ? '#FF8316' : '#A6A6A6'}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* 4. Ulasan (Text Area) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Ulasan</Text>
            <View style={styles.textAreaBox}>
              <TextInput
                style={styles.textInput}
                placeholder="Punya cerita tentang resto? Tulis di sini!"
                placeholderTextColor="#A6A6A6"
                multiline
                numberOfLines={4}
                value={reviewText}
                onChangeText={setReviewText}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* 5. Unggah Foto */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Unggah Foto</Text>
            {photoUri ? (
              <View style={styles.photoPreviewWrapper}>
                <Image source={{ uri: photoUri }} style={styles.photoPreviewImage} />
                <Pressable
                  style={styles.removePhotoBtn}
                  onPress={() => setPhotoUri(null)}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={28} color="#FF4D4D" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.uploadDashedBox}>
                <Ionicons name="camera-outline" size={32} color="#A6A6A6" />
                <Text style={styles.uploadHintText}>Bagikan keseruanmu di resto!</Text>
                <Pressable style={styles.choosePhotoBtn} onPress={handlePickImage}>
                  <Text style={styles.choosePhotoBtnText}>Pilih Foto</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Tombol Kirim */}
          <View style={styles.submitSection}>
            <Pressable
              style={[styles.submitBtn, (isSubmitting || !selectedPoi) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting || !selectedPoi}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Kirim</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backBtnText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#404040',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  headerBlock: {
    marginBottom: 14,
  },
  pageTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    color: '#404040',
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#404040',
    marginBottom: 6,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dropdownSelectedText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#1E1E1E',
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: '#A6A6A6',
  },
  dropdownListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ECECEC',
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: 220,
  },
  dropdownListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  dropdownListItemActive: {
    backgroundColor: '#FFF4EA',
  },
  dropdownListItemText: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#333333',
  },
  dropdownListItemTextActive: {
    fontFamily: fontFamily.semibold,
    color: '#FF8316',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starBtn: {
    paddingVertical: 2,
  },
  selectedMenuChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  menuChipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE0B8',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },
  menuChipText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#8F3D00',
  },
  menuSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  menuSelectItemActive: {
    backgroundColor: '#FFF8F0',
  },
  menuSelectName: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#333333',
  },
  menuSelectPrice: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#FF8316',
    marginTop: 2,
  },
  emptyMenuText: {
    padding: 16,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#999999',
  },
  textAreaBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 72,
  },
  textInput: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 18,
    color: '#1E1E1E',
    minHeight: 56,
  },
  uploadDashedBox: {
    borderWidth: 1.5,
    borderColor: '#DCDCDC',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FAFAFA',
  },
  uploadHintText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#A6A6A6',
    textAlign: 'center',
  },
  choosePhotoBtn: {
    backgroundColor: '#FFA044',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginTop: 2,
  },
  choosePhotoBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  photoPreviewWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    height: 130,
    width: '100%',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  submitSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8316',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  noVisitText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: '#A86A3A',
    backgroundColor: '#FFF4EA',
    borderRadius: 12,
    padding: 12,
  },
  submitBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
