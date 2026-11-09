# Design System — Mangan Yuk 🍜

Dokumen ini merupakan panduan sistem desain resmi aplikasi **Mangan Yuk** (Tugas Besar II4011 Transformasi Digital). Sistem desain ini diturunkan dari token desain yang berada di [manganyuk-color-tokens.json](./manganyuk-color-tokens.json) dan [manganyuk-typography-tokens.json](./manganyuk-typography-tokens.json).

---

## 1. Filosofi & Karakter Visual

Mangan Yuk dirancang sebagai aplikasi pemandu wisata kuliner berbasis lokasi yang ramah, hangat, dan menggugah selera.
- **Kesan Utama**: Hangat, lezat, tradisional namun modern, dan mudah dinavigasi saat pengguna sedang berjalan kaki di kawasan kuliner.
- **Fondasi Token**: Mengadopsi standar **Material Design 3 (M3) Tokens** dengan penyesuaian aksen kuliner Nusantara (*terracotta/spiced orange*, *turmeric gold*, dan *coastal blue*).

---

## 2. Sistem Warna (Color Tokens)

### 2.1 Ringkasan Palet Semantik

| Kelompok | Token Utama | Nilai HEX | Karakter & Peruntukan |
|---|---|---|---|
| **Primary** (Orange & Brown) | `primary` | `#A14000` | Warna identitas brand, Tombol Utama (CTA), active state tab bar, pin marker POI utama. |
| **Primary Container** | `primary-container` | `#FF6A00` | Aksen tombol aktif, highlight kartu pilihan. |
| **Secondary** (Yellow / Gold) | `secondary` | `#785A00` | Aksen stempel Paspor Kuliner, rating/ulasan bintang, badge reward. |
| **Tertiary** (Blue) | `tertiary` | `#065CBB` | Garis rute navigasi, scrubber/waveform audio narasi, link eksternal. |
| **Neutral / Surface** | `surface` / `background` | `#FCF9F8` | Latar belakang aplikasi, card sheet, modal dialog. |
| **Surface Variant** | `surface-variant` | `#E5E2E1` | Garis pembatas (divider), placeholder gambar, background badge non-aktif. |
| **Text (On Surface)** | `on-surface` | `#1B1B1C` | Teks utama, judul, label dengan tingkat keterbacaan tinggi (high contrast). |
| **Error** (Red & Pink) | `error` | `#BA1A1A` | Peringatan geofence (keluar rute), validasi form, notifikasi gagal. |

---

### 2.2 Tabel Lengkap Token Warna

#### A. Orange & Brown (Primary & Accents)
| Token Key | HEX | Role / Penggunaan |
|---|---|---|
| `primary` | `#A14000` | CTA button, interactive icon, active marker |
| `primary-container` | `#FF6A00` | Hero banners, elevated active card |
| `on-primary` | `#FFFFFF` | Teks / ikon di atas warna `primary` |
| `on-primary-container` | `#571F00` | Teks / ikon di atas `primary-container` |
| `inverse-primary` | `#FFB694` | Aksen kontras pada mode gelap / dark container |
| `primary-fixed` | `#FFDBCC` | Chip filter terpilih, background badge lembut |
| `primary-fixed-dim` | `#FFB694` | State pressed pada chip filter |
| `on-primary-fixed` | `#351000` | Teks di atas `primary-fixed` |
| `on-primary-fixed-variant` | `#7B2F00` | Teks sekunder pada chip fixed |
| `surface-tint` | `#A14000` | Tint elevasi permukaan |
| `outline` | `#8E7164` | Border kartu, input text field border |
| `outline-variant` | `#E2BFB0` | Border divider halus, separator list POI |
| `on-surface-variant` | `#5A4136` | Subtitle, caption, jam operasional, estimasi waktu |

#### B. Yellow (Secondary & Gamifikasi Paspor)
| Token Key | HEX | Role / Penggunaan |
|---|---|---|
| `secondary` | `#785A00` | Badge prestasi kuliner, ikon bintang rating |
| `secondary-container` | `#FEC73A` | Stempel paspor yang telah dikoleksi |
| `on-secondary` | `#FFFFFF` | Teks di atas warna `secondary` |
| `on-secondary-container` | `#705400` | Teks di atas container secondary |
| `secondary-fixed` | `#FFDF9B` | Card reward paspor |
| `secondary-fixed-dim` | `#F5BF31` | Highlight paspor interaktif |
| `on-secondary-fixed` | `#251A00` | Teks pada card reward |
| `on-secondary-fixed-variant` | `#5B4300` | Label tambahan di paspor |

