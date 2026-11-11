import type { NotificationResponse } from 'expo-notifications';
import { playNarration } from '@/features/audio';
import { handleNotificationResponse } from '../actions';

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  dismissNotificationAsync: jest.fn(async () => {}),
}));

jest.mock('@/features/audio', () => ({
  playNarration: jest.fn(async () => true),
}));

jest.mock('@/features/poi', () => ({
  getPoiById: jest.fn((id: string) => (id === 'P01' ? { id: 'P01', name: 'Batagor' } : undefined)),
}));

let seq = 0;
function response(actionIdentifier: string, data: Record<string, unknown>): NotificationResponse {
  seq += 1;
  return {
    actionIdentifier,
    notification: {
      date: 1_000 + seq,
      request: { identifier: `poi-nearby-${seq}`, content: { data }, trigger: null },
    },
  } as unknown as NotificationResponse;
}

const POI_DATA = { type: 'poi-geofence-enter', poiId: 'P01', url: '/poi/P01' };

describe('F04 aksi notifikasi Dengar / Lewati', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Dengar memutar narasi POI tanpa navigasi', async () => {
    const res = await handleNotificationResponse(response('LISTEN', POI_DATA));
    expect(res).toEqual({ kind: 'listen', poiId: 'P01' });
    expect(playNarration).toHaveBeenCalledWith(expect.objectContaining({ id: 'P01' }));
  });

  it('Lewati hanya menutup notifikasi', async () => {
    const res = await handleNotificationResponse(response('SKIP', POI_DATA));
    expect(res).toEqual({ kind: 'skip', poiId: 'P01' });
    expect(playNarration).not.toHaveBeenCalled();
  });

  it('respons yang sama (task + listener) hanya diputar sekali', async () => {
    const r = response('LISTEN', POI_DATA);
    await handleNotificationResponse(r);
    const second = await handleNotificationResponse(r);
    expect(second).toEqual({ kind: 'ignored' });
    expect(playNarration).toHaveBeenCalledTimes(1);
  });

  it('respons terakhir saat cold start tidak memutar ulang aksi', async () => {
    const res = await handleNotificationResponse(response('LISTEN', POI_DATA), {
      allowActions: false,
    });
    expect(res).toEqual({ kind: 'ignored' });
    expect(playNarration).not.toHaveBeenCalled();
  });

  it('ketukan biasa membuka URL kartu POI', async () => {
    const res = await handleNotificationResponse(
      response('expo.modules.notifications.actions.DEFAULT', POI_DATA),
      { allowActions: false },
    );
    expect(res).toEqual({ kind: 'open', url: '/poi/P01' });
  });
});
