import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { C } from '@/components/design/tokens';
import { Empty } from '@/components/design/split';
import { BottomTabInset } from '@/constants/theme';

interface RowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  value: string;
  onPress?: () => void;
}

function ControlRow({ icon, title, body, value, onPress }: RowProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-3.5 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-fill">
        <Feather name={icon} size={18} color={C.ink} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-ink">{title}</Text>
        <Text className="text-xs text-muted">{body}</Text>
      </View>
      <Text className="text-[13px] text-muted">{value}</Text>
      <Feather name="chevron-right" size={18} color={C.muted} />
    </Pressable>
  );
}

interface Props {
  onShowCode: () => void;
  onHowItWorks: () => void;
  onEmergencyCard: () => void;
  onHistory: () => void;
  historyValue: string;
}

export default function AccessEmpty({
  onShowCode,
  onHowItWorks,
  onEmergencyCard,
  onHistory,
  historyValue,
}: Props) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 16 }}>
      {/*
        One statement of the fact, not three.
        
        This screen used to say "your record is private", then "no pending requests", then "no
        active sessions" — the same absence, worded three ways, which reads as a system with
        three broken parts rather than one working guarantee. The page header is gone too: the
        screen's chrome already carries it.
      */}
      <Empty
        icon="lock"
        title="Your record is private"
        body="Nobody has access, and nobody is asking. This is where that changes, and only with your say-so."
        hints={[
          { icon: 'user-check', label: 'A request shows who is asking, where they work and why' },
          { icon: 'sliders', label: 'You can approve part of what they asked for' },
          { icon: 'clock', label: 'Access ends on its own, and you can end it sooner' },
        ]}
      />

      <View className="flex-row gap-2.5">
        <Pressable
          onPress={onShowCode}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <Feather name="grid" size={16} color={C.surface} />
          <Text className="text-[15px] font-medium text-white">Show my code</Text>
        </Pressable>
        <Pressable
          onPress={onHowItWorks}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
          <Feather name="info" size={16} color={C.ink} />
          <Text className="text-[15px] font-medium text-ink">How it works</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">Your controls</Text>
        <View className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <ControlRow
            icon="grid"
            title="Emergency card"
            body="Readable by a responder without your approval"
            value="On"
            onPress={onEmergencyCard}
          />
          <ControlRow
            icon="file-text"
            title="Access history"
            body="Every view is written down"
            value={historyValue}
            onPress={onHistory}
          />
        </View>
      </View>
    </ScrollView>
  );
}