#### C. Blue (Tertiary & Navigasi/Audio)
| Token Key | HEX | Role / Penggunaan |
|---|---|---|
| `tertiary` | `#065CBB` | Garis polyline navigasi rute jalan kaki, tombol audio play |
| `tertiary-container` | `#5D98FB` | Progress bar audio narasi, background indikator trail |
| `on-tertiary` | `#FFFFFF` | Ikon / teks di atas warna `tertiary` |
| `on-tertiary-container` | `#002F68` | Teks di atas `tertiary-container` |
| `tertiary-fixed` | `#D7E2FF` | Background chip filter rute / trail |
| `tertiary-fixed-dim` | `#ACC7FF` | Pressed state rute trail |
| `on-tertiary-fixed` | `#001B40` | Teks kontras pada chip trail |
| `on-tertiary-fixed-variant` | `#004590` | Subtitle rute |

#### D. Neutral & Surface (Layout & Latar Belakang)
| Token Key | HEX | Role / Penggunaan |
|---|---|---|
| `background` | `#FCF9F8` | Background utama screen aplikasi |
| `on-background` | `#1B1B1C` | Teks utama pada background screen |
| `surface` | `#FCF9F8` | Permukaan layar dan view default |
| `on-surface` | `#1B1B1C` | Teks utama pada card dan modal |
| `surface-dim` | `#DCD9D9` | State disabled atau backdrop modal |
| `surface-bright` | `#FCF9F8` | Surface dengan pencahayaan tinggi |
| `surface-container-lowest` | `#FFFFFF` | Kartu POI murni, pop-up modal, drawer |
| `surface-container-low` | `#F6F3F2` | Bottom sheet background, search bar background |
| `surface-container` | `#F0EDED` | List item card default |
| `surface-container-high` | `#EAE7E7` | Card elevasi level 2 |
| `surface-container-highest` | `#E5E2E1` | Header bar background, sticky action bar |
| `surface-variant` | `#E5E2E1` | Background skeleton loading |
| `inverse-surface` | `#303030` | SnackBar / Toast background |
| `inverse-on-surface` | `#F3F0EF` | Teks pada SnackBar / Toast |

#### E. Red & Pink (Error & Validasi)
| Token Key | HEX | Role / Penggunaan |
|---|---|---|
| `error` | `#BA1A1A` | Ikon error, peringatan geofence di luar radius |
| `error-container` | `#FFDAD6` | Banner peringatan GPS / lokasi dinonaktifkan |
| `on-error` | `#FFFFFF` | Teks pada tombol konfirmasi error |
| `on-error-container` | `#93000A` | Teks pada banner error GPS |

---

## 3. Sistem Tipografi (Typography Tokens)

