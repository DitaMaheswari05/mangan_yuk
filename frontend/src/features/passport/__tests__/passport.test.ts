// ============================================================================
// Unit Test: 09-passport-and-gamification.test.ts
// Terkait: F10, PB-16, Paspor Kuliner Digital, Stempel Idempoten, Progres Trail, & Badge
// ============================================================================

import {
  calculateTrailProgress,
  evaluateBadges,
  INITIAL_PASSPORT_STATE,
  recordStamp,
  type PassportState,
} from '@/features/passport';
import type { Trail } from '@/types/content';

// Menggunakan data trail dan POI riil yang sesuai dengan tenant Sudirman Street Food:
// - P01: Traditional Fried Food (Pisang Goreng Pontianak, Gandasturi) [jajanan]
// - P13: Pandu Baso Goreng Tenggiri [jajanan]
// - P17: Kuo Tie Kelenteng [jajanan]
// - P16: Hau’s Tea [minuman manis]
// - P22: Susu Mbok Darmi [minuman manis]
// - P27: Rainbow Juice [minuman segar/manis]
const sampleTrails: Trail[] = [
  {
    id: 'jejak-jajanan-sudirman',
    name: 'Jejak Jajanan Sudirman',
    description: 'Eksplorasi aneka jajanan dan gorengan khas di Sudirman Street Food.',
    badgeName: 'Penjelajah Jajanan Sudirman',
    badgeIcon: 'badge_jajanan.png',
    poiIds: ['P01', 'P13', 'P17'],
  },
  {
    id: 'manis-manis-sudirman',
    name: 'Manis-manis Sudirman',
    description: 'Rute khusus penikmat minuman manis dan pelepas dahaga.',
    badgeName: 'Pemburu Manis Sudirman',
    badgeIcon: 'badge_manis.png',
    poiIds: ['P16', 'P22', 'P27'],
  },
];

const T0 = 1_700_000_000_000;

describe('Kategori 1: Sifat Idempoten Stempel Paspor Kuliner (PB-16)', () => {
  it('kunjungan/dwell pertama mencatat stempel baru dengan visitCount = 1', () => {
    const state = recordStamp(INITIAL_PASSPORT_STATE, 'P01', T0);
    expect(state.stamps['P01']).toBeDefined();
    expect(state.stamps['P01'].poiId).toBe('P01');
    expect(state.stamps['P01'].visitCount).toBe(1);
    expect(state.stamps['P01'].firstStampedAt).toBe(new Date(T0).toISOString());
  });

  it('kunjungan atau scan QR ulang pada tenant yang sama TIDAK menduplikasi stempel (idempoten)', () => {
    let state = recordStamp(INITIAL_PASSPORT_STATE, 'P01', T0);
    // Kunjungan kedua 1 jam kemudian
    state = recordStamp(state, 'P01', T0 + 3600_000);

    // Tetap hanya 1 entri stempel untuk 'P01', bukan dua
    expect(Object.keys(state.stamps)).toEqual(['P01']);
    expect(state.stamps['P01'].visitCount).toBe(2);
    expect(state.stamps['P01'].firstStampedAt).toBe(new Date(T0).toISOString());
    expect(state.stamps['P01'].lastStampedAt).toBe(new Date(T0 + 3600_000).toISOString());
  });
});

describe('Kategori 2: Perhitungan Progres Trail Tematik', () => {
  const trail = sampleTrails[0]; // Memerlukan P01, P13, P17 (Jajanan Sudirman)

  it('menghitung progres 0% jika belum ada tenant di trail yang dikunjungi', () => {
    const progress = calculateTrailProgress(trail, []);
    expect(progress.visitedCount).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.isCompleted).toBe(false);
  });

  it('menghitung progres parsial secara presisi (misal 1 dari 3 = 33%)', () => {
    const progress = calculateTrailProgress(trail, ['P01']);
    expect(progress.visitedCount).toBe(1);
    expect(progress.percentage).toBe(33);
    expect(progress.isCompleted).toBe(false);
  });

  it('menghitung progres 67% saat 2 dari 3 tenant dikunjungi', () => {
    const progress = calculateTrailProgress(trail, ['P01', 'P13']);
    expect(progress.visitedCount).toBe(2);
    expect(progress.percentage).toBe(67);
    expect(progress.isCompleted).toBe(false);
  });

  it('menghitung progres 100% dan isCompleted: true saat seluruh tenant di trail selesai dikunjungi', () => {
    const progress = calculateTrailProgress(trail, ['P01', 'P13', 'P17']);
    expect(progress.visitedCount).toBe(3);
    expect(progress.percentage).toBe(100);
    expect(progress.isCompleted).toBe(true);
  });
});

describe('Kategori 3: Sistem Penghargaan Badge Digital', () => {
  it('memberikan badge baru saat seluruh tenant pada trail selesai dikunjungi', () => {
    let passport: PassportState = INITIAL_PASSPORT_STATE;
    passport = recordStamp(passport, 'P16', T0);
    passport = recordStamp(passport, 'P22', T0 + 1000);
    passport = recordStamp(passport, 'P27', T0 + 2000);

    const { updatedState, newlyUnlockedBadges } = evaluateBadges(sampleTrails, passport, T0 + 3000);

    expect(newlyUnlockedBadges).toHaveLength(1);
    expect(newlyUnlockedBadges[0].id).toBe('manis-manis-sudirman');
    expect(newlyUnlockedBadges[0].name).toBe('Pemburu Manis Sudirman');
    expect(updatedState.unlockedBadgeIds).toContain('manis-manis-sudirman');
  });

  it('tidak memberikan badge duplikat jika badge tersebut sudah pernah terbuka sebelumnya', () => {
    let passport: PassportState = {
      stamps: {
        P16: { poiId: 'P16', firstStampedAt: '', lastStampedAt: '', visitCount: 1 },
        P22: { poiId: 'P22', firstStampedAt: '', lastStampedAt: '', visitCount: 1 },
        P27: { poiId: 'P27', firstStampedAt: '', lastStampedAt: '', visitCount: 1 },
      },
      unlockedBadgeIds: ['manis-manis-sudirman'], // Sudah terbuka sebelumnya
    };

    const { updatedState, newlyUnlockedBadges } = evaluateBadges(sampleTrails, passport);
    expect(newlyUnlockedBadges).toHaveLength(0); // Tidak ada badge baru
    expect(updatedState.unlockedBadgeIds).toEqual(['manis-manis-sudirman']);
  });
});

describe('Kategori 4: Edge Cases Paspor Kuliner', () => {
  it('menangani trail kosong dengan aman', () => {
    const emptyTrail: Trail = {
      id: 'T_EMPTY',
      name: 'Trail Kosong',
      description: '',
      badgeName: 'Empty',
      badgeIcon: null,
      poiIds: [],
    };
    const progress = calculateTrailProgress(emptyTrail, ['P01']);
    expect(progress.totalPois).toBe(0);
    expect(progress.isCompleted).toBe(true);
  });

  it('menangani POI di luar trail tanpa mempengaruhi progres trail yang ada', () => {
    const progress = calculateTrailProgress(sampleTrails[0], ['P99_UNRELATED']);
    expect(progress.visitedCount).toBe(0);
    expect(progress.percentage).toBe(0);
  });
});
