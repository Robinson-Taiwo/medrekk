import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/services/api";
import {
  BADGE,
  EXPIRY_OPTIONS,
  STATUS_LABEL,
  prettyCategory,
  type PickableClaim,
  type Referral,
} from "./types";

const inputClass =
  "rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white";

export default function ReferralCreate(props: { onCancel: () => void; onCreated: (r: Referral) => void }) {
  const [claims, setClaims] = useState<PickableClaim[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PickableClaim[]>("/patients/me/claims")
      .then(setClaims)
      .catch((e: Error) => setError(e.message));
  }, []);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const chosen = (claims ?? []).filter((c) => picked.includes(c.id));

  const goPreview = () => {
    if (reason.trim().length < 3) return setError("Say briefly why you are being referred (at least 3 characters).");
    if (picked.length === 0) return setError("Pick at least one item to include.");
    setError(null);
    setPreview(true);
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(destination.trim() ? { destinationFacility: destination.trim() } : {}),
        reason: reason.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
        claimIds: picked,
        expiresInDays: days,
      };
      const created = await api<Referral>("/patients/me/referrals", { method: "POST", body });
      props.onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  if (preview) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">Check before sharing</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            This is exactly what the receiving provider will see. Nothing else from your record is included.
          </Text>
          <View className="gap-1 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <Text className="text-base text-gray-900 dark:text-white">To: {destination.trim() || "Any provider"}</Text>
            <Text className="text-base text-gray-900 dark:text-white">Reason: {reason.trim()}</Text>
            {note.trim() ? <Text className="text-base text-gray-900 dark:text-white">Note: {note.trim()}</Text> : null}
            <Text className="text-sm text-gray-500">Expires in {days} day{days === 1 ? "" : "s"}</Text>
          </View>
          {chosen.map((c) => {
            const badge = BADGE[c.status] ?? BADGE.UNVERIFIED;
            return (
              <View key={c.id} className="gap-1 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <Text className="text-base text-gray-900 dark:text-white">{c.value}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[c.status] ?? c.status}</Text>
                  </View>
                  <Text className="text-xs text-gray-500">{prettyCategory(c.category)}</Text>
                </View>
              </View>
            );
          })}
          {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
          <Pressable
            onPress={() => void create()}
            disabled={busy}
            className={`items-center rounded-xl bg-[#0F6E56] py-4 ${busy ? "opacity-60" : ""}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Create referral</Text>}
          </Pressable>
          <Pressable onPress={() => setPreview(false)} disabled={busy} className="items-center py-3">
            <Text className="text-base text-gray-600 dark:text-gray-300">Edit</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={props.onCancel} className="self-start py-1">
          <Text className="text-base text-[#0F6E56]">Cancel</Text>
        </Pressable>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">New referral</Text>

        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Destination (optional)</Text>
        <TextInput className={inputClass} placeholder="e.g. General Hospital" placeholderTextColor="#9ca3af" value={destination} onChangeText={setDestination} />

        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason for referral</Text>
        <TextInput className={inputClass} placeholder="e.g. Specialist review" placeholderTextColor="#9ca3af" value={reason} onChangeText={setReason} />

        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</Text>
        <TextInput
          className={inputClass}
          style={{ minHeight: 64, textAlignVertical: "top" }}
          multiline
          placeholder="Anything the provider should know"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />

        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Link stays valid for</Text>
        <View className="flex-row flex-wrap gap-2">
          {EXPIRY_OPTIONS.map((o) => (
            <Pressable
              key={o.days}
              onPress={() => setDays(o.days)}
              className={`rounded-xl border px-4 py-2 ${
                days === o.days ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <Text className={days === o.days ? "font-semibold text-white" : "text-gray-900 dark:text-white"}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">What to include</Text>
        {!claims && !error ? <ActivityIndicator /> : null}
        {claims && claims.length === 0 ? (
          <Text className="text-sm text-gray-500">Your record is empty. Add information in the Record tab first.</Text>
        ) : null}
        {(claims ?? []).map((c) => {
          const on = picked.includes(c.id);
          const badge = BADGE[c.status] ?? BADGE.UNVERIFIED;
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                on ? "border-[#0F6E56] bg-emerald-50 dark:bg-emerald-950" : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <View className={`h-6 w-6 items-center justify-center rounded-md border ${on ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-400"}`}>
                {on ? <Text className="text-xs font-bold text-white">✓</Text> : null}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-base text-gray-900 dark:text-white">{c.value}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[c.status] ?? c.status}</Text>
                  </View>
                  <Text className="text-xs text-gray-500">{prettyCategory(c.category)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
        <Pressable onPress={goPreview} className="items-center rounded-xl bg-[#0F6E56] py-4">
          <Text className="text-base font-semibold text-white">Preview</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
