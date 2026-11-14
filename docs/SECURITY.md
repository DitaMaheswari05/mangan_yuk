# Kebijakan Keamanan Aplikasi Mangan Yuk

Dokumen ini mendokumentasikan postur keamanan aplikasi mobile **Mangan Yuk** berdasarkan standar **OWASP Mobile Application Security (MASVS v2)** dan **OWASP Mobile Top 10 (2024)**.

---

## 1. Checklist OWASP Mobile Top 10 (2024)

| ID | Kategori OWASP | Status | Keterangan & Implementasi |
|---|---|:---:|---|
| **M1** | **Improper Credential Usage** | ✅ Selesai | Tidak ada secret, token Supabase `service_role`, atau JWT secret yang di-hardcode di frontend maupun di-commit ke Git. Variabel environment build dikelola melalui EAS Secrets / environment variables server terpisah. `.gitignore` telah diperketat untuk mengabaikan `.env*`. |
| **M2** | **Inadequate Supply Chain Security** | ✅ Selesai | Semua dependensi wildcard (`*`) pada `frontend/package.json` telah di-pin ke versi rilis stabil SDK 58. Duplikasi entri devDependencies telah dihapus. `npm audit` dijalankan secara berkala pada pipeline CI. |
| **M3** | **Insecure Authentication/Authorization** | ✅ Selesai | Backend Express mengimplementasikan rotasi refresh token per family dengan deteksi reuse token, hashing token via SHA-256 sebelum disimpan ke database, bcrypt salt rounds ≥ 12, sliding-window rate limiting per email/IP, pesan login generik anti-enumerasi, serta verifikasi JWT ketat dengan algoritma eksplisit (`HS256`) dan penolakan token tanpa klaim kedaluwarsa (`exp`). RLS Supabase dikonfigurasi tertutup (`deny all`) untuk akses publik anonim. |
| **M4** | **Insufficient Input/Output Validation** | ✅ Selesai | Backend menggunakan Zod untuk validasi skema request body, limit JSON payload (16 KB), middleware `helmet` untuk security headers, dan `cors` yang membatasi origin. Frontend mengimplementasikan sanitasi input regex (`isValidPoiId`), whitelist rute internal (`isValidInternalRoute`), dan validasi parameter numerik (`sanitizeNumber`) untuk mencegah open redirect dan path traversal dari deep link / notifikasi. |
| **M5** | **Insecure Communication** | ✅ Selesai | `usesCleartextTraffic` dimatikan secara eksplisit. Network Security Config Android membatasi trust anchor hanya ke CA sistem (`<certificates src="system" />`) dan melarang cleartext HTTP. iOS dikonfigurasi dengan `NSAppTransportSecurity` ketat (`NSAllowsArbitraryLoads: false`). Endpoint rute jalan kaki OSRM dan tile peta OSM berjalan melalui HTTPS dengan batas timeout abort (8 detik). |
| **M6** | **Inadequate Privacy Controls** | ✅ Selesai | Permintaan izin lokasi dilakukan bertahap (foreground terlebih dahulu). Koordinat GPS pengguna diproses sepenuhnya secara lokal di perangkat dan **tidak pernah dikirim ke server**. Tersedia tombol "Hapus Semua Data Lokal & Reset" pada halaman Profil pengguna yang membersihkan seluruh jejak paspor, kunjungan, preferensi, dan token lokal. |
| **M7** | **Insufficient Binary Protections** | ⚠️ Sebagian | Minifikasi kode dan optimasi resource Android telah diaktifkan via R8/Proguard (`enableProguardInReleaseBuilds: true`, `shrinkResources: true`). Source maps tidak diekspos di rilis publik. Deteksi root/jailbreak dan Play Integrity API direkomendasikan untuk implementasi masa depan jika fitur transaksi/sinkronisasi cloud diaktifkan. |
| **M8** | **Security Misconfiguration** | ✅ Selesai | `android.allowBackup` diset ke `false` untuk mencegah ekstraksi data lewat `adb backup` atau cloud backup Android. Komponen native diatur minimal, `blockedPermissions` memblokir izin otomatis library yang tidak diperlukan (`RECORD_AUDIO`, `READ_PHONE_STATE`), dan profil production EAS diset menghasilkan Android App Bundle (`app-bundle`). |
| **M9** | **Insecure Data Storage** | ✅ Selesai | Modul penyimpanan aman berbasis hardware (`expo-secure-store`) disediakan untuk token autentikasi dan data sensitif (`saveSecure`, `loadSecure`, `deleteSecure`). Seluruh pencetakan log sensitif (`console.log`) dihapus dari bundle rilis via `babel-plugin-transform-remove-console`, log token reset pada backend disensor, dan log font/dataset diproteksi guard `__DEV__`. |
| **M10** | **Insufficient Cryptography** | ✅ Selesai | Penyimpanan token di database memakai fungsi hash satu arah SHA-256. Password pengguna di-hash memakai bcrypt dengan cost factor 12. Token opaque dihasilkan menggunakan generator acak berkekuatan kriptografi (`crypto.randomBytes(32)`). |

