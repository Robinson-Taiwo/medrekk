import { useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { accessStatus, lookupPatient, requestAccess } from '@/features/worker/workerApi';
import { patchWorkerSession, setWorkerSession, useWorkerSession } from '@/features/worker/workerSession';

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
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 gap-4 p-6">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">{session.patientName}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">{session.medrekkCode}</Text>

          {session.status === 'PENDING' ? (
            <View className="gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950">
              <Text className="text-base font-semibold text-amber-900 dark:text-amber-100">
                Waiting for the patient to approve
              </Text>
              <Text className="text-sm text-amber-900 dark:text-amber-200">
                Ask them to open MedRekk and check their Access tab.
              </Text>
              <ActivityIndicator />
            </View>
          ) : null}

          {session.status === 'APPROVED' ? (
            <View className="gap-3">
              <Text className="rounded-2xl bg-emerald-50 p-4 text-base text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
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
            <Text className="rounded-2xl bg-red-50 p-4 text-base text-red-900 dark:bg-red-950 dark:text-red-100">
              {session.status === 'DENIED' ? 'The patient declined.' : 'This request expired.'}
            </Text>
          ) : null}

          <Pressable onPress={() => setWorkerSession(null)} className="items-center py-3">
            <Text className="text-sm text-[#0F6E56]">Find another patient</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Find a patient</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Ask the patient for their MedRekk Code and full name. They approve on their own phone.
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="MRK-82941"
          className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white"
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Patient's full name"
          className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white"
        />
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason"
          className="rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white"
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
