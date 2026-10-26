import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { api } from "@/services/api";
import ReferralCreate from "./ReferralCreate";
import ReferralShare from "./ReferralShare";
import { effectiveStatus, type Referral } from "./types";
import { Chrome, Screen, Sheet } from "@/components/design/split";

type Screen = { kind: "list" } | { kind: "create" } | { kind: "share"; referral: Referral };

const PILL: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: "bg-primary-soft", text: "text-primary", label: "Active" },
  REVOKED: { bg: "bg-track", text: "text-muted", label: "Cancelled" },
  EXPIRED: { bg: "bg-warn-soft", text: "text-warn", label: "Expired" },
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
    <Screen>
      <Chrome title="Referrals" subtitle="A snapshot you choose, for a provider without your record" onBack={onClose} />
      <Sheet>

        <Pressable onPress={() => setScreen({ kind: "create" })} className="items-center rounded-xl bg-primary py-4">
          <Text className="text-base font-semibold text-white">New referral</Text>
        </Pressable>

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        {!items && !error ? <ActivityIndicator /> : null}
        {items && items.length === 0 ? <Text className="text-sm text-muted">No referrals yet.</Text> : null}

        {(items ?? []).map((r) => {
          const status = effectiveStatus(r);
          const pill = PILL[status];
          return (
            <Pressable
              key={r.id}
              onPress={() => setScreen({ kind: "share", referral: r })}
              className="gap-1 rounded-2xl border border-line p-4 active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-semibold text-muted">{r.destinationFacility ?? "Any provider"}</Text>
                <View className={`rounded-full px-2 py-0.5 ${pill.bg}`}>
                  <Text className={`text-xs font-medium ${pill.text}`}>{pill.label}</Text>
                </View>
              </View>
              <Text className="text-sm text-muted">{r.reason}</Text>
              <Text className="text-xs text-muted">
                {r.items.length} item{r.items.length === 1 ? "" : "s"} · expires {new Date(r.expiresAt).toLocaleDateString()}
              </Text>
            </Pressable>
          );
        })}
      </Sheet>
    </Screen>
  );
}
