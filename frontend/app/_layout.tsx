import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
// Task background harus terdaftar saat bundle dimuat, termasuk saat OS menjalankan app headless.
import '@/tasks/backgroundLocation';

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
        console.warn('[RootLayout] Gagal memuat font Chiron GoRound TC:', e);
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

  // Ketuk notifikasi geofence → buka layar terkait (mis. kartu POI).
  // Ditunda sampai Stack terpasang (fontsLoaded) agar navigasi saat cold start tidak gagal.
  useEffect(() => {
    if (!fontsLoaded) return undefined;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    try {
      open(Notifications.getLastNotificationResponse());
      const sub = Notifications.addNotificationResponseReceivedListener(open);
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
