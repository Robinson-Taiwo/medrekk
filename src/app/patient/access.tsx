import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ActiveAccessSession, PendingAccessRequest } from '@/features/access/accessApi';
import { useAccessRequests } from '@/features/access/useAccessRequests';
import AccessEmpty from '@/features/access/AccessEmpty';
import { explainAccessRequest, plainAccessRequest } from '@/features/ai/explain';
import { Card, Chip, Eyebrow, Meta, PrimaryButton, SecondaryButton } from '@/components/design/primitives';
import type { AccessScope } from '@/types/api';

const LABELS: Record<string, string> = {
  ALLERGIES: 'Allergies',
  CURRENT_MEDICATIONS: 'Current medications',
  RECENT_ENCOUNTERS: 'Recent encounters',
  PAST_MEDICAL_HISTORY: 'Past medical history',
  LAB_RESULTS: 'Lab results',
  REFERRALS: 'Referrals',
  EMERGENCY_INFORMATION: 'Emergency information',
};

const ALL_SCOPES: AccessScope[] = [
  'ALLERGIES',
  'CURRENT_MEDICATIONS',
  'RECENT_ENCOUNTERS',
  'PAST_MEDICAL_HISTORY',
  'LAB_RESULTS',
] as AccessScope[];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function ScopeRow({
  scope,
  requested,
  on,
  onToggle,
}: {
  scope: AccessScope;
  requested: boolean;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={requested ? onToggle : undefined}
      className="flex-row items-center gap-3 border-b border-line py-3">
      <View className="flex-1 gap-0.5">
        <Text className={`text-[15px] font-medium ${requested ? 'text-ink' : 'text-muted'}`}>
          {LABELS[scope] ?? scope}
        </Text>
        <Meta>{requested ? (on ? 'Will be shared' : 'You turned this off') : 'Not requested'}</Meta>
      </View>
      <View className={`h-[26px] w-11 rounded-[13px] p-[3px] ${requested && on ? 'bg-primary' : 'bg-dim'}`}>
        <View className={`h-5 w-5 rounded-[10px] bg-surface ${requested && on ? 'ml-auto' : ''}`} />
      </View>
    </Pressable>
  );
}

