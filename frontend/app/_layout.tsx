import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';

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

  return (
    <Stack
      key={fontsLoaded ? 'fonts-ready' : 'fonts-loading'}
      screenOptions={{ headerShown: false }}
    />
  );
}
