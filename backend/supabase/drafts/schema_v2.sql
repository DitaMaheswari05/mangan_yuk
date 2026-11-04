-- DRAFT skema Mangan Yuk v2 — BUKAN migration, belum dijalankan.
-- Ditulis sebagai skema utuh (bukan delta dari 20261022000000_init.sql) supaya mudah dibaca.
-- Semua jarak dalam meter, semua durasi dalam menit kecuali disebut lain, semua harga dalam Rupiah.
--
-- Skema ini adalah sumber konten read-only. `npm run export` mengubahnya menjadi
-- assets/data/pois.json (PoiDataset: area + pois dengan relasi nested) dan assets/data/area.json,
-- sesuai kontrak di src/types/poi.ts. Aplikasi tidak memanggil Supabase saat berjalan.
--
-- Data pengguna (onboarding, preferensi, izin, kunjungan, cooldown, trail, paspor) TIDAK ada di sini:
-- semuanya disimpan di AsyncStorage (@mangan/v1/*). Sesuai F09, koordinat pengguna tidak pernah
-- dikirim ke server, jadi tidak ada tabel user/visit/location.
--
-- Field turunan (priceMinIdr, priceMaxIdr, priceBucket) sengaja tidak disimpan; dihitung saat load
-- dari menu supaya tidak ada data ganda yang bisa tidak sinkron.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

-- Label rasa (TasteTag). Dipakai filter F05, skor F07, input F08.
-- Tambah label baru: alter type taste add value '...'; lalu update TasteTag di src/types/poi.ts.
create type public.taste as enum ('pedas', 'manis', 'gurih', 'segar', 'aromatik');

-- Jenis kuliner (KulinerType). Filter F05, onboarding.
create type public.food_type as enum ('makanan', 'minuman', 'jajanan');

-- PhotoRef.kind. Setiap POI wajib punya minimal satu per jenis (F03).
create type public.photo_kind as enum ('food', 'tenant', 'ambience');

-- ---------------------------------------------------------------------------
-- Kawasan (AreaConfig) — satu baris untuk pilot Sudirman Street Food (NG04)
-- ---------------------------------------------------------------------------

create table public.areas (
  id                 text primary key check (id = 'sudirman-street-food'),
  name               text not null,
  center_latitude    double precision not null check (center_latitude between -90 and 90),
  center_longitude   double precision not null check (center_longitude between -180 and 180),
  entry_radius_m     integer not null default 100 check (entry_radius_m > 0),   -- entry event F02
  exit_hysteresis_m  integer not null default 10 check (exit_hysteresis_m >= 0), -- keluar jika jarak > radius + ini
  google_maps_query  text,                                                      -- intent Google Maps (F06)
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tenant / POI
-- ---------------------------------------------------------------------------

create table public.pois (
  id                 text primary key check (id ~ '^P[0-9]{2}$'),  -- 'P01' … 'P10'
  area_id            text not null default 'sudirman-street-food' references public.areas(id),
  name               text not null,
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  food_type          public.food_type not null,
  category_label     text not null,                    -- tampilan, mis. 'Seafood / Gurih-Pedas'
  tastes             public.taste[] not null check (cardinality(tastes) >= 1),
  zone               text not null,                    -- 'Zone Entrance', 'Zone Kuliner Malam', …
  latitude           double precision not null check (latitude between -90 and 90),
  longitude          double precision not null check (longitude between -180 and 180),
  trigger_radius_m   integer not null default 10 check (trigger_radius_m > 0),  -- change log v1.1: 5 m → 10 m
  avg_visit_min      integer not null check (avg_visit_min > 0),               -- data observasi, untuk F08
  description        text not null,
  cultural_story     text,                             -- asal-usul, istilah Sunda, keunikan tenant; wajib mulai PB08
  -- Audio narasi (0..1). Ketiga kolom diisi bersamaan atau kosong semua; wajib mulai PB08.
  audio_path         text,                             -- path di bucket poi-audio
  audio_duration_sec integer check (audio_duration_sec between 45 and 90),
  audio_transcript   text,
  search_keywords    text[] not null default '{}',     -- sinonim untuk Fuse.js (F05)
  qr_code            text unique,                      -- opsional, hanya kalau F10 pakai QR check-in
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (
    (audio_path is null and audio_duration_sec is null and audio_transcript is null)
    or (audio_path is not null and audio_duration_sec is not null and audio_transcript is not null)
  )
);

-- Wajib ≥3 foto (food, tenant, ambience) per POI mulai PB08; dicek oleh skrip export.
create table public.poi_photos (
  id       bigint generated always as identity primary key,
  poi_id   text not null references public.pois(id) on delete cascade,
  path     text not null,                              -- path di bucket poi-photos; assetKey diturunkan saat export
  kind     public.photo_kind not null,
  caption  text,
  position integer not null default 0,
  unique (poi_id, position)
);

-- Wajib ≥1 menu per POI; dicek oleh skrip export.
create table public.menu_items (
  id           text primary key check (id ~ '^P[0-9]{2}-M[0-9]{2}$'),  -- 'P01-M01'
  poi_id       text not null references public.pois(id) on delete cascade,
  name         text not null,
  price_idr    integer not null check (price_idr > 0),
  tastes       public.taste[] not null default '{}',
  is_signature boolean not null default false,         -- menu andalan, dipakai estimasi biaya trail (F08)
  position     integer not null default 0,
  unique (poi_id, name),
  check (left(id, 3) = poi_id)
);

-- Satu hari boleh punya beberapa slot. close_time < open_time berarti tutup lewat tengah malam.
create table public.opening_hours (
  poi_id      text not null references public.pois(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0 = Minggu, sama dengan Date.getDay()
  open_time   time not null,
  close_time  time not null check (close_time <> open_time),
  primary key (poi_id, day_of_week, open_time)
);

-- Jam ramai hasil observasi lapangan (F07 "biasanya tidak ramai jam segini"; NG03: bukan real-time).
create table public.peak_hours (
  poi_id      text not null references public.pois(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time <> start_time),
  primary key (poi_id, day_of_week, start_time)
);

-- ---------------------------------------------------------------------------
-- Aturan pasangan rasa (F07), mis. setelah pedas → sarankan minuman segar
-- ---------------------------------------------------------------------------

create table public.taste_pairings (
  id                bigint generated always as identity primary key,
  after_taste       public.taste not null,
  suggest_taste     public.taste,
  suggest_food_type public.food_type,
  reason            text not null,                     -- teks alasan, mis. 'cocok setelah makanan pedas'
  check (suggest_taste is not null or suggest_food_type is not null)
);

-- ---------------------------------------------------------------------------
-- Trail tematik Paspor Kuliner (F10), mis. 'Jejak Jajanan Sunda'
-- Trail hasil Smart Culinary Trail Planner (F08) dihitung di HP, tidak disimpan di sini.
-- ---------------------------------------------------------------------------

create table public.trails (
  id          text primary key,
  name        text not null,
  description text not null default '',
  badge_name  text not null,
  badge_icon  text,                                    -- path aset badge
  created_at  timestamptz not null default now()
);

create table public.trail_pois (
  trail_id text not null references public.trails(id) on delete cascade,
  poi_id   text not null references public.pois(id) on delete cascade,
  position integer not null,
  primary key (trail_id, poi_id),
  unique (trail_id, position)
);

-- ---------------------------------------------------------------------------
-- updated_at otomatis
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

create trigger pois_set_updated_at
  before update on public.pois
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Konten bersifat publik-baca
-- ---------------------------------------------------------------------------

alter table public.areas          enable row level security;
alter table public.pois           enable row level security;
alter table public.poi_photos     enable row level security;
alter table public.menu_items     enable row level security;
alter table public.opening_hours  enable row level security;
alter table public.peak_hours     enable row level security;
alter table public.taste_pairings enable row level security;
alter table public.trails         enable row level security;
alter table public.trail_pois     enable row level security;

create policy "public read areas"          on public.areas          for select using (true);
create policy "public read pois"           on public.pois           for select using (true);
create policy "public read poi_photos"     on public.poi_photos     for select using (true);
create policy "public read menu_items"     on public.menu_items     for select using (true);
create policy "public read opening_hours"  on public.opening_hours  for select using (true);
create policy "public read peak_hours"     on public.peak_hours     for select using (true);
create policy "public read taste_pairings" on public.taste_pairings for select using (true);
create policy "public read trails"         on public.trails         for select using (true);
create policy "public read trail_pois"     on public.trail_pois     for select using (true);
