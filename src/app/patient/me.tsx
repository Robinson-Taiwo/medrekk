import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/AuthProvider";
import { fetchVerifications, type VerificationEventView } from "@/features/verification/verificationApi";
import { api } from "@/services/api";

type Category = "ALLERGIES" | "CURRENT_MEDICATIONS" | "PAST_MEDICAL_HISTORY";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "ALLERGIES", label: "Allergy" },
  { key: "CURRENT_MEDICATIONS", label: "Medication" },
  { key: "PAST_MEDICAL_HISTORY", label: "History" },
];

interface Me { fullName: string; medrekkCode: string; createdAt: string }
interface Claim {
  id: string;
  category: string;
  value: string;
  status: string;
  source: string;
  verificationMethod?: string;
  verifiedAt?: string;
}

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: "Unverified",
  SELF_REPORTED: "Self-reported",
  EVIDENCE_BACKED: "Evidence-backed",
  CLINICALLY_VERIFIED: "Clinically verified",
};

const BADGE: Record<string, { bg: string; text: string }> = {
  UNVERIFIED: { bg: "bg-gray-200", text: "text-gray-700" },
  SELF_REPORTED: { bg: "bg-amber-100", text: "text-amber-800" },
  EVIDENCE_BACKED: { bg: "bg-sky-100", text: "text-sky-800" },
  CLINICALLY_VERIFIED: { bg: "bg-emerald-100", text: "text-emerald-800" },
};

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString();

export default function PatientHomeScreen() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [events, setEvents] = useState<VerificationEventView[]>([]);
  const [category, setCategory] = useState<Category>("ALLERGIES");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([api<Me>("/patients/me"), api<Claim[]>("/patients/me/claims")]);
      setMe(m);
      setClaims(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    // Verification history is a bonus; the record still works without it.
    try {
      setEvents(await fetchVerifications());
    } catch {
      setEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const add = async () => {
    if (busy || value.trim().length === 0) return;
    setBusy(true);
    try {
      const created = await api<Claim>("/patients/me/claims", {
        method: "POST",
        body: { category, value: value.trim() },
      });
      setClaims((prev) => [...prev, created]);
      setValue("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // Latest event that produced the claim's current status.
  const verifierFor = (claim: Claim): VerificationEventView | undefined =>
    [...events].reverse().find((ev) => ev.claimId === claim.id && ev.resultingStatus === claim.status);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">My record</Text>

        {me ? (
          <View className="rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
            <Text className="text-sm text-gray-500 dark:text-gray-400">{me.fullName}</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">Your MedRekk Code</Text>
            <Text selectable className="text-3xl font-bold tracking-widest text-[#0F6E56]">
              {me.medrekkCode}
            </Text>
          </View>
        ) : (
          <ActivityIndicator />
        )}

        <Link href="/emergency" asChild>
          <Pressable className="rounded-2xl border border-red-300 bg-red-50 p-4 active:opacity-80">
            <Text className="text-base font-semibold text-red-800">Emergency profile</Text>
            <Text className="mt-1 text-sm text-red-700">What a responder sees if you can't speak</Text>
          </Pressable>
        </Link>

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

        <Text className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">Add information</Text>
        <View className="flex-row gap-2">
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              className={`flex-1 items-center rounded-xl border py-2 ${
                category === c.key ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <Text className={category === c.key ? "text-white" : "text-gray-900 dark:text-white"}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white"
          placeholder="e.g. Penicillin"
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={setValue}
          onSubmitEditing={() => void add()}
        />
        <Pressable
          onPress={() => void add()}
          disabled={busy}
          className={`items-center rounded-xl bg-[#0F6E56] py-3 ${busy ? "opacity-60" : ""}`}
        >
          <Text className="font-semibold text-white">Add (self-reported)</Text>
        </Pressable>

        <Text className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">What's on my record</Text>
        {claims.length === 0 ? (
          <Text className="text-sm text-gray-500 dark:text-gray-400">Nothing yet.</Text>
        ) : (
          claims.map((c) => {
            const ev = verifierFor(c);
            const badge = BADGE[c.status] ?? BADGE.UNVERIFIED;
            return (
              <View key={c.id} className="gap-1 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <Text className="text-base text-gray-900 dark:text-white">{c.value}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[c.status] ?? c.status}</Text>
                  </View>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {c.category.replace(/_/g, " ").toLowerCase()}
                  </Text>
                </View>
                {ev ? (
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {STATUS_LABEL[ev.resultingStatus] ?? ev.resultingStatus} by {ev.verifierName}
                    {ev.verifierFacility ? `, ${ev.verifierFacility}` : ""} on {formatDate(ev.verifiedAt)}
                    {` · ${ev.method}`}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <Pressable onPress={() => void signOut()} className="items-center py-4">
          <Text className="text-sm text-[#0F6E56]">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
