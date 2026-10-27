import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { fetchWithCache } from '@/offline/cachedFetch';
import { clearCache } from '@/offline/cache';
import { useFeedback, reasonFor } from '@/components/design/feedback';
import { localImageFor } from '@/features/record/evidenceImages';

/** The document as the cached list carries it — including its full text. */
interface CachedEntry {
  id: string;
  rawInput: string;
  recordedByName: string;
  recordedByFacility: string | null;
  recordedAt: string;
  authoredBy?: 'PATIENT' | 'WORKER';
  imageHash?: string;
}
import { plainReport, type PlainLine } from '@/features/ai/plainLanguage';
import { Card, Meta } from '@/components/design/primitives';
import { explainReport, type Section } from '@/features/ai/reportTemplates';
import { Chrome, Screen, Sheet } from '@/components/design/split';
import { C } from '@/components/design/tokens';

interface Visit {
  id: string;
  rawInput: string;
  /** The fingerprint of the picture this handset may be holding. The image is never uploaded. */
  imageHash?: string;
  authoredBy?: 'PATIENT' | 'WORKER';
  recordedByName: string;
  recordedByFacility: string | null;
  recordedAt: string;
  status: string;
}

interface Claim {
  id: string;
  category: string;
  value: string;
  status: string;
  encounterId?: string;
}

const CATEGORY_HEADING: Record<string, string> = {
  CURRENT_MEDICATIONS: 'Medicines recorded',
  ALLERGIES: 'Allergies recorded',
  PAST_MEDICAL_HISTORY: 'Medical history recorded',
  LAB_RESULTS: 'Test results recorded',
};

/**
 * Pulls the documented plan out of the note. Only phrases that clearly state what should happen
 * next are matched: anything else is left alone rather than guessed at.
 */

/**
 * The photograph behind this document, if this handset is the one that took it.
 *
 * MedRekk holds the fingerprint and never the picture, so a second phone signed into the same
 * account has the whole record and none of the images. That is the design rather than a fault, and
 * saying so plainly is better than a blank frame that reads as something having gone missing.
 */
