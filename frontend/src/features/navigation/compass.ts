// F06 / PB-11: Modul Hook & Listener Sensor Kompas (Heading)
import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';

export type CompassHeading = {
  /** Nilai orientasi perangkat (0–360° terhadap utara magnetik/sejati) */
  headingDeg: number;
  accuracy: number;
};

function getExpoLocation(): typeof import('expo-location') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as typeof import('expo-location');
  } catch {
    return null;
  }
}

/**
 * Hook untuk memantau arah hadap (compass heading) perangkat secara real-time.
 * Dilengkapi fallback smoothing & dev mocking.
 */
export function useCompassHeading(): { headingDeg: number; isAvailable: boolean } {
  const [headingDeg, setHeadingDeg] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);
  const lastHeadingRef = useRef(0);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;

    async function startCompass() {
      const Location = getExpoLocation();
      if (!Location || typeof Location.watchHeadingAsync !== 'function') {
        if (active) setIsAvailable(false);
        return;
      }

      try {
        subscription = await Location.watchHeadingAsync((data) => {
          if (!active) return;
          // trueHeading didukung di beberapa perangkat, fallback ke magHeading
          const current = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
          if (typeof current === 'number' && !isNaN(current)) {
            // Smoothing sederhana wrap-around 360
            lastHeadingRef.current = Math.round(current);
            setHeadingDeg(Math.round(current));
            setIsAvailable(true);
          }
        });
      } catch (err) {
        if (active) {
          setIsAvailable(false);
        }
      }
    }

    startCompass();

    return () => {
      active = false;
      if (subscription) {
        try {
          subscription.remove();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { headingDeg, isAvailable };
}
