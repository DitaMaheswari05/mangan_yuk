import { isInsideGeofence } from '../index';

const poi = { latitude: -6.920838, longitude: 107.600471 }; // P09 Dapur Sotoku

describe('isInsideGeofence', () => {
  it('true jika pengguna tepat di POI', () => {
    expect(isInsideGeofence(poi, poi)).toBe(true);
  });

  it('radius default 10 m: 8 m masuk, 12 m tidak', () => {
    const dLat = (m: number) => m / ((Math.PI / 180) * 6_371_000);
    expect(isInsideGeofence({ ...poi, latitude: poi.latitude + dLat(8) }, poi)).toBe(true);
    expect(isInsideGeofence({ ...poi, latitude: poi.latitude + dLat(12) }, poi)).toBe(false);
  });

  it('radius bisa diganti per POI', () => {
    expect(isInsideGeofence({ latitude: -6.9207, longitude: 107.600471 }, poi, 25)).toBe(true);
  });
});
