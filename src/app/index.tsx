import { useCallback, useEffect, useState } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth/AuthProvider";
import { BottomTabInset } from "@/constants/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

type BackendState = "checking" | "online" | "offline";

function useBackendStatus() {
  const [state, setState] = useState<BackendState>("checking");

  const check = useCallback(async () => {
    setState("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
      setState(res.ok ? "online" : "offline");
    } catch {
      setState("offline");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { state, check };
}

const STATUS_STYLES: Record<BackendState, { dot: string; label: string }> = {
  checking: { dot: "bg-amber-400", label: "Checking backend…" },
  online: { dot: "bg-emerald-500", label: "Backend online" },
  offline: { dot: "bg-red-500", label: "Backend unreachable" },
};

function MenuLink({ href, title, subtitle }: { href: Href; title: string; subtitle: string }) {
  return (
    <Link href={href} asChild>
      <Pressable className="rounded-2xl bg-[#0F6E56] p-4 active:opacity-80">
        <Text className="text-base font-semibold text-white">{title}</Text>
        <Text className="mt-1 text-sm text-white/80">{subtitle}</Text>
      </Pressable>
    </Link>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <View className="rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
      <Text className="text-base font-semibold text-gray-400 dark:text-gray-500">{title}</Text>
      <Text className="mt-1 text-sm text-gray-400 dark:text-gray-500">Not built yet</Text>
    </View>
  );
}

export default function Index() {
  const { user, signOut } = useAuth();
  const { state, check } = useBackendStatus();
  const status = STATUS_STYLES[state];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: BottomTabInset + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">MedRekk</Text>
          <Text className="text-base text-gray-500 dark:text-gray-400">
            {user ? `Signed in as ${user.fullName}` : "Your medical record, wherever you go."}
          </Text>
        </View>

        <Pressable
          onPress={() => void check()}
          className="flex-row items-center gap-2 self-start rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-900"
        >
          <View className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
          <Text className="text-sm text-gray-700 dark:text-gray-300">{status.label}</Text>
        </Pressable>

        {user?.role === "PATIENT" ? (
          <>
            <MenuLink href="/record" title="My record" subtitle="Your MedRekk Code and self-reported information" />
            <MenuLink href="/explore" title="Access requests" subtitle="Approve or deny provider requests" />
          </>
        ) : (
          <ComingSoon title="Health worker: new encounter" />
        )}
        <MenuLink href="/emergency" title="Emergency profile" subtitle="What a responder sees in an emergency" />

        <Pressable onPress={() => void signOut()} className="items-center py-3">
          <Text className="text-sm text-[#0F6E56]">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}