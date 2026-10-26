import { useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { accessStatus, lookupPatient, releaseAccess, requestAccess } from '@/features/worker/workerApi';
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
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 gap-4 p-6">
          <Text className="text-3xl font-bold text-ink">{session.patientName}</Text>
          <Text className="text-sm text-muted">{session.medrekkCode}</Text>

          {session.status === 'PENDING' ? (
            <View className="gap-3 rounded-2xl bg-amber-50 p-4">
              <Text className="text-base font-semibold text-amber-900">
                Waiting for the patient to approve
              </Text>
              <Text className="text-sm text-amber-900">
                Ask them to open MedRekk and check their Access tab.
              </Text>
              <ActivityIndicator />
            </View>
          ) : null}

          {session.status === 'APPROVED' ? (
            <View className="gap-3">
              <Text className="rounded-2xl bg-emerald-50 p-4 text-base text-emerald-900">
                Approved{session.grantedUntil ? ` until ${new Date(session.grantedUntil).toLocaleTimeString()}` : ''}.
              </Text>
              <Pressable
                onPress={() => router.push('/worker-encounter')}
                className="items-center rounded-xl bg-[#0F6E56] py-4">
                <Text className="text-base font-semibold text-white">Start encounter</Text>
              </Pressable>
            </View>
          ) : null}

          {session.status === 'DENIED' || session.status === 'EXPIRED' ? (
            <Text className="rounded-2xl bg-red-50 p-4 text-base text-red-900">
              {session.status === 'DENIED' ? 'The patient declined.' : 'This request expired.'}
            </Text>
          ) : null}

          {error ? <Text className="text-sm text-danger">{error}</Text> : null}

          <Pressable disabled={busy} onPress={() => void endAccess()} className="items-center py-3">
            <Text className={`text-sm text-[#0F6E56] ${busy ? 'opacity-50' : ''}`}>
              {session.status === 'APPROVED' ? 'End access and find another patient' : 'Find another patient'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-3xl font-bold text-ink">Find a patient</Text>
        <Text className="text-sm text-muted">
          Ask the patient for their MedRekk Code and full name. They approve on their own phone.
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="MRK-82941"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Patient's full name"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
        />

        {error ? <Text className="text-sm text-red-700">{error}</Text> : null}

        <Pressable
          disabled={busy || code.trim().length < 5 || name.trim().length < 2}
          onPress={() => void start()}
          className={`items-center rounded-xl bg-[#0F6E56] py-4 ${busy ? 'opacity-50' : ''}`}>
          <Text className="text-base font-semibold text-white">
            {busy ? 'Requesting...' : 'Request access'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
