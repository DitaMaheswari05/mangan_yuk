-- Data awal Mangan Yuk. Jalankan setelah migration 20261104000000_schema_v2.sql.
-- Nama dan koordinat dari survei lapangan tim (31 tenant).
-- food_type, category_label, dan tastes DITEBAK dari nama tenant — verifikasi di lapangan.
-- Baris dengan category_label 'TODO' belum bisa ditebak dari namanya.
-- TODO: zona, avg_visit_min (sementara: minuman 5, jajanan 10, makanan 15), deskripsi, menu & harga,
-- jam buka, jam ramai, cultural_story, foto (≥3 per POI), dan audio + transkrip.

-- ---------------------------------------------------------------------------
-- Kawasan — pusat = rata-rata koordinat tenant (tanpa P20, lihat catatan di bawah)
-- ---------------------------------------------------------------------------

insert into public.areas (id, name, center_latitude, center_longitude, entry_radius_m, exit_hysteresis_m, google_maps_query) values
  ('sudirman-street-food', 'Sudirman Street Food', -6.920890, 107.600574, 100, 10, 'Sudirman Street Food Bandung');

-- ---------------------------------------------------------------------------
-- POI (P01–P31)
-- Beberapa tenant berbagi koordinat yang sama (P01–P02; P12–P14; P15–P17). Geofence-nya akan
-- tumpang tindih, jadi proximity event bisa terpicu bersamaan — ambil ulang koordinat per tenant kalau bisa.
-- ---------------------------------------------------------------------------

insert into public.pois
  (id, name, slug, food_type, category_label, tastes, zone, latitude, longitude, avg_visit_min, description, search_keywords)
values
  ('P01', 'Traditional Fried Food from West Borneo', 'traditional-fried-food-from-west-borneo', 'jajanan', 'Gorengan / Gurih', '{gurih}',
   'TODO', -6.921332, 107.600650, 10, '', '{gorengan,pontianak,kalimantan barat}'),
  ('P02', 'Pisang Goreng Pontianak', 'pisang-goreng-pontianak', 'jajanan', 'Jajanan / Manis', '{manis}',
   'TODO', -6.921332, 107.600650, 10, '', '{pisang goreng,gorengan,pontianak}'),
  ('P03', 'Swike Asli JTW', 'swike-asli-jtw', 'makanan', 'Swike / Gurih', '{gurih}',
   'TODO', -6.921294, 107.600650, 15, '', '{swike,kodok}'),
  ('P04', 'Bebek Gober Bumbu Hitam', 'bebek-gober-bumbu-hitam', 'makanan', 'Bebek / Gurih', '{gurih}',
   'TODO', -6.921285, 107.600602, 15, '', '{bebek,bumbu hitam}'),
  ('P05', 'Pigbull', 'pigbull', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.921299, 107.600588, 15, '', '{}'),
  ('P06', 'Awin Kwetiau Siantar', 'awin-kwetiau-siantar', 'makanan', 'Kwetiau / Gurih', '{gurih}',
   'TODO', -6.921044, 107.600539, 15, '', '{kwetiau,kwetiaw,siantar}'),
  ('P07', 'Sedap The Best Chinese Food', 'sedap-the-best-chinese-food', 'makanan', 'Chinese Food / Gurih', '{gurih}',
   'TODO', -6.920932, 107.600533, 15, '', '{chinese food}'),
  ('P08', 'Gou Cheng Hiang', 'gou-cheng-hiang', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920928, 107.600462, 15, '', '{}'),
  ('P09', 'Dapur Sotoku', 'dapur-sotoku', 'makanan', 'Makanan Berkuah / Gurih', '{gurih}',
   'TODO', -6.920838, 107.600471, 15, 'Soto khas dan gurami bakar.', '{soto,berkuah,gurami,ikan bakar}'),
  ('P10', 'Klypot', 'klypot', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920782, 107.600481, 15, '', '{}'),
  ('P11', 'Umai', 'umai', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920673, 107.600584, 15, '', '{}'),
  ('P12', 'Hong Nam', 'hong-nam', 'makanan', 'Asian Food / Gurih', '{gurih}',
   'TODO', -6.920687, 107.600476, 15, 'Olahan bak kut teh dan samcan.', '{bak kut teh,samcan,pork ribs,babi}'),
  ('P13', 'Pandu Baso Goreng Tenggiri', 'pandu-baso-goreng-tenggiri', 'jajanan', 'Jajanan / Gurih', '{gurih}',
   'TODO', -6.920687, 107.600476, 10, 'Bakso ikan tenggiri goreng yang krispi.', '{baso,bakso,basreng,tenggiri,gorengan}'),
  ('P14', 'Segulung Babi', 'segulung-babi', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920687, 107.600476, 15, '', '{babi}'),
  ('P15', 'Bacuk Sultan Agung', 'bacuk-sultan-agung', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920633, 107.600575, 15, '', '{}'),
  ('P16', 'Hau’s Tea', 'haus-tea', 'minuman', 'Minuman / Manis', '{manis}',
   'TODO', -6.920633, 107.600575, 5, '', '{teh,tea,haus}'),
  ('P17', 'Kuo Tie Kelenteng', 'kuo-tie-kelenteng', 'jajanan', 'Kuo Tie / Gurih', '{gurih}',
   'TODO', -6.920633, 107.600575, 10, '', '{kuotie,kuo tie,pangsit,dumpling}'),
  ('P18', 'Nasi Goreng Babi Samcan Crispy', 'nasi-goreng-babi-samcan-crispy', 'makanan', 'Nasi Goreng / Gurih', '{gurih}',
   'TODO', -6.920685, 107.600631, 15, '', '{nasi goreng,samcan,babi}'),
  ('P19', 'Jazz Coffee', 'jazz-coffee', 'minuman', 'Kopi', '{aromatik}',
   'TODO', -6.920791, 107.600631, 5, '', '{kopi,coffee}'),
  -- P20: 97 m dari pusat kawasan (tenant lain ≤50 m) — kemungkinan koordinat salah, cek ulang.
  ('P20', 'Nasi Campur Kencana99', 'nasi-campur-kencana99', 'makanan', 'Makanan Utama / Gurih', '{gurih}',
   'TODO', -6.920556, 107.601389, 15, 'Nasi hainan atau nasi putih dengan topping lengkap.', '{nasi campur,nasi hainan,nasi}'),
  ('P21', 'Kuwali Kwetiaw Bakar & Nasi Goreng Samcan', 'kuwali-kwetiaw-bakar-nasi-goreng-samcan', 'makanan', 'Kwetiau / Gurih', '{gurih}',
   'TODO', -6.920769, 107.600645, 15, '', '{kwetiau,kwetiaw,nasi goreng,samcan,babi}'),
  ('P22', 'Susu Mbok Darmi', 'susu-mbok-darmi', 'minuman', 'Minuman / Manis', '{manis}',
   'TODO', -6.920693, 107.600669, 5, '', '{susu,milk}'),
  ('P23', 'D’Cheers', 'dcheers', 'minuman', 'TODO', '{segar}',
   'TODO', -6.921202, 107.600602, 5, '', '{}'),
  ('P24', 'Singaraja Beer', 'singaraja-beer', 'minuman', 'Bir', '{segar}',
   'TODO', -6.921211, 107.600554, 5, '', '{bir,beer}'),
  ('P25', 'Medan', 'medan', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.921155, 107.600544, 15, '', '{medan}'),
  ('P26', 'Sotomie Sukabumi Ko Ricky & Happy Time', 'sotomie-sukabumi-ko-ricky-happy-time', 'makanan', 'Mie Berkuah / Gurih', '{gurih}',
   'TODO', -6.921011, 107.600478, 15, '', '{soto mie,sotomie,mie,berkuah,sukabumi}'),
  ('P27', 'Rainbow Juice', 'rainbow-juice', 'minuman', 'Jus / Segar', '{segar,manis}',
   'TODO', -6.920753, 107.600549, 5, '', '{jus,juice,buah}'),
  ('P28', 'Pempek Gochan', 'pempek-gochan', 'makanan', 'Pempek / Gurih-Pedas', '{gurih,pedas}',
   'TODO', -6.920713, 107.600607, 15, '', '{pempek,empek-empek,cuko}'),
  ('P29', 'Mie Susu', 'mie-susu', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920656, 107.600649, 15, '', '{mie}'),
  ('P30', 'Waroenk Laris', 'waroenk-laris', 'makanan', 'TODO', '{gurih}',
   'TODO', -6.920707, 107.600623, 15, '', '{warung}'),
  ('P31', 'Bacang Babi', 'bacang-babi', 'makanan', 'Bacang / Gurih', '{gurih}',
   'TODO', -6.920659, 107.600662, 15, '', '{bacang,bakcang,babi}');

