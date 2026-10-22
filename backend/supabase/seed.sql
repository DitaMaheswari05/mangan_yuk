-- Data awal 10 POI.
-- TODO: ganti nama, deskripsi, dan koordinat dengan data hasil survei lapangan.
insert into public.pois (id, name, latitude, longitude, photos, audio) values
  ('p01', 'POI 01', -6.2000, 106.8000, '{p01/1.jpg}', 'p01.mp3'),
  ('p02', 'POI 02', -6.2005, 106.8005, '{p02/1.jpg}', 'p02.mp3'),
  ('p03', 'POI 03', -6.2010, 106.8010, '{p03/1.jpg}', 'p03.mp3'),
  ('p04', 'POI 04', -6.2015, 106.8015, '{p04/1.jpg}', 'p04.mp3'),
  ('p05', 'POI 05', -6.2020, 106.8020, '{p05/1.jpg}', 'p05.mp3'),
  ('p06', 'POI 06', -6.2025, 106.8025, '{p06/1.jpg}', 'p06.mp3'),
  ('p07', 'POI 07', -6.2030, 106.8030, '{p07/1.jpg}', 'p07.mp3'),
  ('p08', 'POI 08', -6.2035, 106.8035, '{p08/1.jpg}', 'p08.mp3'),
  ('p09', 'POI 09', -6.2040, 106.8040, '{p09/1.jpg}', 'p09.mp3'),
  ('p10', 'POI 10', -6.2045, 106.8045, '{p10/1.jpg}', 'p10.mp3');

insert into public.trails (id, name, description) values
  ('t01', 'Trail Contoh', 'Trail contoh berisi tiga POI pertama.');

insert into public.trail_pois (trail_id, poi_id, position) values
  ('t01', 'p01', 1), ('t01', 'p02', 2), ('t01', 'p03', 3);
