import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
        <Feather name={icon} size={18} color="#142D2A" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-ink">{title}</Text>
        <Text className="text-xs text-muted">{body}</Text>
      </View>
      <Text className="text-[13px] text-muted">{value}</Text>
      <Feather name="chevron-right" size={18} color="#64748B" />
    </Pressable>
  );
}

function EmptyRow({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3.5">
      <Feather name={icon} size={16} color="#64748B" />
      <Text className="text-sm text-muted">{label}</Text>
    </View>
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
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 18 }}>
      <View className="gap-1">
        <Text className="text-[28px] font-semibold tracking-tight text-ink">Access</Text>
        <Text className="text-sm text-muted">You decide who sees your record, and for how long.</Text>
      </View>

      <View className="items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
          <Feather name="lock" size={22} color="#0F6E56" />
        </View>
        <Text className="text-xl font-semibold text-ink">Your record is private</Text>
        <Text className="max-w-[300px] text-center text-sm leading-[21px] text-muted">
          No one has access right now. Requests from health workers will appear here, and nothing is shared until you
          approve.
        </Text>
        <View className="w-full flex-row gap-2.5 pt-1">
          <Pressable
            onPress={onShowCode}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
            <Feather name="grid" size={16} color="#FFFFFF" />
            <Text className="text-[15px] font-medium text-white">Show my code</Text>
          </Pressable>
          <Pressable
            onPress={onHowItWorks}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
            <Feather name="info" size={16} color="#142D2A" />
            <Text className="text-[15px] font-medium text-ink">How it works</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Requests</Text>
        <EmptyRow icon="bell" label="No pending requests" />
      </View>

      <View className="gap-2">
        <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Active access</Text>
        <EmptyRow icon="shield" label="No active sessions" />
      </View>

      <View className="gap-2">
        <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Your controls</Text>
        <View className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <ControlRow
            icon="grid"
            title="Emergency card"
            body="Visible to anyone who scans your QR"
            value="On"
            onPress={onEmergencyCard}
          />
          <ControlRow
            icon="file-text"
            title="Access history"
            body="Every view is logged"
            value={historyValue}
            onPress={onHistory}
          />
        </View>
      </View>
    </ScrollView>
  );
}
