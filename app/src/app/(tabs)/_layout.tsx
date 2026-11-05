import { Tabs } from 'expo-router/tabs';
import { useWindowDimensions } from 'react-native';
import { TabBar } from '@/components/navigation/TabBar';
import { useTheme, navigationLayoutFor } from '@/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const vertical = navigationLayoutFor(width) !== 'bottom-bar';
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: vertical ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
