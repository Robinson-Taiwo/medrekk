import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { fetchWithCache } from "@/offline/cachedFetch";

interface MeResponse {
  medrekkCode?: string;
}

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(/\/+$/, "");
const ME_KEY = "me";

export default function EmergencyQr() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchWithCache<MeResponse>(ME_KEY, "/patients/me").catch(() => undefined);
  }, []);

  const show = async () => {
    setOpen(true);
    setError(null);
    if (!WEB_URL) {
      setError("EXPO_PUBLIC_WEB_URL is not set in the app's .env.");
      return;
    }
    try {
      const me = await fetchWithCache<MeResponse>(ME_KEY, "/patients/me");
      if (!me.data.medrekkCode) throw new Error("Your MedRekk Code was not found in the response.");
      setCode(me.data.medrekkCode);
      setFromCache(me.fromCache);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const url = code ? `${WEB_URL}/emergency/${code}` : null;

  return (
    <>
      <Pressable
        onPress={() => void show()}
        className="items-center rounded-xl border border-[#0F6E56] py-4"
      >
        <Text className="text-base font-semibold text-[#0F6E56]">Show emergency QR</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 items-center justify-center gap-5 bg-white p-6">
          <Text className="text-2xl font-bold text-gray-900">Emergency QR</Text>
          {url ? (
            <View className="rounded-2xl bg-white p-4">
              <QRCode value={url} size={240} />
            </View>
          ) : error ? (
            <Text className="text-center text-sm text-red-700">{error}</Text>
          ) : (
            <ActivityIndicator />
          )}
          {code ? <Text className="text-lg tracking-widest text-gray-900">{code}</Text> : null}
          {fromCache ? (
            <Text className="max-w-[320px] text-center text-xs text-amber-800">
              You are offline. This QR was saved on your phone and still works for anyone who scans it.
            </Text>
          ) : null}
          <Text className="max-w-[320px] text-center text-xs text-gray-500">
            Anyone who scans this sees your emergency profile only, without your approval. The QR holds a link, not
            medical data, and every open is logged in your History.
          </Text>
          <Pressable onPress={() => setOpen(false)} className="rounded-xl bg-[#0F6E56] px-8 py-3">
            <Text className="font-semibold text-white">Close</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </>
  );
}
