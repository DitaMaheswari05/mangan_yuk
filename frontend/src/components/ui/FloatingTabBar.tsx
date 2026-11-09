import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavIcon } from '@/components/ui/NavIcon';
import { fontFamily } from '@/constants/theme';

export type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomTabBarProps = any;

const TAB_CONFIG: Record<
  string,
  { label: string; icon: 'explore' | 'search' | 'trail' | 'profile' }
> = {
  index: { label: 'Explore', icon: 'explore' },
  search: { label: 'Search', icon: 'search' },
  trail: { label: 'Trail', icon: 'trail' },
  passport: { label: 'Trail', icon: 'trail' },
  profile: { label: 'Profile', icon: 'profile' },
  settings: { label: 'Profile', icon: 'profile' },
};

export function FloatingTabBar(props: CustomTabBarProps) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();

  // Filter routes agar hanya menampilkan 4 tab utama
  // urutan: explore (index), search, trail, profile
  const mainRoutes = (state.routes as TabRoute[]).filter((route: TabRoute) =>
    ['index', 'search', 'trail', 'profile'].includes(route.name),
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        { bottom: Math.max(insets.bottom, 16) },
      ]}
    >
      <View style={styles.navBar}>
        {mainRoutes.map((route: TabRoute) => {
          const isFocused = state.index === state.routes.indexOf(route);
          const config = TAB_CONFIG[route.name] || {
            label: route.name,
            icon: 'explore',
          };

          const activeColor = '#FF8316'; // Sesuai token Figma navbar aktif
          const inactiveColor = '#CCCCCC'; // Sesuai token Figma navbar non-aktif
          const color = isFocused ? activeColor : inactiveColor;

          const onPress = () => {
            if (navigation) {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            } else if (props.navigateToTab) {
              props.navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            if (navigation) {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={config.label}
              testID={`tab-${route.name}`}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <NavIcon name={config.icon} color={color} size={24} />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: 356,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // Soft floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    height: 48,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
