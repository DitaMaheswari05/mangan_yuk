// F01 / PB03 – Izin & pelacakan lokasi pengguna
// Mengacu pada docs/api/client-contracts.yaml (PB03_location).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  FIRST_FIX_TIMEOUT_MS,
  LOCATION_DISTANCE_INTERVAL_M,
  LOCATION_TIME_INTERVAL_MS,
} from '@/constants/config';
import areaJson from '@/data/area.json';
import { PermissionService, type PermStatus } from '@/features/onboarding';
import { getArea } from '@/features/poi';
import {
  bearingDeg,
  computeAreaStatus,
  haversineM,
  type AreaGeometry,
  type AreaStatus,
  type LatLng,
  type UserPosition,
} from '@/lib/geo';
import { fail, ok, type AppError, type Result } from '@/lib/result';
import type { AreaConfig } from '@/types/content';

export {
  bearingDeg,
  computeAreaStatus,
  haversineM,
  type AreaGeometry,
  type AreaStatus,
  type LatLng,
  type UserPosition,
};

export const GeoUtils = {
  haversineM,
  bearingDeg,
  computeAreaStatus,
};

export type UserLocationState = {
  permission: PermStatus;
  position: UserPosition | null;
  areaStatus: AreaStatus;
  distanceToAreaM: number | null;
  error: AppError | null;
};

const DEFAULT_AREA: AreaConfig = areaJson as AreaConfig;

function toUserPosition(loc: {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
}): UserPosition {
  return {
    coordinate: {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    },
    accuracyM:
      typeof loc.coords.accuracy === 'number' && loc.coords.accuracy >= 0
        ? loc.coords.accuracy
        : 0,
    timestamp: loc.timestamp ?? Date.now(),
  };
}

export const LocationService = {
  /**
   * Fix pertama posisi pengguna; timeout default 10000 ms (F01-AC1) → LOCATION_TIMEOUT.
   */
  async getCurrentPosition(opts?: { timeoutMs?: number }): Promise<Result<UserPosition>> {
    const timeoutMs = opts?.timeoutMs ?? FIRST_FIX_TIMEOUT_MS;

    const perm = await PermissionService.getLocationStatus();
    if (perm !== 'granted') {
      return fail('PERMISSION_DENIED', 'Izin lokasi belum diberikan.');
    }

    const servicesEnabled = await PermissionService.isLocationServicesEnabled();
    if (!servicesEnabled) {
      return fail('SERVICES_DISABLED', 'Layanan lokasi (GPS) pada perangkat tidak aktif.');
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');

      const timeoutPromise = new Promise<Result<UserPosition>>((resolve) => {
        timer = setTimeout(() => {
          resolve(
            fail(
              'LOCATION_TIMEOUT',
              `Gagal mendapatkan lokasi dalam batas waktu ${timeoutMs} ms.`,
            ),
          );
        }, timeoutMs);
      });

      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).then(
        (loc) => ok(toUserPosition(loc)),
        (err) => fail('LOCATION_UNAVAILABLE', 'Lokasi pengguna tidak tersedia saat ini.', err),
      );

      return await Promise.race([locationPromise, timeoutPromise]);
    } catch (e) {
      return fail('LOCATION_UNAVAILABLE', 'Gagal membaca lokasi perangkat.', e);
    } finally {
      if (timer) clearTimeout(timer);
    }
  },

  /**
   * Wrapper watchPositionAsync — accuracy: High, timeInterval: 3000, distanceInterval: 5 (F01).
   * Mengembalikan fungsi unsubscribe.
   */
  async watchPosition(
    onUpdate: (p: UserPosition) => void,
    onError: (e: AppError) => void,
  ): Promise<Result<() => void>> {
    const perm = await PermissionService.getLocationStatus();
    if (perm !== 'granted') {
      const err: AppError = {
        code: 'PERMISSION_DENIED',
        message: 'Izin lokasi belum diberikan.',
      };
      onError(err);
      return { ok: false, error: err };
    }

    const servicesEnabled = await PermissionService.isLocationServicesEnabled();
    if (!servicesEnabled) {
      const err: AppError = {
        code: 'SERVICES_DISABLED',
        message: 'Layanan lokasi (GPS) pada perangkat tidak aktif.',
      };
      onError(err);
      return { ok: false, error: err };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_TIME_INTERVAL_MS,
          distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
        },
        (loc) => {
          onUpdate(toUserPosition(loc));
        },
      );

      return ok(() => {
        try {
          subscription.remove();
        } catch {
          // Abaikan error saat cleanup subscription
        }
      });
    } catch (e) {
      const err: AppError = {
        code: 'LOCATION_UNAVAILABLE',
        message: 'Gagal memantau perubahan lokasi pengguna.',
        cause: e,
      };
      onError(err);
      return { ok: false, error: err };
    }
  },
};

/**
 * Hook pelacakan lokasi pengguna & status kawasan SSF untuk dikonsumsi layar Beranda (Home).
 */
export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    permission: 'undetermined',
    position: null,
    areaStatus: 'UNKNOWN',
    distanceToAreaM: null,
    error: null,
  });

  const areaRef = useRef<AreaConfig>(DEFAULT_AREA);
  const areaStatusRef = useRef<AreaStatus>('UNKNOWN');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const applyPosition = useCallback((pos: UserPosition) => {
    const area = areaRef.current;
    const nextStatus = computeAreaStatus(pos, area, areaStatusRef.current);
    areaStatusRef.current = nextStatus;
    const distanceM = Math.round(haversineM(pos.coordinate, area.center));

    setState((prev) => ({
      ...prev,
      position: pos,
      areaStatus: nextStatus,
      distanceToAreaM: distanceM,
      error: null,
    }));
  }, []);

  const stopWatching = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  const startTracking = useCallback(async () => {
    stopWatching();

    const areaRes = await getArea();
    if (areaRes.ok) {
      areaRef.current = areaRes.data;
    }

    const perm = await PermissionService.getLocationStatus();
    if (perm !== 'granted') {
      areaStatusRef.current = 'UNKNOWN';
      setState({
        permission: perm,
        position: null,
        areaStatus: 'UNKNOWN',
        distanceToAreaM: null,
        error:
          perm === 'denied'
            ? { code: 'PERMISSION_DENIED', message: 'Izin lokasi ditolak.' }
            : null,
      });
      return;
    }

    setState((prev) => ({ ...prev, permission: 'granted', error: null }));

    // 1. Ambil fix pertama dengan batas waktu FIRST_FIX_TIMEOUT_MS (10 detik)
    const firstFix = await LocationService.getCurrentPosition();
    if (firstFix.ok) {
      applyPosition(firstFix.data);
    } else {
      setState((prev) => ({ ...prev, error: firstFix.error }));
    }

    // 2. Pantau pembaruan lokasi secara kontinu
    const watchRes = await LocationService.watchPosition(
      (pos) => {
        applyPosition(pos);
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err }));
      },
    );

    if (watchRes.ok) {
      unsubscribeRef.current = watchRes.data;
    }
  }, [applyPosition, stopWatching]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (active) {
        await startTracking();
      }
    })();

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && active) {
        startTracking();
      }
    });

    return () => {
      active = false;
      sub.remove();
      stopWatching();
    };
  }, [startTracking, stopWatching]);

  return state;
}
