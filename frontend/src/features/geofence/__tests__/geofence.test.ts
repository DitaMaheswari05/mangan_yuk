import { isInsideGeofence } from '../index';

const poi = { latitude: -6.2, longitude: 106.8 };

describe('isInsideGeofence', () => {
  it('true jika pengguna tepat di POI', () => {
    expect(isInsideGeofence(poi, poi)).toBe(true);
  });

  it('false jika pengguna ~1 km dari POI', () => {
    expect(isInsideGeofence({ latitude: -6.209, longitude: 106.8 }, poi)).toBe(false);
  });
});
