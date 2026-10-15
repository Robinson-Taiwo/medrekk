import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { api } from "@/services/api";
import { BADGE, STATUS_LABEL, effectiveStatus, prettyCategory, referralUrl, WEB_URL, type Referral } from "./types";

export default function ReferralShare(props: {
  referral: Referral;
  onBack: () => void;
  onChanged: (r: Referral) => void;
}) {
  const [referral, setReferral] = useState<Referral>(props.referral);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = effectiveStatus(referral);
  const url = referralUrl(referral.shareId);

  const revoke = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Referral>(`/patients/me/referrals/${referral.id}/revoke`, { method: "POST" });
      setReferral(updated);
      props.onChanged(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: `MedRekk referral: ${url}` });
    } catch {
      setError("Could not open the share sheet.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
        <Pressable onPress={props.onBack} className="self-start py-1">
          <Text className="text-base text-[#0F6E56]">Back</Text>
        </Pressable>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Referral</Text>

        {status === "ACTIVE" ? (
          <View className="items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800">
            {WEB_URL ? (
              <QRCode value={url} size={220} />
            ) : (
              <Text className="text-sm text-red-700">EXPO_PUBLIC_WEB_URL is not set in the app's .env.</Text>
            )}
            <Text className="text-center text-xs text-gray-500">
              The QR holds a link only, never medical data. Whoever opens it sees just the items below.
            </Text>
          </View>
        ) : (
          <View className="rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {status === "REVOKED" ? "You cancelled this referral" : "This referral has expired"}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">The link no longer shows anything.</Text>
          </View>
        )}

        <View className="gap-1 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <Text className="text-xs font-semibold uppercase tracking-widest text-gray-500">To</Text>
          <Text className="text-base text-gray-900 dark:text-white">{referral.destinationFacility ?? "Any provider"}</Text>
          <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Reason</Text>
          <Text className="text-base text-gray-900 dark:text-white">{referral.reason}</Text>
          {referral.note ? (
            <>
              <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Note</Text>
              <Text className="text-base text-gray-900 dark:text-white">{referral.note}</Text>
            </>
          ) : null}
          <Text className="mt-2 text-xs text-gray-500">Expires {new Date(referral.expiresAt).toLocaleString()}</Text>
        </View>

        <Text className="text-lg font-semibold text-gray-900 dark:text-white">What this referral shares</Text>
        {referral.items.map((item) => {
          const badge = BADGE[item.status] ?? BADGE.UNVERIFIED;
          return (
            <View key={item.claimId} className="gap-1 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <Text className="text-base text-gray-900 dark:text-white">{item.value}</Text>
              <View className="flex-row items-center gap-2">
                <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                  <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[item.status] ?? item.status}</Text>
                </View>
                <Text className="text-xs text-gray-500">{prettyCategory(item.scope)}</Text>
              </View>
            </View>
          );
        })}
        <Text className="text-xs text-gray-500">
          This is a frozen snapshot from when you created it. Later changes to your record do not appear in it.
        </Text>

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

        {status === "ACTIVE" ? (
          <>
            <Pressable onPress={() => void share()} className="items-center rounded-xl bg-[#0F6E56] py-4">
              <Text className="text-base font-semibold text-white">Share link</Text>
            </Pressable>
            <Pressable
              onPress={() => void revoke()}
              disabled={busy}
              className="items-center rounded-xl border border-red-300 py-4"
            >
              {busy ? <ActivityIndicator /> : <Text className="text-base font-semibold text-red-700">Cancel this referral</Text>}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
