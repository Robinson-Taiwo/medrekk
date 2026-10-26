import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useAuth } from '@/features/auth/AuthProvider';
import { submitCredential, LICENCE_BODIES, type LicenceBody } from '@/features/auth/authApi';
import { loadToken } from '@/services/session';
import { Card, Meta } from '@/components/design/primitives';
import { BottomTabInset } from '@/constants/theme';
import { Chrome, Note, Screen, Sheet } from '@/components/design/split';
import { C } from '@/components/design/tokens';

/**
 * The register, in the words the licence itself uses. Named rather than typed freely so the
 * person approving knows which public register to look the number up on — an approval here is
 * someone checking a register, and that is only possible if they know which one.
 */
const BODIES: { key: LicenceBody; label: string; full: string }[] = [
  { key: 'MDCN', label: 'MDCN', full: 'Medical and Dental Council of Nigeria' },
  { key: 'NMCN', label: 'NMCN', full: 'Nursing and Midwifery Council of Nigeria' },
  { key: 'PCN', label: 'PCN', full: 'Pharmacists Council of Nigeria' },
  { key: 'MLSCN', label: 'MLSCN', full: 'Medical Laboratory Science Council of Nigeria' },
  { key: 'OTHER', label: 'Other', full: 'Another professional register' },
];

/**
 * Compressed hard on purpose. The whole submission travels as one JSON request, and a photo
 * straight off a modern camera is larger than the server will accept — a licence only has to
 * be legible, not beautiful.
 */
const IMAGE_QUALITY = 0.45;
const MAX_BASE64 = 700_000;

