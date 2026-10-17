import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { fetchVerifications, type VerificationEventView } from '@/features/verification/verificationApi';
import { Card, Meta } from '@/components/design/primitives';
import { explainSections, type ExplanationSections } from '@/features/ai/explain';

interface Claim {
  id: string;
  category: string;
  value: string;
  status: string;
  source: string;
  lastConfirmedAt?: string;
  verifiedAt?: string;
  encounterId?: string;
  emergencyDecision?: 'ADDED' | 'DECLINED';
}

interface EvidenceView {
  id: string;
  claimId: string;
  kind: string;
  description: string;
  addedByName?: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Unverified',
  SELF_REPORTED: 'Self-reported',
  EVIDENCE_BACKED: 'Evidence-backed',
  CLINICALLY_VERIFIED: 'Verified',
};

const STATUS_EXPLAIN: Record<string, string> = {
  UNVERIFIED: 'Nobody has confirmed this yet.',
  SELF_REPORTED: 'You entered this yourself. No health worker has checked it.',
  EVIDENCE_BACKED: 'A health worker saw supporting evidence for this.',
  CLINICALLY_VERIFIED: 'A credentialed clinician reviewed and confirmed this.',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; icon: keyof typeof Feather.glyphMap; hex: string }> = {
  UNVERIFIED: { bg: 'bg-neutral-soft', fg: 'text-muted', icon: 'help-circle', hex: '#5D6C82' },
  SELF_REPORTED: { bg: 'bg-warn-soft', fg: 'text-warn', icon: 'user', hex: '#B45309' },
  EVIDENCE_BACKED: { bg: 'bg-primary-soft', fg: 'text-primary', icon: 'paperclip', hex: '#0F6E56' },
  CLINICALLY_VERIFIED: { bg: 'bg-primary-soft', fg: 'text-primary', icon: 'check', hex: '#0F6E56' },
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [origin, setOrigin] = useState<EvidenceView[]>([]);
  const [events, setEvents] = useState<VerificationEventView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sections, setSections] = useState<ExplanationSections | null>(null);
  const [cardBusy, setCardBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(false);
    setCardBusy(false);
    if (!id) return;
    try {
      setClaim(null);
      setOrigin([]);
      setEvents([]);
      const claims = await api<Claim[]>('/patients/me/claims');
      setClaim(claims.find((c) => c.id === id) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    try {
      setOrigin(await api<EvidenceView[]>(`/patients/me/claims/${id}/origin`));
    } catch {
      setOrigin([]);
    }
    try {
      const all = await fetchVerifications();
      setEvents(all.filter((ev) => ev.claimId === id));
    } catch {
      setEvents([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!claim) {
      setSections(null);
      return;
    }
    setSections(
      explainSections({
        category: claim.category,
        value: claim.value,
        status: claim.status,
        source: claim.source,
      }),
    );
  }, [claim]);

  if (!claim) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas p-6">
        {error ? <Text className="text-center text-sm text-danger">{error}</Text> : <ActivityIndicator />}
      </SafeAreaView>
    );
  }

  const selfEntered = claim ? claim.status === 'SELF_REPORTED' || claim.status === 'UNVERIFIED' : false;
  const isAllergy = claim.category === 'ALLERGIES';
  const onCard = claim.emergencyDecision === 'ADDED';

  const remove = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/patients/me/claims/${id}`, { method: 'DELETE' });
      router.navigate('/record');
    } catch (e) {
      setBusy(false);
      Alert.alert('Could not remove it', e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const decideCard = async (add: boolean) => {
    if (!id) return;
    setCardBusy(true);
    try {
      const updated = await api<Claim>(`/patients/me/claims/${id}/emergency`, {
        method: add ? 'POST' : 'DELETE',
      });
      setClaim(updated);
    } catch (e) {
      Alert.alert('Could not update the card', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setCardBusy(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert(
      'Remove this from your record?',
      selfEntered
        ? 'You added this yourself, so it will be deleted.'
        : 'It will no longer appear in your record or to anyone you share it with. Your history will show that you removed an item on this date, but not what it was.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void remove() },
      ],
    );

  const style = STATUS_STYLE[claim.status] ?? STATUS_STYLE.UNVERIFIED;
  const captures = origin.filter((o) => o.kind === 'ORIGINAL_CAPTURE');
  const others = origin.filter((o) => o.kind !== 'ORIGINAL_CAPTURE');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.navigate('/record')} hitSlop={8} className="h-10 w-10 justify-center">
          <Feather name="chevron-left" size={24} color="#142D2A" />
        </Pressable>

        <View className="gap-2">
          <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {claim.category.replace(/_/g, ' ').toLowerCase()}
          </Text>
          <Text className="text-[26px] font-semibold leading-8 tracking-tight text-ink">{claim.value}</Text>
          <View className={`h-7 flex-row items-center gap-1.5 self-start rounded-full px-3 ${style.bg}`}>
            <Feather name={style.icon} size={12} color={style.hex} />
            <Text className={`text-[13px] font-medium ${style.fg}`}>{STATUS_LABEL[claim.status] ?? claim.status}</Text>
          </View>
          <Meta>{STATUS_EXPLAIN[claim.status] ?? ''}</Meta>
        </View>

        {sections ? (
          <View className="gap-3 rounded-xl border border-line bg-fill p-4">
            <View className="gap-1.5">
              <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">What was recorded</Text>
              <Text className="text-[15px] leading-[22px] text-ink">{sections.recorded}</Text>
            </View>

            {sections.meaning ? (
              <View className="gap-1.5 border-t border-line pt-3">
                <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">What it means</Text>
                <Text className="text-[15px] leading-[22px] text-ink">{sections.meaning}</Text>
              </View>
            ) : null}

            {sections.next ? (
              <View className="gap-1.5 border-t border-line pt-3">
                <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">What happens next</Text>
                <Text className="text-[15px] leading-[22px] text-ink">{sections.next}</Text>
              </View>
            ) : null}

            {sections.unclear ? (
              <View className="flex-row items-start gap-2.5 rounded-[10px] bg-warn-soft p-3">
                <Feather name="help-circle" size={15} color="#B45309" />
                <Text className="flex-1 text-[13px] leading-[19px] text-warn">{sections.unclear}</Text>
              </View>
            ) : null}

            <Text className="border-t border-line pt-2.5 text-xs text-muted">
              {sections.source === 'glossary'
                ? 'From a reviewed medical glossary, based on what was recorded. Not a diagnosis or a recommendation.'
                : 'Based on what was recorded. Not a diagnosis or a recommendation.'}
            </Text>
          </View>
        ) : null}

        {isAllergy ? (
          <Card className="gap-3 p-3.5">
            <View className="flex-row items-start gap-3">
              <View
                className={`h-9 w-9 items-center justify-center rounded-[10px] ${
                  onCard ? 'bg-danger-soft' : 'bg-fill'
                }`}>
                <Feather
                  name={onCard ? 'alert-triangle' : 'shield'}
                  size={16}
                  color={onCard ? '#CE2B2B' : '#5D6C82'}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-ink">
                  {onCard ? 'On your emergency card' : 'Not on your emergency card'}
                </Text>
                <Meta>
                  {onCard
                    ? 'Anyone who scans your card can read this without asking you first.'
                    : 'Your emergency card is the one part of your record a stranger can read without your approval. Nothing goes on it unless you put it there.'}
                </Meta>
              </View>
            </View>
            <Pressable
              onPress={() => void decideCard(!onCard)}
              disabled={cardBusy}
              className={`h-[46px] flex-row items-center justify-center rounded-xl ${
                onCard ? 'border border-line bg-surface' : 'bg-primary'
              } ${cardBusy ? 'opacity-50' : ''}`}>
              <Text className={`text-[15px] font-medium ${onCard ? 'text-ink' : 'text-white'}`}>
                {cardBusy ? 'Saving…' : onCard ? 'Take it off the card' : 'Add to emergency card'}
              </Text>
            </Pressable>
          </Card>
        ) : null}

        {claim.encounterId ? (
          <Pressable onPress={() => router.push(`/patient/visit/${claim.encounterId}`)}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft">
                <Feather name="file-text" size={16} color="#0F6E56" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-ink">See the whole visit</Text>
                <Meta>The note this was taken from, and everything else recorded that day</Meta>
              </View>
              <Feather name="chevron-right" size={18} color="#5D6C82" />
            </Card>
          </Pressable>
        ) : null}

        <Card className="gap-2.5 p-3.5">
          <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Where this came from</Text>
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-fill">
              <Feather name="user" size={16} color="#142D2A" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-medium text-ink">{claim.source}</Text>
              <Meta>
                {claim.lastConfirmedAt ? `Recorded ${formatDate(claim.lastConfirmedAt)}` : 'Date not recorded'}
              </Meta>
            </View>
          </View>
        </Card>

        {captures.length > 0 ? (
          <View className="gap-2">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">The original words</Text>
            {captures.map((capture) => (
              <Card key={capture.id} className="gap-2 p-3.5">
                <Text className="text-[15px] italic leading-[22px] text-ink">&ldquo;{capture.description}&rdquo;</Text>
                <Meta>
                  {capture.addedByName ? `Captured by ${capture.addedByName} · ` : ''}
                  {formatDate(capture.createdAt)}
                </Meta>
              </Card>
            ))}
            <Meta>This is what was said or written at the time. It is kept so the record can be traced back.</Meta>
          </View>
        ) : null}

        {others.length > 0 ? (
          <View className="gap-2">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Supporting evidence</Text>
            {others.map((item) => (
              <Card key={item.id} className="gap-1 p-3.5">
                <Text className="text-sm font-medium text-ink">{item.kind.replace(/_/g, ' ').toLowerCase()}</Text>
                <Text className="text-[15px] leading-[21px] text-ink">{item.description}</Text>
                <Meta>
                  {item.addedByName ? `${item.addedByName} · ` : ''}
                  {formatDate(item.createdAt)}
                </Meta>
              </Card>
            ))}
          </View>
        ) : null}

        {events.length > 0 ? (
          <View className="gap-2">
            <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">Verification history</Text>
            {events.map((event) => (
              <Card key={event.id} className="gap-1 p-3.5">
                <Text className="text-sm font-medium text-ink">
                  {STATUS_LABEL[event.resultingStatus] ?? event.resultingStatus}
                </Text>
                <Meta>
                  {event.verifierName}
                  {event.verifierFacility ? `, ${event.verifierFacility}` : ''} · {formatDate(event.verifiedAt)}
                </Meta>
                <Meta>{event.method}</Meta>
              </Card>
            ))}
          </View>
        ) : null}
        <View className="gap-2 pt-2">
          <Pressable
            onPress={confirmRemove}
            disabled={busy}
            className={`h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface ${
              busy ? 'opacity-50' : ''
            }`}>
            <Feather name="trash-2" size={17} color="#CE2B2B" />
            <Text className="text-base font-medium text-danger">
              {busy ? 'Removing…' : 'Remove from my record'}
            </Text>
          </Pressable>
          <Meta>This is your record. You decide what stays in it.</Meta>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
