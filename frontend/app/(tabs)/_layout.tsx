import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="trail" options={{ title: 'Trail' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Route cadangan bila ada navigasi internal */}
      <Tabs.Screen name="passport" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
