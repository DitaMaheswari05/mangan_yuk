# Dokumentasi Pengujian Unit Test — ManganYuk!

Dokumentasi ini memetakan seluruh file pengujian pada folder `unit-test/` terhadap Kebutuhan Fungsional (F01–F10), Product Backlog (PB-01 s.d. PB-16), dan Kebutuhan Non-Fungsional (NFR) berdasarkan **Scrum Document**, **PRD**, dan **Spesifikasi Tugas Besar Transformasi Digital STEI ITB**.

---

## 1. Struktur Folder Pengujian

```
unit-test/
├── 01-geofence-and-location.test.ts        # F01, F02, PB-05, PB-06, PB-07, NFR GPS Filter & Hysteresis
├── 02-poi-dataset-and-validator.test.ts    # F03, PB-04, Validasi V1–V7, PB08, Price Buckets, Jam Buka, Repo
├── 03-multimodal-and-audio.test.ts         # F03, F04, PB-08, PB-09, Narasi Budaya Sunda & Audio Offline
├── 04-typo-tolerant-search-and-filter.test.ts # F05, PB-10, Typo-Tolerant Search & Multi-Filter
├── 05-contextual-recommendation-engine.test.ts # F07, PB-13, Rule-Based Contextual Recommendation
├── 06-smart-culinary-trail-planner.test.ts # F08, PB-14, PB-15, Nearest Neighbor Trail & Dwell Alert
├── 07-navigation-and-compass.test.ts       # F06, PB-11, Navigasi Kompas, Deviasi Arah, Kedatangan, Audio Cue
├── 08-privacy-and-security-nfr.test.ts     # F09, NFR, PB-02, PB-17, Zero Network Location Leakage & Consent
├── 09-passport-and-gamification.test.ts    # F10, PB-16, Paspor Kuliner, Stempel Idempoten, Progres & Badge
└── 10-onboarding-and-permissions.test.ts   # PB-01, PB-02, F01, F09, Onboarding Flow, PermissionService, & State
```

---

## 2. Pemetaan Fitur & Rincian Kasus Uji