function DocumentImage({ hash }: { hash?: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void localImageFor(hash).then((found) => {
      if (cancelled) return;
      setUri(found);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hash]);

  if (!hash || !checked) return null;

  if (!uri) {
    return (
      <Card className="flex-row items-center gap-3 p-3.5">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-fill">
          <Feather name="image" size={16} color={C.muted} />
        </View>
        <Text className="flex-1 text-[12.5px] leading-[18px] text-muted">
          A photograph was attached to this document. It is kept on the phone that took it and was
          never uploaded, so it is not on this device.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Pressable onPress={() => setFull(true)}>
        <Card className="gap-2.5 overflow-hidden p-3.5">
          <View className="flex-row items-center gap-2">
            <Feather name="paperclip" size={13} color={C.muted} />
            <Text className="flex-1 text-[12.5px] font-medium text-ink">The document you photographed</Text>
            <Feather name="maximize-2" size={13} color={C.muted} />
          </View>
          <Image
            source={{ uri }}
            style={{ width: '100%', height: 190, borderRadius: 12, backgroundColor: C.fill }}
            resizeMode="cover"
          />
          <Meta>Held on this phone only. Tap to see all of it.</Meta>
        </Card>
      </Pressable>

      {/* Full-bleed on black, because the point is to read small print on a photographed page. */}
      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            <View className="flex-row justify-end px-4 py-2">
              <Pressable
                onPress={() => setFull(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close the photograph"
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
              <Image source={{ uri }} style={{ width: '100%', height: 520 }} resizeMode="contain" />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const PLAIN_ICON: Record<PlainLine['kind'], keyof typeof Feather.glyphMap> = {
  medicine: 'package',
  test: 'activity',
  condition: 'alert-circle',
  instruction: 'info',
};

/**
 * The note, said the way a person would say it.
 *
 * First on the screen and open by default, because it is the reason to open a document at all.
 * The original is still underneath, unchanged and one tap away — this does not replace the
 * record, it reads it aloud. Anyone who wants to check a sentence against the words it came
 * from can, which is also the only way a rewrite like this earns trust.
 */
function InPlainWords({ note }: { note: string }) {
  const lines = useMemo(() => plainReport(note), [note]);
  if (lines.length === 0) return null;

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center gap-2">
        <Feather name="message-circle" size={14} color={C.primary} />
        <Text className="text-[13px] font-semibold text-ink">In plain words</Text>
      </View>

      <Card className="overflow-hidden p-0">
        {lines.map((line, i) => (
          <View
            key={`${line.kind}-${i}`}
            className={`flex-row gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-line' : ''}`}>
            <View className="mt-[1px] h-7 w-7 items-center justify-center rounded-lg bg-primary-soft">
              <Feather name={PLAIN_ICON[line.kind]} size={13} color={C.primary} />
            </View>
            <Text className="flex-1 text-[14px] leading-[21px] text-ink">{line.text}</Text>
          </View>
        ))}
      </Card>

      <Text className="text-[11.5px] leading-[16px] text-muted">
        MedRekk rewrote this from the note below. It explains what was written down — it does not
        add to it, and it is not advice. Ask your health worker if anything here is unclear.
      </Text>
    </View>
  );
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, toast } = useFeedback();

  /**
   * Taking the visit back off the record.
   *
   * The warning says what actually happens, including the two things somebody would not guess:
   * everything the visit produced goes with it, and the removal itself is written into the trail.
   * A confirmation that only says "are you sure" teaches nobody anything.
   */
  const removeVisit = async () => {
    if (!id || busy) return;
    const count = claims.length;
    const ok = await confirm({
      title: 'Remove this visit?',
      body:
        count > 0
          ? `The ${count === 1 ? 'entry' : `${count} entries`} it added to your record will be removed with it, and any allergy among them comes off your emergency card. Your history will show that you removed something on this date, but not what it was. This cannot be undone.`
          : 'Your history will show that you removed something on this date, but not what it was. This cannot be undone.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/patients/me/entries/${id}`, { method: 'DELETE' });
      // The cached copies still hold it, and the record screen reads them.
      await clearCache();
      toast({ tone: 'ok', title: 'Removed from your record' });
      router.navigate('/record');
    } catch (e) {
      setBusy(false);
      toast({ tone: 'error', title: 'Could not remove it', body: reasonFor(e) });
    }
  };

  /**
   * Both halves come through the cache, and both are already in it.
   *
   * The record screen caches the claims and the document list, and the document list now carries
   * each document's full text — so by the time a card is on screen, everything needed to open it
   * is on the handset. This used to call the bare client twice, which is why a patient with no
   * signal could see their cards and open none of them.
   */
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [entries, all] = await Promise.all([
        fetchWithCache<CachedEntry[]>('entries', '/patients/me/entries'),
        fetchWithCache<Claim[]>('claims', '/patients/me/claims'),
      ]);

      const found = entries.data.find((e) => e.id === id);
      if (!found) throw new Error('This visit is not on this phone.');

      setVisit({
        id: found.id,
        rawInput: found.rawInput,
        recordedByName: found.recordedByName,
        recordedByFacility: found.recordedByFacility,
        recordedAt: found.recordedAt,
        status: 'REVIEWED',
        ...(found.imageHash ? { imageHash: found.imageHash } : {}),
        authoredBy: found.authoredBy,
      });
      setClaims(all.data.filter((c) => c.encounterId === id));
      setFromCache(entries.fromCache || all.fromCache);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const explained = useMemo(() => (visit ? explainReport(visit.rawInput) : null), [visit]);

  const grouped = useMemo(() => {
    const out = new Map<string, Claim[]>();
    for (const claim of claims) {
      const list = out.get(claim.category) ?? [];
      list.push(claim);
      out.set(claim.category, list);
    }
    return [...out.entries()];
  }, [claims]);

  if (!visit) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas p-6">
        {error ? <Text className="text-center text-sm text-danger">{error}</Text> : <ActivityIndicator />}
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      <Chrome title={"Visit"} subtitle={undefined} onBack={() => router.navigate('/record')} />
      <Sheet>

        <View className="gap-1.5">
          <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Visit</Text>
          <Text className="text-[26px] font-semibold leading-8 tracking-tight text-ink">
            {formatDate(visit.recordedAt)}
          </Text>
          <Meta>
            Recorded by {visit.recordedByName}
            {visit.recordedByFacility ? ` · ${visit.recordedByFacility}` : ''}
          </Meta>
        </View>

        {explained ? (
          <View className="gap-4 rounded-xl border border-line bg-surface p-4">
            {explained.sections.map((section: Section, index: number) => (
              <View
                key={section.heading}
                className={`gap-1.5 ${index > 0 ? 'border-t border-line pt-3.5' : ''}`}>
                <Text className="text-[15px] font-semibold text-ink">{section.heading}</Text>
                <Text
                  className={`text-[15px] leading-[23px] ${section.uncertain ? 'text-warn' : 'text-ink'}`}>
                  {section.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <InPlainWords note={visit.rawInput} />

        <Pressable onPress={() => setShowNote((v) => !v)} hitSlop={6}>
          <Text className="text-[13px] font-medium text-primary">
            {showNote ? 'Hide the original note' : 'Show the original note'}
          </Text>
        </Pressable>

        {showNote ? (
          <Card className="gap-2 p-4">
            <Text className="text-[15px] leading-[23px] text-ink">{visit.rawInput}</Text>
            <Meta>
              {visit.authoredBy === 'PATIENT'
                ? 'This is the document exactly as it was captured, with nothing rewritten.'
                : "These are the health worker's own words, kept exactly as written."}
            </Meta>
          </Card>
        ) : null}

        <DocumentImage hash={visit.imageHash} />


        {grouped.map(([category, list]) => (
          <View key={category} className="gap-2">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">
              {CATEGORY_HEADING[category] ?? 'Also recorded'}
            </Text>
            {list.map((claim) => (
              <Pressable key={claim.id} onPress={() => router.push(`/patient/claim/${claim.id}`)}>
                <Card className="flex-row items-center gap-3 p-3.5">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-medium text-ink">{claim.value}</Text>
                    <Meta>Added to your record from this visit</Meta>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        ))}


        <Meta>
          This page shows what was recorded at the visit and explains the terms in it. It is not a diagnosis and not a
          recommendation.
        </Meta>

        {/*
          Last, and quiet. Removing a visit is a thing a patient is entitled to do — the record is
          theirs, including the parts they disagree with — but it is not what this screen is for,
          so it does not compete with reading.
        */}
        <Pressable
          onPress={() => void removeVisit()}
          disabled={busy || fromCache}
          className={`mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface ${
            busy || fromCache ? 'opacity-40' : ''
          }`}>
          <Feather name="trash-2" size={15} color={C.danger} />
          <Text className="text-[14px] font-medium text-danger">
            {busy ? 'Removing…' : 'Remove this visit from my record'}
          </Text>
        </Pressable>
        {fromCache ? (
          <Meta>Removing needs a connection, so that the change reaches your record and not just this phone.</Meta>
        ) : null}
      </Sheet>
    </Screen>
  );
}