### 3.1 Font Family
- **Font Utama**: `Chiron GoRound TC`
- **Fallback**: `'System Round', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Karakter**: Memiliki lekukan membulat (*rounded terminal*) yang bersahabat, santai, dan modern, cocok dengan tema kuliner.

### 3.2 Hierarki & Skala Tipografi

| Kategori Token | Font Size | Line Height | Weight | Rekomendasi Penggunaan di Screen |
|---|---|---|---|---|
| `Headline-72` | 72px | 80px | 700 (Bold) | Splash screen / display khusus landing |
| `Headline-48` | 48px | 56px | 700 (Bold) | Judul hero onboarding |
| `Headline-32` | 32px | 40px | 700 (Bold) | Header halaman utama (Beranda, Paspor, Trail) |
| `Sub-headline-32`| 32px | 40px | 600 (Semibold)| Sub-judul section besar |
| `Text-lg-Bold` | 18px | 28px | 700 (Bold) | Nama POI pada modal / detail POI |
| `Text-lg-Semibold`| 18px | 28px | 600 (Semibold)| Label tombol utama (CTA Button) |
| `Text-lg-Medium` | 18px | 28px | 500 (Medium) | Judul kartu POI di list/peta |
| `Text-lg-Regular`| 18px | 28px | 400 (Regular) | Teks pembuka transkrip narasi audio |
| `Text-md-Bold` | 16px | 24px | 700 (Bold) | Nama gerai kuliner pada kartu ringkas |
| `Text-md-Semibold`| 16px | 24px | 600 (Semibold)| Judul filter, label tab aktif |
| `Text-md-Medium` | 16px | 24px | 500 (Medium) | Teks input form, teks navigasi tombol |
| `Text-md-Regular`| 16px | 24px | 400 (Regular) | Body text narasi audio, deskripsi POI |
| `Text-sm-Bold` | 14px | 20px | 700 (Bold) | Status stempel ("Terkunjungi"), estimasi jarak |
| `Text-sm-Semibold`| 14px | 20px | 600 (Semibold)| Badge kategori kuliner ("Halal", "Legendaris") |
| `Text-sm-Medium` | 14px | 20px | 500 (Medium) | Jam buka-tutup, jarak meter (`150 m`) |
| `Text-sm-Regular`| 14px | 20px | 400 (Regular) | Alamat lengkap POI, footnote |
| `Text-xs-Medium` | 12px | 16px | 500 (Medium) | Label Tab Bar (Bawah), caption status |
| `Text-xs-Regular`| 12px | 16px | 400 (Regular) | Atribusi peta OSM (OpenStreetMap attribution) |

---

## 4. Panduan Komponen Kunci (Fitur F01–F10)

```
┌────────────────────────────────────────────────────────┐
│ [Beranda / Peta Interaktif]                           │
│  - Background Tile: OpenStreetMap                      │
│  - POI Pin Marker: Primary (#A14000)                   │
│  - Geofence Radius Circle: Primary Tint + Transparan  │
│  - Trail Route Polyline: Tertiary (#065CBB, 4px)       │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [Card Bottom Sheet - POI Terdekat] (Lowest #FFFFFF)│ │
│ │ • Judul POI: Text-lg-Bold (On-Surface #1B1B1C)     │ │
│ │ • Jarak: Text-sm-Medium (On-Surface-Variant)       │ │
│ │ • Tombol Putar Audio: Primary Container (#FF6A00)  │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

1. **Peta & Geofence (F01, F02, F06)**:
   - Polyline navigasi dan trail menggunakan warna `tertiary` (`#065CBB`).
   - Marker POI reguler menggunakan warna `primary` (`#A14000`).
   - Indikator radius geofence menggunakan `surface-tint` dengan opacity 15%.
2. **Audio Narasi & Notifikasi (F03, F04)**:
   - Scrubber audio & equalizer bar menggunakan `tertiary` dan `tertiary-container`.
   - Card pemutar audio mengambang menggunakan background `surface-container-lowest` (`#FFFFFF`) dengan elevasi bayangan halus.
3. **Paspor Kuliner (F10)**:
   - Stempel belum terkunjungi: `surface-variant` (`#E5E2E1`) dengan ikon monokrom.
   - Stempel sudah dikoleksi: `secondary-container` (`#FEC73A`) dan `secondary` (`#785A00`) dengan border emas.

---

## 5. Integrasi ke Kode Frontend

Untuk kemudahan pengembang, token ini dipetakan ke modul TypeScript di:
`frontend/src/constants/theme.ts`

### Contoh Penggunaan dalam Komponen React Native:
```tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography } from '@/constants/theme';

export const PoiCard = ({ name, category, distance }: { name: string; category: string; distance: string }) => (
  <View style={styles.card}>
    <Text style={styles.title}>{name}</Text>
    <Text style={styles.category}>{category}</Text>
    <Text style={styles.distance}>{distance}</Text>
    <Pressable style={styles.button}>
      <Text style={styles.buttonText}>Dengarkan Cerita</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  title: {
    ...typography.textLgBold,
    color: colors.onSurface,
  },
  category: {
    ...typography.textSmMedium,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  distance: {
    ...typography.textSmBold,
    color: colors.primary,
    marginTop: 2,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.textMdSemibold,
    color: colors.onPrimary,
  },
});
```
