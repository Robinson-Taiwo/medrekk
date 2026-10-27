import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { fetchWithCache } from '@/offline/cachedFetch';
import ReferralsFlow from '@/features/referrals/ReferralsFlow';
import { C } from '@/components/design/tokens';
import { Chrome, Empty, EntryRow, Pills, Screen, Sheet, StandingLegend, type Standing } from '@/components/design/split';
import { CATEGORY_ICON, nounFor } from '@/features/record/categories';
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

/**
 * When the copy on this phone was taken, in the terms somebody actually thinks in. An exact
 * timestamp invites arithmetic; "earlier today" answers the only question being asked, which is
 * whether this is recent enough to rely on.
 */
function savedFrom(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'earlier';
  const minutes = Math.round(ms / 60000);
  if (minutes < 2) return 'a moment ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function dayOf(claim: Claim): string {
  const iso = claim.verifiedAt ?? claim.lastConfirmedAt;
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * A document on the record, as the list needs it. The full text lives on the encounter and is
 * fetched when the row is opened; `preview` is enough to render a row without a second request.
 */
interface Entry {
  id: string;
  authoredBy: 'PATIENT' | 'WORKER';
  captureMethod: string;
  recordedByName: string;
  recordedByFacility: string | null;
  recordedAt: string;
  claimIds: string[];
  preview: string;
  hasImage: boolean;
  origin?: { facility?: string; clinician?: string; documentDate?: string };
}

/**
 * A timeline row is either a document with whatever was found inside it, or a single claim that
 * belongs to no document.
 *
 * Rows used to be built only from claims, grouping them by encounterId — so a document existed on
 * the timeline only if something had been extracted from it, and a scan the extractor made nothing
 * of disappeared entirely. The document now comes from the document list and the claims hang off
 * it, which is the right way round.
 */
type Row =
  | { kind: 'DOC'; entry: Entry; claims: Claim[]; at: number }
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

/** How the document got here, in one word and one glyph. */
const CAPTURE: Record<string, { icon: keyof typeof Feather.glyphMap; word: string }> = {
  PHOTO: { icon: 'camera', word: 'Scanned' },
  VOICE: { icon: 'mic', word: 'Dictated' },
  TEXT: { icon: 'edit-3', word: 'Typed' },
};

/** The categories inside a document, each with a count. The index into what you are about to open. */
function InsideTags({ claims }: { claims: Claim[] }) {
  const counts = new Map<string, number>();
  for (const c of claims) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  if (counts.size === 0) return null;
  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5">
      {[...counts.entries()].map(([category, n]) => (
        <View key={category} className="flex-row items-center gap-1.5 rounded-lg bg-fill px-2 py-1">
          <Feather name={CATEGORY_ICON[category] ?? 'file-text'} size={11} color={C.muted} />
          <Text className="text-[11.5px] text-ink">
            <Text className="font-semibold">{n}</Text> {nounFor(category, n)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A document, as a card rather than a list row.
 *
 * The list used to render every document as the word "Visit" over a one-line summary, which gave
 * six identical rows no matter what they held. A document is the thing with substance on this
 * screen — it has a source, a date on the paper, words in it and things found inside — so it gets
 * the weight, and single claims stay as quiet rows beneath.
 */
function DocRow({ row, onPress }: { row: Extract<Row, { kind: 'DOC' }>; onPress: () => void }) {
  const { entry } = row;
  const capture = CAPTURE[entry.captureMethod] ?? CAPTURE.TEXT;
  const mine = entry.authoredBy === 'PATIENT';
  const facility = entry.origin?.facility ?? entry.recordedByFacility ?? undefined;

  return (
    <Pressable onPress={onPress} className="px-4 pb-2.5">
      {/*
        Borderless, lifted, with the capture tile grown into a real leading block.
        
        A bordered card inside a list of bordered cards draws a line around every item; the
        shadow does the separating instead, and the page tint behind does the rest.
      */}
      <View
        className="overflow-hidden rounded-2xl bg-surface"
        style={{
          shadowColor: '#0B1A17',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}>
        <View className="flex-row items-center gap-2.5 px-3.5 pb-2 pt-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
            <Feather name={capture.icon} size={15} color={C.primary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[13px] font-semibold text-ink">
              {facility ?? (mine ? 'Your document' : entry.recordedByName)}
            </Text>
            <Text numberOfLines={1} className="text-[11px] text-muted">
              {capture.word} {mine ? 'by you' : `by ${entry.recordedByName}`}
              {entry.origin?.documentDate ? ` · dated ${entry.origin.documentDate}` : ''}
            </Text>
          </View>
          {entry.hasImage ? <Feather name="paperclip" size={13} color={C.dim} /> : null}
          <Text className="text-[11.5px] text-muted">
            {new Date(row.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Text>
        </View>

        <View className="px-3.5 pb-3.5 pt-1">
          {/* The document's own words, not a label describing it. Three lines is enough to
              recognise which one this is without opening it. */}
          {entry.preview.length > 0 ? (
            <Text numberOfLines={3} className="text-[13.5px] leading-[19px] text-ink">
              {entry.preview}
            </Text>
          ) : (
            <Text className="text-[13px] text-muted">
              {row.claims.length === 1 ? 'One thing was recorded here.' : `${row.claims.length} things were recorded here.`}
            </Text>
          )}
          <InsideTags claims={row.claims} />
          <View className="mt-2.5 flex-row items-center gap-1">
            <Text className="text-[12px] font-medium text-primary">
              {row.claims.length === 0 ? 'Open document' : 'Read it in full'}
            </Text>
            <Feather name="chevron-right" size={14} color={C.primary} />
          </View>
        </View>
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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The whole record, deliberately unpaged: it has to be readable with no connection, so
      // the app holds all of it. The audit trail is the list that grows without a ceiling,
      // and that one is paged.
      //
      // Fetched through the cache rather than the bare client, which is what that sentence was
      // always describing and never did: the record arrived unpaged for the sake of offline and
      // was then thrown away, so a phone with no signal showed an error over an empty list.
      // The documents are fetched beside the claims, never with them.
      //
      // These were one Promise.all, which meant a server that does not serve /entries yet — an
      // older deployment, a staged rollout — failed the whole screen with "Route not found" and
      // an endless spinner, when the claims it did return were right there. The record is the
      // thing that must always render; documents enrich it.
      const claimResult = await fetchWithCache<Claim[]>('claims', '/patients/me/claims');
      setClaims(claimResult.data);
      setSavedAt(claimResult.fromCache ? claimResult.savedAt : null);
      setError(null);

      try {
        const entryResult = await fetchWithCache<Entry[]>('entries', '/patients/me/entries');
        setEntries(entryResult.data);
      } catch {
        // No document list from this server. Claims carrying an encounterId still group
        // themselves below, so the timeline degrades to what it was rather than breaking.
        setEntries([]);
      }
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

    // Only the unfiltered view shows documents: choosing "Medicines" means you want the medicines,
    // not the documents that happened to contain some.
    const rows: Row[] = [];
    if (filter === 'ALL') {
      const byEncounter = new Map<string, Claim[]>();
      for (const claim of list) {
        if (!claim.encounterId) {
          rows.push({ kind: 'CLAIM', claim, at: timeOf(claim) });
          continue;
        }
        byEncounter.set(claim.encounterId, [...(byEncounter.get(claim.encounterId) ?? []), claim]);
      }

      // Driven by the document list, so one with nothing extracted still gets a row. Its own
      // recordedAt orders it, rather than the timestamps of claims it may not have.
      for (const entry of entries) {
        rows.push({
          kind: 'DOC',
          entry,
          claims: byEncounter.get(entry.id) ?? [],
          at: Date.parse(entry.recordedAt) || 0,
        });
        byEncounter.delete(entry.id);
      }

      // Claims pointing at a document the list did not return — an older row, a server with no
      // /entries, or one still syncing. The document is reconstructed from the claims rather
      // than letting one report scatter into three unrelated rows.
      for (const [encounterId, group] of byEncounter) {
        const at = Math.max(...group.map(timeOf));
        rows.push({
          kind: 'DOC',
          entry: {
            id: encounterId,
            authoredBy: group[0]?.source === 'Patient' ? 'PATIENT' : 'WORKER',
            captureMethod: 'TEXT',
            recordedByName: group[0]?.source ?? 'A health worker',
            recordedByFacility: null,
            recordedAt: new Date(at).toISOString(),
            claimIds: group.map((c) => c.id),
            // No preview without the document itself; the tags below carry the row instead.
            preview: '',
            hasImage: false,
          },
          claims: group,
          at,
        });
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
  }, [claims, entries, filter]);

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

        {/*
          Three different situations, and they used to read as one. A record served from the
          cache is not a fault — it is the app doing the thing it promises — so it says when the
          copy is from and stays out of the way. An error only shows when there is nothing to
          show, because an alarming red line above a perfectly good list is just noise.
        */}
        {savedAt ? (
          <View className="mx-5 mt-3 flex-row items-center gap-2 rounded-xl bg-fill px-3 py-2">
            <Feather name="download-cloud" size={14} color={C.muted} />
            <Text className="flex-1 text-[12px] leading-[17px] text-muted">
              Saved copy from {savedFrom(savedAt)}. It will update when you are back online.
            </Text>
          </View>
        ) : error && claims === null ? (
          <Text className="px-5 pt-3 text-[13px] text-danger">{error}</Text>
        ) : null}

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
                  row.kind === 'DOC' ? (
                    <DocRow
                      key={row.entry.id}
                      row={row}
                      onPress={() => router.push(`/patient/visit/${row.entry.id}`)}
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
          // One capture can produce several claims and always produces a document, so the
          // screen asks the server what it now holds rather than guessing from the response.
          onAdded={() => void load()}
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
