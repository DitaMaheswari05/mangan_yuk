# Unit Test & Static Test — ManganYuk!

Hasil per 18 November 2026, branch `test` (commit `ba52a3e` + perbaikan test lewati tenant).

## Ringkasan

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Unit test frontend (Jest) | `cd frontend && npm test` | **242/242 lolos**, 23 file |
| Unit test backend (Vitest) | `cd backend && npm test` | **37/37 lolos**, 2 file |
| Typecheck frontend | `cd frontend && npm run typecheck` | Lolos, 0 error |
| Typecheck backend | `cd backend && npm run typecheck` | Lolos, 0 error (setelah `prisma generate`) |
| Lint frontend (ESLint) | `cd frontend && npm run lint` | 0 error, 62 warning |
| Validasi skema Prisma | `cd backend && npx prisma validate` | Valid |
| Lint migration Supabase | `cd backend && supabase db start && supabase db lint --fail-on error` | Hanya jalan di CI (butuh Docker) |
| Coverage baris frontend | `npx jest --coverage` | 48% baris, 39% cabang |

## Cara menjalankan

### Persiapan sekali

```bash
cd frontend && npm ci
cd ../backend && npm ci && npx prisma generate
```

`prisma generate` wajib setelah `npm ci` di backend. Tanpa itu, typecheck gagal di `src/reviews/store.prisma.ts` karena tipe Prisma Client kosong.

### Unit test

```bash
# Frontend (Jest, preset jest-expo)
cd frontend
npm test                              # semua test: src/**/__tests__ + ../unit-test
npx jest src/features/trail           # satu fitur
npx jest --watch                      # ulang otomatis saat file disimpan
npx jest --coverage                   # laporan coverage

# Backend (Vitest + Supertest)
cd backend
npm test
npx vitest                            # mode watch
```

### Static test

```bash
cd frontend
npm run lint          # expo lint (ESLint 9, flat config)
npm run typecheck     # tsc --noEmit, mode strict

cd backend
npm run typecheck     # tsc, mode strict
npx prisma validate
```

Pakai `npm run lint` (yang memanggil `expo lint`), jangan `npx eslint .`. Pemanggilan langsung gagal membaca plugin `@typescript-eslint` dari konfigurasi Expo.

## Unit test frontend

Lokasi test ada dua:

- `frontend/src/**/__tests__/`: test di samping kode fitur.
- `unit-test/` di root repo: test per kebutuhan PRD (F01–F10). Pemetaannya ke PRD ada di [unit-test/README.md](../../unit-test/README.md).

Keduanya ikut jalan lewat `npm test` karena `jest.config.js` memakai `roots: ['<rootDir>/src', '<rootDir>/../unit-test']`.

### Per kebutuhan

