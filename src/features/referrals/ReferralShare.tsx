import { useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { api } from "@/services/api";
import { BADGE, STATUS_LABEL, effectiveStatus, prettyCategory, referralUrl, WEB_URL, type Referral } from "./types";
import { Chrome, Screen, Sheet } from "@/components/design/split";

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
    <Screen>
      <Chrome title="Referral" onBack={props.onBack} />
      <Sheet>

        {status === "ACTIVE" ? (
          <View className="items-center gap-3 rounded-2xl border border-line bg-white p-5">
            {WEB_URL ? (
              <QRCode value={url} size={220} />
            ) : (
              <Text className="text-sm text-danger">EXPO_PUBLIC_WEB_URL is not set in the app's .env.</Text>
            )}
            <Text className="text-center text-xs text-muted">
              The QR holds a link only, never medical data. Whoever opens it sees just the items below.
            </Text>
          </View>
        ) : (
          <View className="rounded-2xl bg-fill p-4">
            <Text className="text-base font-semibold text-muted">
              {status === "REVOKED" ? "You cancelled this referral" : "This referral has expired"}
            </Text>
            <Text className="text-sm text-muted">The link no longer shows anything.</Text>
          </View>
        )}

        <View className="gap-1 rounded-2xl border border-line p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted">To</Text>
          <Text className="text-base text-muted">{referral.destinationFacility ?? "Any provider"}</Text>
          <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">Reason</Text>
          <Text className="text-base text-muted">{referral.reason}</Text>
          {referral.note ? (
            <>
              <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">Note</Text>
              <Text className="text-base text-muted">{referral.note}</Text>
            </>
          ) : null}
          <Text className="mt-2 text-xs text-muted">Expires {new Date(referral.expiresAt).toLocaleString()}</Text>
        </View>

        <Text className="text-lg font-semibold text-muted">What this referral shares</Text>
        {referral.items.map((item) => {
          const badge = BADGE[item.status] ?? BADGE.UNVERIFIED;
          return (
            <View key={item.claimId} className="gap-1 rounded-xl border border-line p-3">
              <Text className="text-base text-muted">{item.value}</Text>
              <View className="flex-row items-center gap-2">
                <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                  <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[item.status] ?? item.status}</Text>
                </View>
                <Text className="text-xs text-muted">{prettyCategory(item.scope)}</Text>
              </View>
            </View>
          );
        })}
        <Text className="text-xs text-muted">
          This is a frozen snapshot from when you created it. Later changes to your record do not appear in it.
        </Text>

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}

        {status === "ACTIVE" ? (
          <>
            <Pressable onPress={() => void share()} className="items-center rounded-xl bg-primary py-4">
              <Text className="text-base font-semibold text-white">Share link</Text>
            </Pressable>
            <Pressable
              onPress={() => void revoke()}
              disabled={busy}
              className="items-center rounded-xl border border-danger py-4"
            >
              {busy ? <ActivityIndicator /> : <Text className="text-base font-semibold text-danger">Cancel this referral</Text>}
            </Pressable>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
