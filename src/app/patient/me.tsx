import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { fetchVerifications, type VerificationEventView } from '@/features/verification/verificationApi';
import { api } from '@/services/api';
import ReferralsFlow from '@/features/referrals/ReferralsFlow';
import { Card, Meta } from '@/components/design/primitives';
import { CATEGORY_ICON, summarise } from '@/features/record/categories';
import { BottomTabInset } from '@/constants/theme';

type Category = 'ALLERGIES' | 'CURRENT_MEDICATIONS' | 'PAST_MEDICAL_HISTORY';

const ADD_CATEGORIES: { key: Category; label: string }[] = [
  { key: 'ALLERGIES', label: 'Allergy' },
  { key: 'CURRENT_MEDICATIONS', label: 'Medicine' },
  { key: 'PAST_MEDICAL_HISTORY', label: 'History' },
];

interface Claim {
  id: string;
  category: string;
  value: string;
  status: string;
  source: string;
  lastConfirmedAt?: string;
  verifiedAt?: string;
  encounterId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Unverified',
  SELF_REPORTED: 'Self-reported',
  EVIDENCE_BACKED: 'Evidence-backed',
  CLINICALLY_VERIFIED: 'Verified',
};

/** Status is never colour alone: each one carries a label and an icon. */
const STATUS_STYLE: Record<string, { bg: string; fg: string; icon: keyof typeof Feather.glyphMap }> = {
  UNVERIFIED: { bg: 'bg-neutral-soft', fg: 'text-muted', icon: 'help-circle' },
  SELF_REPORTED: { bg: 'bg-warn-soft', fg: 'text-warn', icon: 'user' },
  EVIDENCE_BACKED: { bg: 'bg-primary-soft', fg: 'text-primary', icon: 'paperclip' },
  CLINICALLY_VERIFIED: { bg: 'bg-primary-soft', fg: 'text-primary', icon: 'check' },
};

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ALLERGIES', label: 'Allergies' },
  { key: 'CURRENT_MEDICATIONS', label: 'Medicines' },
  { key: 'RECENT_ENCOUNTERS', label: 'Visits' },
  { key: 'LAB_RESULTS', label: 'Labs' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function monthOf(claim: Claim): string {
  const iso = claim.verifiedAt ?? claim.lastConfirmedAt;
  if (!iso) return 'Undated';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** The same month heading as monthOf, for a visit row that carries a timestamp rather than a claim. */
function monthOfTime(at: number): string {
  if (!at) return 'Undated';
  return new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function dayOf(claim: Claim): string {
  const iso = claim.verifiedAt ?? claim.lastConfirmedAt;
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A timeline row is either one visit with the items it produced, or a single standalone claim. */
type Row =
  | { kind: 'VISIT'; encounterId: string; claims: Claim[]; at: number }
  | { kind: 'CLAIM'; claim: Claim; at: number };

function VisitRow({ row, last, onPress }: { row: Extract<Row, { kind: 'VISIT' }>; last: boolean; onPress: () => void }) {
  const source = row.claims[0]?.source ?? 'a health worker';

  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft">
          <Feather name="file-text" size={16} color="#0F6E56" />
        </View>
        {last ? null : <View className="w-px flex-1 bg-line" />}
      </View>

      <Pressable onPress={onPress} className="mb-2.5 flex-1">
        <Card className="flex-row items-center gap-3 px-3.5 py-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-medium text-ink">Visit</Text>
            <Meta>
              {new Date(row.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {source}
            </Meta>
            <Meta>{summarise(row.claims)}</Meta>
          </View>
          <Feather name="chevron-right" size={18} color="#5D6C82" />
        </Card>
      </Pressable>
    </View>
  );
}

function TimelineEntry({ claim, last, onPress }: { claim: Claim; last: boolean; onPress: () => void }) {
  const style = STATUS_STYLE[claim.status] ?? STATUS_STYLE.UNVERIFIED;
  const day = dayOf(claim);

  return (
    <View className="flex-row gap-3">
      <View className="w-[38px] items-center">
        <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-fill">
          <Feather name={CATEGORY_ICON[claim.category] ?? 'file-text'} size={18} color="#142D2A" />
        </View>
        {last ? null : <View className="mt-1.5 w-px flex-1 bg-line" />}
      </View>

      <Pressable onPress={onPress} className="mb-2.5 flex-1">
        <Card className="gap-1.5 px-3.5 py-3">
        <Text className="text-[15px] font-medium text-ink">{claim.value}</Text>
        <Meta>
          {day ? `${day} · ` : ''}
          {claim.source}
        </Meta>
        <View className={`h-6 flex-row items-center gap-1.5 self-start rounded-full px-2.5 ${style.bg}`}>
          <Feather
            name={style.icon}
            size={11}
            color={style.fg === 'text-primary' ? '#0F6E56' : style.fg === 'text-warn' ? '#B45309' : '#5D6C82'}
          />
          <Text className={`text-xs font-medium ${style.fg}`}>{STATUS_LABEL[claim.status] ?? claim.status}</Text>
        </View>
        </Card>
      </Pressable>
    </View>
  );
}

function AddSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (claim: Claim) => void }) {
  const [category, setCategory] = useState<Category>('ALLERGIES');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (busy || value.trim().length === 0) return;
    setBusy(true);
    try {
      const created = await api<Claim>('/patients/me/claims', {
        method: 'POST',
        body: { category, value: value.trim() },
      });
      onAdded(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="gap-3 rounded-t-3xl bg-canvas p-5 pb-9">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ink">Add to your record</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color="#5D6C82" />
            </Pressable>
          </View>

          <View className="flex-row rounded-xl bg-track p-[3px]">
            {ADD_CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                className={`h-9 flex-1 items-center justify-center rounded-[10px] ${
                  category === c.key ? 'border border-line bg-surface' : ''
                }`}>
                <Text className={`text-[13px] ${category === c.key ? 'font-medium text-ink' : 'text-muted'}`}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
            placeholder="e.g. Penicillin"
            placeholderTextColor="#7C8A9C"
            value={value}
            onChangeText={setValue}
            autoFocus
            onSubmitEditing={() => void add()}
          />

          {error ? <Text className="text-sm text-danger">{error}</Text> : null}

          <Pressable
            onPress={() => void add()}
            disabled={busy || value.trim().length === 0}
            className={`h-[52px] items-center justify-center rounded-xl ${
              busy || value.trim().length === 0 ? 'bg-track' : 'bg-primary'
            }`}>
            <Text
              className={`text-base font-medium ${
                busy || value.trim().length === 0 ? 'text-muted' : 'text-white'
              }`}>
              Add
            </Text>
          </Pressable>
          <Meta>This is saved as self-reported until a health worker confirms it.</Meta>
        </View>
      </View>
    </Modal>
  );
}

function RecordScreen({ onOpenReferrals }: { onOpenReferrals: () => void }) {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [events, setEvents] = useState<VerificationEventView[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setClaims(await api<Claim[]>('/patients/me/claims'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    try {
      setEvents(await fetchVerifications());
    } catch {
      setEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const list = (claims ?? []).filter((c) => filter === 'ALL' || c.category === filter);
    const timeOf = (c: Claim) => Date.parse(c.verifiedAt ?? c.lastConfirmedAt ?? '') || 0;

    // Only the unfiltered view groups by visit: choosing "Medicines" means you want the medicines,
    // not the visits that happened to contain some.
    const rows: Row[] = [];
    if (filter === 'ALL') {
      const visits = new Map<string, Claim[]>();
      for (const claim of list) {
        if (!claim.encounterId) {
          rows.push({ kind: 'CLAIM', claim, at: timeOf(claim) });
          continue;
        }
        visits.set(claim.encounterId, [...(visits.get(claim.encounterId) ?? []), claim]);
      }
      for (const [encounterId, group] of visits) {
        rows.push({ kind: 'VISIT', encounterId, claims: group, at: Math.max(...group.map(timeOf)) });
      }
    } else {
      for (const claim of list) rows.push({ kind: 'CLAIM', claim, at: timeOf(claim) });
    }

    rows.sort((a, b) => b.at - a.at);

    const months = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.kind === 'CLAIM' ? monthOf(row.claim) : monthOfTime(row.at);
      months.set(key, [...(months.get(key) ?? []), row]);
    }
    return [...months.entries()];
  }, [claims, filter]);

  void events;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-semibold tracking-tight text-ink">My record</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={onOpenReferrals}
              className="h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-surface">
              <Feather name="share-2" size={18} color="#142D2A" />
            </Pressable>
            <Pressable
              onPress={() => setAdding(true)}
              className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
              <Feather name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`h-8 justify-center rounded-full px-3.5 ${
                  active ? 'bg-ink' : 'border border-line bg-surface'
                }`}>
                <Text className={`text-[13px] ${active ? 'text-white' : 'text-muted'}`}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}

        {claims === null ? (
          <ActivityIndicator />
        ) : grouped.length === 0 ? (
          <View className="items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-5 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-fill">
              <Feather name="file-text" size={22} color="#5D6C82" />
            </View>
            <Text className="text-[17px] font-semibold text-ink">
              {filter === 'ALL' ? 'Nothing recorded yet' : 'Nothing in this category'}
            </Text>
            <Text className="max-w-[280px] text-center text-sm leading-5 text-muted">
              {filter === 'ALL'
                ? 'Add your allergies and medicines, or let a health worker record a visit for you.'
                : 'Try another filter, or add something yourself.'}
            </Text>
          </View>
        ) : (
          grouped.map(([month, list]) => (
            <View key={month} className="gap-2.5">
              <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">{month}</Text>
              {list.map((row, index) =>
                row.kind === 'VISIT' ? (
                  <VisitRow
                    key={row.encounterId}
                    row={row}
                    last={index === list.length - 1}
                    onPress={() => router.push(`/patient/visit/${row.encounterId}`)}
                  />
                ) : (
                  <TimelineEntry
                    key={row.claim.id}
                    claim={row.claim}
                    last={index === list.length - 1}
                    onPress={() => router.push(`/patient/claim/${row.claim.id}`)}
                  />
                ),
              )}
            </View>
          ))
        )}
      </ScrollView>

      {adding ? (
        <AddSheet
          onClose={() => setAdding(false)}
          onAdded={(claim) => setClaims((prev) => [...(prev ?? []), claim])}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function PatientRecordScreen() {
  const [showReferrals, setShowReferrals] = useState(false);
  if (showReferrals) return <ReferralsFlow onClose={() => setShowReferrals(false)} />;
  return <RecordScreen onOpenReferrals={() => setShowReferrals(true)} />;
}