-- Status halal. Hanya diisi untuk tenant yang nama/menunya jelas mengandung babi, swike, atau alkohol;
-- sisanya null (belum diverifikasi). TODO: verifikasi di lapangan, termasuk P05 Pigbull.
update public.pois set is_halal = false
where id in (
  'P03',  -- Swike Asli JTW (kodok)
  'P12',  -- Hong Nam (bak kut teh, samcan)
  'P14',  -- Segulung Babi
  'P18',  -- Nasi Goreng Babi Samcan Crispy
  'P21',  -- Kuwali Kwetiaw Bakar & Nasi Goreng Samcan
  'P24',  -- Singaraja Beer
  'P31'   -- Bacang Babi
);

-- ---------------------------------------------------------------------------
-- Menu, jam buka, jam ramai — TODO isi dari survei. Format:
-- ---------------------------------------------------------------------------

-- insert into public.menu_items (id, poi_id, name, price_idr, tastes, is_signature, position) values
--   ('P01-M01', 'P01', '<nama menu>', <harga>, '{manis}', true, 1);

-- day_of_week: 0 = Minggu … 6 = Sabtu. close_time < open_time = tutup lewat tengah malam.
-- insert into public.opening_hours (poi_id, day_of_week, open_time, close_time) values
--   ('P01', 5, '16:00', '23:00');

-- insert into public.peak_hours (poi_id, day_of_week, start_time, end_time) values
--   ('P01', 6, '18:00', '21:00');

-- ---------------------------------------------------------------------------
-- Aturan pasangan rasa (F07)
-- ---------------------------------------------------------------------------

insert into public.taste_pairings (after_taste, suggest_taste, suggest_food_type, reason) values
  ('pedas', 'segar', 'minuman', 'cocok setelah makanan pedas'),
  ('gurih', 'manis', 'jajanan', 'pencuci mulut setelah makanan gurih');

-- ---------------------------------------------------------------------------
-- Trail tematik Paspor Kuliner (F10) — TODO tentukan anggota trail
-- ---------------------------------------------------------------------------

insert into public.trails (id, name, description, badge_name) values
  ('jejak-jajanan-sunda', 'Jejak Jajanan Sunda', 'Jelajahi jajanan khas di Sudirman Street Food.', 'Penjelajah Jajanan Sunda'),
  ('manis-manis-bandung', 'Manis-manis Bandung', 'Kumpulkan stempel dari tenant kuliner manis.', 'Pemburu Manis Bandung');

-- insert into public.trail_pois (trail_id, poi_id, position) values
--   ('jejak-jajanan-sunda', 'P01', 1), ('jejak-jajanan-sunda', 'P05', 2);
