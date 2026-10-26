import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/services/api';
import { loadToken } from '@/services/session';
import { addOwnRecord } from '@/features/auth/authApi';
import { Card, Meta } from '@/components/design/primitives';
import { BottomTabInset } from '@/constants/theme';

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
        <Feather name={icon} size={18} color="#142D2A" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-medium text-ink">{title}</Text>
        {body ? <Meta>{body}</Meta> : null}
      </View>
      {value ? <Text className="text-[13px] text-muted">{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={18} color="#5D6C82" /> : null}
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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-semibold tracking-tight text-ink">Profile</Text>

        <Card className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-ink">
              <Text className="text-base font-semibold text-white">
                {(user?.fullName ?? '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-ink">{user?.fullName ?? ''}</Text>
              <Meta>{isWorker ? 'Health worker' : 'Patient'}</Meta>
            </View>
          </View>
          {!isWorker && me ? (
            <View className="gap-1 border-t border-line pt-3">
              <Meta>Your MedRekk code</Meta>
              <Text selectable className="text-xl font-semibold tracking-widest text-primary">
                {me.medrekkCode}
              </Text>
            </View>
          ) : null}
        </Card>

        <View className="gap-2">
          <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">
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
          <Feather name="log-out" size={17} color="#CE2B2B" />
          <Text className="text-base font-medium text-danger">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