| File Test | Kebutuhan Terkait | Cakupan Kasus Uji & Edge Cases |
|---|---|---|
| **`01-geofence-and-location.test.ts`** | F01, F02, PB-05, PB-06, PB-07, NFR GPS | • Kalkulasi Haversine geodesik (akurasi meter, simetri, koordinat ekstrem ±90°/±180°).<br>• Filter GPS jitter: akurasi >30m diabaikan, akurasi ≤30m diproses, filter nilai NaN/Infinity/negatif.<br>• Meredam lonjakan palsu (spike) GPS agar tidak salah exit.<br>• Entry kawasan (100 m) & Exit kawasan dengan hysteresis 10 m (ambang 110 m).<br>• Pencegahan flapping di ambang batas 100–110 m.<br>• First fix sudah di dalam kawasan tidak memicu entry ganda.<br>• Proximity tenant (<15 m) & pelaporan jarak meter.<br>• Cooldown 30 menit per POI (masuk kembali <30 mnt diabaikan, ≥30 mnt dipicu lagi).<br>• Cooldown independen antar-POI.<br>• Deteksi Dwell time (diam ≥3 menit di tenant) memicu event DWELL.<br>• Durasi <3 menit tidak memicu DWELL; keluar sebelum 3 menit membatalkan timer.<br>• Exit tenant dengan hysteresis 10 m (radius 15 m + 10 m = keluar jika >25 m).<br>• Session teardown (`endGeofenceSession`). |
| **`02-poi-dataset-and-validator.test.ts`** | F03, PB-04, V1–V7, PB08 | • Validasi dataset asli bundel (`pois.json` & `area.json`) lolos 100% aturan PB04.<br>• V1: Menolak dataset jika jumlah POI < 10.<br>• V2: Format ID regex `^P\d{2}$`, menolak ID POI atau Menu duplikat.<br>• V3: Koordinat dalam rentang valid dan berada dalam toleransi radius kawasan Sudirman.<br>• V4: Menu non-kosong, nama non-kosong, harga integer > 0.<br>• V5: Format jam buka HH:mm, hari 0–6, menolak `open == close`.<br>• V5: Jam operasional lintas tengah malam (mis. Sabtu 17:00 – Minggu 02:00 pagi).<br>• V6: Validasi profil rasa (`tasteTags`) dan tipe makanan (`foodType`).<br>• V7: `triggerRadiusM > 0` dan `avgVisitMin > 0`.<br>• Penentuan kategori harga (`under15k`, `15to30k`, `over30k`). |
| **`03-multimodal-and-audio.test.ts`** | F03, F04, PB-08, PB-09 | • Resolusi aset bundel offline (`resolveAsset`) ke modul ID numerik.<br>• Penanganan assetKey kosong/null/undefined secara aman.<br>• Format tampilan jam audio (`formatClock`): 0s -> 0:00, 5s -> 0:05, 75s -> 1:15, desimal 75.8s -> 1:15, durasi negatif -> 0:00.<br>• Konfigurasi background audio session (`playsInSilentMode: true`, `shouldPlayInBackground: true`).<br>• Sifat idempoten konfigurasi sesi audio.<br>• Fallback offline: jika audio belum diekspor, player menandai `available: false` tanpa crash, transkrip cerita budaya tetap tampil. |
| **`04-typo-tolerant-search-and-filter.test.ts`** | F05, PB-10 | • Kalkulasi jarak edit Levenshtein (case-insensitive, substitusi, string kosong).<br>• Pencarian toleran salah ketik (fuzzy): "pndu" / "batagr" -> Pandu Baso Goreng Tenggiri.<br>• Pencarian "soto" -> Dapur Sotoku.<br>• Pencarian berbasis menu (mis. "pisang" / "gandasturi" -> Traditional Fried Food).<br>• Pencarian berbasis kategori, tipe makanan, dan `searchKeywords`.<br>• Multi-filter: rentang harga, profil rasa, tipe makanan, kehalalan, dan status buka saat ini (`openNow`).<br>• Edge cases: query kosong, whitespace, karakter spesial `!@#$%`, case insensitivity, kata kunci tidak relevan (`[]`). |
| **`05-contextual-recommendation-engine.test.ts`** | F07, PB-13 | • Sifat deterministik: input sama selalu menghasilkan rekomendasi, skor, dan urutan identik.<br>• Aturan eksklusi ketat: tenant tutup tidak pernah muncul.<br>• Tenant yang sudah dikunjungi (`visitedPoiIds`) tidak pernah muncul.<br>• Active POI tidak pernah muncul.<br>• Aturan pasangan rasa: setelah pedas disarankan minuman segar.<br>• Memperhitungkan sisa budget dalam skoring.<br>• Setiap rekomendasi memuat string alasan rasional yang transparan.<br>• Maksimal 3 rekomendasi teratas.<br>• Edge cases: semua tenant sudah dikunjungi, dataset kosong, budget habis. |
| **`06-smart-culinary-trail-planner.test.ts`** | F08, PB-14, PB-15 | • Validasi input: durasi (30/60/90 menit), budget > 0.<br>• Algoritma Nearest Neighbor menghasilkan rute urut terdekat tanpa bolak-balik.<br>• Tidak ada POI duplikat dalam satu rute.<br>• Kepatuhan batasan keras: total biaya estimasi ≤ budget.<br>• Kepatuhan batasan keras: total waktu estimasi ≤ durasi.<br>• Peringatan dwell time alert (`checkDwellAlert`) saat waktu kunjungan > alokasi + 5 menit.<br>• Fitur lewati tenant (`skipTrailStep`): menyusun ulang sisa rute tanpa mengganggu langkah yang sudah selesai. |
| **`07-navigation-and-compass.test.ts`** | F06, PB-11 | • Kalkulasi bearing geodesik (0° Utara, 90° Timur, 180° Selatan, 270° Barat).<br>• Deviasi arah hadap pengguna (-180° s.d. +180°).<br>• Penanganan batas wrap-around 360° (heading 350° vs bearing 10° -> deviasi +20°).<br>• Verifikasi status `isOnTarget` dalam batas deviasi ≤ 30°.<br>• Deteksi kedatangan di tenant (jarak ≤ 10 m memicu `hasArrived: true`).<br>• Pemicu panduan suara berkala (audio cue) tiap pengurangan jarak kelipatan 20 m.<br>• Evaluasi komprehensif `computeNavigationStatus`. |
| **`08-privacy-and-security-nfr.test.ts`** | F09, NFR, PB-02, PB-17 | • Audit Zero Network Location Leakage: seluruh kalkulasi geofence, search, rekomendasi, dan trail berjalan 100% lokal tanpa request HTTP/jaringan.<br>• Audit inspeksi payload: tidak ada paket data yang membawa latitude/longitude pengguna.<br>• Tata kelola izin privasi: dialog edukasi privasi wajib dikonfirmasi sebelum dialog izin sistem Android diminta.<br>• Mode Jelajah dimatikan -> pelacakan background berhenti seketika. |
| **`09-passport-and-gamification.test.ts`** | F10, PB-16 | • Stempel digital paspor kuliner bersifat idempoten: kunjungan ulang tidak menduplikasi stempel melainkan menaikkan `visitCount` dan memperbarui `lastStampedAt`.<br>• Perhitungan progres trail tematik (persentase 0..100%, jumlah tenant, status penyelesaian).<br>• Sistem penghargaan badge digital: otomatis terbuka saat trail 100% selesai.<br>• Tidak memberikan badge duplikat jika badge sudah pernah diperoleh.<br>• Edge cases: trail kosong, POI di luar anggota trail. |
| **`10-onboarding-and-permissions.test.ts`** | PB-01, PB-02, F01, F09 | • Alur navigasi rute onboarding (`stepToHref`).<br>• Penyimpanan state onboarding dan snapshot izin perangkat di AsyncStorage (`AppStateRepository`).<br>• Penyimpanan preferensi rasa, jenis makanan, halal-only, dan fungsi skip (`PreferenceRepository`).<br>• Layanan izin perangkat foreground & notifikasi (`PermissionService`).<br>• Integrasi pembukaan pengaturan aplikasi (`Linking.openSettings`). |

---

## 3. Cara Menjalankan Pengujian

Jalankan perintah berikut dari folder root atau folder `frontend`:

```bash
# Menjalankan seluruh pengujian unit-test
npm --prefix frontend test -- unit-test

# Menjalankan seluruh test suite di proyek (termasuk modul internal src/)
npm --prefix frontend test

# Menjalankan pengujian spesifik per kategori
npm --prefix frontend test -- 01-geofence
npm --prefix frontend test -- 04-typo-tolerant
npm --prefix frontend test -- 05-contextual
npm --prefix frontend test -- 06-smart-culinary
```
