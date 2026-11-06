// Validasi dataset asli yang dibundel (src/data/*.json). Gagal = data belum memenuhi PB04 (V1–V7).
// Perbaiki di backend/supabase/seed.sql, lalu `npm run export` di backend/.
import area from '@/data/area.json';
import pois from '@/data/pois.json';
import { validate } from '../validator';

describe('dataset bundel', () => {
  it('lolos validasi PB04 (V1–V7)', () => {
    const { errors } = validate({ area, pois }, 'PB04');
    expect(errors).toEqual([]);
  });
});
