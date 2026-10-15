import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/services/api";
import ReferralCreate from "./ReferralCreate";
import ReferralShare from "./ReferralShare";
import { effectiveStatus, type Referral } from "./types";

type Screen = { kind: "list" } | { kind: "create" } | { kind: "share"; referral: Referral };

const PILL: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Active" },
  REVOKED: { bg: "bg-gray-200", text: "text-gray-700", label: "Cancelled" },
  EXPIRED: { bg: "bg-amber-100", text: "text-amber-800", label: "Expired" },
};

export default function ReferralsFlow({ onClose }: { onClose: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [items, setItems] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isList = screen.kind === "list";

  useEffect(() => {
    if (!isList) return;
    let live = true;
    api<Referral[]>("/patients/me/referrals")
      .then((rows) => {
        if (!live) return;
        setItems([...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
        setError(null);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [isList]);

  if (screen.kind === "create") {
    return (
      <ReferralCreate
        onCancel={() => setScreen({ kind: "list" })}
        onCreated={(r) => setScreen({ kind: "share", referral: r })}
      />
    );
  }

  if (screen.kind === "share") {
    return (
      <ReferralShare
        referral={screen.referral}
        onBack={() => setScreen({ kind: "list" })}
        onChanged={() => undefined}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Pressable onPress={onClose} className="self-start py-1">
          <Text className="text-base text-[#0F6E56]">Back to my record</Text>
        </Pressable>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Referrals</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          A referral shares a snapshot of the items you choose with a provider who does not have your record yet.
        </Text>

        <Pressable onPress={() => setScreen({ kind: "create" })} className="items-center rounded-xl bg-[#0F6E56] py-4">
          <Text className="text-base font-semibold text-white">New referral</Text>
        </Pressable>

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
        {!items && !error ? <ActivityIndicator /> : null}
        {items && items.length === 0 ? <Text className="text-sm text-gray-500">No referrals yet.</Text> : null}

        {(items ?? []).map((r) => {
          const status = effectiveStatus(r);
          const pill = PILL[status];
          return (
            <Pressable
              key={r.id}
              onPress={() => setScreen({ kind: "share", referral: r })}
              className="gap-1 rounded-2xl border border-gray-200 p-4 active:opacity-80 dark:border-gray-800"
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{r.destinationFacility ?? "Any provider"}</Text>
                <View className={`rounded-full px-2 py-0.5 ${pill.bg}`}>
                  <Text className={`text-xs font-medium ${pill.text}`}>{pill.label}</Text>
                </View>
              </View>
              <Text className="text-sm text-gray-700 dark:text-gray-300">{r.reason}</Text>
              <Text className="text-xs text-gray-500">
                {r.items.length} item{r.items.length === 1 ? "" : "s"} · expires {new Date(r.expiresAt).toLocaleDateString()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
