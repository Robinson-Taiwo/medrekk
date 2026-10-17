import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import WorkerHome from '@/features/worker/WorkerHome';
import { useAccessRequests } from '@/features/access/useAccessRequests';
import { fetchWithCache } from '@/offline/cachedFetch';
import { api } from '@/services/api';
import { PROFILE_PATH, type EmergencyProfileData } from '@/features/emergency/types';
import { Card, Meta } from '@/components/design/primitives';
import { C } from '@/components/design/tokens';
import { CATEGORY_ICON, countByCategory, nounFor } from '@/features/record/categories';
import { BottomTabInset } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface Me {
  fullName: string;
  medrekkCode: string;
}

interface AllergyClaim {
  id: string;
  category: string;
  value: string;
  emergencyDecision?: 'ADDED' | 'DECLINED';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function timeLeft(until: string): string {
  const ms = Date.parse(until) - Date.now();
  if (ms <= 0) return 'expired';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m left`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-[10px] bg-white/10 px-2.5 py-2">
      <Text className="text-[11px] text-white/60">{label}</Text>
      <Text className="text-base font-semibold text-white">{value}</Text>
    </View>
  );
}

/**
 * One thing left to do, or one already done. A finished step keeps its place rather than
 * disappearing, so the list does not reshuffle under the thumb while it is being worked
 * through, and it stops being rendered at all once everything is done.
 */
function SetupStep({
  icon,
  title,
  body,
  done,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      accessibilityRole="button"
      accessibilityState={{ disabled: done }}
      accessibilityLabel={done ? `${title}, done` : title}
      className="flex-row items-center gap-3 px-3.5 py-3">
      <View
        className={`h-9 w-9 items-center justify-center rounded-[10px] ${done ? 'bg-primary-soft' : 'bg-fill'}`}>
        <Feather name={done ? 'check' : icon} size={16} color={done ? C.primary : C.ink} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={`text-sm font-medium ${done ? 'text-muted' : 'text-ink'}`}>{title}</Text>
        {done ? null : <Text className="text-xs leading-[17px] text-muted">{body}</Text>}
      </View>
      {done ? null : <Feather name="chevron-right" size={18} color={C.muted} />}
    </Pressable>
  );
}

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();
  const { requests, active } = useAccessRequests();

  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<EmergencyProfileData | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<AllergyClaim[]>([]);
  const [allergies, setAllergies] = useState<AllergyClaim[]>([]);
  const [ussdReady, setUssdReady] = useState<boolean | null>(null);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meResult, profileResult] = await Promise.all([
        fetchWithCache<Me>('me', '/patients/me'),
        fetchWithCache<EmergencyProfileData>('emergency-profile', PROFILE_PATH),
      ]);
      setMe(meResult.data);
      setProfile(profileResult.data);
    } catch {
      // The cache covers the offline case; a failure here just leaves the card empty.
    }
  }, []);

  // Allergies a worker recorded that the patient has not decided about. Not cached with the rest:
  // an undecided allergy is a prompt, not part of the record view.
  const loadAllergies = useCallback(async () => {
    try {
      const all = await api<AllergyClaim[]>('/patients/me/claims');
      setClaims(all);
      setAllergies(all.filter((c) => c.category === 'ALLERGIES' && !c.emergencyDecision));
    } catch {
      setClaims([]);
      setAllergies([]);
    }
  }, []);

  // Null means the question could not be asked, offline or otherwise. That row is then left
  // out rather than guessed at, which would tell somebody to set a PIN they already have.
  const loadUssd = useCallback(async () => {
    try {
      const status = await api<{ set: boolean }>('/patients/me/ussd-pin');
      setUssdReady(status.set);
    } catch {
      setUssdReady(null);
    }
  }, []);

  const decideEmergency = useCallback(
    async (claimId: string, add: boolean) => {
      setDeciding(true);
      try {
        await api(`/patients/me/claims/${claimId}/emergency`, { method: add ? 'POST' : 'DELETE' });
        setAllergies((prev) => prev.filter((c) => c.id !== claimId));
        if (add) await load();
      } catch (e) {
        Alert.alert('Could not update your card', e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setDeciding(false);
      }
    },
    [load],
  );

  const ping = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void ping();
  }, [ping]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadAllergies();
      void loadUssd();
    }, [load, loadAllergies, loadUssd]),
  );

  if (user?.role === 'HEALTH_WORKER') return <WorkerHome />;

  const name = user?.fullName ?? '';
  const pending = requests[0];
  const awaitingEmergency = allergies[0];

  // What is still worth doing. A new account otherwise lands on a screen that reports only
  // absences, which is the state most people see first and the least useful one.
  const hasEmergencyCard =
    Boolean(profile?.bloodGroup) ||
    (profile?.criticalAllergies.length ?? 0) > 0 ||
    (profile?.criticalConditions.length ?? 0) > 0;

  const setupSteps: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    body: string;
    done: boolean;
    onPress: () => void;
  }[] = [
    {
      icon: 'alert-circle',
      title: 'Fill in your emergency card',
      body: 'Blood group and allergies, readable by a responder without unlocking your phone',
      done: hasEmergencyCard,
      onPress: () => router.push('/patient/emergency'),
    },
    ...(ussdReady === null
      ? []
      : [
          {
            icon: 'phone' as const,
            title: 'Set a PIN for dialling',
            body: 'Read your record from any phone — no app, no internet',
            done: ussdReady,
            onPress: () => router.push('/patient/ussd'),
          },
        ]),
    {
      icon: 'plus-circle',
      title: 'Add your first record',
      body: 'A prescription or a test result you already have',
      done: claims.length > 0,
      onPress: () => router.push('/patient/me'),
    },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;

  // Counts, never values: this is the screen most likely to be read over a shoulder.
  const recordCounts = [...countByCategory(claims).entries()].sort((a, b) => b[1] - a[1]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void Promise.all([load(), loadAllergies(), loadUssd(), ping()]).finally(() =>
                setRefreshing(false),
              );
            }}
          />
        }>
        <View className="flex-row items-center justify-between">
          <View className="gap-0.5">
            <Text className="text-[13px] text-muted">{greeting()}</Text>
            <Text className="text-2xl font-semibold tracking-tight text-ink">{firstName(name)}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/patient/me')}
            className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft">
            <Text className="text-sm font-semibold text-primary">{initials(name)}</Text>
          </Pressable>
        </View>

        <View className="gap-3.5 rounded-2xl bg-ink p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-white/70">Health passport</Text>
            <View className="flex-row items-center gap-1.5">
              <View
                className={`h-1.5 w-1.5 rounded-full ${
                  online === null ? 'bg-white/40' : online ? 'bg-primary-soft' : 'bg-danger'
                }`}
              />
              <Text className="text-xs text-white/80">{online === false ? 'Offline' : 'Available offline'}</Text>
            </View>
          </View>

          <View className="flex-row items-end justify-between">
            <View className="gap-1">
              <Text className="text-xs text-white/60">MedRekk code</Text>
              <Text className="text-2xl font-semibold tracking-widest text-white">{me?.medrekkCode ?? '—'}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/patient/emergency')}
              className="h-9 flex-row items-center gap-1.5 rounded-[10px] bg-surface px-3">
              <Feather name="grid" size={15} color="#142D2A" />
              <Text className="text-[13px] font-medium text-ink">Show QR</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <Stat label="Blood group" value={profile?.bloodGroup ?? '—'} />
            <Stat label="Allergies" value={String(profile?.criticalAllergies.length ?? 0)} />
            <Stat label="Conditions" value={String(profile?.criticalConditions.length ?? 0)} />
          </View>
        </View>

        {pending ? (
          <Card className="gap-3 p-3.5">
            <View className="flex-row items-center gap-3">
              <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-fill">
                <Feather name="user-check" size={18} color="#142D2A" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-ink">
                  {pending.requester?.name ?? 'A provider'} requests access
                </Text>
                <Meta>
                  {pending.requester?.facility ? `${pending.requester.facility} · ` : ''}
                  {pending.requestedScopes.length} {pending.requestedScopes.length === 1 ? 'area' : 'areas'}
                </Meta>
              </View>
              <Pressable
                onPress={() => router.push('/patient/access')}
                className="h-[34px] justify-center rounded-[10px] bg-primary px-3.5">
                <Text className="text-[13px] font-medium text-white">Review</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {awaitingEmergency ? (
          <Card className="gap-3 p-3.5">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-danger-soft">
                <Feather name="alert-circle" size={17} color="#CE2B2B" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-medium text-ink">Add to your emergency card?</Text>
                <Meta>A health worker recorded that you are allergic to {awaitingEmergency.value}.</Meta>
              </View>
            </View>

            <Text className="rounded-[10px] bg-fill px-3 py-2.5 text-xs leading-[17px] text-muted">
              Anyone who scans your emergency QR can read what is on that card, without needing your approval. Only
              put something there if you want it seen in an emergency.
            </Text>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => void decideEmergency(awaitingEmergency.id, false)}
                disabled={deciding}
                className="h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                <Text className="text-[13px] font-medium text-ink">Not now</Text>
              </Pressable>
              <Pressable
                onPress={() => void decideEmergency(awaitingEmergency.id, true)}
                disabled={deciding}
                className={`h-11 flex-1 items-center justify-center rounded-xl bg-primary ${deciding ? 'opacity-50' : ''}`}>
                <Text className="text-[13px] font-medium text-white">Add it</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {setupDone < setupSteps.length ? (
          <View className="gap-2.5">
            <View className="flex-row items-end justify-between">
              <Text className="text-lg font-semibold text-ink">Finish setting up</Text>
              <Meta>
                {setupDone} of {setupSteps.length} done
              </Meta>
            </View>
            <Card className="divide-y divide-line overflow-hidden">
              {setupSteps.map((step) => (
                <SetupStep key={step.title} {...step} />
              ))}
            </Card>
          </View>
        ) : null}

        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ink">Who can see your record</Text>
            <Pressable onPress={() => router.push('/patient/access')} hitSlop={8}>
              <Text className="text-[13px] font-medium text-primary">Manage</Text>
            </Pressable>
          </View>

          {active.length === 0 ? (
            <Card className="items-center gap-2 px-5 py-6">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <Feather name="lock" size={20} color={C.primary} />
              </View>
              <Text className="text-[15px] font-medium text-ink">Your record is private</Text>
              <Text className="max-w-[290px] text-center text-[13px] leading-[19px] text-muted">
                Nobody can see it. When a health worker asks, the request arrives here, and nothing is shared until
                you approve it.
              </Text>
            </Card>
          ) : (
            active.map((session) => (
              <Card key={session.id} className="gap-2.5 p-3.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-primary-soft">
                    <Text className="text-sm font-semibold text-primary">
                      {initials(session.requester?.name ?? '?')}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-medium text-ink">{session.requester?.name ?? 'A provider'}</Text>
                    <Meta>{session.requester?.facility ?? 'Facility not given'}</Meta>
                  </View>
                  {session.grantedUntil ? (
                    <Text className="text-xs font-medium text-ink">{timeLeft(session.grantedUntil)}</Text>
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </View>

        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ink">Your record</Text>
            {claims.length > 0 ? (
              <Pressable onPress={() => router.push('/patient/me')} hitSlop={8}>
                <Text className="text-[13px] font-medium text-primary">See all</Text>
              </Pressable>
            ) : null}
          </View>

          {claims.length === 0 ? (
            <Pressable onPress={() => router.push('/patient/me')}>
              <Card className="gap-3 p-4">
                <Text className="text-[15px] font-medium text-ink">Nothing recorded yet</Text>
                <Text className="text-[13px] leading-[19px] text-muted">
                  A health worker adds to this after a visit. You can add a prescription or a result yourself too —
                  it is kept as self-reported until someone confirms it.
                </Text>
                <View className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
                  <Feather name="plus" size={16} color={C.surface} />
                  <Text className="text-[15px] font-medium text-white">Add something</Text>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/patient/me')}>
              <Card className="gap-3 p-3.5">
                <View className="flex-row flex-wrap gap-2">
                  {recordCounts.map(([category, n]) => (
                    <View
                      key={category}
                      className="flex-row items-center gap-2 rounded-[10px] bg-fill px-2.5 py-2">
                      <Feather name={CATEGORY_ICON[category] ?? 'file-text'} size={14} color={C.ink} />
                      <Text className="text-[13px] text-ink">
                        <Text className="font-semibold">{n}</Text> {nounFor(category, n)}
                      </Text>
                    </View>
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-xs leading-[17px] text-muted">
                    Only you can see this until you approve a request.
                  </Text>
                  <Feather name="chevron-right" size={18} color={C.muted} />
                </View>
              </Card>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => router.push('/patient/history')}>
          <Card className="flex-row items-center gap-3 p-3.5">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-fill">
              <Feather name="eye" size={18} color={C.ink} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-medium text-ink">Who has looked at your record</Text>
              <Meta>Every view is written down, emergency scans included</Meta>
            </View>
            <Feather name="chevron-right" size={18} color={C.muted} />
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
