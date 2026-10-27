import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { api } from "@/services/api";
import { fetchWithCache } from "@/offline/cachedFetch";
import { Chrome, Screen, Sheet } from '@/components/design/split';
import Feather from '@expo/vector-icons/Feather';
import { C } from '@/components/design/tokens';
import { BottomTabInset } from '@/constants/theme';

interface AuditEntry {
  id: string;
  type: string;
  accessType?: string;
  occurredAt: string;
  sessionId?: string;
  requesterIdentifier?: string;
  reason?: string;
  informationViewed?: string[];
}

const LABEL: Record<string, { title: string; dot: string }> = {
  ACCESS_SESSION_STARTED: { title: "Someone looked you up", dot: "bg-dim" },
  ACCESS_REQUESTED: { title: "Access requested", dot: "bg-warn" },
  ACCESS_APPROVED: { title: "You approved access", dot: "bg-primary" },
  ACCESS_DENIED: { title: "You denied access", dot: "bg-danger" },
  RECORD_VIEWED: { title: "Record viewed", dot: "bg-evidence" },
  EVIDENCE_ADDED: { title: "Evidence added to an item", dot: "bg-evidence" },
  CLAIM_VERIFIED: { title: "An item was clinically verified", dot: "bg-primary" },
  EMERGENCY_PROFILE_VERIFIED: { title: "Emergency profile verified", dot: "bg-primary" },
  EMERGENCY_ACCESSED: { title: "Emergency profile opened", dot: "bg-danger" },
  REFERRAL_CREATED: { title: "You created a referral", dot: "bg-evidence" },
  REFERRAL_VIEWED: { title: "A referral was opened", dot: "bg-evidence" },
  REFERRAL_REVOKED: { title: "You cancelled a referral", dot: "bg-dim" },
  ACCESS_REVOKED: { title: "You ended someone's access", dot: "bg-dim" },
  ACCESS_RELEASED: { title: "A health worker gave access back", dot: "bg-dim" },
  CLAIM_REMOVED: { title: "You removed an item from your record", dot: "bg-dim" },
  ENCOUNTER_RECORDED: { title: "A health worker started a note", dot: "bg-warn" },
  ENCOUNTER_REVIEWED: { title: "A health worker added items to your record", dot: "bg-evidence" },
  ENCOUNTER_DISCARDED: { title: "A health worker discarded a note", dot: "bg-dim" },
};

const pretty = (s: string): string => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Entry({ item }: { item: AuditEntry }) {
  const meta = LABEL[item.type] ?? { title: pretty(item.type), dot: "bg-dim" };
  const viewed = item.informationViewed && item.informationViewed.length > 0 ? item.informationViewed.map(pretty).join(", ") : null;
  return (
    <View className="gap-1 rounded-2xl border border-line bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <View className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
        <Text className="flex-1 text-base font-semibold text-ink">{meta.title}</Text>
      </View>
      <Text className="text-xs text-muted">{new Date(item.occurredAt).toLocaleString()}</Text>
      {item.requesterIdentifier ? (
        <Text className="text-sm text-ink">By: {item.requesterIdentifier}</Text>
      ) : null}
      {viewed ? <Text className="text-sm text-ink">Information: {viewed}</Text> : null}
      {item.reason ? <Text className="text-sm text-ink">Reason: {item.reason}</Text> : null}
    </View>
  );
}

/** One screenful and a bit, so the first page fills the view without a visible second fetch. */
const PAGE = 25;

/**
 * How much of the trail this phone keeps for reading with no signal.
 *
 * Deeper than one page, because the offline copy is not a preview of the trail — it is the trail,
 * for as long as the connection is gone. Somebody offline for a day should see the same history
 * on the last look as on the first.
 */
const OFFLINE_KEEP = 60;

/** Which audit types belong to each filter. Mirrors AUDIT_GROUPS on the server, so the same
 *  filter gives the same answer whether it is applied there or here. */
const GROUP_TYPES: Record<Exclude<GroupKey, 'all'>, readonly string[]> = {
  views: ['RECORD_VIEWED', 'EMERGENCY_ACCESSED', 'USSD_ACCESSED', 'REFERRAL_VIEWED'],
  access: [
    'ACCESS_SESSION_STARTED',
    'ACCESS_REQUESTED',
    'ACCESS_APPROVED',
    'ACCESS_DENIED',
    'ACCESS_REVOKED',
    'ACCESS_RELEASED',
    'ACCESS_RESUMED',
  ],
  changes: [
    'EVIDENCE_ADDED',
    'CLAIM_VERIFIED',
    'CLAIM_REMOVED',
    'EMERGENCY_PROFILE_VERIFIED',
    'EMERGENCY_CARD_UPDATED',
    'ENCOUNTER_RECORDED',
    'ENCOUNTER_REVIEWED',
    'ENCOUNTER_DISCARDED',
  ],
  sharing: ['REFERRAL_CREATED', 'REFERRAL_REVOKED'],
};

