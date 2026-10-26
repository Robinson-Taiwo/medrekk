import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { api } from "@/services/api";
import { C } from '@/components/design/tokens';
import { Chrome, Screen, Sheet } from "@/components/design/split";
import {
  BADGE,
  EXPIRY_OPTIONS,
  STATUS_LABEL,
  prettyCategory,
  type PickableClaim,
  type Referral,
} from "./types";

const inputClass =
  "rounded-xl border border-line px-4 py-3 text-base text-muted";

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
      <Screen>
        <Chrome title="Check before sharing" subtitle="Exactly what the provider will see" />
        <Sheet>
          <View className="gap-1 rounded-2xl border border-line p-4">
            <Text className="text-base text-muted">To: {destination.trim() || "Any provider"}</Text>
            <Text className="text-base text-muted">Reason: {reason.trim()}</Text>
            {note.trim() ? <Text className="text-base text-muted">Note: {note.trim()}</Text> : null}
            <Text className="text-sm text-muted">Expires in {days} day{days === 1 ? "" : "s"}</Text>
          </View>
          {chosen.map((c) => {
            const badge = BADGE[c.status] ?? BADGE.UNVERIFIED;
            return (
              <View key={c.id} className="gap-1 rounded-xl border border-line p-3">
                <Text className="text-base text-muted">{c.value}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[c.status] ?? c.status}</Text>
                  </View>
                  <Text className="text-xs text-muted">{prettyCategory(c.category)}</Text>
                </View>
              </View>
            );
          })}
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          <Pressable
            onPress={() => void create()}
            disabled={busy}
            className={`items-center rounded-xl bg-primary py-4 ${busy ? "opacity-60" : ""}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Create referral</Text>}
          </Pressable>
          <Pressable onPress={() => setPreview(false)} disabled={busy} className="items-center py-3">
            <Text className="text-base text-muted">Edit</Text>
          </Pressable>
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen>
      <Chrome title="New referral" onBack={props.onCancel} />
      <Sheet>
        <Pressable onPress={props.onCancel} className="hidden">
          <Text className="text-base text-primary">Cancel</Text>
        </Pressable>
        <Text className="text-3xl font-bold text-muted">New referral</Text>

        <Text className="text-sm font-medium text-muted">Destination (optional)</Text>
        <TextInput className={inputClass} placeholder="e.g. General Hospital" placeholderTextColor={C.hint} value={destination} onChangeText={setDestination} />

        <Text className="text-sm font-medium text-muted">Reason for referral</Text>
        <TextInput className={inputClass} placeholder="e.g. Specialist review" placeholderTextColor={C.hint} value={reason} onChangeText={setReason} />

        <Text className="text-sm font-medium text-muted">Note (optional)</Text>
        <TextInput
          className={inputClass}
          style={{ minHeight: 64, textAlignVertical: "top" }}
          multiline
          placeholder="Anything the provider should know"
          placeholderTextColor={C.hint}
          value={note}
          onChangeText={setNote}
        />

        <Text className="text-sm font-medium text-muted">Link stays valid for</Text>
        <View className="flex-row flex-wrap gap-2">
          {EXPIRY_OPTIONS.map((o) => (
            <Pressable
              key={o.days}
              onPress={() => setDays(o.days)}
              className={`rounded-xl border px-4 py-2 ${
                days === o.days ? "border-primary bg-primary" : "border-line"
              }`}
            >
              <Text className={days === o.days ? "font-semibold text-white" : "text-muted"}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-2 text-lg font-semibold text-muted">What to include</Text>
        {!claims && !error ? <ActivityIndicator /> : null}
        {claims && claims.length === 0 ? (
          <Text className="text-sm text-muted">Your record is empty. Add information in the Record tab first.</Text>
        ) : null}
        {(claims ?? []).map((c) => {
          const on = picked.includes(c.id);
          const badge = BADGE[c.status] ?? BADGE.UNVERIFIED;
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                on ? "border-primary bg-primary-soft" : "border-line"
              }`}
            >
              <View className={`h-6 w-6 items-center justify-center rounded-md border ${on ? "border-primary bg-primary" : "border-line"}`}>
                {on ? <Text className="text-xs font-bold text-white">✓</Text> : null}
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-base text-muted">{c.value}</Text>
                <View className="flex-row items-center gap-2">
                  <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
                    <Text className={`text-xs font-medium ${badge.text}`}>{STATUS_LABEL[c.status] ?? c.status}</Text>
                  </View>
                  <Text className="text-xs text-muted">{prettyCategory(c.category)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        <Pressable onPress={goPreview} className="items-center rounded-xl bg-primary py-4">
          <Text className="text-base font-semibold text-white">Preview</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
