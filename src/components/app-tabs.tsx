import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { C } from '@/components/design/tokens';

type IconName = keyof typeof Feather.glyphMap;

interface TabSpec {
  name: string;
  label: string;
  icon: IconName;
}

/**
 * Every tab is drawn the same way and the filled marker follows whichever one is open.
 *
 * The middle tab used to be a raised button painted dark whether or not it was the screen you
 * were on, so the bar always looked as though the middle tab were selected — and the real
 * selection, a small change of icon colour, was the quieter of the two signals. A permanent
 * highlight on a tab you are not looking at is worse than no highlight at all.
 */
const PATIENT_TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'record', label: 'Record', icon: 'file-text' },
  { name: 'emergency', label: 'Emergency', icon: 'alert-circle' },
  { name: 'explore', label: 'Access', icon: 'shield' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

const WORKER_TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'worker-patient', label: 'Patient', icon: 'search' },
  { name: 'worker-encounter', label: 'Visit', icon: 'edit-3' },
  { name: 'worker-model', label: 'Model', icon: 'cpu' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

/**
 * Reachable by name but not shown in the bar. A patient can now record by voice, so they need
 * the model screen the worker has — without a fifth-and-a-half tab, and without pushing a
 * route the navigator never registered for them, which simply did nothing when tapped.
 */
const PATIENT_HIDDEN = ['worker-model'];

/**
 * Not in the bar, but reachable. The credential screen is a thing a worker visits once, and
 * `record` is their own record — present only once they have turned one on, which is why it
 * is registered rather than given a tab.
 */
const WORKER_HIDDEN = ['worker-credential', 'record'];

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
    /*
     * A floating bar rather than a strip welded to the bottom edge.
     *
     * Edge-to-edge, it read as the end of the screen — a place where content ran out. Lifted
     * clear with the sheet visible underneath, it reads as a control resting on the page,
     * which is what it is. The inset top highlight is the same trick the panels use: depth
     * from a one-pixel line rather than from a shadow, which stays crisp at any density.
     */
    <View className="bg-night px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      <View
        className="flex-row items-center justify-around rounded-[22px] border border-white/[0.08] px-1.5 py-2"
        style={{
          backgroundColor: 'rgba(255,255,255,0.045)',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}>
      {state.routes.map((route, index) => {
        const tab = tabs.find((t) => t.name === route.name);
        if (!tab) return null;

        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            className="flex-1 items-center gap-[3px] py-0.5">
            <View
              className="h-7 w-[52px] items-center justify-center rounded-full"
              style={focused ? { backgroundColor: 'rgba(47,190,143,0.18)' } : undefined}>
              <Feather name={tab.icon} size={19} color={focused ? C.glow : C.mistFaint} />
            </View>
            <Text
              numberOfLines={1}
              className="text-[10px]"
              style={{
                color: focused ? C.glow : C.mistFaint,
                fontWeight: focused ? '700' : '500',
                letterSpacing: 0.1,
              }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  const { user } = useAuth();
  const worker = user?.role === 'HEALTH_WORKER';
  const tabs = worker ? WORKER_TABS : PATIENT_TABS;
  // Registered so they can be navigated to; TabBar skips any route it has no spec for.
  const hidden = worker ? WORKER_HIDDEN : PATIENT_HIDDEN;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...(props as unknown as Omit<TabBarProps, 'tabs'>)} tabs={tabs} />}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
      {hidden.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}
