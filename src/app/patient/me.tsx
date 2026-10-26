import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import ReferralsFlow from '@/features/referrals/ReferralsFlow';
import { C } from '@/components/design/tokens';
import { Chrome, Empty, EntryRow, Pills, Screen, Sheet, StandingLegend, type Standing } from '@/components/design/split';
import { summarise } from '@/features/record/categories';
import AddEntrySheet from '@/features/record/AddEntrySheet';

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

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ALLERGIES', label: 'Allergies' },
  { key: 'CURRENT_MEDICATIONS', label: 'Medicines' },
  { key: 'RECENT_ENCOUNTERS', label: 'Visits' },
  { key: 'LAB_RESULTS', label: 'Labs' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

/** FILTERS predates the shared control, which takes `value`. Mapped once, not per render. */
const FILTER_PILLS = FILTERS.map((f) => ({ value: f.key, label: f.label }));

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

/**
 * A claim's status in the words and colour the rest of the app uses. The screen used to carry
 * its own STATUS_STYLE map, which is how "evidence-backed" ended up looking identical to
 * "confirmed by a clinician" — two different standings reading as the same thing.
 */
function standingOf(claim: Claim): Standing {
  if (claim.category === 'ALLERGIES') return 'ALERT';
  if (claim.status === 'CLINICALLY_VERIFIED') return 'CLINICALLY_VERIFIED';
  if (claim.status === 'EVIDENCE_BACKED') return 'EVIDENCE_BACKED';
  if (claim.status === 'SELF_REPORTED') return 'SELF_REPORTED';
  return 'UNVERIFIED';
}

/** A visit is one thing that happened, not a pile of separate entries. */
function VisitRow({ row, last, onPress }: { row: Extract<Row, { kind: 'VISIT' }>; last: boolean; onPress: () => void }) {
  void last;
  const source = row.claims[0]?.source ?? 'a health worker';
  return (
    <Pressable onPress={onPress}>
      <View className="flex-row gap-3 border-b border-line px-5 py-3">
        <View className="mt-[3px] w-[3px] rounded-full bg-primary" />
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold leading-[20px] tracking-tight text-ink">Visit</Text>
          <Text className="mt-1 text-[12px] font-medium text-primary">Recorded at a visit</Text>
          <Text className="mt-0.5 text-[12px] text-muted">{summarise(row.claims)}</Text>
        </View>
        <Text className="pt-0.5 text-[12px] text-muted">
          {new Date(row.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </Text>
        <Feather name="chevron-right" size={16} color={C.dim} style={{ marginTop: 2 }} />
      </View>
    </Pressable>
  );
}

function TimelineEntry({ claim, last, onPress }: { claim: Claim; last: boolean; onPress: () => void }) {
  void last;
  return (
    <EntryRow
      title={claim.value}
      standing={standingOf(claim)}
      meta={claim.source}
      right={dayOf(claim) || undefined}
      onPress={onPress}
    />
  );
}

function RecordScreen({ onOpenReferrals }: { onOpenReferrals: () => void }) {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The whole record, deliberately unpaged: it has to be readable with no connection, so
      // the app holds all of it. The audit trail is the list that grows without a ceiling,
      // and that one is paged.
      setClaims(await api<Claim[]>('/patients/me/claims'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
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

  return (
    <Screen>
      <Chrome
        title="My record"
        subtitle={claims === null ? undefined : `${claims.length} ${claims.length === 1 ? 'entry' : 'entries'}`}
        right={
          <View className="flex-row gap-2">
            <Pressable
              onPress={onOpenReferrals}
              accessibilityLabel="Share your record"
              className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Feather name="share-2" size={17} color={C.mist} />
            </Pressable>
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityLabel="Add to your record"
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: C.glow }}>
              <Feather name="plus" size={20} color={C.glowInk} />
            </Pressable>
          </View>
        }
      />

      <Sheet pad={false}>
        <View className="pb-1 pt-4">
          <Pills options={FILTER_PILLS} value={filter} onChange={setFilter} />
        </View>

        {error ? <Text className="px-5 pt-3 text-[13px] text-danger">{error}</Text> : null}

        {claims === null ? (
          <View className="py-10">
            <ActivityIndicator color={C.primary} />
          </View>
        ) : grouped.length === 0 ? (
          <View className="px-5 pt-5">
            <Empty
              icon={filter === 'ALL' ? 'file-text' : 'filter'}
              title={filter === 'ALL' ? 'Your record is empty' : 'Nothing in this category'}
              body={
                filter === 'ALL'
                  ? 'Everything here belongs to you, and every entry says how it got here.'
                  : 'Nothing has been recorded under this yet. Try another filter, or add it yourself.'
              }
              hints={
                filter === 'ALL'
                  ? [
                      { icon: 'camera', label: 'Photograph a prescription — the text is read on this phone' },
                      { icon: 'mic', label: 'Speak it, if typing is awkward' },
                      { icon: 'shield', label: 'What you add stays self-reported until a clinician confirms it' },
                    ]
                  : undefined
              }
              action="Add an entry"
              onAction={() => setAdding(true)}
              secondary={filter === 'ALL' ? undefined : 'Show everything'}
              onSecondary={filter === 'ALL' ? undefined : () => setFilter('ALL')}
            />
          </View>
        ) : (
          <>
            {grouped.map(([month, list]) => (
              <View key={month}>
                <Text className="px-5 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-[1.2px] text-muted">
                  {month}
                </Text>
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
            ))}
            {/* A colour system nobody can decode is decoration. */}
            <StandingLegend />
          </>
        )}
      </Sheet>

      {adding ? (
        <AddEntrySheet
          onClose={() => setAdding(false)}
          onAdded={(claim) => setClaims((prev) => [...(prev ?? []), claim])}
        />
      ) : null}
    </Screen>
  );
}

export default function PatientRecordScreen() {
  const [showReferrals, setShowReferrals] = useState(false);
  if (showReferrals) return <ReferralsFlow onClose={() => setShowReferrals(false)} />;
  return <RecordScreen onOpenReferrals={() => setShowReferrals(true)} />;
}
