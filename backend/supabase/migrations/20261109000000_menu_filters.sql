-- Filter per menu (F05): pengguna memfilter MENU (rasa, jenis, jenis hidangan, halal, harga),
-- lalu membuka tenant dari menu yang dipilih. Sebelumnya hanya pois yang punya food_type/is_halal.
--
-- Kolom baru di menu_items sengaja nullable supaya migration aman dijalankan di database yang sudah
-- berisi data; seed.sql mengisi semuanya dan skrip export menolak menu yang food_type/dish_category-nya kosong.
-- Rentang harga TIDAK disimpan (turunan dari price_idr, dihitung saat export).

-- Jenis hidangan untuk filter. Tambah nilai: alter type dish_category add value '...';
-- lalu update DishCategory di frontend/src/types/content.ts.
create type public.dish_category as enum (
  'nasi',
  'mie',
  'kwetiau-bihun',
  'bubur',
  'soto-sup',
  'sate',
  'lauk',           -- lauk tanpa nasi: ayam, babi, seafood, capcay, claypot, dll.
  'pempek',
  'gorengan',
  'dimsum-bakpao',  -- termasuk kuo tie dan bacang
  'roti-sandwich',
  'dessert',
  'kopi',
  'teh',
  'susu',
  'jus-es-buah',
  'alkohol',
  'minuman-lain',
  'pelengkap'       -- nasi putih, telur, saus, topping/ekstra
);

alter table public.menu_items
  add column food_type     public.food_type,      -- jenis per menu (Es Teh di tenant makanan = 'minuman')
  add column dish_category public.dish_category,
  add column is_halal      boolean;               -- null = belum diverifikasi; export mewarisi dari pois.is_halal

create index menu_items_food_type_idx     on public.menu_items (food_type);
create index menu_items_dish_category_idx on public.menu_items (dish_category);