export default function WorkerCredential() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const existing = user?.licence;
  const [body, setBody] = useState<LicenceBody>(existing?.body ?? 'MDCN');
  const [number, setNumber] = useState(existing?.number ?? '');
  const [profession, setProfession] = useState(existing?.profession ?? '');
  const [image, setImage] = useState<{ uri: string; mime: 'image/jpeg' | 'image/png'; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const approved = user?.credentialStatus === 'APPROVED';

  const pick = async (from: 'CAMERA' | 'LIBRARY') => {
    setError(null);
    setWorking(true);
    try {
      if (from === 'CAMERA') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('MedRekk needs permission to use the camera.');
      }
      const picked =
        from === 'CAMERA'
          ? await ImagePicker.launchCameraAsync({ quality: IMAGE_QUALITY, allowsEditing: true })
          : await ImagePicker.launchImageLibraryAsync({ quality: IMAGE_QUALITY, allowsEditing: true });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (base64.length > MAX_BASE64) {
        setError('That photo is too large. Take it again a little further back, or crop it tighter.');
        return;
      }
      setImage({
        uri: asset.uri,
        mime: asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        base64,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setWorking(false);
    }
  };

  const submit = async () => {
    if (busy || number.trim().length < 3 || profession.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const token = await loadToken();
      if (!token) throw new Error('Sign in again to submit your licence.');
      await submitCredential(
        {
          body,
          number: number.trim(),
          profession: profession.trim(),
          ...(image ? { image: { mime: image.mime, base64: image.base64 } } : {}),
        },
        token,
      );
      await refreshUser();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit that.');
    } finally {
      setBusy(false);
    }
  };

  const ready = number.trim().length >= 3 && profession.trim().length >= 2;

  if (done) {
    return (
      <Screen>
        <Chrome title="Your licence" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center gap-3 bg-canvas px-8">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
            <Feather name="check" size={24} color={C.primary} />
          </View>
          <Text className="text-[17px] font-semibold text-ink">Sent for review</Text>
          <Text className="text-center text-sm leading-5 text-muted">
            Someone will check your number against the {BODIES.find((b) => b.key === body)?.label} register. You can
            keep working in the meantime — this only affects whether you can confirm what is already in a record.
          </Text>
          <Pressable onPress={() => router.back()} className="mt-2 h-11 justify-center rounded-xl bg-primary px-5">
            <Text className="text-[15px] font-medium text-white">Done</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Chrome
        title="Your licence"
        subtitle="So somebody can check you are who you say"
        onBack={() => router.back()}
      />
      <Sheet>
        <Note>
          You can already find a patient and record a visit. This is what lets you confirm something already in a
          record — the difference between a note you took and you vouching for it.
        </Note>

        {approved ? (
          <Card className="flex-row items-start gap-3 p-3.5">
            <Feather name="alert-triangle" size={17} color={C.warn} />
            <Text className="flex-1 text-[13px] leading-5 text-ink">
              Your credential is approved. Sending a different licence puts you back to pending, because an approval
              refers to the document it was given.
            </Text>
          </Card>
        ) : null}

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-ink">Which register are you on?</Text>
          <View className="gap-1.5">
            {BODIES.map((b) => {
              const active = body === b.key;
              return (
                <Pressable
                  key={b.key}
                  onPress={() => setBody(b.key)}
                  className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                    active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                  }`}>
                  <View
                    className={`h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                      active ? 'border-primary' : 'border-dim'
                    }`}>
                    {active ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className={`text-[14px] font-medium ${active ? 'text-primary' : 'text-ink'}`}>
                      {b.label}
                    </Text>
                    <Text className="text-[11px] text-muted">{b.full}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-medium text-ink">Registration number</Text>
          <TextInput
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
            placeholder="As printed on your licence"
            placeholderTextColor={C.hint}
            value={number}
            onChangeText={setNumber}
            autoCapitalize="characters"
          />
        </View>

        <View className="gap-1.5">
          <Text className="text-[13px] font-medium text-ink">Your role</Text>
          <TextInput
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
            placeholder="e.g. Medical officer, Registered nurse"
            placeholderTextColor={C.hint}
            value={profession}
            onChangeText={setProfession}
          />
        </View>

        <View className="gap-2.5 rounded-xl border border-line bg-surface p-3.5">
          <Text className="text-[13px] font-medium text-ink">A photo of the licence</Text>
          <Meta>
            Held only so a person can look at it beside the number. It is never shown to patients.
          </Meta>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => void pick('CAMERA')}
              disabled={working}
              className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary-soft">
              <Feather name="camera" size={15} color={C.primary} />
              <Text className="text-[13px] font-medium text-primary">Take a photo</Text>
            </Pressable>
            <Pressable
              onPress={() => void pick('LIBRARY')}
              disabled={working}
              className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-fill">
              <Feather name="image" size={15} color={C.muted} />
              <Text className="text-[13px] font-medium text-ink">From photos</Text>
            </Pressable>
          </View>

          {working ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={C.primary} />
              <Text className="text-[13px] text-muted">Reading the photo…</Text>
            </View>
          ) : null}

          {image ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-fill p-2.5">
              <Image source={{ uri: image.uri }} className="h-12 w-12 rounded-lg" resizeMode="cover" />
              <Text className="flex-1 text-[13px] font-medium text-ink">Ready to send</Text>
              <Pressable onPress={() => setImage(null)} hitSlop={8}>
                <Feather name="trash-2" size={16} color={C.muted} />
              </Pressable>
            </View>
          ) : existing?.documentId ? (
            <Meta>A photo is already on file. Attach a new one only if you want to replace it.</Meta>
          ) : null}
        </View>

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}

        <Pressable
          onPress={() => void submit()}
          disabled={!ready || busy}
          className={`h-[52px] items-center justify-center rounded-xl ${ready && !busy ? 'bg-primary' : 'bg-track'}`}>
          <Text className={`text-base font-medium ${ready && !busy ? 'text-white' : 'text-muted'}`}>
            {busy ? 'Sending…' : 'Send for review'}
          </Text>
        </Pressable>

        <Meta>
          Nothing here is checked automatically. A person compares your number against the register and looks at the
          photo, which is why both matter.
        </Meta>
      </Sheet>
    </Screen>
  );
}