---

## 2. Pemetaan OWASP MASVS v2

- **MASVS-STORAGE**:
  - `allowBackup: false` terpasang di AndroidManifest.
  - Token sesi dan kredensial dipisahkan dari `AsyncStorage` polos ke `expo-secure-store`.
  - Fungsi pembersihan data lokal (`clearAllUserData`) disediakan untuk pemenuhan hak privasi pengguna (Right to be Forgotten).
- **MASVS-CRYPTO**:
  - Hashing token autentikasi di server: SHA-256.
  - Password hashing: bcrypt cost 12.
  - JWT Signature: HMAC-SHA256 (`HS256`) dengan secret minimal 32 karakter dan validasi klaim `exp`.
- **MASVS-AUTH**:
  - Rotasi refresh token satu kali pakai (one-time use) dengan deteksi token reuse yang langsung mematikan seluruh family sesi yang bersangkutan.
  - Rate limiting sliding-window pada endpoint login (5 gagal / 15 menit), register (10 / jam), dan reset password (3 / jam).
- **MASVS-NETWORK**:
  - Cleartext traffic (HTTP) ditolak secara global.
  - Android Network Security Config (`res/xml/network_security_config.xml`) mengunci trust anchor ke sertifikat sistem Android, mencegah inspeksi lalu lintas melalui user-installed CA di production.
  - iOS ATS dikonfigurasi `NSAllowsArbitraryLoads: false`.
- **MASVS-PLATFORM**:
  - Permission minimal: `ACCESS_FINE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `VIBRATE`.
  - `blockedPermissions` memblokir injeksi permission yang tidak terpakai (`android.permission.RECORD_AUDIO`, `android.permission.READ_PHONE_STATE`).
  - Parameter deep link (`manganyuk://...`) divalidasi dan disanitasi sebelum diproses.
- **MASVS-CODE**:
  - Dependensi supply chain di-pin tanpa wildcard `*`.
  - Source map dan log `console.log` di-strip pada production build.
- **MASVS-RESILIENCE**:
  - Proguard / R8 diaktifkan pada build rilis Android untuk mengecilkan ukuran biner dan mengaburkan kode (obfuscation).

---

## 3. Draf Google Play Data Safety Form

Saat mengajukan aplikasi ke Google Play Console, isi formulir Data Safety dengan acuan berikut:

| Kategori Data | Jenis Data | Dikumpulkan? | Dibagikan ke Pihak Ketiga? | Pemrosesan Bersifat Efemeral? | Tujuan Penggunaan |
|---|---|:---:|:---:|:---:|---|
| **Lokasi (Location)** | Lokasi Presisi (Approximate & Precise Location) | Ya | **Tidak** | **Ya** (hanya diproses secara lokal di RAM/storage perangkat untuk mendeteksi geofence Sudirman Street Food) | Fungsionalitas Aplikasi (App Functionality) — panduan navigasi jalan kaki dan notifikasi geofence tenant kuliner. |
| **Informasi Pribadi (Personal Info)** | Nama / Display Name | Ya (opsional, saat register) | **Tidak** | Tidak | Manajemen Akun (Account Management). |
| **Informasi Pribadi (Personal Info)** | Alamat Email | Ya (saat register) | **Tidak** | Tidak | Fungsionalitas Akun & Autentikasi / Reset Password. |
| **Aktivitas Aplikasi (App Activity)** | Interaksi Aplikasi (Stempel Paspor, Kunjungan) | Ya (disimpan lokal) | **Tidak** | Tidak | Fungsionalitas Paspor Kuliner & Gamifikasi. Pengguna dapat menghapus seluruh riwayat sewaktu-waktu di menu Profil. |
| **Audio** | Berkas Suara | Tidak | **Tidak** | — | Aplikasi hanya memutar audio narasi lokal/offline; tidak merekam suara (`RECORD_AUDIO` diblokir). |

---

## 4. Panduan Verifikasi APK / AAB Rilis

Untuk memverifikasi artefak build Android (`preview` atau `production`):

```bash
# 1. Inspect AndroidManifest dari APK hasil build
aapt dump badging path/to/manganyuk.apk | grep -E "permission|application"

# 2. Atau menggunakan apktool untuk melihat AndroidManifest.xml hasil merge
apktool d path/to/manganyuk.apk -o apk_inspect
cat apk_inspect/AndroidManifest.xml | grep -E "allowBackup|usesCleartextTraffic|networkSecurityConfig"
```

Pastikan nilai berikut terverifikasi:
- `android:allowBackup="false"`
- `android:usesCleartextTraffic="false"`
- `android:networkSecurityConfig="@xml/network_security_config"`
- Tidak ada permission `RECORD_AUDIO` atau `READ_PHONE_STATE`.
