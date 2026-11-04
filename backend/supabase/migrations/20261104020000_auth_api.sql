-- Auth API sendiri (AUTH-01 … AUTH-09, docs/api/openapi.yaml) menggantikan Supabase Auth.
-- Kontrak butuh hal yang tidak disediakan Supabase Auth: rotasi refresh token per family dengan
-- deteksi reuse, kode error stabil, dan rate limit per email/IP. Server (backend/src) mengakses tabel
-- ini lewat Prisma dengan role postgres, jadi RLS berbasis auth.uid() tidak dipakai lagi.

-- ---------------------------------------------------------------------------
-- Lepas ketergantungan ke auth.users
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own stamps read"    on public.passport_stamps;
drop policy if exists "own stamps insert"  on public.passport_stamps;
drop policy if exists "own stamps delete"  on public.passport_stamps;

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- ---------------------------------------------------------------------------
-- Pengguna
-- ---------------------------------------------------------------------------

create table public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (email = lower(email) and char_length(email) <= 254),
  password_hash  text not null,                       -- bcrypt
  email_verified boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz                          -- soft delete (AUTH-09)
);

-- Email boleh dipakai ulang setelah akun lama di-soft-delete.
create unique index users_email_active_key on public.users (email) where deleted_at is null;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Profil tetap 1:1 dengan pengguna; display_name 2–50 karakter (divalidasi di server).
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references public.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Refresh token (opaque, 256-bit). Yang disimpan hanya SHA-256-nya.
-- Satu family = satu sesi login di satu perangkat; setiap rotasi menambah baris baru di family yang sama.
-- ---------------------------------------------------------------------------

create table public.refresh_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  family_id    uuid not null,
  token_hash   text not null unique,
  device_label text check (char_length(device_label) <= 100),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  replaced_by  uuid references public.refresh_tokens(id) on delete set null
);

create index refresh_tokens_user_idx   on public.refresh_tokens (user_id);
create index refresh_tokens_family_idx on public.refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- Token reset password (30 menit, sekali pakai)
-- ---------------------------------------------------------------------------

create table public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index password_reset_tokens_user_idx on public.password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- RLS: tanpa policy = tertutup untuk anon/authenticated. Hanya server (role postgres) yang mengakses.
-- ---------------------------------------------------------------------------

alter table public.users                 enable row level security;
alter table public.refresh_tokens        enable row level security;
alter table public.password_reset_tokens enable row level security;
