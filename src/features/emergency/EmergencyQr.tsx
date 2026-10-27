import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import Feather from '@expo/vector-icons/Feather';

import { fetchWithCache } from '@/offline/cachedFetch';
import { C } from '@/components/design/tokens';
import { useFeedback, reasonFor } from '@/components/design/feedback';
import { printCard, shareCard, printingAvailable, type CardData } from './printCard';
import { PROFILE_PATH, type EmergencyProfileData } from './types';

interface MeResponse {
  medrekkCode?: string;
  fullName?: string;
}

/** What react-native-qrcode-svg hands back through getRef. */
interface QrRef {
  toDataURL: (cb: (base64: string) => void) => void;
}

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
const ME_KEY = 'me';

export default function EmergencyQr() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<EmergencyProfileData | null>(null);
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);
  const { toast } = useFeedback();

  // The large QR in the modal doubles as the source for the printed one, so what goes on paper
  // is byte-for-byte the code on screen rather than a second one generated from the same string.
  const qr = useRef<QrRef | null>(null);

  const load = useCallback(async () => {
    if (!WEB_URL) {
      setError("EXPO_PUBLIC_WEB_URL is not set in the app's .env.");
      return;
    }
    try {
      const me = await fetchWithCache<MeResponse>(ME_KEY, '/patients/me');
      if (!me.data.medrekkCode) throw new Error('Your MedRekk Code was not found in the response.');
      setCode(me.data.medrekkCode);
      setName(me.data.fullName ?? '');
      setFromCache(me.fromCache);
      setError(null);
      // Only for the printed card. A failure here must not cost the QR, which is the thing
      // this component exists for.
      try {
        const p = await fetchWithCache<EmergencyProfileData>('emergency-profile', PROFILE_PATH);
        setProfile(p.data);
      } catch {
        setProfile(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const url = code ? `${WEB_URL}/emergency/${code}` : null;

  /**
   * Null while the answer is being worked out, so the buttons appear once rather than appearing
   * and then vanishing. A build that cannot print simply never shows them.
   */
  const [canPrint, setCanPrint] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void printingAvailable().then((ok) => {
      if (!cancelled) setCanPrint(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The QR is read off the rendered one rather than regenerated, so the printed square and the
   * one on screen cannot diverge. toDataURL is callback-style, hence the wrapper.
   */
  const qrBase64 = (): Promise<string | undefined> =>
    new Promise((resolve) => {
      const ref = qr.current;
      if (!ref) return resolve(undefined);
      const bail = setTimeout(() => resolve(undefined), 2500);
      try {
        ref.toDataURL((data) => {
          clearTimeout(bail);
          resolve(data);
        });
      } catch {
        clearTimeout(bail);
        resolve(undefined);
      }
    });

  const makeCard = async (how: 'print' | 'share') => {
    if (!url || !code || busy) return;
    setBusy(how);
    try {
      const card: CardData = {
        fullName: name || 'MedRekk user',
        medrekkCode: code,
        ...(profile?.bloodGroup ? { bloodGroup: profile.bloodGroup } : {}),
        allergies: profile?.criticalAllergies ?? [],
        url,
        printedOn: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
      };
      const png = await qrBase64();
      if (png) card.qrBase64 = png;
      await (how === 'print' ? printCard(card) : shareCard(card));
    } catch (e) {
      toast({ tone: 'error', title: 'Could not make the card', body: reasonFor(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} disabled={!url} className="items-center gap-2">
        <View className="rounded-[14px] border border-line p-2.5">
          {url ? (
            <QRCode value={url} size={136} color={C.ink} backgroundColor={C.surface} />
          ) : (
            <View className="h-[136px] w-[136px] items-center justify-center">
              {error ? <Feather name="alert-circle" size={22} color={C.muted} /> : <ActivityIndicator />}
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
                <QRCode
                  value={url}
                  size={248}
                  color={C.ink}
                  backgroundColor={C.surface}
                  getRef={(c) => {
                    qr.current = c as unknown as QrRef;
                  }}
                />
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
              <Feather name="lock" size={15} color={C.muted} />
              <Text className="flex-1 text-xs leading-[17px] text-muted">
                Anyone who scans this sees your emergency card only, without your approval. The QR holds a link, not
                medical data, and every open is logged in your history.
              </Text>
            </View>

            {/*
              Where to keep it, which is the part that decides whether any of this works.
              
              A QR that only exists on a locked screen answers the easy half of the problem. The
              person who most needs this is unconscious with a flat battery, and for them the
              card has to be somewhere a stranger will look.
            */}
            {canPrint === true ? (
              <View className="max-w-[330px] gap-2 rounded-xl border border-line bg-surface px-3.5 py-3">
                <Text className="text-[12.5px] font-semibold text-ink">Keep a copy off your phone</Text>
                {[
                  'In your wallet, behind your bank card',
                  'Taped inside a helmet, or in a school bag',
                  'On the fridge — where paramedics are trained to look',
                ].map((where) => (
                  <View key={where} className="flex-row items-start gap-2">
                    <View className="mt-[7px] h-1 w-1 rounded-full bg-primary" />
                    <Text className="flex-1 text-[12px] leading-[17px] text-muted">{where}</Text>
                  </View>
                ))}
                <Text className="mt-0.5 text-[11.5px] leading-[16px] text-muted">
                  The printed card carries only your blood group and severe allergies — what changes treatment
                  in the first minute. Conditions, medicines and your contact stay behind the code, where they
                  stay current and where every look is logged.
                </Text>
              </View>
            ) : null}
          </View>

          <View className="gap-2 p-5">
            {canPrint === true ? (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => void makeCard('share')}
                  disabled={busy !== null || !url}
                  className={`h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface ${busy ? 'opacity-50' : ''}`}>
                  <Feather name="share" size={16} color={C.ink} />
                  <Text className="text-[15px] font-medium text-ink">
                    {busy === 'share' ? 'Preparing…' : 'Save or send'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void makeCard('print')}
                  disabled={busy !== null || !url}
                  className={`h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface ${busy ? 'opacity-50' : ''}`}>
                  <Feather name="printer" size={16} color={C.ink} />
                  <Text className="text-[15px] font-medium text-ink">
                    {busy === 'print' ? 'Preparing…' : 'Print'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
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
