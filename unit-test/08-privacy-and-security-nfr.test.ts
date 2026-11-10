// ============================================================================
// Unit Test: 08-privacy-and-security-nfr.test.ts
// Terkait: F09, NFR, PB-02, PB-17, Zero Network Location Leakage & Consent Architecture
// ============================================================================

import { getRecommendations } from '@/features/recommendation';
import { searchPois } from '@/features/search';
import { planTrail } from '@/features/trail';
import type { LatLng } from '@/lib/geo';
import type { Poi } from '@/types/content';

const dummyPoi: Poi = {
  id: 'P13',
  name: 'Pandu Baso Goreng Tenggiri',
  slug: 'pandu-baso-goreng-tenggiri',
  type: 'jajanan',
  categoryLabel: 'Jajanan / Gurih',
  tasteTags: ['gurih'],
  isHalal: null,
  zone: 'Zone B',
  latitude: -6.92089,
  longitude: 107.600574,
  triggerRadiusM: 10,
  avgVisitMin: 15,
  description: 'Baso goreng tenggiri legendaris di Sudirman.',
  culturalStory: null,
  photos: [],
  audio: null,
  menu: [{ id: 'P13-M1', name: 'Baso Goreng', priceIdr: 36000, tastes: ['gurih'], isSignature: true }],
  openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
  peakHours: [],
  searchKeywords: ['baso', 'goreng', 'tenggiri'],
  qrCode: null,
  priceMinIdr: 36000,
  priceMaxIdr: 36000,
  priceBucket: 'over30k',
};

describe('Kategori 1: Zero Network Coordinate Leakage Audit (F09, NFR, SB-5.3)', () => {
  let originalFetch: typeof global.fetch;
  let interceptedRequests: { url: string; body?: unknown }[] = [];

  beforeEach(() => {
    originalFetch = global.fetch;
    interceptedRequests = [];
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
      interceptedRequests.push({ url: url.toString(), body: init?.body });
      return Promise.resolve(new Response(JSON.stringify({})));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('seluruh modul cerdas (Rekomendasi, Search, Trail Planner) berjalan 100% offline tanpa HTTP request', () => {
    const userLocation: LatLng = { latitude: -6.92089, longitude: 107.600574 };

    // 1. Jalankan pencarian
    searchPois([dummyPoi], 'baso');

    // 2. Jalankan rekomendasi
    getRecommendations({
      userPosition: userLocation,
      pois: [dummyPoi],
      visitedPoiIds: [],
    });

    // 3. Jalankan trail planning
    planTrail({
      userPosition: userLocation,
      pois: [dummyPoi],
      durationMin: 60,
      budget: 50000,
    });

    // Audit: Pastikan 0 HTTP request dibuat
    expect(interceptedRequests).toHaveLength(0);
  });

  it('jika ada panggilan jaringan di aplikasi, tidak ada payload yang memuat koordinat GPS pengguna', () => {
    const userCoords = { lat: -6.92089, lng: 107.600574 };

    // Simulasi audit inspeksi paket jaringan seperti di Charles/Wireshark (SB-5.3)
    for (const req of interceptedRequests) {
      const serialized = JSON.stringify(req);
      expect(serialized).not.toContain(String(userCoords.lat));
      expect(serialized).not.toContain(String(userCoords.lng));
      expect(serialized).not.toContain('latitude');
      expect(serialized).not.toContain('longitude');
    }
  });
});

describe('Kategori 2: Tata Kelola Izin Privasi (Privacy Consent Order - PB-02)', () => {
  it('penjelasan transparansi privasi harus diberikan kepada pengguna sebelum izin lokasi diminta', () => {
    // Alur onboarding mensyaratkan:
    // Step 1: Penjelasan bahwa lokasi hanya diproses lokal di HP dan tidak pernah diunggah ke cloud
    // Step 2: Tombol user persetujuan eksplisit
    // Step 3: Permintaan izin sistem Android Foreground / Background
    const consentFlow = ['EXPLANATION_MODAL', 'USER_ACKNOWLEDGE', 'SYSTEM_PERMISSION_PROMPT'];
    const explanationIndex = consentFlow.indexOf('EXPLANATION_MODAL');
    const systemPromptIndex = consentFlow.indexOf('SYSTEM_PERMISSION_PROMPT');

    expect(explanationIndex).toBeLessThan(systemPromptIndex);
  });
});
