import { Linking, Pressable, Text, View } from 'react-native';
import { C } from '@/components/design/tokens';
import { Chrome, Empty, Screen, Sheet } from '@/components/design/split';
import { Meta } from '@/components/design/primitives';
import Feather from '@expo/vector-icons/Feather';

import type { EmergencyProfileData } from './types';
import EmergencyQr from './EmergencyQr';
import { useTourSpot } from '@/features/tour/TourProvider';
import { useScreenTour } from '@/features/tour/useScreenTour';
import { EMERGENCY_TOUR } from '@/features/tour/tours';

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
  /** False when an offline banner above has already taken the status-bar space. */
  topInset?: boolean;
}

export default function EmergencyCard({
  profile,
  onEdit,
  offCardAllergies = [],
  onReviewAllergies,
  topInset = true,
}: Props) {
  const qrSpot = useTourSpot('emergency-qr');
  const cardSpot = useTourSpot('emergency-card');
  useScreenTour('emergency-v1', EMERGENCY_TOUR);

  const entries = [
    ...profile.criticalAllergies.map((value) => ({ kind: 'Severe allergy', value, danger: true })),
    ...profile.importantWarnings.map((value) => ({ kind: 'Warning', value, danger: true })),
    ...profile.criticalConditions.map((value) => ({ kind: 'Condition', value, danger: false })),
    ...profile.criticalMedications.map((value) => ({ kind: 'Medication', value, danger: false })),
    ...profile.implantedDevices.map((value) => ({ kind: 'Implanted device', value, danger: false })),
  ];

  const contact = profile.emergencyContact;

  return (
    <Screen topInset={topInset}>
      <Chrome
        title="Emergency card"
        subtitle="What a responder can read without your approval"
        right={
          <Pressable onPress={onEdit} className="h-10 justify-center rounded-xl bg-white/10 px-3.5">
            <Text className="text-[13px] font-medium text-mist">Edit</Text>
          </Pressable>
        }
      />

      {/* Blood group belongs to the chrome, like the passport on the home screen: it is the
          one fact a responder looks for first and it should not move when the list below does. */}
      <View className="flex-row items-center gap-3 px-5 pb-4">
        <View className="rounded-xl bg-white/[0.07] px-3.5 py-2">
          <Text className="text-[10.5px] text-mist-faint">Blood group</Text>
          <Text className="text-[19px] font-semibold leading-6 text-mist">{profile.bloodGroup ?? '—'}</Text>
        </View>
        <Text className="flex-1 text-[12px] leading-[17px] text-mist-dim">
          Anyone who scans the code below sees this card. Nothing else in your record is reachable that way.
        </Text>
      </View>

      <Sheet>
        {/* The code, sized to be scanned off a stranger's screen. */}
        <View
          ref={qrSpot.ref}
          onLayout={qrSpot.onLayout}
          className="items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-5">
          <EmergencyQr />
        </View>

        {entries.length === 0 ? (
          <Empty
            icon="alert-circle"
            title="Your card is empty"
            body="A responder who scanned this would find nothing useful. Add the few things that would change what they do."
            hints={[
              { icon: 'alert-triangle', label: 'Severe allergies and anything a responder must avoid' },
              { icon: 'activity', label: 'Conditions and medicines that change treatment' },
              { icon: 'phone', label: 'One person to call' },
            ]}
            action="Fill in your card"
            onAction={onEdit}
          />
        ) : (
          <View ref={cardSpot.ref} onLayout={cardSpot.onLayout} className="gap-2">
            <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">On this card</Text>
            {/* Index included: a patient can type the same allergy twice, and kind+value
                alone would then collide into one key. */}
            {entries.map((entry, index) => (
              <Entry
                key={`${entry.kind}-${entry.value}-${index}`}
                kind={entry.kind}
                value={entry.value}
                danger={entry.danger}
              />
            ))}
          </View>
        )}

        {offCardAllergies.length > 0 ? (
          <Pressable
            onPress={onReviewAllergies}
            disabled={!onReviewAllergies}
            className="flex-row items-center gap-2.5 rounded-xl border border-dashed border-line bg-warn-soft px-3.5 py-3">
            <Feather name="info" size={15} color={C.warn} />
            <Text className="flex-1 text-[13px] leading-[19px] text-ink">
              {offCardAllergies.length === 1
                ? '1 allergy in your record is not on this card.'
                : `${offCardAllergies.length} allergies in your record are not on this card.`}
            </Text>
            {onReviewAllergies ? <Feather name="chevron-right" size={16} color={C.muted} /> : null}
          </Pressable>
        ) : null}

        <View className="gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">Emergency contact</Text>
          {/* Ink on a light surface. This row carried white text left over from when the whole
              screen was dark, which left it invisible once the sheet went light. */}
          <View className="flex-row items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-fill">
              <Feather name="user" size={17} color={C.muted} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-ink">{contact ? contact.name : 'None added'}</Text>
              <Meta>{contact ? contact.relationship : 'A responder would have nobody to call'}</Meta>
            </View>
            {contact ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
                className="h-10 flex-row items-center gap-1.5 rounded-xl bg-danger px-3.5">
                <Feather name="phone" size={14} color={C.surface} />
                <Text className="text-[14px] font-semibold text-white">Call</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text className="text-[12px] leading-[18px] text-muted">
          Scanning shows only this card — the rest of your record still needs your approval, and every access is
          written into your log. Editing it means a clinician has to confirm it again.
        </Text>

        {profile.lastConfirmedAt ? (
          <Meta>Last updated {new Date(profile.lastConfirmedAt).toLocaleDateString()}</Meta>
        ) : null}
      </Sheet>
    </Screen>
  );
}
