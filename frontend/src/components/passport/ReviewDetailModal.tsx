import React, { useRef } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { fontFamily } from '@/constants/theme';
import { resolveAsset } from '@/features/audio';
import { getPoiById } from '@/features/poi';
import { StampBadge } from './StampBadge';
import type { PoiReview } from '@/features/passport';

interface ReviewDetailModalProps {
  visible: boolean;
  onClose: () => void;
  review: PoiReview | null;
}

export function ReviewDetailModal({ visible, onClose, review }: ReviewDetailModalProps) {
  const insets = useSafeAreaInsets();
  const ticketRef = useRef<any>(null);

  if (!review) return null;

  const poi = getPoiById(review.poiId);
  const poiName = poi?.name ?? 'Tenant Kuliner';

  // Format tanggal (mis. 20/06/26)
  const formattedDate = (() => {
    try {
      const d = new Date(review.createdAt);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return '20/06/26';
    }
  })();

  // Foto review dari user atau foto cover default dari tenant
  const imageSource = (() => {
    if (review.photoPath) {
      return { uri: review.photoPath };
    }
    const defaultPhotoKey = poi?.photos?.[0]?.assetKey;
    const resolved = resolveAsset(defaultPhotoKey);
    return resolved;
  })();

  const handleShareOrDownload = async () => {
    try {
      if (!ticketRef.current) return;
      const uri = await captureRef(ticketRef, {
        format: 'png',
        quality: 0.95,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Paspor Kuliner - ${poiName}`,
          mimeType: 'image/png',
        });
      } else {
        Alert.alert('Sukses', 'Gambar stempel paspor berhasil dibuat!');
      }
    } catch {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengunduh/membagikan gambar.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        {/* Top Bar Header */}
        <View style={styles.topBar}>
          <Pressable style={styles.backCircleBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {poiName}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Tiket Paspor Oranye/Putih Sesuai Figma */}
          <View ref={ticketRef} collapsable={false} style={styles.ticketCard}>
            {/* Bagian Atas Tiket: Foto & Review Details */}
            <View style={styles.ticketTopSection}>
              {/* Foto Tenant / Review */}
              <View style={styles.photoContainer}>
                {imageSource ? (
                  <Image source={imageSource} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="restaurant-outline" size={48} color="#FF8316" />
                  </View>
                )}
              </View>

              {/* Baris Tanggal & Rating */}
              <View style={styles.metaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Tanggal</Text>
                  <Text style={styles.metaValue}>{formattedDate}</Text>
                </View>

                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Rating</Text>
                  <View style={styles.starRatingRow}>
                    {([1, 2, 3, 4, 5] as const).map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={18}
                        color={s <= review.rating ? '#FFA044' : '#D9D9D9'}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {/* Daftar Makanan / Menu Dicicipi */}
              {review.menuItemIds && review.menuItemIds.length > 0 && (
                <View style={styles.menuSection}>
                  <Text style={styles.metaLabel}>Makanan</Text>
                  <View style={styles.menuChipsRow}>
                    {review.menuItemIds.map((menuId) => {
                      const item = poi?.menu.find((m) => m.id === menuId);
                      return (
                        <View key={menuId} style={styles.menuBadge}>
                          <Text style={styles.menuBadgeText} numberOfLines={1}>
                            {item ? item.name : menuId}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Teks Ulasan */}
              {review.reviewText ? (
                <View style={styles.reviewTextSection}>
                  <Text style={styles.metaLabel}>Ulasan</Text>
                  <Text style={styles.reviewBodyText}>{review.reviewText}</Text>
                </View>
              ) : null}
            </View>

            {/* Garis Potong / Perforated Divider Berlubang Kiri-Kanan */}
            <View style={styles.perforatedRow}>
              <View style={styles.notchLeft} />
              <View style={styles.dashedLine} />
              <View style={styles.notchRight} />
            </View>

            {/* Bagian Bawah Tiket: Nama Resto Besar Watermark + Stempel Paspor */}
            <View style={styles.ticketBottomSection}>
              {/* Nama Resto Watermark */}
              <Text style={styles.watermarkPoiName} numberOfLines={2}>
                {poiName}
              </Text>

              {/* Stempel Melingkar Paspor Kuliner */}
              <View style={styles.stampWrapper}>
                <StampBadge size={120} color="#E66B00" />
              </View>
            </View>
          </View>

          {/* Action Buttons: Unduh / Bagikan Gambar */}
          <View style={styles.actionRow}>
            <Pressable style={styles.moreActionBtn} onPress={onClose}>
              <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable style={styles.downloadBtn} onPress={handleShareOrDownload}>
              <Ionicons name="download-outline" size={20} color="#E66B00" />
              <Text style={styles.downloadBtnText}>Unduh Gambar</Text>
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
    backgroundColor: '#FF8316', // Latar oranye khas Figma #366:98597
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  ticketTopSection: {
    padding: 18,
  },
  photoContainer: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFF4EA',
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#A6A6A6',
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: '#1E1E1E',
  },
  starRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  menuSection: {
    marginBottom: 14,
  },
  menuChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  menuBadge: {
    backgroundColor: '#FFE0B8',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  menuBadgeText: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#8F3D00',
  },
  reviewTextSection: {
    marginTop: 2,
  },
  reviewBodyText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#1E1E1E',
  },
  perforatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF8316',
    marginLeft: -10,
  },
  notchRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF8316',
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#FF8316',
    borderStyle: 'dashed',
    marginHorizontal: 10,
  },
  ticketBottomSection: {
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  watermarkPoiName: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    color: '#FFE0B8',
    textAlign: 'center',
    opacity: 0.6,
  },
  stampWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  moreActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFA044',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  downloadBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: '#E66B00',
  },
});
