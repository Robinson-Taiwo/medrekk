import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/AuthProvider";
import type { PendingAccessRequest } from "@/features/access/accessApi";
import { useAccessRequests } from "@/features/access/useAccessRequests";
import type { AccessScope } from "@/types/api";

const LABELS: Record<string, string> = {
    ALLERGIES: "Allergies",
    CURRENT_MEDICATIONS: "Current medications",
    RECENT_ENCOUNTERS: "Recent encounters",
    PAST_MEDICAL_HISTORY: "Past medical history",
    LAB_RESULTS: "Lab results",
    REFERRALS: "Referrals",
    EMERGENCY_INFORMATION: "Emergency information",
};

interface CardProps {
    item: PendingAccessRequest;
    onDecide: (id: string, decision: "APPROVE" | "DENY", scopes?: AccessScope[]) => Promise<void>;
}

function RequestCard({ item, onDecide }: CardProps) {
    const [selected, setSelected] = useState<AccessScope[]>(item.requestedScopes);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (s: AccessScope) =>
        setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

    const run = async (decision: "APPROVE" | "DENY") => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const narrowed = selected.length < item.requestedScopes.length ? selected : undefined;
            await onDecide(item.id, decision, decision === "APPROVE" ? narrowed : undefined);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
            setBusy(false);
        }
    };

    return (
        <View className="gap-2 rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {item.requester?.name} ({item.requester?.role})
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">{item.requester?.reason}</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
                Access for {item.durationMinutes} minutes. Tap to untick anything you don't want to share:
            </Text>

            {item.requestedScopes.map((s) => {
                const on = selected.includes(s);
                return (
                    <Pressable
                        key={s}
                        onPress={() => toggle(s)}
                        className={`flex-row items-center gap-2 rounded-xl border px-3 py-3 ${on ? "border-[#0F6E56]" : "border-gray-300 dark:border-gray-700"
                            }`}
                    >
                        <Text className="text-base text-gray-900 dark:text-white">{on ? "☑" : "☐"}</Text>
                        <Text className="text-base text-gray-900 dark:text-white">{LABELS[s] ?? s}</Text>
                    </Pressable>
                );
            })}

            {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

            <View className="mt-2 flex-row gap-2">
                <Pressable
                    disabled={busy}
                    onPress={() => void run("DENY")}
                    className="flex-1 items-center rounded-xl border border-gray-400 py-3"
                >
                    <Text className="text-gray-900 dark:text-white">Deny</Text>
                </Pressable>
                <Pressable
                    disabled={busy || selected.length === 0}
                    onPress={() => void run("APPROVE")}
                    className={`flex-1 items-center rounded-xl bg-[#0F6E56] py-3 ${busy || selected.length === 0 ? "opacity-50" : ""
                        }`}
                >
                    <Text className="font-semibold text-white">Approve</Text>
                </Pressable>
            </View>
        </View>
    );
}

export default function AccessRequestsScreen() {
    const { user, signOut } = useAuth();
    const { requests, error, decide } = useAccessRequests();

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            <View className="flex-1 gap-3 p-6">
                <Text className="text-3xl font-bold text-gray-900 dark:text-white">Access requests</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">Signed in as {user?.fullName}</Text>
                {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

                <FlatList
                    data={requests}
                    keyExtractor={(r) => r.id}
                    contentContainerStyle={{ gap: 12 }}
                    ListEmptyComponent={
                        <Text className="text-sm text-gray-500 dark:text-gray-400">No pending requests.</Text>
                    }
                    renderItem={({ item }) => <RequestCard item={item} onDecide={decide} />}
                />

                <Pressable onPress={() => void signOut()} className="items-center py-3">
                    <Text className="text-sm text-[#0F6E56]">Sign out</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}