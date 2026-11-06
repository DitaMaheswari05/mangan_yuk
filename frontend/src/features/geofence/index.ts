// F02 – deteksi masuk radius POI (geofence)
import { DEFAULT_TRIGGER_RADIUS_M } from '@/constants/config';
import { haversineM, type LatLng } from '@/lib/geo';

export function isInsideGeofence(user: LatLng, poi: LatLng, radius = DEFAULT_TRIGGER_RADIUS_M): boolean {
  return haversineM(user, poi) <= radius;
}
