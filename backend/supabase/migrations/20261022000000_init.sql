-- Skema awal Mangan Yuk

create table public.pois (
  id                 text primary key,               -- 'p01' … 'p10'
  name               text not null,
  description        text not null default '',
  category           text not null default 'kuliner',
  latitude           double precision not null,
  longitude          double precision not null,
  photos             text[] not null default '{}',   -- path di bucket poi-photos
  audio              text,                           -- path di bucket poi-audio
  audio_duration_sec integer check (audio_duration_sec between 45 and 90),
  transcript         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.trails (
  id          text primary key,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.trail_pois (
  trail_id text not null references public.trails(id) on delete cascade,
  poi_id   text not null references public.pois(id) on delete cascade,
  position integer not null,
  primary key (trail_id, poi_id)
);

-- Konten bersifat publik-baca
alter table public.pois enable row level security;
alter table public.trails enable row level security;
alter table public.trail_pois enable row level security;

create policy "public read pois" on public.pois for select using (true);
create policy "public read trails" on public.trails for select using (true);
create policy "public read trail_pois" on public.trail_pois for select using (true);
