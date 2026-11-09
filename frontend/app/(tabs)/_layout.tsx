import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { fontFamily } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF8316',
        tabBarInactiveTintColor: '#B8B8B8',
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="compass-outline"
              size={22}
              color={typeof color === 'string' ? color : '#FF8316'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="search-outline"
              size={22}
              color={typeof color === 'string' ? color : '#FF8316'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="passport"
        options={{
          title: 'Trail',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="git-branch-outline"
              size={22}
              color={typeof color === 'string' ? color : '#FF8316'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="person-outline"
              size={22}
              color={typeof color === 'string' ? color : '#FF8316'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    height: 72,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  tabBarItem: {
    gap: 2,
  },
  tabBarLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});
