**Isi README root:**
* **Alur data:** `content/` → Supabase → skrip export → `frontend/`. Aplikasi tidak memanggil Supabase saat berjalan; semua konten POI ikut dibundel di dalam aplikasi.
* **Prasyarat:** Node 20, Docker Desktop, dan Expo Go atau emulator.
* **Langkah menjalankan:**
  1. Jalankan backend: `npm run db:start`.
  2. Isi `backend/.env` dengan URL dan service role key yang muncul di output.
  3. Salin data ke frontend: `npm run gen:types` lalu `npm run export`.
  4. Jalankan frontend: `npm install`, `npx expo install --fix`, lalu `npm start`.
* **Lain-lain:** peta folder, tabel F01–F10 ke folder fitur, dan alur kerja tim (penamaan branch, aturan migration).

[frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md), dan [content/README.md](content/README.md) berisi detail per bagian, misalnya aturan penamaan dan durasi audio 45–90 detik.

**Isi file starter:**
* **Frontend:** semua screen expo-router (masih berupa placeholder). Ada `geofence` dengan perhitungan jarak (haversine) beserta test Jest, komponen peta OSM, store Zustand, dan helper AsyncStorage.
* **Backend:**
  - Migration untuk tabel `pois`, `trails`, dan `trail_pois`, dengan aturan akses publik-baca.
  - `seed.sql` berisi 10 POI.
  - Dua bucket storage (foto dan audio) di `config.toml`.
  - Skrip `export-content.ts` dan `gen-types.sh`.
* **CI:** dua workflow GitHub Actions. Satu untuk lint, typecheck, dan test frontend; satu lagi menjalankan migration backend.

**Yang perlu kamu tindak lanjuti:**
* **Data di `seed.sql` hanya contoh.** Nama dan koordinat POI-nya saya isi asal. `INITIAL_REGION` di [map.ts](frontend/src/constants/map.ts) juga masih koordinat sementara. Keduanya perlu diganti dengan data lokasi asli.
* **Versi paket frontend belum dikunci.** Di [package.json](frontend/package.json) masih ditulis `"*"` karena saya tidak tahu versi Expo yang kalian pakai. `npx expo install --fix` di langkah 4 akan menyesuaikannya. Setelah itu commit `package-lock.json`, karena CI frontend butuh file itu.
* **Ada dua file tambahan di luar pohonmu:** `frontend/metro.config.js` dan `metro.transformer.js`. Tanpa keduanya, `area.geojson` tidak bisa di-import langsung.
* **Gambar denah belum ada.** `assets/maps/denah-sudirman.png` perlu ditambahkan sendiri.
* **Lokasi di background tidak jalan di Expo Go.** Geofence butuh development build (`npx expo run:android`); ini sudah dijelaskan di README.