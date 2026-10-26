import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import { restoreWorkerSession, useWorkerSession } from '@/features/worker/workerSession';
import { useModelStatus } from '@/features/ai/modelStore';
import { Card, Meta } from '@/components/design/primitives';
import { C } from '@/components/design/tokens';
import { Callout, Chrome, ChromeTag, Empty, Heading, Note, Screen, Sheet } from '@/components/design/split';

export default function WorkerHome() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const session = useWorkerSession();
  const model = useModelStatus();

  // A grant this worker still holds is brought back here, from this handset or from the
  // account on the server. This screen is where a worker
  // lands after opening the app, and it was the one place that never looked — so an approved
  // session sat unread in storage while the screen said there was none, and the worker went
  // and asked the patient for access they already had.
  useFocusEffect(
    useCallback(() => {
      if (!session) void restoreWorkerSession(user?.id);
      // An approval happens on somebody else's screen, so without this the worker would go
      // on being told their licence was pending until they signed out and back in.
      if (user?.credentialStatus !== 'APPROVED') void refreshUser();
    }, [session, user?.id, user?.credentialStatus, refreshUser]),
  );

  const approved = session?.status === 'APPROVED';

  return (
    <Screen>
      <Chrome
        title={(user?.fullName ?? '').trim().split(/\s+/)[0] ?? ''}
        subtitle={user?.facility ?? 'Health worker'}
        right={
          approved ? (
            <ChromeTag label="Access live" tone="ok" />
          ) : user?.credentialStatus === 'APPROVED' ? (
            <ChromeTag label="Approved" tone="quiet" />
          ) : (
            <ChromeTag label="Licence pending" tone="warn" />
          )
        }
      />

      <Sheet>
        {approved && session ? (
          /* The patient in front of you, and the one thing you came here to do. */
          <View className="gap-3.5 rounded-2xl bg-ink p-4">
            <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-white/60">Current patient</Text>
            <View className="gap-1">
              <Text className="text-[20px] font-semibold tracking-tight text-white">{session.patientName}</Text>
              <Text className="text-[13px] tracking-[2px] text-white/60">{session.medrekkCode}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/worker-encounter')}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl"
              style={{ backgroundColor: C.glow }}>
              <Feather name="edit-3" size={16} color={C.glowInk} />
              <Text className="text-[15px] font-semibold" style={{ color: C.glowInk }}>
                Record an encounter
              </Text>
            </Pressable>
          </View>
        ) : (
          <Empty
            icon="search"
            title="No patient yet"
            body="Start by finding one. They approve on their own phone before you can see or record anything."
            hints={[
              { icon: 'key', label: 'You need their MedRekk code and the name on the record' },
              { icon: 'edit-3', label: 'Once approved, record a visit by typing, speaking or photographing' },
              { icon: 'wifi-off', label: 'A visit recorded with no signal is kept and sent later' },
            ]}
            action="Find a patient"
            onAction={() => router.push('/worker-patient')}
          />
        )}

        {user?.credentialStatus !== 'APPROVED' ? (
          <Callout
            kicker={user?.licence ? 'Under review' : 'Needed'}
            title={user?.licence ? 'Your licence is being checked' : 'Add your licence'}
            action={user?.licence ? 'Review what you sent' : 'Add it now'}
            onAction={() => router.push('/worker-credential')}>
            <Note>
              {user?.licence
                ? 'Someone is checking your number against the register. You can keep working while they do.'
                : 'You can find a patient and record a visit now. Confirming what is already in a record needs your licence first.'}
            </Note>
          </Callout>
        ) : null}

        <View className="gap-2.5">
          <Heading>On-device AI</Heading>
          <Pressable onPress={() => router.push('/worker-model')}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View
                className={`h-[38px] w-[38px] items-center justify-center rounded-xl ${
                  model.state === 'READY' ? 'bg-primary-soft' : 'bg-fill'
                }`}>
                <Feather name="cpu" size={18} color={model.state === 'READY' ? C.primary : C.muted} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[14px] font-semibold text-ink">
                  {model.state === 'READY' ? 'Model installed' : 'Model not installed'}
                </Text>
                <Meta>
                  {model.state === 'READY'
                    ? 'Notes are structured on this phone, with no internet'
                    : 'Without it, notes are structured by simple rules'}
                </Meta>
              </View>
              <Feather name="chevron-right" size={18} color={C.muted} />
            </Card>
          </Pressable>
        </View>
      </Sheet>
    </Screen>
  );
}
