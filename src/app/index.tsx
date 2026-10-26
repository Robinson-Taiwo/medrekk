import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import WorkerHome from '@/features/worker/WorkerHome';
import { useAccessRequests } from '@/features/access/useAccessRequests';
import { fetchWithCache } from '@/offline/cachedFetch';
import { api } from '@/services/api';
import { PROFILE_PATH, type EmergencyProfileData } from '@/features/emergency/types';
import { Card, Meta } from '@/components/design/primitives';
import { C } from '@/components/design/tokens';
import { Callout, Chrome, ChromeTag, Empty, Heading, Note, Screen, Sheet } from '@/components/design/split';
import { CATEGORY_ICON, countByCategory, nounFor } from '@/features/record/categories';

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

/** One fact on the dark chrome. Three of them read as a passport without needing a frame. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-xl bg-white/[0.07] px-3 py-2">
      <Text className="text-[10.5px] text-mist-faint">{label}</Text>
      <Text className="text-[15px] font-semibold text-mist">{value}</Text>
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
    <Screen>
      {/* The passport lives in the chrome. It is who you are, not an item in your record, so
          it belongs to the frame rather than sitting in a card among the things you own. */}
      <Chrome
        title={`${greeting()} ${firstName(name)}`.trim()}
        subtitle={me?.medrekkCode ? `MedRekk code · ${me.medrekkCode}` : undefined}
        right={<ChromeTag label={online === false ? 'Offline' : 'Synced'} tone={online === false ? 'warn' : 'ok'} />}
      />
      <View className="flex-row gap-2 px-5 pb-4">
        <Stat label="Blood group" value={profile?.bloodGroup ?? '—'} />
        <Stat label="Allergies" value={String(profile?.criticalAllergies.length ?? 0)} />
        <Stat label="Conditions" value={String(profile?.criticalConditions.length ?? 0)} />
      </View>

      <Sheet
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.muted}
            onRefresh={() => {
              setRefreshing(true);
              void Promise.all([load(), loadAllergies(), loadUssd(), ping()]).finally(() => setRefreshing(false));
            }}
          />
        }>
        {pending ? (
          <Callout
            kicker="Waiting for you"
            title={`${pending.requester?.name ?? 'A provider'} wants to read your record`}
            action="Review the request"
            onAction={() => router.push('/patient/access')}>
            <Note>
              {pending.requester?.facility ? `${pending.requester.facility} · ` : ''}
              {pending.requestedScopes.length} {pending.requestedScopes.length === 1 ? 'area' : 'areas'} asked for
            </Note>
          </Callout>
        ) : null}

        {awaitingEmergency ? (
          <Callout tone="danger" kicker="Your decision" title="Add this to your emergency card?">
            <Note>A health worker recorded that you are allergic to {awaitingEmergency.value}.</Note>
            <Text className="rounded-xl bg-white/60 px-3 py-2.5 text-[12px] leading-[17px] text-muted">
              Anyone who scans your emergency QR can read what is on that card, without needing your approval. Only
              put something there if you want it seen in an emergency.
            </Text>
            <View className="mt-1 flex-row gap-2">
              <Pressable
                onPress={() => void decideEmergency(awaitingEmergency.id, false)}
                disabled={deciding}
                className="h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface">
                <Text className="text-[14px] font-medium text-ink">Not now</Text>
              </Pressable>
              <Pressable
                onPress={() => void decideEmergency(awaitingEmergency.id, true)}
                disabled={deciding}
                className={`h-11 flex-1 items-center justify-center rounded-xl bg-danger ${deciding ? 'opacity-50' : ''}`}>
                <Text className="text-[14px] font-semibold text-white">Add it</Text>
              </Pressable>
            </View>
          </Callout>
        ) : null}

        {setupDone < setupSteps.length ? (
          <View className="gap-2.5">
            <Heading
              right={
                <Text className="text-[12px] text-muted">
                  {setupDone} of {setupSteps.length} done
                </Text>
              }>
              Finish setting up
            </Heading>
            <Card className="divide-y divide-line overflow-hidden">
              {setupSteps.map((step) => (
                <SetupStep key={step.title} {...step} />
              ))}
            </Card>
          </View>
        ) : null}

        <View className="gap-2.5">
          <Heading
            right={
              <Pressable onPress={() => router.push('/patient/access')} hitSlop={8}>
                <Text className="text-[13px] font-medium text-primary">Manage</Text>
              </Pressable>
            }>
            Who can see your record
          </Heading>

          {active.length === 0 ? (
            <Empty
              icon="lock"
              title="Your record is private"
              body="Nobody can see it right now. When a health worker asks, the request arrives here and nothing is shared until you say yes."
              hints={[
                { icon: 'user-check', label: 'You will see who is asking, where they work and why' },
                { icon: 'sliders', label: 'You can approve less than they asked for' },
                { icon: 'clock', label: 'Access ends by itself, and you can end it sooner' },
              ]}
            />
          ) : (
            active.map((session) => (
              <Card key={session.id} className="flex-row items-center gap-3 p-3.5">
                <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary-soft">
                  <Text className="text-[13px] font-semibold text-primary">
                    {initials(session.requester?.name ?? '?')}
                  </Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[14px] font-semibold text-ink">{session.requester?.name ?? 'A provider'}</Text>
                  <Meta>{session.requester?.facility ?? 'Facility not given'}</Meta>
                </View>
                {session.grantedUntil ? (
                  <Text className="text-[12px] font-semibold text-ink">{timeLeft(session.grantedUntil)}</Text>
                ) : null}
              </Card>
            ))
          )}
        </View>

        <View className="gap-2.5">
          <Heading
            right={
              claims.length > 0 ? (
                <Pressable onPress={() => router.push('/patient/me')} hitSlop={8}>
                  <Text className="text-[13px] font-medium text-primary">See all</Text>
                </Pressable>
              ) : undefined
            }>
            Your record
          </Heading>

          {claims.length === 0 ? (
            <Empty
              icon="plus-circle"
              title="Your record is empty"
              body="It fills up as you use it — by you, and by any health worker you let in."
              hints={[
                { icon: 'camera', label: 'Photograph a prescription or a printed result' },
                { icon: 'mic', label: 'Say an allergy out loud instead of typing it' },
                { icon: 'file-text', label: 'A visit a health worker records lands here too' },
              ]}
              action="Add your first entry"
              onAction={() => router.push('/patient/me')}
            />
          ) : (
            <Pressable onPress={() => router.push('/patient/me')}>
              <Card className="gap-3 p-3.5">
                {/* Counts, never values: this is the screen most likely to be read over a shoulder. */}
                <View className="flex-row flex-wrap gap-2">
                  {recordCounts.map(([category, n]) => (
                    <View key={category} className="flex-row items-center gap-2 rounded-xl bg-fill px-2.5 py-2">
                      <Feather name={CATEGORY_ICON[category] ?? 'file-text'} size={14} color={C.ink} />
                      <Text className="text-[13px] text-ink">
                        <Text className="font-semibold">{n}</Text> {nounFor(category, n)}
                      </Text>
                    </View>
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-[12px] leading-[17px] text-muted">
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
            <View className="h-[38px] w-[38px] items-center justify-center rounded-xl bg-fill">
              <Feather name="eye" size={18} color={C.ink} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[14px] font-semibold text-ink">Who has looked at your record</Text>
              <Meta>Every view is written down, emergency scans included</Meta>
            </View>
            <Feather name="chevron-right" size={18} color={C.muted} />
          </Card>
        </Pressable>
      </Sheet>
    </Screen>
  );
}
