import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="search" options={{ title: 'Cari' }} />
      <Tabs.Screen name="passport" options={{ title: 'Paspor' }} />
      <Tabs.Screen name="settings" options={{ title: 'Pengaturan' }} />
    </Tabs>
  );
}
