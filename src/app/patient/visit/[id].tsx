import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { Card, Meta } from '@/components/design/primitives';
import { explainReport, type Section } from '@/features/ai/reportTemplates';

interface Visit {
  id: string;
  rawInput: string;
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

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [found, all] = await Promise.all([
        api<Visit>(`/patients/me/encounters/${id}`),
        api<Claim[]>('/patients/me/claims'),
      ]);
      setVisit(found);
      setClaims(all.filter((c) => c.encounterId === id));
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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.navigate('/record')} hitSlop={8} className="h-10 w-10 justify-center">
          <Feather name="chevron-left" size={24} color="#142D2A" />
        </Pressable>

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

        <Pressable onPress={() => setShowNote((v) => !v)} hitSlop={6}>
          <Text className="text-[13px] font-medium text-primary">
            {showNote ? 'Hide the original note' : 'Show the original note'}
          </Text>
        </Pressable>

        {showNote ? (
          <Card className="gap-2 p-4">
            <Text className="text-[15px] leading-[23px] text-ink">{visit.rawInput}</Text>
            <Meta>These are the health worker&apos;s own words, kept exactly as written.</Meta>
          </Card>
        ) : null}


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
                  <Feather name="chevron-right" size={18} color="#64748B" />
                </Card>
              </Pressable>
            ))}
          </View>
        ))}


        <Meta>
          This page shows what was recorded at the visit and explains the terms in it. It is not a diagnosis and not a
          recommendation.
        </Meta>
      </ScrollView>
    </SafeAreaView>
  );
}
