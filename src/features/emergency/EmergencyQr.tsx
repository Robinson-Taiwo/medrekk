import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import Feather from '@expo/vector-icons/Feather';

import { fetchWithCache } from '@/offline/cachedFetch';

interface MeResponse {
  medrekkCode?: string;
}

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
const ME_KEY = 'me';

export default function EmergencyQr() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!WEB_URL) {
      setError("EXPO_PUBLIC_WEB_URL is not set in the app's .env.");
      return;
    }
    try {
      const me = await fetchWithCache<MeResponse>(ME_KEY, '/patients/me');
      if (!me.data.medrekkCode) throw new Error('Your MedRekk Code was not found in the response.');
      setCode(me.data.medrekkCode);
      setFromCache(me.fromCache);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const url = code ? `${WEB_URL}/emergency/${code}` : null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} disabled={!url} className="items-center gap-2">
        <View className="rounded-[14px] border border-line p-2.5">
          {url ? (
            <QRCode value={url} size={136} color="#142D2A" backgroundColor="#FFFFFF" />
          ) : (
            <View className="h-[136px] w-[136px] items-center justify-center">
              {error ? <Feather name="alert-circle" size={22} color="#64748B" /> : <ActivityIndicator />}
            </View>
          )}
        </View>
        {code ? <Text className="text-[15px] font-medium tracking-[2px] text-ink">{code}</Text> : null}
        <Text className="text-xs text-muted">{error ? 'QR unavailable' : 'Scan with any phone camera'}</Text>
        {fromCache ? <Text className="text-xs text-warn">Saved on your phone, still works offline</Text> : null}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-canvas">
          <View className="flex-1 items-center justify-center gap-5 p-6">
            <Text className="text-[22px] font-semibold tracking-tight text-ink">Emergency QR</Text>

            {url ? (
              <View className="rounded-2xl border border-line bg-surface p-5">
                <QRCode value={url} size={248} color="#142D2A" backgroundColor="#FFFFFF" />
              </View>
            ) : error ? (
              <Text className="text-center text-sm text-danger">{error}</Text>
            ) : (
              <ActivityIndicator />
            )}

            {code ? <Text className="text-xl font-medium tracking-[3px] text-ink">{code}</Text> : null}

            {fromCache ? (
              <Text className="max-w-[320px] text-center text-xs leading-[17px] text-warn">
                You are offline. This QR was saved on your phone and still works for anyone who scans it.
              </Text>
            ) : null}

            <View className="max-w-[330px] flex-row items-start gap-2.5 rounded-xl bg-fill px-3.5 py-3">
              <Feather name="lock" size={15} color="#64748B" />
              <Text className="flex-1 text-xs leading-[17px] text-muted">
                Anyone who scans this sees your emergency card only, without your approval. The QR holds a link, not
                medical data, and every open is logged in your history.
              </Text>
            </View>
          </View>

          <View className="p-5">
            <Pressable
              onPress={() => setOpen(false)}
              className="h-[52px] items-center justify-center rounded-xl bg-primary">
              <Text className="text-base font-medium text-white">Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
