-- Ulasan (Review) Tenant & Menu untuk Gamifikasi Paspor Kuliner (F10).
-- Memungkinkan pengguna memberikan rating (1–5), teks ulasan, foto opsional, serta menandai
-- menu apa saja yang mereka makan dari suatu tenant untuk progres gamifikasi & stempel paspor.

-- ---------------------------------------------------------------------------
-- 1. Tabel Ulasan Tenant (reviews)
-- ---------------------------------------------------------------------------

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  poi_id      text not null references public.pois(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  review_text text check (review_text is null or char_length(review_text) <= 1000),
  -- Foto dokumentasi makanan/kunjungan dari pengguna (opsional, path di bucket 'review-photos')
  photo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index reviews_poi_created_idx on public.reviews (poi_id, created_at desc);
create index reviews_user_poi_idx    on public.reviews (user_id, poi_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Tabel Menu yang Dimakan saat Review / Kunjungan (review_menu_items)
--    Menyimpan daftar menu dari tenant tersebut yang dicicipi oleh pengguna.
-- ---------------------------------------------------------------------------

create table public.review_menu_items (
  review_id    uuid not null references public.reviews(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id) on delete cascade,
  primary key (review_id, menu_item_id)
);

create index review_menu_items_menu_idx on public.review_menu_items (menu_item_id);

-- Validasi agar menu yang dipilih benar-benar milik tenant (poi_id) yang sedang direview.
create function public.check_review_menu_item_poi() returns trigger
language plpgsql as $$
declare
  v_review_poi_id text;
  v_menu_poi_id   text;
begin
  select poi_id into v_review_poi_id from public.reviews where id = new.review_id;
  select poi_id into v_menu_poi_id   from public.menu_items where id = new.menu_item_id;

  if v_review_poi_id is distinct from v_menu_poi_id then
    raise exception 'Menu item % bukan milik tenant % pada review %',
      new.menu_item_id, v_review_poi_id, new.review_id;
  end if;

  return new;
end;
$$;

create trigger review_menu_items_validate_poi
  before insert or update on public.review_menu_items
  for each row execute function public.check_review_menu_item_poi();

-- ---------------------------------------------------------------------------
-- 3. Integrasi Otomatis dengan Stempel Paspor Kuliner (passport_stamps)
--    Saat pengguna mengirim review pada suatu tenant, otomatis mencatat stempel
--    kunjungan di passport_stamps jika belum ada (idempoten).
-- ---------------------------------------------------------------------------

create function public.sync_passport_stamp_on_review() returns trigger
language plpgsql as $$
begin
  insert into public.passport_stamps (user_id, poi_id, stamped_at)
  values (new.user_id, new.poi_id, new.created_at)
  on conflict (user_id, poi_id) do nothing;
  return new;
end;
$$;

create trigger reviews_sync_passport_stamp
  after insert on public.reviews
  for each row execute function public.sync_passport_stamp_on_review();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (RLS) & Storage Bucket untuk Foto Review
-- ---------------------------------------------------------------------------

alter table public.reviews           enable row level security;
alter table public.review_menu_items enable row level security;

-- Ulasan dan daftar menu yang dicicipi bersifat publik-baca agar dapat tampil di halaman tenant/komunitas.
-- Operasi tulis dilakukan melalui backend API (role postgres) sebagaimana tabel auth/user lainnya.
create policy "public read reviews"           on public.reviews           for select using (true);
create policy "public read review_menu_items" on public.review_menu_items for select using (true);

-- Bucket penyimpanan foto review yang diunggah pengguna (opsional saat review).
insert into storage.buckets (id, name, public, allowed_mime_types) values
  ('review-photos', 'review-photos', true, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
