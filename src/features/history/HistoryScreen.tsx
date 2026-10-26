import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/services/api";

interface AuditEntry {
  id: string;
  type: string;
  accessType?: string;
  occurredAt: string;
  sessionId?: string;
  requesterIdentifier?: string;
  reason?: string;
  informationViewed?: string[];
}

const LABEL: Record<string, { title: string; dot: string }> = {
  ACCESS_SESSION_STARTED: { title: "Someone looked you up", dot: "bg-dim" },
  ACCESS_REQUESTED: { title: "Access requested", dot: "bg-amber-500" },
  ACCESS_APPROVED: { title: "You approved access", dot: "bg-emerald-500" },
  ACCESS_DENIED: { title: "You denied access", dot: "bg-red-500" },
  RECORD_VIEWED: { title: "Record viewed", dot: "bg-sky-500" },
  EVIDENCE_ADDED: { title: "Evidence added to an item", dot: "bg-indigo-500" },
  CLAIM_VERIFIED: { title: "An item was clinically verified", dot: "bg-emerald-600" },
  EMERGENCY_PROFILE_VERIFIED: { title: "Emergency profile verified", dot: "bg-emerald-600" },
  EMERGENCY_ACCESSED: { title: "Emergency profile opened", dot: "bg-red-600" },
  REFERRAL_CREATED: { title: "You created a referral", dot: "bg-indigo-500" },
  REFERRAL_VIEWED: { title: "A referral was opened", dot: "bg-sky-500" },
  REFERRAL_REVOKED: { title: "You cancelled a referral", dot: "bg-dim" },
  ACCESS_REVOKED: { title: "You ended someone's access", dot: "bg-dim" },
  ACCESS_RELEASED: { title: "A health worker gave access back", dot: "bg-dim" },
  CLAIM_REMOVED: { title: "You removed an item from your record", dot: "bg-dim" },
  ENCOUNTER_RECORDED: { title: "A health worker started a note", dot: "bg-amber-500" },
  ENCOUNTER_REVIEWED: { title: "A health worker added items to your record", dot: "bg-indigo-500" },
  ENCOUNTER_DISCARDED: { title: "A health worker discarded a note", dot: "bg-dim" },
};

const pretty = (s: string): string => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Entry({ item }: { item: AuditEntry }) {
  const meta = LABEL[item.type] ?? { title: pretty(item.type), dot: "bg-dim" };
  const viewed = item.informationViewed && item.informationViewed.length > 0 ? item.informationViewed.map(pretty).join(", ") : null;
  return (
    <View className="gap-1 rounded-2xl border border-line bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <View className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
        <Text className="flex-1 text-base font-semibold text-ink">{meta.title}</Text>
      </View>
      <Text className="text-xs text-muted">{new Date(item.occurredAt).toLocaleString()}</Text>
      {item.requesterIdentifier ? (
        <Text className="text-sm text-ink">By: {item.requesterIdentifier}</Text>
      ) : null}
      {viewed ? <Text className="text-sm text-ink">Information: {viewed}</Text> : null}
      {item.reason ? <Text className="text-sm text-ink">Reason: {item.reason}</Text> : null}
    </View>
  );
}

export default function HistoryScreen() {
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api<AuditEntry[]>("/patients/me/audit");
      setItems([...rows].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!items) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-canvas p-6">
        {error ? (
          <View className="items-center gap-3">
            <Text className="text-center text-sm text-red-700">{error}</Text>
            <Pressable onPress={() => void load()} className="rounded-xl bg-[#0F6E56] px-5 py-3">
              <Text className="font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={
          <View className="mb-2 gap-1">
            <Text className="text-3xl font-bold text-ink">Access history</Text>
            <Text className="text-sm text-muted">
              Everyone who looked at or changed your record, newest first. Pull down to refresh.
            </Text>
            {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text className="text-sm text-muted">Nothing has happened yet.</Text>}
        renderItem={({ item }) => <Entry item={item} />}
      />
    </SafeAreaView>
  );
}