function RequestCard({
  item,
  onDecide,
}: {
  item: PendingAccessRequest;
  onDecide: (id: string, decision: 'APPROVE' | 'DENY', scopes?: AccessScope[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<AccessScope[]>(item.requestedScopes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = item.requester?.name ?? 'A provider';
  const role = (item.requester?.role ?? 'provider').toLowerCase().replace(/_/g, ' ');
  const reason = item.requester?.reason ?? 'No reason given';
  const minutes = item.durationMinutes ?? 60;

  const [summary, setSummary] = useState(() =>
    plainAccessRequest({
      name,
      role,
      reason,
      scopes: item.requestedScopes,
      minutes,
    }),
  );
  const [fromModel, setFromModel] = useState(false);

  useEffect(() => {
    let live = true;
    void explainAccessRequest({ name, role, reason, scopes: item.requestedScopes, minutes })
      .then((result) => {
        if (!live) return;
        setSummary(result.text);
        setFromModel(result.fromModel);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [name, role, reason, item.requestedScopes, minutes]);

  const toggle = (scope: AccessScope) =>
    setSelected((prev) => (prev.includes(scope) ? prev.filter((x) => x !== scope) : [...prev, scope]));

  const run = async (decision: 'APPROVE' | 'DENY') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const narrowed = selected.length < item.requestedScopes.length ? selected : undefined;
      await onDecide(item.id, decision, decision === 'APPROVE' ? narrowed : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  const shown = [...item.requestedScopes, ...ALL_SCOPES.filter((s) => !item.requestedScopes.includes(s))];

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-ink">
          <Text className="text-base font-semibold text-white">{initials(name)}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-ink">{name}</Text>
          <Meta>
            {role}
            {item.requester?.facility ? ` · ${item.requester.facility}` : ''}
          </Meta>
        </View>
      </View>

      <Text className="text-[22px] font-semibold leading-7 tracking-tight text-ink">
        Wants to see part of your record
      </Text>

      <View className="gap-2 rounded-xl border border-line bg-fill p-3.5">
        <Text className="text-xs font-medium text-muted">
          {fromModel ? 'Summary written by AI' : 'Summary of the request'}
        </Text>
        <Text className="text-sm leading-[21px] text-ink">{summary}</Text>
      </View>

      <View className="gap-1">
        <Eyebrow>What they can see</Eyebrow>
        {shown.map((scope) => (
          <ScopeRow
            key={scope}
            scope={scope}
            requested={item.requestedScopes.includes(scope)}
            on={selected.includes(scope)}
            onToggle={() => toggle(scope)}
          />
        ))}
      </View>

      <View className="gap-1">
        <Eyebrow>For how long</Eyebrow>
        <Text className="text-[15px] font-medium text-ink">{duration(minutes)} from approval</Text>
        <Meta>You can end access at any time.</Meta>
      </View>

      {error ? <Text className="text-sm text-danger">{error}</Text> : null}

      <View className="flex-row gap-2.5 pt-1">
        <View className="w-[116px]">
          <SecondaryButton label="Decline" onPress={() => void run('DENY')} />
        </View>
        <View className="flex-1">
          <PrimaryButton
            label={`Approve for ${duration(minutes)}`}
            disabled={busy || selected.length === 0}
            onPress={() => void run('APPROVE')}
          />
        </View>
      </View>
    </Card>
  );
}

function ActiveCard({ item, onEnd }: { item: ActiveAccessSession; onEnd: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const scopes = item.approvedScopes ?? item.requestedScopes;
  const name = item.requester?.name ?? 'This provider';

  const confirm = () =>
    Alert.alert('End access?', `${name} will lose access to your record immediately.`, [
      { text: 'Keep access', style: 'cancel' },
      {
        text: 'End access',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void onEnd(item.id).catch(() => setBusy(false));
        },
      },
    ]);

  return (
    <Card className="gap-3 p-3.5">
      <View className="flex-row items-center gap-3">
        <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-primary-soft">
          <Text className="text-sm font-semibold text-primary">{initials(name)}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium text-ink">{name}</Text>
          <Meta>{item.requester?.facility ?? 'Facility not given'}</Meta>
        </View>
        <Pressable
          disabled={busy}
          onPress={confirm}
          className={`h-8 justify-center rounded-[10px] border border-line px-3 ${busy ? 'opacity-50' : ''}`}>
          <Text className="text-[13px] font-medium text-ink">{busy ? 'Ending…' : 'End access'}</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between">
        <Meta>{scopes.map((s) => LABELS[s] ?? s).join(' · ')}</Meta>
        {item.grantedUntil ? (
          <Text className="text-xs font-medium text-ink">
            until {new Date(item.grantedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export default function AccessRequestsScreen() {
  const router = useRouter();
  const { requests, active, error, decide, endAccess } = useAccessRequests();

  if (!error && requests.length === 0 && active.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <AccessEmpty
          onShowCode={() => router.push('/patient/emergency')}
          onHowItWorks={() => router.push('/patient/emergency')}
          onEmergencyCard={() => router.push('/patient/emergency')}
          onHistory={() => router.push('/patient/history')}
          historyValue="None yet"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Text className="text-2xl font-semibold tracking-tight text-ink">Access</Text>
            <Meta>You decide who sees your record, and for how long.</Meta>
            {error ? <Text className="text-sm text-danger">{error}</Text> : null}

            <Text className="pt-2 text-lg font-semibold text-ink">Who can see your record</Text>
            {active.length === 0 ? (
              <Card className="p-4">
                <Text className="text-[15px] text-muted">No one has access right now.</Text>
              </Card>
            ) : (
              <View className="gap-2.5">
                {active.map((s) => (
                  <ActiveCard key={s.id} item={s} onEnd={endAccess} />
                ))}
              </View>
            )}

            <View className="flex-row items-center justify-between pt-3">
              <Text className="text-lg font-semibold text-ink">Pending requests</Text>
              {requests.length > 0 ? <Chip tone="pending">{`${requests.length} waiting`}</Chip> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card className="p-4">
            <Text className="text-[15px] text-muted">No one is asking for access.</Text>
          </Card>
        }
        renderItem={({ item }) => <RequestCard item={item} onDecide={decide} />}
      />
    </SafeAreaView>
  );
}
