import { Linking, Pressable, Text, View } from 'react-native';
import { C } from '@/components/design/tokens';
import { Chrome, Screen, Sheet } from '@/components/design/split';
import Feather from '@expo/vector-icons/Feather';

import type { EmergencyProfileData } from './types';
import EmergencyQr from './EmergencyQr';

const RANK: Record<string, number> = {
  UNVERIFIED: 0,
  SELF_REPORTED: 1,
  EVIDENCE_BACKED: 2,
  CLINICALLY_VERIFIED: 3,
};

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Not verified',
  SELF_REPORTED: 'Self-reported',
  EVIDENCE_BACKED: 'Evidence-backed',
  CLINICALLY_VERIFIED: 'Clinically verified',
};

const STEPS = ['Entered by you', 'Backed by evidence', 'Reviewed by a clinician'] as const;

function Entry({ kind, value, danger = false }: { kind: string; value: string; danger?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 rounded-xl p-3 ${danger ? 'bg-danger-soft' : 'bg-fill'}`}>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-surface">
        <Text className={`text-base font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>
          {danger ? '!' : '•'}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-[11px] font-semibold uppercase tracking-wider ${danger ? 'text-danger' : 'text-muted'}`}>
          {kind}
        </Text>
        <Text className="text-base font-semibold text-ink">{value}</Text>
      </View>
    </View>
  );
}

interface Props {
  profile: EmergencyProfileData;
  onEdit: () => void;
  /** Allergies recorded elsewhere in the record that the patient has not put on this card. */
  offCardAllergies?: string[];
  onReviewAllergies?: () => void;
}

export default function EmergencyCard({ profile, onEdit, offCardAllergies = [], onReviewAllergies }: Props) {
  const status = profile.verificationStatus;
  const rank = RANK[status] ?? 0;

  const entries = [
    ...profile.criticalAllergies.map((value) => ({ kind: 'Severe allergy', value, danger: true })),
    ...profile.criticalConditions.map((value) => ({ kind: 'Condition', value, danger: false })),
    ...profile.criticalMedications.map((value) => ({ kind: 'Medication', value, danger: false })),
    ...profile.implantedDevices.map((value) => ({ kind: 'Implanted device', value, danger: false })),
    ...profile.importantWarnings.map((value) => ({ kind: 'Warning', value, danger: true })),
  ];

  const contact = profile.emergencyContact;

  return (
    <Screen>
      <Chrome
        title="Emergency card"
        subtitle="What a responder can read without your approval"
        right={
          <Pressable onPress={onEdit} className="h-10 justify-center rounded-xl bg-white/10 px-3.5">
            <Text className="text-[13px] font-medium text-mist">Edit</Text>
          </Pressable>
        }
      />
      <Sheet>

        <View className="gap-3 rounded-[18px] bg-surface p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-0.5">
              <Text className="text-[22px] font-semibold tracking-tight text-ink">Your emergency card</Text>
              <Text className="text-sm text-muted">{STATUS_LABEL[status] ?? 'Not verified'}</Text>
            </View>
            <View className="items-center rounded-[10px] border border-line px-3 py-1.5">
              <Text className="text-[11px] text-muted">Blood</Text>
              <Text className="text-[22px] font-semibold text-ink">{profile.bloodGroup ?? '—'}</Text>
            </View>
          </View>

          <View className="flex-row gap-1.5 border-t border-dashed border-line pt-3">
            {STEPS.map((label, index) => (
              <View key={label} className="flex-1 gap-1">
                <View className={`h-1 rounded-sm ${rank > index ? 'bg-primary' : 'bg-line'}`} />
                <Text className={`text-[10px] ${rank > index ? 'text-ink' : 'text-muted'}`}>{label}</Text>
              </View>
            ))}
          </View>

          <View className="items-center gap-2 border-t border-dashed border-line pt-3">
            <EmergencyQr />
          </View>

          {entries.length === 0 ? (
            <View className="rounded-xl border border-dashed border-line p-4">
              <Text className="text-[15px] leading-6 text-muted">
                Nothing added yet. A responder who scans this would see nothing useful. Tap Edit to add your allergies,
                conditions, medicines and a contact.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {entries.map((entry) => (
                <Entry key={`${entry.kind}-${entry.value}`} kind={entry.kind} value={entry.value} danger={entry.danger} />
              ))}
            </View>
          )}

          {offCardAllergies.length > 0 ? (
            <Pressable
              onPress={onReviewAllergies}
              disabled={!onReviewAllergies}
              className="flex-row items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3">
              <Feather name="info" size={15} color={C.warn} />
              <Text className="flex-1 text-[13px] leading-[19px] text-muted">
                {offCardAllergies.length === 1
                  ? '1 allergy in your record is not on this card.'
                  : `${offCardAllergies.length} allergies in your record are not on this card.`}
              </Text>
              {onReviewAllergies ? <Feather name="chevron-right" size={16} color={C.muted} /> : null}
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3 rounded-xl bg-white/10 px-3.5 py-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-white/60">Emergency contact</Text>
            <Text className="text-base font-medium text-white">
              {contact ? `${contact.name} · ${contact.relationship}` : 'None added'}
            </Text>
          </View>
          {contact ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
              className="h-11 flex-row items-center rounded-xl bg-danger px-3.5">
              <Text className="text-sm font-medium text-white">Call</Text>
            </Pressable>
          ) : null}
        </View>

        <Text className="px-1 text-xs leading-[17px] text-white/70">
          Scanning shows only this card. The full record still needs your approval, and every access is logged. Saving
          an edit resets the status to self-reported.
        </Text>

        {profile.lastConfirmedAt ? (
          <Text className="px-1 text-xs text-white/50">
            Last updated {new Date(profile.lastConfirmedAt).toLocaleDateString()}
          </Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}
