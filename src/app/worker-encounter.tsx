import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { type ClaimCategory } from '@/features/worker/workerApi';
import {
  newEncounterId,
  queueVisit,
  removeQueuedVisit,
  syncNow,
} from '@/features/worker/offlineEncounter';
import { useWorkerSession } from '@/features/worker/workerSession';
import { useAuth } from '@/features/auth/AuthProvider';
import ReviewItem, { type ReviewEntry } from '@/features/worker/ReviewItem';
import { findConflicts } from '@/features/worker/conflicts';
import { structure } from '@/features/ai/structure';
import { refreshModelStatus } from '@/features/ai/modelStore';
import { refreshWhisperStatus, useWhisperStatus } from '@/features/ai/whisperStore';
import { useVoiceCapture, voiceAvailable } from '@/features/ai/useVoiceCapture';
import { captureFromCamera, captureFromLibrary } from '@/features/ai/photo';
import { Card, Meta } from '@/components/design/primitives';
import { C } from '@/components/design/tokens';
import { BottomTabInset } from '@/constants/theme';

type Stage = 'CAPTURE' | 'PROCESSING' | 'REVIEW' | 'SAVED';

const CAPTURE_MODES = [
  { key: 'TYPE', label: 'Type', icon: 'type' },
  { key: 'VOICE', label: 'Voice', icon: 'mic' },
  { key: 'PHOTO', label: 'Photo', icon: 'camera' },
] as const;

/** The order sections appear in. Allergies first: they are the ones that change what is safe to give. */
const GROUP_ORDER: ClaimCategory[] = [
  'ALLERGIES',
  'CURRENT_MEDICATIONS',
  'PAST_MEDICAL_HISTORY',
  'LAB_RESULTS',
  'RECENT_ENCOUNTERS',
];

const GROUP_HEADING: Record<string, string> = {
  ALLERGIES: 'Allergies',
  CURRENT_MEDICATIONS: 'Medicines',
  PAST_MEDICAL_HISTORY: 'Medical history',
  LAB_RESULTS: 'Test results',
  RECENT_ENCOUNTERS: 'Visit notes',
};