| Kebutuhan | File | Test | Yang diuji |
|---|---|---|---|
| F01, F02 Lokasi & geofence | `unit-test/01-geofence-and-location` | 27 | Haversine, filter jitter >30 m, entry/exit kawasan + hysteresis, proximity, cooldown 30 menit, dwell ≥3 menit, exit tenant, teardown sesi |
| F02 + F08 Runtime geofence ↔ trail | `src/features/geofence/__tests__/runtime-trail` | 3 | Dwell menandai step trail selesai, pengingat overstay sekali per tenant, tanpa trail aktif tidak ada pengingat |
| F03 Dataset POI | `unit-test/02-poi-dataset-and-validator` | 21 | Aturan validasi V1–V7 pada `pois.json`, rentang harga, jam buka lintas tengah malam, `PoiRepository` |
| F03, F04 Multimodal & audio | `unit-test/03-multimodal-and-audio` | 12 | Resolusi aset offline, format durasi, mode audio background, fallback |
| F04 Audio & eyes-free | `src/features/audio/__tests__/{queue,tts,walkMode}` | 14 | Antrian audio, TTS fallback, auto-play Mode Jalan |
| F04 Aksi notifikasi | `src/features/notifications/__tests__/actions` | 5 | Tombol Dengar / Lewati, aksi tidak terputar dua kali, ketukan membuka kartu POI |
| F05 Pencarian | `unit-test/04-typo-tolerant-search-and-filter`, `src/features/search/__tests__/search` | 18 + 10 | Typo ("batagr"), threshold Fuse.js tanpa false positive, multi-filter harga/rasa/tipe/buka, urut jarak, waktu ≤1 detik |
| F06 Navigasi | `unit-test/07-navigation-and-compass`, `src/features/navigation/__tests__/navigation` | 16 + 16 | Bearing, deviasi heading, kedatangan ≤10 m, audio cue tiap 20 m |
| F06 Rute jalan kaki | `src/features/navigation/__tests__/routing` | 8 | Geometri rute, sisa rute, `fetchWalkingRoute` |
| F07 Rekomendasi | `unit-test/05-contextual-recommendation-engine`, `src/features/recommendation/__tests__/recommendation` | 10 + 10 | Deterministik, eksklusi tenant tutup/dikunjungi, pasangan rasa |
| F08 Trail planner | `unit-test/06-smart-culinary-trail-planner`, `src/features/trail/__tests__/trail` | 8 + 9 | Validasi input, Nearest Neighbor tanpa bolak-balik, batas budget & waktu, dwell alert, fallback jam buka |
| F08 Progres trail | `src/features/trail/__tests__/progress` | 17 | Selesai via dwell, overstay alokasi + 5 menit, lewati & susun ulang sesuai sisa waktu/budget, batal lewati, penyimpanan sesi |
| F09 Privasi | `unit-test/08-privacy-and-security-nfr` | 3 | Modul cerdas jalan tanpa HTTP request, tidak ada koordinat di payload jaringan, penjelasan privasi sebelum izin lokasi |
| F10 Paspor | `unit-test/09-passport-and-gamification`, `src/features/passport/__tests__/passport` | 10 + 10 | Stempel idempoten, progres trail tematik, badge |
| PB-01, PB-02 Onboarding | `unit-test/10-onboarding-and-permissions` | 9 | Alur langkah, penyimpanan status, preferensi, `PermissionService` |
| Keamanan input | `src/lib/__tests__/validation` | 6 | ID POI, rute internal (tolak open redirect & traversal), sanitasi angka & rasa (OWASP M4) |

Test rekomendasi, navigasi, dan paspor di `unit-test/` isinya sama dengan versi di `src/features/**/__tests__/` (nama grup dan jumlah test identik). Kalau ada perubahan, keduanya perlu diubah, atau salah satunya dihapus.

### Coverage per modul (baris)

| Modul | Coverage | Catatan |
|---|---|---|
| `features/trail` | 92% | |
| `features/recommendation` | 95% | |
| `lib/validation`, `lib/geo` | 96–100% | |
| `features/search` | 83% | |
| `features/poi` | 79% | |
| `features/onboarding` | 69% | |
| `features/geofence` | 56% | `ExploreModeController` (watch lokasi, timer dwell) belum dites |
| `features/audio` | 53% | |
| `features/navigation` | 52% | `compass.ts` (sensor) belum dites |
| `features/visits` | 46% | |
| `features/notifications` | 38% | Penjadwalan notifikasi belum dites |
| `features/passport` | 13% | Klien API review (`api.ts`) belum dites |
| `features/location` | 6% | Bergantung pada `expo-location`, belum di-mock |
| `features/auth`, `storage/secure`, `store/useAppStore` | 0–7% | Belum ada test |
| `components/*`, layar `app/*` | 0% | Belum ada test UI (render) |

## Unit test backend

Vitest + Supertest. Store memakai implementasi in-memory, jadi tidak butuh database.

| File | Grup | Test | Yang diuji |
|---|---|---|---|
| `src/__tests__/auth.test.ts` | AUTH-01 register | 4 | Daftar akun, email duplikat (409), validasi input, JSON rusak |
| | AUTH-02 login | 4 | Login, pesan error seragam, rate limit per email & per IP |
| | AUTH-03 refresh | 3 | Rotasi refresh token, deteksi reuse token lama, token tidak valid |
| | AUTH-04 logout | 2 | Sesi dicabut, logout idempoten |
| | AUTH-05/06 me | 2 | GET profil (token tidak valid / kedaluwarsa), PATCH hanya `displayName` |
| | AUTH-07/08 reset password | 4 | Respons sama untuk email terdaftar/tidak, rate limit, token sekali pakai, kedaluwarsa 30 menit |
| | AUTH-09 hapus akun | 1 | Password salah ditolak; benar → sesi mati, email bisa dipakai lagi |
| | 404 | 1 | Format error seragam untuk endpoint tak dikenal |
| `src/__tests__/reviews.test.ts` | REV-VAL | 4 | Validasi skema review & stempel |
| | REV-01/03 | 4 | Buat review, menu harus milik tenant, stempel otomatis idempoten |
| | REV-05/06 | 3 | Edit & hapus hanya oleh pemilik (403) |
| | REV-07 | 2 | Rata-rata rating, distribusi bintang, menu populer |
| | GAM-01/02 | 3 | Progres trail tematik & badge |

