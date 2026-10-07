import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { EmergencyProfileData } from "./types";
import EmergencyQr from "./EmergencyQr";

const RANK: Record<string, number> = {
  UNVERIFIED: 0,
  SELF_REPORTED: 1,
  EVIDENCE_BACKED: 2,
  CLINICALLY_VERIFIED: 3,
};

const BANNER: Record<string, { title: string; body: string; box: string; text: string }> = {
  UNVERIFIED: {
    title: "Not verified",
    body: "Nobody has confirmed this yet.",
    box: "bg-gray-100 dark:bg-gray-900",
    text: "text-gray-800 dark:text-gray-200",
  },
  SELF_REPORTED: {
    title: "Self-reported",
    body: "You entered this. No health worker has checked it yet.",
    box: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-900 dark:text-amber-200",
  },
  EVIDENCE_BACKED: {
    title: "Evidence-backed",
    body: "A health worker saw supporting evidence for this profile.",
    box: "bg-sky-100 dark:bg-sky-950",
    text: "text-sky-900 dark:text-sky-200",
  },
  CLINICALLY_VERIFIED: {
    title: "Clinically verified",
    body: "A credentialed health worker reviewed this profile.",
    box: "bg-emerald-100 dark:bg-emerald-950",
    text: "text-emerald-900 dark:text-emerald-200",
  },
};

const STEPS: { min: number; label: string }[] = [
  { min: 1, label: "Entered by you" },
  { min: 2, label: "Backed by evidence" },
  { min: 3, label: "Reviewed by a clinician" },
];

function Row({ label, items }: { label: string; items: string[] }) {
  return (
    <View className="gap-1 border-t border-gray-200 pt-3 dark:border-gray-800">
      <Text className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</Text>
      {items.length === 0 ? (
        <Text className="text-base text-gray-400 dark:text-gray-500">None added</Text>
      ) : (
        items.map((item) => (
          <Text key={item} className="text-base text-gray-900 dark:text-white">
            {item}
          </Text>
        ))
      )}
    </View>
  );
}

export default function EmergencyCard({ profile, onEdit }: { profile: EmergencyProfileData; onEdit: () => void }) {
  const status = profile.verificationStatus;
  const banner = BANNER[status] ?? BANNER.UNVERIFIED;
  const rank = RANK[status] ?? 0;

  const reviewer =
    profile.verifiedByName && profile.verifiedAt
      ? `${profile.verifiedByName}${profile.verifiedByFacility ? `, ${profile.verifiedByFacility}` : ""} on ${new Date(profile.verifiedAt).toLocaleDateString()}`
      : null;

  const isEmpty =
    profile.criticalAllergies.length +
      profile.criticalConditions.length +
      profile.criticalMedications.length +
      profile.implantedDevices.length +
      profile.importantWarnings.length ===
      0 &&
    !profile.bloodGroup &&
    !profile.emergencyContact;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Emergency profile</Text>

        <View className={`gap-1 rounded-2xl p-4 ${banner.box}`}>
          <Text className={`text-base font-semibold ${banner.text}`}>{banner.title}</Text>
          <Text className={`text-sm ${banner.text}`}>{banner.body}</Text>
          {reviewer ? <Text className={`text-sm ${banner.text}`}>Reviewed by {reviewer}</Text> : null}
        </View>

        <View className="gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <Text className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Verification
          </Text>
          {STEPS.map((s) => {
            const done = rank >= s.min;
            return (
              <View key={s.label} className="flex-row items-center gap-2">
                <View className={`h-5 w-5 items-center justify-center rounded-full ${done ? "bg-[#0F6E56]" : "bg-gray-200 dark:bg-gray-800"}`}>
                  <Text className={`text-xs font-bold ${done ? "text-white" : "text-gray-500"}`}>{done ? "✓" : "–"}</Text>
                </View>
                <Text className={`text-sm ${done ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
                  {s.label}
                </Text>
              </View>
            );
          })}
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Verification applies to the whole profile, not to each line.
          </Text>
        </View>

        {isEmpty ? (
          <View className="rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
            <Text className="text-base text-gray-700 dark:text-gray-300">
              Nothing added yet. A responder who opens your profile would see nothing useful. Tap Edit to add your
              allergies, conditions, medications and a contact.
            </Text>
          </View>
        ) : null}

        <View className="gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Blood group</Text>
            <Text className="text-4xl font-bold text-gray-900 dark:text-white">{profile.bloodGroup ?? "Not set"}</Text>
          </View>
          <Row label="Allergies" items={profile.criticalAllergies} />
          <Row label="Conditions" items={profile.criticalConditions} />
          <Row label="Medications" items={profile.criticalMedications} />
          <Row label="Implanted devices" items={profile.implantedDevices} />
          <Row label="Warnings" items={profile.importantWarnings} />
          <View className="gap-1 border-t border-gray-200 pt-3 dark:border-gray-800">
            <Text className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Emergency contact
            </Text>
            {profile.emergencyContact ? (
              <Text className="text-base text-gray-900 dark:text-white">
                {profile.emergencyContact.name} ({profile.emergencyContact.relationship}){"\n"}
                {profile.emergencyContact.phone}
              </Text>
            ) : (
              <Text className="text-base text-gray-400 dark:text-gray-500">None added</Text>
            )}
          </View>
        </View>

        {profile.lastConfirmedAt ? (
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Last updated {new Date(profile.lastConfirmedAt).toLocaleDateString()}
          </Text>
        ) : null}

        <EmergencyQr />
        <Pressable onPress={onEdit} className="items-center rounded-xl bg-[#0F6E56] py-4">
          <Text className="text-base font-semibold text-white">Edit</Text>
        </Pressable>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          A responder can see this without your approval, and each access is logged. Saving an edit resets the status
          to self-reported.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}