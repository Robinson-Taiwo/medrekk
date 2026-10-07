import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/services/api";
import { BLOOD_GROUPS, PROFILE_PATH, type BloodGroup, type EmergencyProfileData } from "./types";

const toLines = (items: string[]): string => items.join("\n");
const fromLines = (text: string): string[] =>
  text.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);

const inputClass =
  "rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white";

function ListField(props: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{props.label}</Text>
      <TextInput
        className={inputClass}
        style={{ minHeight: 64, textAlignVertical: "top" }}
        multiline
        placeholder={props.placeholder}
        placeholderTextColor="#9ca3af"
        value={props.value}
        onChangeText={props.onChange}
        autoCapitalize="sentences"
      />
    </View>
  );
}

export default function EmergencyEditor(props: {
  profile: EmergencyProfileData;
  onSaved: (p: EmergencyProfileData) => void;
  onCancel: () => void;
}) {
  const p = props.profile;
  const [allergies, setAllergies] = useState(toLines(p.criticalAllergies));
  const [conditions, setConditions] = useState(toLines(p.criticalConditions));
  const [medications, setMedications] = useState(toLines(p.criticalMedications));
  const [devices, setDevices] = useState(toLines(p.implantedDevices));
  const [warnings, setWarnings] = useState(toLines(p.importantWarnings));
  const [blood, setBlood] = useState<BloodGroup | null>(BLOOD_GROUPS.find((g) => g === p.bloodGroup) ?? null);
  const [cName, setCName] = useState(p.emergencyContact?.name ?? "");
  const [cPhone, setCPhone] = useState(p.emergencyContact?.phone ?? "");
  const [cRel, setCRel] = useState(p.emergencyContact?.relationship ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    const contactParts = [cName, cPhone, cRel].map((s) => s.trim());
    const anyContact = contactParts.some((s) => s.length > 0);
    if (anyContact && contactParts.some((s) => s.length === 0)) {
      return setError("Fill in all three contact fields (name, phone, relationship) or clear them all.");
    }
    if (anyContact && contactParts[1].length < 5) return setError("Enter a valid contact phone number.");

    const lists = [fromLines(allergies), fromLines(conditions), fromLines(medications), fromLines(devices), fromLines(warnings)];
    if (lists.some((l) => l.length > 20 || l.some((s) => s.length > 120))) {
      return setError("Each list can have up to 20 entries of 120 characters.");
    }

    setBusy(true);
    setError(null);
    try {
      const body = {
        criticalAllergies: lists[0],
        criticalConditions: lists[1],
        criticalMedications: lists[2],
        implantedDevices: lists[3],
        importantWarnings: lists[4],
        ...(blood ? { bloodGroup: blood } : {}),
        ...(anyContact
          ? { emergencyContact: { name: contactParts[0], phone: contactParts[1], relationship: contactParts[2] } }
          : {}),
      };
      const updated = await api<EmergencyProfileData>(PROFILE_PATH, { method: "PUT", body });
      props.onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Edit emergency profile</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          A responder can see this without your approval. Include only what matters in an emergency. Each access is
          logged. One item per line. Saving marks this profile self-reported
          {p.verifiedByName ? " and clears the review below" : ""}.
        </Text>
        {p.verifiedByName ? (
          <Text className="text-xs text-gray-500 dark:text-gray-400">Currently reviewed by {p.verifiedByName}.</Text>
        ) : null}

        <ListField label="Critical allergies" value={allergies} onChange={setAllergies} placeholder="Penicillin" />
        <ListField label="Critical conditions" value={conditions} onChange={setConditions} placeholder="Type 2 diabetes" />
        <ListField label="Critical medications" value={medications} onChange={setMedications} placeholder="Metformin" />
        <ListField label="Implanted devices" value={devices} onChange={setDevices} placeholder="Pacemaker" />
        <ListField label="Important warnings" value={warnings} onChange={setWarnings} placeholder="Check blood glucose" />

        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Blood group</Text>
        <View className="flex-row flex-wrap gap-2">
          {BLOOD_GROUPS.map((g) => (
            <Pressable
              key={g}
              onPress={() => setBlood(blood === g ? null : g)}
              className={`rounded-xl border px-4 py-2 ${
                blood === g ? "border-[#0F6E56] bg-[#0F6E56]" : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <Text className={blood === g ? "font-semibold text-white" : "text-gray-900 dark:text-white"}>{g}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">Emergency contact</Text>
        <TextInput className={inputClass} placeholder="Name" placeholderTextColor="#9ca3af" value={cName} onChangeText={setCName} />
        <TextInput
          className={inputClass}
          placeholder="Phone, e.g. +2348000000000"
          placeholderTextColor="#9ca3af"
          value={cPhone}
          onChangeText={setCPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          className={inputClass}
          placeholder="Relationship, e.g. Brother"
          placeholderTextColor="#9ca3af"
          value={cRel}
          onChangeText={setCRel}
        />

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className={`items-center rounded-xl bg-[#0F6E56] py-4 ${busy ? "opacity-60" : ""}`}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Save</Text>}
        </Pressable>
        <Pressable onPress={props.onCancel} disabled={busy} className="items-center py-3">
          <Text className="text-base text-gray-600 dark:text-gray-300">Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}