Belum dites: `store.prisma.ts` (adapter database asli). Saat ini hanya dicek oleh typecheck.

## Static test

### TypeScript

Frontend dan backend sama-sama memakai `"strict": true`. Keduanya lolos tanpa error.

### ESLint (frontend)

Konfigurasi: [frontend/eslint.config.js](../../frontend/eslint.config.js), berbasis `eslint-config-expo`. Ada tiga aturan yang sengaja diturunkan dari error menjadi warning: `react-hooks/refs`, `react-hooks/set-state-in-effect`, dan `@typescript-eslint/no-unused-vars`.

Rincian 62 warning:

| Aturan | Jumlah | Arti |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 33 | Import atau variabel tidak terpakai |
| `react-hooks/refs`, `react-hooks/set-state-in-effect` | 22 | Ref dibaca saat render atau `setState` di dalam effect; berisiko UI tidak ter-update |
| `@typescript-eslint/no-require-imports` | 3 | `require()` di file TypeScript |
| `@typescript-eslint/array-type` | 2 | Gaya penulisan tipe array |
| `react-hooks/exhaustive-deps` | 1 | Dependensi hook tidak lengkap |
| `@typescript-eslint/no-explicit-any` | 1 | Tipe `any` eksplisit |

Warning tidak membuat CI gagal. Yang paling layak dibereskan dulu adalah grup `react-hooks`, karena berpotensi jadi bug tampilan.

### Database

- `npx prisma validate`: skema Prisma valid.
- `supabase db lint --fail-on error`: memeriksa fungsi dan migration SQL. Butuh Docker; saat ini dijalankan di CI.

## CI (GitHub Actions)

| Workflow | Pemicu | Langkah |
|---|---|---|
| `frontend-ci` | push/PR yang mengubah `frontend/**` | `npm ci` → `npm run lint` → `npm run typecheck` → `npm test -- --ci` |
| `backend-ci` | push/PR yang mengubah `backend/**` | `supabase db start` → `supabase db lint --fail-on error` |

Celah CI saat ini:

- Unit test dan typecheck backend **tidak** dijalankan di CI.
- Perubahan yang hanya menyentuh `unit-test/` tidak memicu `frontend-ci`, karena path filter-nya hanya `frontend/**`.

## Masalah yang ditemukan & diperbaiki saat menyusun dokumen ini

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| `unit-test/06-smart-culinary-trail-planner.test.ts` gagal | Masih memanggil `skipTrailStep` versi lama, sebelum ada sesi trail | Test disesuaikan ke API baru (`createTrailSession` → `skipTrailStep`) |
| `auth.test.ts` gagal: `Cannot find package 'helmet'` | `node_modules` backend belum sinkron dengan lockfile | `npm ci` di `backend/` |
| Typecheck backend gagal di `store.prisma.ts` | Prisma Client belum di-generate setelah instalasi | `npx prisma generate` |

## Saran berikutnya

1. Tambahkan `npm ci && npx prisma generate && npm run typecheck && npm test` ke `backend-ci`.
2. Tambahkan `unit-test/**` ke path filter `frontend-ci`.
3. Hapus duplikasi test rekomendasi, navigasi, dan paspor antara `unit-test/` dan `src/features/**/__tests__/`.
4. Tambah test untuk modul yang coverage-nya rendah: `features/location` (mock `expo-location`), `features/notifications`, `features/passport/api.ts`, `features/auth`.
5. Bereskan 22 warning `react-hooks`, lalu kembalikan aturannya ke level error.
