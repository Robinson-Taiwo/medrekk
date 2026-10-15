import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';

type IconName = keyof typeof Feather.glyphMap;

interface TabSpec {
  name: string;
  label: string;
  icon: IconName;
  /** The design's raised centre button. */
  raised?: boolean;
}

const PATIENT_TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'record', label: 'Record', icon: 'file-text' },
  { name: 'emergency', label: '', icon: 'grid', raised: true },
  { name: 'explore', label: 'Access', icon: 'shield' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

const WORKER_TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'worker-patient', label: 'Patient', icon: 'search' },
  { name: 'worker-encounter', label: '', icon: 'edit-3', raised: true },
  { name: 'worker-model', label: 'Model', icon: 'cpu' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

/** Typed locally: @react-navigation/bottom-tabs is a transitive dependency without its own types here. */
interface TabRoute {
  key: string;
  name: string;
}

interface TabBarState {
  index: number;
  routes: TabRoute[];
}

interface TabBarNavigation {
  emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  navigate: (name: string) => void;
}

interface TabBarProps {
  state: TabBarState;
  navigation: TabBarNavigation;
  tabs: TabSpec[];
}

function TabBar({ state, navigation, tabs }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-start justify-around border-t border-line bg-surface px-2.5 pt-2.5"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
      {state.routes.map((route, index) => {
        const tab = tabs.find((t) => t.name === route.name);
        if (!tab) return null;

        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (tab.raised) {
          return (
            <Pressable key={route.key} onPress={onPress} className="w-[60px] items-center">
              <View className="-mt-4 h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-ink">
                <Feather name={tab.icon} size={22} color="#FFFFFF" />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable key={route.key} onPress={onPress} className="w-[60px] items-center gap-1">
            <Feather name={tab.icon} size={22} color={focused ? '#0F6E56' : '#64748B'} />
            <Text className={`text-[11px] font-medium ${focused ? 'text-primary' : 'text-muted'}`}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppTabs() {
  const { user } = useAuth();
  const tabs = user?.role === 'HEALTH_WORKER' ? WORKER_TABS : PATIENT_TABS;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...(props as unknown as Omit<TabBarProps, 'tabs'>)} tabs={tabs} />}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
