import { useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { accessStatus, lookupPatient, releaseAccess, requestAccess } from '@/features/worker/workerApi';
import { C } from '@/components/design/tokens';
import { BottomBar, Callout, Chrome, ChromeTag, Note, Screen, Sheet } from '@/components/design/split';
import {
  patchWorkerSession, restoreWorkerSession, setWorkerSession, useWorkerSession,
} from '@/features/worker/workerSession';

const SCOPES = ['RECENT_ENCOUNTERS', 'ALLERGIES', 'CURRENT_MEDICATIONS'];

export default function WorkerPatientScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const session = useWorkerSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('Clinic visit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An approved grant outlives the app being reloaded, reclaimed by Android, or signed out of.
  useFocusEffect(
    useCallback(() => {
      if (!session) void restoreWorkerSession(user?.id);
    }, [session, user?.id]),
  );

  /**
   * Finishing with a patient. The server is told first, and the handset only lets go once it
   * agrees.
   *
   * The order matters now that a grant can be picked up again from the account: clearing this
   * phone before the server knew would mean an "end access" that failed offline came back by
   * itself at the next sign-in. Ending access has to be a decision that sticks, so a failure
   * here is shown rather than swallowed.
   */
  const endAccess = async () => {
    const token = session?.token;
    if (!token) {
      setWorkerSession(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await releaseAccess(token);
      setWorkerSession(null);
    } catch {
      setError(
        "Couldn't end the access from here — you appear to be offline. It stays active until you have a connection, or until the patient ends it.",
      );
    } finally {
      setBusy(false);
    }
  };

  // While the patient decides, poll so the screen moves on by itself.
  useFocusEffect(
    useCallback(() => {
      if (!session || session.status !== 'PENDING') return;
      const timer = setInterval(() => {
        void accessStatus(session.token)
          .then((res) => {
            if (res.status === 'APPROVED' || res.status === 'DENIED' || res.status === 'EXPIRED') {
              patchWorkerSession({ status: res.status, grantedUntil: res.grantedUntil });
            }
          })
          .catch(() => undefined);
      }, 4000);
      return () => clearInterval(timer);
    }, [session]),
  );

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const found = await lookupPatient(code.trim().toUpperCase(), name.trim());
      await requestAccess(found.session, {
        requesterName: user?.fullName ?? 'Health worker',
        requesterRole: 'NURSE',
        reason: reason.trim(),
        scopes: SCOPES,
        durationMinutes: 120,
      });
      setWorkerSession({
        token: found.session,
        patientName: found.patientName,
        medrekkCode: found.medrekkCode,
        status: 'PENDING',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    const waiting = session.status === 'PENDING';
    const approved = session.status === 'APPROVED';
    const refused = session.status === 'DENIED' || session.status === 'EXPIRED';

    return (
      <Screen>
        <Chrome
          title={session.patientName}
          subtitle={session.medrekkCode}
          right={
            <ChromeTag
              label={waiting ? 'Waiting' : approved ? 'Approved' : 'Ended'}
              tone={waiting ? 'warn' : approved ? 'ok' : 'quiet'}
            />
          }
        />

        <Sheet>
          {waiting ? (
            <Callout kicker="Their decision" title="Waiting for the patient to approve">
              <Note>Ask them to open MedRekk and check their Access tab. This screen moves on by itself.</Note>
              <ActivityIndicator color={C.warn} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            </Callout>
          ) : null}

          {approved ? (
            <View className="gap-3">
              <Callout
                tone="quiet"
                kicker="Approved"
                title={
                  session.grantedUntil
                    ? `You can read this record until ${new Date(session.grantedUntil).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'You can read this record'
                }>
                <Note>The patient can end it at any moment, and it ends by itself when the time is up.</Note>
              </Callout>
            </View>
          ) : null}

          {refused ? (
            <Callout
              tone="danger"
              kicker="No access"
              title={session.status === 'DENIED' ? 'The patient declined' : 'This request expired'}>
              <Note>Nothing was shared. You can ask again if they are happy for you to.</Note>
            </Callout>
          ) : null}

          {error ? <Text className="text-[13px] text-danger">{error}</Text> : null}

          <Pressable disabled={busy} onPress={() => void endAccess()} className="items-center py-2">
            <Text className={`text-[13px] font-medium text-primary ${busy ? 'opacity-50' : ''}`}>
              {approved ? 'End access and find another patient' : 'Find another patient'}
            </Text>
          </Pressable>
        </Sheet>

        {approved ? (
          <BottomBar label="Start encounter" onPress={() => router.push('/worker-encounter')} />
        ) : null}
      </Screen>
    );
  }

  const ready = code.trim().length >= 5 && name.trim().length >= 2;

  return (
    <Screen>
      <Chrome title="Find a patient" subtitle="They approve on their own phone" />

      <Sheet>
        <Note>
          Ask the patient for their MedRekk code and the full name on their record. Nothing is shared until they
          say yes.
        </Note>

        <View className="gap-1.5">
          <Text className="text-[13px] font-medium text-ink">MedRekk code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="MRK-82941"
            placeholderTextColor={C.hint}
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base tracking-[2px] text-ink"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-medium text-ink">Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="As it appears on their record"
            placeholderTextColor={C.hint}
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-medium text-ink">Why you need it</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Clinic visit"
            placeholderTextColor={C.hint}
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
          />
          <Note>The patient sees this, so say something they will recognise.</Note>
        </View>

        {error ? <Text className="text-[13px] text-danger">{error}</Text> : null}
      </Sheet>

      <BottomBar
        label="Request access"
        busy={busy}
        disabled={!ready}
        onPress={() => void start()}
        note="They decide what you see, and for how long."
      />
    </Screen>
  );
}
