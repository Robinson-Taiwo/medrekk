import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/services/api';
import { loadToken } from '@/services/session';
import { addOwnRecord } from '@/features/auth/authApi';
import { Meta } from '@/components/design/primitives';
import { C } from '@/components/design/tokens';
import { Chrome, Screen, Sheet } from '@/components/design/split';

interface Me {
  fullName: string;
  medrekkCode: string;
}

function Row({
  icon,
  title,
  body,
  value,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-3.5 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-fill">
        <Feather name={icon} size={18} color={C.ink} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-ink">{title}</Text>
        {body ? <Meta>{body}</Meta> : null}
      </View>
      {value ? <Text className="text-[13px] text-muted">{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={18} color={C.muted} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, signOut, adoptSession } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [ownRecordBusy, setOwnRecordBusy] = useState(false);
  const isWorker = user?.role === 'HEALTH_WORKER';

  useFocusEffect(
    useCallback(() => {
      if (isWorker) return;
      void api<Me>('/patients/me')
        .then(setMe)
        .catch(() => undefined);
    }, [isWorker]),
  );

  /**
   * Turning on a clinician's own record. The server mints a new token, because the one this
   * phone holds was signed before the account had a record and the patient endpoints read
   * the record out of the token — keeping the old one would have left them with a record the
   * app could see and the server would not.
   */
  const startOwnRecord = async () => {
    if (ownRecordBusy) return;
    setOwnRecordBusy(true);
    try {
      const token = await loadToken();
      if (!token) throw new Error('Sign in again first.');
      await adoptSession(await addOwnRecord(token));
      router.push('/record');
    } catch (e) {
      Alert.alert('Could not set that up', e instanceof Error ? e.message : 'Try again when you have a connection.');
    } finally {
      setOwnRecordBusy(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need your email and password to get back in.', [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen>
      {/* Who you are belongs to the frame, like the passport on the home screen. */}
      <Chrome
        title={user?.fullName ?? ''}
        subtitle={isWorker ? (user?.facility ?? 'Health worker') : 'Patient'}
        right={
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Text className="text-[16px] font-semibold text-mist">
              {(user?.fullName ?? '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        }
      />
      {!isWorker && me ? (
        <View className="px-5 pb-4">
          <View className="gap-1 rounded-xl bg-white/[0.07] px-3.5 py-3">
            <Text className="text-[10.5px] text-mist-faint">Your MedRekk code</Text>
            <Text selectable className="text-[19px] font-semibold tracking-[3px] text-mist">
              {me.medrekkCode}
            </Text>
          </View>
        </View>
      ) : null}

      <Sheet>
        <View className="gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">
            {isWorker ? 'Your tools' : 'Your record'}
          </Text>
          <View className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {isWorker ? (
              <>
                <Row
                  icon="award"
                  title="Your licence"
                  body={
                    user?.credentialStatus === 'APPROVED'
                      ? 'Approved — you can confirm entries'
                      : user?.licence
                        ? 'Sent, waiting for review'
                        : 'Needed before you can confirm entries'
                  }
                  onPress={() => router.push('/worker-credential')}
                />
                {/* Clinicians get ill too. One account, one email, both sides. */}
                {user?.patientId ? (
                  <Row
                    icon="file-text"
                    title="My own record"
                    body="Your MedRekk record, as a patient"
                    onPress={() => router.push('/record')}
                  />
                ) : (
                  <Row
                    icon="plus-circle"
                    title="Use MedRekk for my own record"
                    body="Get your own MedRekk code on this account"
                    onPress={() => void startOwnRecord()}
                  />
                )}
                <Row
                  icon="cpu"
                  title="On-device AI"
                  body="Download or remove the model"
                  onPress={() => router.push('/worker-model')}
                />
              </>
            ) : (
              <>
                <Row
                  icon="clock"
                  title="Access history"
                  body="Every view of your record is logged"
                  onPress={() => router.push('/patient/history')}
                />
                <Row
                  icon="alert-triangle"
                  title="Emergency card"
                  body="What a responder sees"
                  onPress={() => router.push('/patient/emergency')}
                />
                <Row
                  icon="phone"
                  title="Reach your card by phone"
                  body="Dial a short code, no internet needed"
                  onPress={() => router.push('/patient/ussd')}
                />
                {/* Patients can record by voice now, so they need the speech model too. */}
                <Row
                  icon="cpu"
                  title="On-device AI"
                  body="Download the speech model to add entries by voice"
                  onPress={() => router.push('/worker-model')}
                />
              </>
            )}
          </View>
        </View>

        <Pressable
          onPress={confirmSignOut}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
          <Feather name="log-out" size={17} color={C.danger} />
          <Text className="text-[15px] font-medium text-danger">Sign out</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