export default function WorkerEncounterScreen() {
  const session = useWorkerSession();
  const { user } = useAuth();
  // Whether the record has it yet, as opposed to whether this handset has it.
  const [synced, setSynced] = useState(false);
  const [stage, setStage] = useState<Stage>('CAPTURE');
  const [raw, setRaw] = useState('');
  const [captureMode, setCaptureMode] = useState<(typeof CAPTURE_MODES)[number]['key']>('TYPE');
  const router = useRouter();
  const voice = useVoiceCapture();
  const whisper = useWhisperStatus();
  // The microphone module is missing on an install made before it was added; the speech
  // model is a separate download. Either one means Voice cannot run.
  const canRecord = voiceAvailable();
  const voiceReady = canRecord && whisper.state === 'READY';
  const [reading, setReading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /** Text read from a photo joins the note the same way a transcript does: as an editable draft. */
  const readPhoto = async (from: 'CAMERA' | 'LIBRARY') => {
    setPhotoError(null);
    setReading(true);
    try {
      const found = from === 'CAMERA' ? await captureFromCamera() : await captureFromLibrary();
      if (found && found.text.length > 0) {
        setRaw((prev) => (prev.length > 0 ? `${prev} ${found.text}` : found.text));
      } else if (found) {
        setPhotoError('No text could be read from that image. Try a clearer photo of printed text.');
      }
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setReading(false);
    }
  };

  // Checked on focus rather than on mount: a worker who installs the speech model and comes
  // straight back would otherwise still see Voice disabled.
  useFocusEffect(
    useCallback(() => {
      void refreshWhisperStatus();
    }, []),
  );

  /** The transcript is a first draft, not the record: it lands in the field so it can be corrected. */
  const finishRecording = async () => {
    const text = await voice.stopAndTranscribe();
    if (text) setRaw((prev) => (prev.length > 0 ? `${prev} ${text}` : text));
  };
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewEntry[]>([]);
  const [fromAi, setFromAi] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  if (!session || session.status !== 'APPROVED') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas p-6">
        <View className="items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-fill">
            <Feather name="user-x" size={22} color="#5D6C82" />
          </View>
          <Text className="text-[17px] font-semibold text-ink">No approved patient</Text>
          <Text className="max-w-[280px] text-center text-sm leading-5 text-muted">
            Find a patient and wait for them to approve on their own phone before recording anything.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const process = async () => {
    setError(null);
    setStage('PROCESSING');
    try {
      // Nothing in here touches the network. The model, the structuring and the review all
      // happen on the handset, and the visit is not sent anywhere until the worker saves it.
      await refreshModelStatus();
      const result = await structure(raw.trim());
      const engine = `${result.source === 'MODEL' ? 'On-device model' : 'Read on this phone'} · ${(
        result.millis / 1000
      ).toFixed(1)}s`;
      setAiNote(result.note ? `${engine} — ${result.note}` : engine);
      // Kept for diagnosis without putting an exception in front of a worker mid-visit.
      if (result.diagnostic) console.warn(`[medrekk] ${result.diagnostic}`);
      setItems(result.items.map((item) => ({ ...item, confirmed: false })));
      setFromAi(true);
      setStage('REVIEW');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStage('CAPTURE');
    }
  };

  const save = async () => {
    const clean = items.filter((i) => i.value.trim().length >= 2);
    if (clean.length === 0) {
      setError('Add at least one item, or discard this encounter.');
      return;
    }
    setError(null);
    try {
      // Written to this handset first, which cannot fail for want of a network. The record
      // catches up when there is one, and the worker is told which of the two has happened.
      const id = encounterId ?? newEncounterId();
      setEncounterId(id);

      await queueVisit({
        encounterId: id,
        accessToken: session.token,
        rawInput: raw.trim(),
        captureMethod: captureMode === 'TYPE' ? 'TEXT' : captureMode,
        items: clean.map(({ confirmed: _confirmed, ...item }) => item),
      });

      setSavedCount(clean.length);
      setStage('SAVED');

      // Not awaited: the visit is already safe, and the worker should not watch a spinner
      // for a request whose failure changes nothing.
      void syncNow(user?.id ?? 'worker').then(() => setSynced(true));
    } catch (e) {
      setError(
        e instanceof Error
          ? `This visit could not be saved on this phone. ${e.message}`
          : 'This visit could not be saved on this phone.',
      );
    }
  };

  const reset = () => {
    setStage('CAPTURE');
    setRaw('');
    setItems([]);
    setEncounterId(null);
    setFromAi(false);
    setShowRaw(false);
    setError(null);
    setAiNote(null);
    setSynced(false);
  };

  const update = (index: number, patch: Partial<ReviewEntry>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const confirmedCount = items.filter((i) => i.confirmed === true).length;
  const conflicts = findConflicts(items);

  const runDiscard = async () => {
    // Only ever queued locally, so discarding is a local delete. A visit already accepted by
    // the record is not touched here: that is the patient's to remove, not a passing worker's.
    if (encounterId) await removeQueuedVisit(encounterId);
    reset();
  };

  const discard = () =>
    Alert.alert('Discard this encounter?', 'Nothing will be added to the record.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => void runDiscard() },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        <Card className="flex-row items-center gap-3 p-3">
          <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft">
            <Text className="text-sm font-semibold text-primary">
              {session.patientName.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[15px] font-medium text-ink">{session.patientName}</Text>
            <Meta>{session.medrekkCode}</Meta>
          </View>
          <View className="h-6 flex-row items-center gap-1.5 rounded-full bg-primary-soft px-2.5">
            <Feather name="check-circle" size={11} color="#0F6E56" />
            <Text className="text-xs font-medium text-primary">Approved</Text>
          </View>
        </Card>

        {stage === 'CAPTURE' ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-semibold tracking-tight text-ink">Record encounter</Text>
              <Meta>Type what the patient tells you, in your own words.</Meta>
            </View>

            <View className="flex-row rounded-xl bg-track p-[3px]">
              {CAPTURE_MODES.map((mode) => {
                const active = mode.key === captureMode;
                // Photo is not built yet; Voice needs its model before it can do anything.
                const usable = mode.key === 'TYPE' || (mode.key === 'VOICE' && voiceReady) || mode.key === 'PHOTO';
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => usable && setCaptureMode(mode.key)}
                    disabled={!usable}
                    className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px] ${
                      active ? 'border border-line bg-surface' : ''
                    }`}>
                    <Feather name={mode.icon} size={14} color={active ? C.ink : usable ? C.muted : C.hint} />
                    <Text
                      className={`text-[13px] ${
                        active ? 'font-medium text-ink' : usable ? 'text-muted' : 'text-hint'
                      }`}>
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!canRecord && captureMode === 'VOICE' ? (
              <Text className="text-[13px] leading-5 text-muted">
                This build does not include the microphone module, so Voice cannot run here. Use Type or Photo.
              </Text>
            ) : null}
            {canRecord && !voiceReady ? (
              <Pressable onPress={() => router.push('/worker-model')} hitSlop={6}>
                <Text className="text-[13px] text-muted">
                  Voice needs the speech model. <Text className="font-medium text-primary">Install it</Text>
                </Text>
              </Pressable>
            ) : null}

            {captureMode === 'VOICE' && voice.stage !== 'IDLE' ? (
              <Card className="items-center gap-3 p-6">
                {voice.stage === 'RECORDING' ? (
                  <>
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
                      <Feather name="mic" size={22} color="#CE2B2B" />
                    </View>
                    <Text className="text-[15px] font-medium text-ink">Listening…</Text>
                    <Meta>Say what the patient told you. Tap stop when you are done.</Meta>
                    <Pressable
                      onPress={() => void finishRecording()}
                      className="h-11 w-full items-center justify-center rounded-xl bg-ink">
                      <Text className="text-[13px] font-medium text-white">Stop</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <ActivityIndicator />
                    <Text className="text-[15px] font-medium text-ink">Reading what you said…</Text>
                    <Meta>This happens on the phone. The recording is not sent anywhere.</Meta>
                  </>
                )}
              </Card>
            ) : (
              <Card className="p-1">
                <TextInput
                  value={raw}
                  onChangeText={setRaw}
                  multiline
                  textAlignVertical="top"
                  placeholder="Fever and headache for three days. Temp 38.4. Allergic to penicillin..."
                  placeholderTextColor="#7C8A9C"
                  className="min-h-[200px] p-3.5 text-base leading-6 text-ink"
                />
              </Card>
            )}

            {captureMode === 'PHOTO' ? (
              <View className="gap-2">
                <Meta>
                  Photograph a printed result or report. Handwriting is usually not readable, so type those
                  instead.
                </Meta>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => void readPhoto('CAMERA')}
                    disabled={reading}
                    className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
                    <Feather name="camera" size={17} color="#0F6E56" />
                    <Text className="text-[13px] font-medium text-primary">Take a photo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void readPhoto('LIBRARY')}
                    disabled={reading}
                    className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
                    <Feather name="image" size={17} color="#0F6E56" />
                    <Text className="text-[13px] font-medium text-primary">Choose one</Text>
                  </Pressable>
                </View>
                {reading ? (
                  <View className="flex-row items-center gap-2.5">
                    <ActivityIndicator />
                    <Meta>Reading the text on this phone…</Meta>
                  </View>
                ) : null}
                {photoError ? <Text className="text-sm text-danger">{photoError}</Text> : null}
              </View>
            ) : null}

            {captureMode === 'VOICE' && voice.stage === 'IDLE' ? (
              <Pressable
                onPress={() => void voice.start()}
                className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
                <Feather name="mic" size={17} color="#0F6E56" />
                <Text className="text-base font-medium text-primary">
                  {raw.length > 0 ? 'Record more' : 'Start recording'}
                </Text>
              </Pressable>
            ) : null}

            {voice.error ? <Text className="text-sm text-danger">{voice.error}</Text> : null}

            <View className="flex-row items-start gap-2.5 rounded-xl bg-fill px-3.5 py-3">
              <Feather name="cpu" size={16} color="#5D6C82" />
              <Text className="flex-1 text-xs leading-[17px] text-muted">
                Structured on this phone. The note is not sent anywhere while the AI drafts it.
              </Text>
            </View>

            {error ? <Text className="text-sm text-danger">{error}</Text> : null}

            <Pressable
              disabled={raw.trim().length < 3}
              onPress={() => void process()}
              className={`h-[52px] flex-row items-center justify-center gap-2 rounded-xl ${
                raw.trim().length < 3 ? 'bg-track' : 'bg-primary'
              }`}>
              <Feather name="zap" size={17} color={raw.trim().length < 3 ? C.muted : C.surface} />
              <Text
                className={`text-base font-medium ${
                  raw.trim().length < 3 ? 'text-muted' : 'text-white'
                }`}>
                Draft with AI
              </Text>
            </Pressable>
          </>
        ) : null}

        {stage === 'PROCESSING' ? (
          <View className="items-center gap-4 py-24">
            <ActivityIndicator color="#0F6E56" />
            <Text className="text-base font-medium text-ink">Structuring on this device…</Text>
            <Text className="max-w-[260px] text-center text-sm leading-5 text-muted">
              Nothing reaches the record until you have reviewed it.
            </Text>
          </View>
        ) : null}

        {stage === 'REVIEW' ? (
          <>
            <View className="gap-1">
              <Text className="text-2xl font-semibold tracking-tight text-ink">
                {fromAi ? 'Check the AI draft' : 'Check what you entered'}
              </Text>
              <Meta>
                {items.length === 1
                  ? 'One item was found in this note. Correct anything that is wrong, then save.'
                  : `${items.length} items were found in this note. Correct anything that is wrong, then save them together.`}
              </Meta>
            </View>

            {conflicts.length > 0 ? (
              <View className="gap-2 rounded-xl border-[1.5px] border-danger bg-surface px-3.5 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Check with the patient
                  </Text>
                  <View className="h-6 flex-row items-center gap-1.5 rounded-full bg-danger-soft px-2.5">
                    <Feather name="alert-triangle" size={11} color="#CE2B2B" />
                    <Text className="text-xs font-medium text-danger">Conflict</Text>
                  </View>
                </View>
                {conflicts.map((c) => (
                  <View key={`${c.allergy}-${c.medicine}`} className="rounded-[10px] bg-danger-soft p-2.5">
                    <Text className="text-[13px] leading-[18px] text-ink">
                      This note records an allergy to {c.allergy} and {c.medicine} as a current medicine. Check this
                      with the patient before saving.
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable onPress={() => setShowRaw((v) => !v)} hitSlop={6}>
              <Text className="text-[13px] font-medium text-primary">
                {showRaw ? 'Hide what you captured' : 'Show what you captured'}
              </Text>
            </Pressable>
            {aiNote ? <Meta>{aiNote}</Meta> : null}
            {showRaw ? <Text className="rounded-xl bg-fill p-3.5 text-sm leading-5 text-muted">{raw}</Text> : null}

            {/* An empty bordered box used to be drawn here when nothing was found, which read
                as the screen having broken rather than as a real and ordinary answer. */}
            {items.length === 0 ? (
              <View className="items-center gap-2 rounded-xl border border-line bg-surface px-5 py-7">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-fill">
                  <Feather name="search" size={20} color="#5D6C82" />
                </View>
                <Text className="text-[15px] font-semibold text-ink">Nothing was found to record</Text>
                <Text className="max-w-[280px] text-center text-sm leading-5 text-muted">
                  Not every note contains something for the record. Add an item yourself below, or go back and
                  capture more.
                </Text>
              </View>
            ) : (
            <View className="gap-4 rounded-xl border border-line bg-surface p-3.5">
              {GROUP_ORDER.filter((category) => items.some((i) => i.category === category)).map((category) => (
                <View key={category} className="gap-2">
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {GROUP_HEADING[category] ?? category}
                  </Text>
                  {items.map((item, index) =>
                    item.category === category ? (
                      <ReviewItem
                        key={index}
                        item={item}
                        index={index}
                        fromAi={fromAi}
                        onChange={update}
                        onRemove={(at) => setItems((prev) => prev.filter((_, i) => i !== at))}
                      />
                    ) : null,
                  )}
                </View>
              ))}
            </View>
            )}

            <Pressable
              onPress={() =>
                setItems((prev) => [...prev, { category: 'CURRENT_MEDICATIONS', value: '', confirmed: true }])
              }
              className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl border border-line bg-surface">
              <Feather name="plus" size={17} color="#142D2A" />
              <Text className="text-base font-medium text-ink">Add an item</Text>
            </Pressable>

            {error ? <Text className="text-sm text-danger">{error}</Text> : null}

            <View className="gap-2 pt-1">
              <Pressable
                onPress={() => void save()}
                className="h-[52px] items-center justify-center rounded-xl bg-primary">
                <Text className="text-base font-medium text-white">
                  {items.length === 1 ? 'Save this to the record' : `Save all ${items.length} to the record`}
                </Text>
              </Pressable>
              <Text className="text-center text-xs text-muted">Saved as unverified until a clinician confirms it</Text>
              <Pressable onPress={discard} className="h-11 items-center justify-center">
                <Text className="text-sm font-medium text-danger">Discard this encounter</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {stage === 'SAVED' ? (
          <View className="items-center gap-3 py-16">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
              <Feather name="check" size={24} color="#0F6E56" />
            </View>
            <Text className="text-[22px] font-semibold tracking-tight text-ink">Saved</Text>
            <Text className="max-w-[300px] text-center text-sm leading-5 text-muted">
              {savedCount} item{savedCount === 1 ? '' : 's'} saved to {session.patientName}&apos;s record, marked
              unverified until a clinician confirms them.
            </Text>
            <View
              className={`mt-3 flex-row items-start gap-2.5 rounded-xl px-3.5 py-3 ${
                synced ? 'bg-primary-soft' : 'bg-fill'
              }`}>
              <Feather
                name={synced ? 'check-circle' : 'clock'}
                size={16}
                color={synced ? C.primary : C.muted}
              />
              <Text className="flex-1 text-[13px] leading-[19px] text-ink">
                {synced
                  ? 'Sent to the record.'
                  : 'Held on this phone. It will be sent on its own as soon as there is a connection — you can close the app.'}
              </Text>
            </View>
            <Pressable onPress={reset} className="mt-2 h-[52px] justify-center rounded-xl bg-primary px-6">
              <Text className="text-base font-medium text-white">Record another</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
