-- Autentikasi Mangan Yuk — pakai Supabase Auth (tabel auth.users dikelola Supabase).
-- Migration ini hanya menambah data milik pengguna yang perlu tersinkron antar perangkat:
-- profil + preferensi onboarding, dan stempel Paspor Kuliner (F10).
--
-- Sesuai F09, koordinat pengguna tetap tidak pernah dikirim ke server: stempel hanya menyimpan
-- POI mana dan kapan, bukan lokasi. Izin, cooldown, dan state sementara lain tetap di AsyncStorage.
--
-- Setiap pengguna hanya bisa membaca dan mengubah barisnya sendiri (RLS auth.uid()).

-- ---------------------------------------------------------------------------
-- Profil (1:1 dengan auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text check (char_length(display_name) <= 50),
  avatar_url           text,
  -- Preferensi onboarding (F05/F07). Kosong = belum memilih.
  preferred_tastes     public.taste[]     not null default '{}',
  preferred_food_types public.food_type[] not null default '{}',
  halal_only           boolean            not null default false,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil dibuat otomatis saat pengguna mendaftar. display_name diambil dari metadata sign-up
-- (options.data.display_name) atau nama dari provider OAuth kalau ada.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Stempel Paspor Kuliner (F10) — satu stempel per POI per pengguna
-- ---------------------------------------------------------------------------

create table public.passport_stamps (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  poi_id     text not null references public.pois(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  primary key (user_id, poi_id)
);

-- Progres trail dihitung dari passport_stamps × trail_pois, jadi tidak disimpan terpisah.

-- ---------------------------------------------------------------------------
-- RLS: hanya pemilik
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.passport_stamps enable row level security;

-- Insert profil hanya lewat trigger handle_new_user, jadi tidak ada policy insert.
create policy "own profile read"   on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own stamps read"   on public.passport_stamps for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own stamps insert" on public.passport_stamps for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own stamps delete" on public.passport_stamps for delete to authenticated
  using ((select auth.uid()) = user_id);
