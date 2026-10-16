import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { Card, Eyebrow, Meta } from '@/components/design/primitives';

interface PinStatus {
  set: boolean;
  phone: string | null;
  lockedUntil?: string;
}

/** Mirrors the backend rule, so a bad PIN is caught before a round trip. */
function isWeakPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  if (/^(\d)\1{3}$/.test(pin)) return true;
  const digits = [...pin].map(Number);
  const step = (by: number): boolean => digits.every((n, i) => i === 0 || n === digits[i - 1]! + by);
  return step(1) || step(-1);
}

const inputClass = 'h-[52px] rounded-xl border border-line bg-surface px-4 text-base text-ink';

export default function UssdSetupScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [phoneDraft, setPhoneDraft] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api<PinStatus>('/patients/me/ussd-pin');
      setStatus(next);
      setPhoneDraft(next.phone ?? '');
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset the transient editing state so a half-typed PIN never survives leaving the screen.
      setPin('');
      setConfirm('');
      setPinError(null);
      setChangingPin(false);
      setEditingPhone(false);
      void load();
    }, [load]),
  );

  const savePhone = async () => {
    setPhoneBusy(true);
    try {
      await api('/auth/me/phone', { method: 'PATCH', body: { phone: phoneDraft.trim() } });
      setEditingPhone(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save that number', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin)) return setPinError('The PIN must be exactly 4 digits.');
    if (isWeakPin(pin)) return setPinError("Pick a PIN that isn't four of the same digit or a run like 1234.");
    if (pin !== confirm) return setPinError('The two PINs do not match.');
    setPinError(null);
    setPinBusy(true);
    try {
      await api('/patients/me/ussd-pin', { method: 'PATCH', body: { pin } });
      setPin('');
      setConfirm('');
      setChangingPin(false);
      await load();
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPinBusy(false);
    }
  };

  const turnOff = () =>
    Alert.alert(
      'Turn off dialling?',
      'Your PIN is deleted. Nobody will be able to reach your emergency card by phone until you set a new one.',
      [
        { text: 'Keep it on', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await api('/patients/me/ussd-pin', { method: 'DELETE' });
                await load();
              } catch (e) {
                Alert.alert('Could not turn it off', e instanceof Error ? e.message : 'Something went wrong.');
              }
            })();
          },
        },
      ],
    );

  if (!status) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas p-6">
        {loadError ? (
          <View className="items-center gap-3">
            <Text className="text-center text-sm text-danger">{loadError}</Text>
            <Pressable onPress={() => void load()} className="rounded-xl bg-primary px-5 py-3">
              <Text className="font-medium text-white">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  const hasPhone = Boolean(status.phone);
  const lockedMinutes = status.lockedUntil
    ? Math.max(0, Math.ceil((new Date(status.lockedUntil).getTime() - Date.now()) / 60_000))
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.navigate('/profile')} hitSlop={8} className="h-10 w-10 justify-center">
          <Feather name="chevron-left" size={24} color="#142D2A" />
        </Pressable>

        <View className="gap-2">
          <Text className="text-[26px] font-semibold leading-8 tracking-tight text-ink">Reach your card by phone</Text>
          <Text className="text-[15px] leading-[22px] text-muted">
            Dial a short code from any phone — a borrowed one, a feature phone, no internet needed. You enter a
            4-digit PIN, then you can read your emergency card and your MedRekk Code.
          </Text>
        </View>

        <Card className="gap-2.5 p-4">
          <Eyebrow>What this does and does not show</Eyebrow>
          <Text className="text-[15px] leading-[22px] text-ink">
            Only your emergency card and your MedRekk Code can be read this way.
          </Text>
          <Text className="text-[13px] leading-[19px] text-muted">
            Not your full record. Text sent over a dialled code passes through the phone network unencrypted, and
            whoever is standing near the handset can read the screen. Your full record still needs your approval in
            the app, every time.
          </Text>
        </Card>

        {lockedMinutes > 0 ? (
          <View className="flex-row items-start gap-2.5 rounded-xl bg-danger-soft p-3.5">
            <Feather name="lock" size={15} color="#D94848" />
            <Text className="flex-1 text-[13px] leading-[19px] text-danger">
              Dialling is locked for {lockedMinutes} more {lockedMinutes === 1 ? 'minute' : 'minutes'} after too many
              wrong PINs. Your record is untouched.
            </Text>
          </View>
        ) : null}

        <View className="gap-2">
          <Eyebrow>The number you will dial from</Eyebrow>
          <Card className="gap-3 p-3.5">
            {editingPhone || !hasPhone ? (
              <>
                <TextInput
                  className={inputClass}
                  placeholder="08031234567"
                  placeholderTextColor="#94A3B8"
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
                <Meta>
                  This is how the service knows the call is yours. It must be the SIM you will actually dial from.
                </Meta>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => void savePhone()}
                    disabled={phoneBusy || phoneDraft.trim().length === 0}
                    className={`h-[46px] flex-1 items-center justify-center rounded-xl bg-primary ${
                      phoneBusy || phoneDraft.trim().length === 0 ? 'opacity-50' : ''
                    }`}>
                    <Text className="text-[15px] font-medium text-white">{phoneBusy ? 'Saving…' : 'Save number'}</Text>
                  </Pressable>
                  {hasPhone ? (
                    <Pressable
                      onPress={() => {
                        setPhoneDraft(status.phone ?? '');
                        setEditingPhone(false);
                      }}
                      className="h-[46px] flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                      <Text className="text-[15px] font-medium text-ink">Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : (
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-fill">
                  <Feather name="phone" size={16} color="#142D2A" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-medium text-ink">{status.phone}</Text>
                  <Meta>Saved</Meta>
                </View>
                <Pressable onPress={() => setEditingPhone(true)} hitSlop={8}>
                  <Text className="text-[13px] font-medium text-primary">Change</Text>
                </Pressable>
              </View>
            )}
          </Card>
        </View>

        <View className="gap-2">
          <Eyebrow>Your 4-digit PIN</Eyebrow>
          {!hasPhone ? (
            <Card className="p-3.5">
              <Meta>Save your phone number first. A PIN with no number to dial from could never be used.</Meta>
            </Card>
          ) : status.set && !changingPin ? (
            <Card className="gap-3 p-3.5">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft">
                  <Feather name="check" size={16} color="#0F6E56" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-medium text-ink">PIN set</Text>
                  <Meta>Five wrong tries locks dialling for 15 minutes</Meta>
                </View>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setChangingPin(true)}
                  className="h-[46px] flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                  <Text className="text-[15px] font-medium text-ink">Change PIN</Text>
                </Pressable>
                <Pressable
                  onPress={turnOff}
                  className="h-[46px] flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                  <Text className="text-[15px] font-medium text-danger">Turn off</Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card className="gap-3 p-3.5">
              <TextInput
                className={inputClass}
                placeholder="New PIN"
                placeholderTextColor="#94A3B8"
                value={pin}
                onChangeText={(next) => setPin(next.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
              <TextInput
                className={inputClass}
                placeholder="Enter it again"
                placeholderTextColor="#94A3B8"
                value={confirm}
                onChangeText={(next) => setConfirm(next.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                onSubmitEditing={() => void savePin()}
              />
              <Meta>
                Not four of the same digit, and not a run like 1234. Those are the first things anyone would try.
              </Meta>
              {pinError ? <Text className="text-sm text-danger">{pinError}</Text> : null}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => void savePin()}
                  disabled={pinBusy}
                  className={`h-[46px] flex-1 items-center justify-center rounded-xl bg-primary ${
                    pinBusy ? 'opacity-50' : ''
                  }`}>
                  <Text className="text-[15px] font-medium text-white">{pinBusy ? 'Saving…' : 'Save PIN'}</Text>
                </Pressable>
                {status.set ? (
                  <Pressable
                    onPress={() => {
                      setChangingPin(false);
                      setPin('');
                      setConfirm('');
                      setPinError(null);
                    }}
                    className="h-[46px] flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                    <Text className="text-[15px] font-medium text-ink">Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          )}
        </View>

        <Meta>
          The PIN can only be set here, in the app, where you are signed in. It can never be set over a dialled code —
          otherwise whoever was holding your phone could set one.
        </Meta>
      </ScrollView>
    </SafeAreaView>
  );
}
