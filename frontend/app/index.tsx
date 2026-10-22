import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/useAppStore';

// Entry point: arahkan ke onboarding jika belum selesai, jika sudah ke tab Beranda.
export default function Index() {
  const onboarded = useAppStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding/welcome'} />;
}
