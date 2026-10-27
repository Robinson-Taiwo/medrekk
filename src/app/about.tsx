import { Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Feather from '@expo/vector-icons/Feather';

import { Card, Meta } from '@/components/design/primitives';
import { Chrome, Screen, Sheet } from '@/components/design/split';
import { C } from '@/components/design/tokens';
import { useFeedback } from '@/components/design/feedback';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

/** What the app stands for, in three lines. Each is a promise the code actually keeps. */
const PRINCIPLES: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: 'wifi-off',
    title: 'It works with no network',
    body: 'Your record is on this phone, not in a building. A clinic with no signal can still read it, and anything you add catches up when you are next online.',
  },
  {
    icon: 'user-check',
    title: 'Nobody sees it until you say yes',
    body: 'A health worker has to ask. You see who they are, where they work and why — and you can approve less than they asked for. Access ends by itself.',
  },
  {
    icon: 'eye',
    title: 'Every look is written down',
    body: 'Views, emergency scans and dial-ins all land in a log only you can open. Nobody can read your record quietly.',
  },
];

/**
 * A plain About screen.
 *
 * Deliberately short. The interesting detail is on the website and in the documentation; what
 * belongs here is what somebody holding the app would want to know — what it promises, where to
 * read more, and which version they are actually running when something goes wrong.
 */
export default function AboutScreen() {
  const router = useRouter();
  const { toast } = useFeedback();

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build =
    Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? null;

  const open = async (path: string) => {
    if (!WEB_URL) {
      toast({ tone: 'error', title: 'No website configured', body: 'EXPO_PUBLIC_WEB_URL is not set in this build.' });
      return;
    }
    const url = `${WEB_URL}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast({ tone: 'error', title: 'Could not open the browser', body: url });
    }
  };

  return (
    <Screen>
      <Chrome title="About MedRekk" onBack={() => router.back()} />

      <Sheet>
        <View className="items-center gap-3 pb-1 pt-2">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
            <Feather name="shield" size={28} color={C.primary} />
          </View>
          <Text className="px-4 text-center text-[15px] leading-[22px] text-ink">
            A medical record that belongs to you, travels with you, and works where the network does not.
          </Text>
        </View>

        <View className="gap-2.5">
          {PRINCIPLES.map((p) => (
            <Card key={p.title} className="flex-row gap-3 p-3.5">
              <View className="mt-[1px] h-9 w-9 items-center justify-center rounded-xl bg-fill">
                <Feather name={p.icon} size={16} color={C.ink} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-[14px] font-semibold text-ink">{p.title}</Text>
                <Text className="text-[12.5px] leading-[18px] text-muted">{p.body}</Text>
              </View>
            </Card>
          ))}
        </View>

        <View className="gap-2">
          <Pressable onPress={() => void open('')}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
                <Feather name="globe" size={16} color={C.primary} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[14px] font-semibold text-ink">Visit the website</Text>
                <Meta>{WEB_URL.replace(/^https?:\/\//, '') || 'Not configured in this build'}</Meta>
              </View>
              <Feather name="external-link" size={16} color={C.muted} />
            </Card>
          </Pressable>

          <Pressable onPress={() => void open('/privacy')}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-fill">
                <Feather name="lock" size={16} color={C.ink} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[14px] font-semibold text-ink">Privacy</Text>
                <Meta>What is stored, and what never leaves this phone</Meta>
              </View>
              <Feather name="external-link" size={16} color={C.muted} />
            </Card>
          </Pressable>

          <Pressable onPress={() => void open('/how-it-works')}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-fill">
                <Feather name="book-open" size={16} color={C.ink} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[14px] font-semibold text-ink">How it works</Text>
                <Meta>The longer explanation</Meta>
              </View>
              <Feather name="external-link" size={16} color={C.muted} />
            </Card>
          </Pressable>
        </View>

        {/* The version, because the first question about any bug is which build it happened on. */}
        <View className="items-center gap-1 pt-2">
          <Text className="text-[12px] text-muted">
            Version {version}
            {build ? ` · build ${build}` : ''}
          </Text>
          <Text className="text-[11.5px] text-dim">Made in Nigeria</Text>
        </View>
      </Sheet>
    </Screen>
  );
}
