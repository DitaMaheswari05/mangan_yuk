// F02 – deteksi masuk radius POI (geofence)
import { GEOFENCE_RADIUS_M } from '@/constants/config';
import { distanceMeters, type LatLng } from '@/lib/geo';

export function isInsideGeofence(user: LatLng, poi: LatLng, radius = GEOFENCE_RADIUS_M): boolean {
  return distanceMeters(user, poi) <= radius;
}