/**
 * The questions people actually open this screen to ask, in their words. The group names are
 * the server's — it owns what each one contains, so a new event type cannot end up visible
 * under no filter.
 */
const GROUPS = [
  { value: 'all', label: 'Everything' },
  { value: 'views', label: 'Who looked' },
  { value: 'access', label: 'Permissions' },
  { value: 'changes', label: 'Changes' },
  { value: 'sharing', label: 'Referrals' },
] as const;
type GroupKey = (typeof GROUPS)[number]['value'];

const RANGES = [
  { value: 'all', label: 'All time', days: 0 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
] as const;
type RangeKey = (typeof RANGES)[number]['value'];

/** Built here rather than sent as a day count, so the server is never guessing a timezone. */
function sinceFor(range: RangeKey): string | null {
  const days = RANGES.find((r) => r.value === range)?.days ?? 0;
  if (days === 0) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface AuditPage {
  items: AuditEntry[];
  nextCursor?: string;
}

/**
 * The route used to return a bare array and now returns a page.
 *
 * A phone is not updated at the same instant as the server — an installed build keeps talking
 * to whatever is deployed, and for a while that is the old shape. Reading `.items` off an
 * array gives undefined, which left this screen on its loading spinner forever with no error
 * to explain it. Accepting both costs four lines and removes a whole class of "it hangs after
 * you deploy" that nobody can diagnose from the outside.
 */
function asPage(body: AuditPage | AuditEntry[]): AuditPage {
  if (Array.isArray(body)) {
    // An older server sent everything and did not sort. Order it here, once.
    const items = [...body].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    return { items };
  }
  return { items: body.items ?? [], nextCursor: body.nextCursor };
}

/**
 * One row of choices. Solid ink when chosen rather than an outline, so the active filter is
 * legible at arm's length and in sunlight — the same treatment the record uses.
 */
function FilterRow<T extends string>({
  options,
  value,
  onChange,
  subdued = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  subdued?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`justify-center rounded-xl px-3 ${subdued ? 'h-8' : 'h-9'} ${
              active ? (subdued ? 'bg-primary-soft' : 'bg-ink') : 'bg-fill'
            }`}>
            <Text
              className={`${subdued ? 'text-[12px]' : 'text-[13px]'} font-medium ${
                active ? (subdued ? 'text-primary' : 'text-white') : 'text-muted'
              }`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function HistoryScreen() {
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  /**
   * The in-flight guard has to be a ref, not state.
   *
   * Two taps, or a scroll that fires onEndReached twice in one tick, both read `loadingMore`
   * before React had re-rendered with it set — so both fetched the same cursor and appended
   * the same page twice. That is where "two children with the same key" came from. A ref is
   * written synchronously, so the second caller sees it immediately.
   */
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [group, setGroup] = useState<GroupKey>('all');
  const [range, setRange] = useState<RangeKey>('all');
  const [offline, setOffline] = useState(false);

  /** Every request carries the filters, including the ones for later pages. */
  const query = useCallback(
    (extra?: string) => {
      const parts = [`limit=${PAGE}`];
      if (group !== 'all') parts.push(`group=${group}`);
      const since = sinceFor(range);
      if (since) parts.push(`since=${encodeURIComponent(since)}`);
      if (extra) parts.push(extra);
      return `/patients/me/audit?${parts.join('&')}`;
    },
    [group, range],
  );

  /**
   * The trail gains a row for every view, every emergency scan and every dial-in, so it is
   * read a page at a time. The server orders it newest first; sorting here as well would be
   * sorting a page rather than the trail, which looks right and is not.
   */
  /**
   * Only the first page is cached, and only the unfiltered one. That page is the answer to "has
   * anybody opened my record", which is worth having on a phone with no signal; the pages behind
   * it are a trail somebody is deliberately walking back through, and that needs the server.
   *
   * Caching per filter combination would fill the table with near-duplicates of the same rows,
   * so a filtered view offline shows nothing rather than something subtly wrong.
   */
  const unfiltered = group === 'all' && range === 'all';

  /** The cached slice of the trail, filtered here rather than on a server we cannot reach. */
  const fromCache = useCallback(async (): Promise<AuditEntry[] | null> => {
    try {
      const cached = await fetchWithCache<AuditPage | AuditEntry[]>(
        'audit-offline',
        `/patients/me/audit?limit=${OFFLINE_KEEP}`,
      );
      const all = asPage(cached.data).items;
      const types = group === 'all' ? null : GROUP_TYPES[group];
      const since = sinceFor(range);
      const after = since ? Date.parse(since) : null;
      return all.filter(
        (e) =>
          (!types || types.includes(e.type)) &&
          (after === null || Date.parse(e.occurredAt) >= after),
      );
    } catch {
      return null;
    }
  }, [group, range]);

  /**
   * Live where possible, from the kept copy where not — including with a filter applied.
   *
   * Filtering used to go to the server unconditionally, so a filter tapped with no signal failed,
   * and because a filter change clears the list first, going back to Everything left the screen
   * empty as well. A trail already sitting on the handset can be filtered on the handset; the
   * only thing a filtered view genuinely needs the network for is the pages behind the kept
   * slice, and those announce themselves by their absence rather than by an error.
   */
  const load = useCallback(async () => {
    try {
      const body = unfiltered
        ? (
            await fetchWithCache<AuditPage | AuditEntry[]>(
              'audit-offline',
              `/patients/me/audit?limit=${OFFLINE_KEEP}`,
            )
          ).data
        : await api<AuditPage | AuditEntry[]>(query());
      const page = asPage(body);
      inFlight.current = false;
      setItems(page.items);
      setCursor(page.nextCursor);
      setOffline(false);
      setError(null);
    } catch (e) {
      const kept = await fromCache();
      if (kept) {
        inFlight.current = false;
        setItems(kept);
        setCursor(undefined); // there is no next page without a connection
        setOffline(true);
        setError(null);
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [query, unfiltered, fromCache]);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = asPage(await api<AuditPage | AuditEntry[]>(query(`cursor=${encodeURIComponent(cursor)}`)));
      // Deduplicated on the way in as well. The cursor should make this impossible, but an
      // access log is the last place to show somebody the same event twice, so it is checked
      // rather than assumed.
      setItems((prev) => {
        const held = new Set((prev ?? []).map((e) => e.id));
        return [...(prev ?? []), ...page.items.filter((e) => !held.has(e.id))];
      });
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [cursor, query]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A filter change starts the list again. Keeping the old cursor would ask the server for
  // the page after a row that is no longer in the filtered trail.
  useEffect(() => {
    setItems(null);
    setCursor(undefined);
    void load();
  }, [group, range, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <Chrome title="Access history" subtitle="Every view of your record is written down" />
      {/*
        scroll={false}: the FlatList below is the scroller.
        
        Sheet scrolls by default, so the list was a VirtualizedList inside a ScrollView of the
        same orientation. React Native warns about that because windowing stops working — the
        list renders every row it has rather than the handful on screen, onEndReached fires
        unpredictably, and the footer that carries the pager is laid out off in space nobody
        scrolls to. That is why pagination kept not appearing.
      */}
      <Sheet pad={false} scroll={false}>
        {/* Outside the list on purpose: a filter that scrolls away with its own results, or
            vanishes while they load, is a filter you cannot undo without scrolling back. */}
        <View className="gap-2.5 border-b border-line px-5 pb-3.5 pt-4">
          <Text className="text-[12px] leading-[18px] text-muted">
            Everyone who looked at or changed your record, newest first.
          </Text>
          <FilterRow options={GROUPS} value={group} onChange={setGroup} />
          <FilterRow options={RANGES} value={range} onChange={setRange} subdued />
          {/* Said once, at the top, rather than as an error on a list that is working fine. */}
          {offline ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-fill px-3 py-2">
              <Feather name="download-cloud" size={13} color={C.muted} />
              <Text className="flex-1 text-[11.5px] leading-[16px] text-muted">
                Showing the copy saved on this phone — the most recent {OFFLINE_KEEP}. It will fill in when
                you are back online.
              </Text>
            </View>
          ) : null}
        </View>

        {error && !items ? (
          <View className="items-center gap-3 py-10">
            <Text className="text-center text-[13px] text-danger">{error}</Text>
            <Pressable onPress={() => void load()} className="h-11 justify-center rounded-xl bg-primary px-5">
              <Text className="text-[15px] font-medium text-white">Try again</Text>
            </Pressable>
          </View>
        ) : !items ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
            ListHeaderComponent={error ? <Text className="text-[13px] text-danger">{error}</Text> : null}
            ListEmptyComponent={
              <Text className="py-6 text-center text-[13px] leading-[19px] text-muted">
                {group === 'all' && range === 'all'
                  ? 'Nothing has happened yet.'
                  : 'Nothing matches that filter. Try a wider date range, or Everything.'}
              </Text>
            }
            renderItem={({ item }) => <Entry item={item} />}
            /*
              Loaded on a tap rather than on scroll.
              
              Auto-loading at the end of the list made paging invisible — rows simply kept
              appearing, so there was nothing to see and no way to tell how much of the log you
              were actually looking at. It was also what fired twice in one tick and appended a
              page you already had. A count and a button say both things plainly.
            */
            ListFooterComponent={
              items.length === 0 ? null : (
                <View className="gap-2.5 pt-1">
                  <Text className="text-center text-[12px] text-muted">
                    {cursor
                      ? `Showing the ${items.length} most recent`
                      : `${items.length} ${items.length === 1 ? 'entry' : 'entries'} — that is the whole history`}
                  </Text>
                  {cursor ? (
                    <Pressable
                      onPress={() => void loadMore()}
                      disabled={loadingMore}
                      className={`h-11 items-center justify-center rounded-xl border border-line bg-surface ${
                        loadingMore ? 'opacity-60' : ''
                      }`}>
                      <Text className="text-[14px] font-medium text-primary">
                        {loadingMore ? 'Loading…' : `Load ${PAGE} older`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            }
          />
        )}
      </Sheet>
    </Screen>
  );
}
