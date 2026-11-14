import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
// Task background harus terdaftar saat bundle dimuat, termasuk saat OS menjalankan app headless.
import '@/tasks/backgroundLocation';
import '@/tasks/notificationActions';
import { handleNotificationResponse } from '@/features/notifications/actions';

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Font.loadAsync({
          'Chiron GoRound TC': require('../assets/fonts/ChironGoRoundTC-Regular.ttf'),
          'ChironGoRoundTC-Regular': require('../assets/fonts/ChironGoRoundTC-Regular.ttf'),
          'ChironGoRoundTC-Medium': require('../assets/fonts/ChironGoRoundTC-Medium.ttf'),
          'ChironGoRoundTC-SemiBold': require('../assets/fonts/ChironGoRoundTC-SemiBold.ttf'),
          'ChironGoRoundTC-Bold': require('../assets/fonts/ChironGoRoundTC-Bold.ttf'),
        });
      } catch (e) {
        if (__DEV__) {
          console.warn('[RootLayout] Gagal memuat font Chiron GoRound TC:', e);
        }
      } finally {
        if (mounted) {
          setFontsLoaded(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ketuk notifikasi geofence → buka layar terkait (mis. kartu POI); tombol Dengar / Lewati
  // ditangani tanpa navigasi. Ditunda sampai Stack terpasang (fontsLoaded) agar navigasi saat
  // cold start tidak gagal.
  useEffect(() => {
    if (!fontsLoaded) return undefined;
    const handle = async (
      response: Notifications.NotificationResponse | null,
      allowActions: boolean,
    ) => {
      const res = await handleNotificationResponse(response, { allowActions });
      if (res.kind === 'open') router.push(res.url as never);
    };
    try {
      // Respons terakhir saat cold start: aksi tombol sudah ditangani background task, jadi
      // hanya ketukan biasa yang diteruskan (mencegah narasi terputar ulang saat app dibuka).
      void handle(Notifications.getLastNotificationResponse(), false);
      const sub = Notifications.addNotificationResponseReceivedListener((r) => {
        void handle(r, true);
      });
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, [fontsLoaded]);

  return (
    <Stack
      key={fontsLoaded ? 'fonts-ready' : 'fonts-loading'}
      screenOptions={{ headerShown: false }}
    />
  );
}
