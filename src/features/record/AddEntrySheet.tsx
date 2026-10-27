import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { Meta } from '@/components/design/primitives';
import { captureFromCamera, captureFromLibrary, type PhotoText } from '@/features/ai/photo';
import { useVoiceCapture, voiceAvailable } from '@/features/ai/useVoiceCapture';
import { structure } from '@/features/ai/structure';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { keepImage } from '@/features/record/evidenceImages';
import { useWhisperStatus } from '@/features/ai/whisperStore';
import { C } from '@/components/design/tokens';

export type AddCategory = 'ALLERGIES' | 'CURRENT_MEDICATIONS' | 'PAST_MEDICAL_HISTORY';

/** What POST /patients/me/entries returns: the document, with the claims it produced. */
export interface CreatedEntry {
  id: string;
  rawInput: string;
  createdClaimIds: string[];
  captureMethod: string;
  createdAt: string;
}

export interface AddedClaim {
  id: string;
  category: string;
  value: string;
  status: string;
  source: string;
  lastConfirmedAt?: string;
  verifiedAt?: string;
  encounterId?: string;
}

const CATEGORIES: { key: AddCategory; label: string }[] = [
  { key: 'ALLERGIES', label: 'Allergy' },
  { key: 'CURRENT_MEDICATIONS', label: 'Medicine' },
  { key: 'PAST_MEDICAL_HISTORY', label: 'History' },
];

type Mode = 'TYPE' | 'PHOTO' | 'VOICE';

const MODES: { key: Mode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'TYPE', label: 'Type', icon: 'edit-3' },
  { key: 'PHOTO', label: 'Photo', icon: 'camera' },
  { key: 'VOICE', label: 'Speak', icon: 'mic' },
];

/**
 * What the patient captured, kept whole.
 *
 * This was 300, which is the cap on a single claim's VALUE — the name of one allergy. Applying it
 * to the capture meant a scanned discharge summary was cut off mid-word and filed as the name of
 * an allergy. The note is a document: the server takes 5000 of it.
 */
const MAX = 5000;

/** A claim's value really is capped at 300, and that cap belongs on the extracted item. */
const MAX_CLAIM_VALUE = 300;

/**
 * Past this, a capture is treated as a document to read rather than one fact typed in.
 *
 * Deliberately generous. "Amoxicillin 500mg three times daily after food" is one medicine, not a
 * report, and sending it through extraction would risk it coming back as two.
 */
const LOOKS_LIKE_A_DOCUMENT = 140;

/**
 * A photograph of a prescription is a prescription; a photograph of anything else is a
 * document. The patient is not asked, because the answer is already in the category they
 * picked and one more question before saving is one more reason not to bother.
 */
const kindFor = (category: AddCategory): 'PRESCRIPTION' | 'DOCUMENT' =>
  category === 'CURRENT_MEDICATIONS' ? 'PRESCRIPTION' : 'DOCUMENT';

/**
 * How a patient puts something into their own record.
 *
 * It used to be one text box, which meant the person who owns the record had the weakest tool
 * in the product: a health worker could photograph a result or speak a note, and the patient
 * — holding the actual paper — could only retype it from memory. This gives them the same
 * three ways in.
 *
 * What it deliberately does not do is let the document raise the entry's standing. A
 * photographed prescription is attached and shown to the next clinician, but the entry stays
 * self-reported until a person with credentials confirms it. Evidence you supply about
 * yourself is worth reviewing, not worth trusting on its own.
 */
export default function AddEntrySheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (entry: CreatedEntry) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<AddCategory>('ALLERGIES');
  const [mode, setMode] = useState<Mode>('TYPE');
  const [value, setValue] = useState('');
  const [photo, setPhoto] = useState<PhotoText | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const voice = useVoiceCapture();
  const whisper = useWhisperStatus();
  // Two different reasons Speak may not work, and they need different answers: the handset
  // build has no microphone module, or the speech model simply has not been downloaded.
  const canRecord = voiceAvailable();
  const voiceReady = canRecord && whisper.state === 'READY';

  const readPhoto = async (from: 'CAMERA' | 'LIBRARY') => {
    setError(null);
    setWorking(from === 'CAMERA' ? 'Reading the photo…' : 'Reading the image…');
    try {
      const result = from === 'CAMERA' ? await captureFromCamera() : await captureFromLibrary();
      if (!result) return;
      setPhoto(result);
      if (result.text.length === 0) {
        setError('No text could be read from that image. The photo is still attached — type what it says.');
        return;
      }
      // The scan fills the box so it can be edited down to the entry itself. The full text is
      // kept on the document, not forced into a one-line record entry.
      setValue(result.text.slice(0, MAX));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setWorking(null);
    }
  };

  const speak = async () => {
    setError(null);
    if (voice.stage === 'RECORDING') {
      setWorking('Transcribing…');
      try {
        const text = await voice.stopAndTranscribe();
        if (text && text.trim().length > 0) setValue(text.trim().slice(0, MAX));
        else setError('Nothing could be heard. Try again, closer to the microphone.');
      } finally {
        setWorking(null);
      }
      return;
    }
    await voice.start();
  };

  /**
   * What to file as the structured items inside this document.
   *
   * One short line typed under a chosen heading is exactly what it says it is, so it goes in as
   * that, with no model involved — somebody who picked "Allergy" and typed "Penicillin" should
   * not have their word reinterpreted. Anything longer, read off a photograph or dictated, is
   * read for the facts it contains.
   *
   * Extraction finding nothing is not a failure and never blocks the save: the document is the
   * thing being kept, and the items are an index into it.
   */
  const itemsFor = async (note: string): Promise<{ category: string; value: string }[]> => {
    const oneFact = mode === 'TYPE' && note.length <= LOOKS_LIKE_A_DOCUMENT;
    if (oneFact) return [{ category, value: note.slice(0, MAX_CLAIM_VALUE) }];
    try {
      const result = await structure(note);
      return result.items.map((i) => ({ category: i.category, value: i.value.slice(0, MAX_CLAIM_VALUE) }));
    } catch {
      return [];
    }
  };

  const submit = async () => {
    const note = value.trim();
    if (busy || note.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // One call, filing the capture as a document with whatever was found inside it. This used
      // to POST a single claim, which is why a whole report arrived as the 300-character name of
      // an allergy: the document had nowhere to live, so the heading became the document.
      const created = await api<CreatedEntry>('/patients/me/entries', {
        method: 'POST',
        body: {
          note: note.slice(0, MAX),
          captureMethod: mode === 'VOICE' ? 'VOICE' : mode === 'PHOTO' ? 'PHOTO' : 'TEXT',
          textSource: mode === 'VOICE' ? 'DICTATED' : mode === 'PHOTO' ? 'OCR' : 'TYPED',
          evidenceKind: kindFor(category),
          items: await itemsFor(note),
          ...(photo?.imageHash ? { imageHash: photo.imageHash } : {}),
        },
      });

      // After the save, never before: the picture is the patient's copy of a document that is
      // now on the record, and a failure to copy it must not cost them the entry.
      if (photo?.imageHash) await keepImage(photo.imageHash, photo.uri);

      onAdded(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  const keyboard = useKeyboardHeight();
  const recording = voice.stage === 'RECORDING';
  const canSave = !busy && value.trim().length > 0;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      {/*
        The field sits at the bottom of a sheet, which is exactly where the keyboard lands.
        
        This was a KeyboardAvoidingView, which is the usual answer and does nothing here: a Modal
        on Android is its own window and does not inherit the activity's adjustResize, so the
        sheet kept being laid out against the full screen height and the field stayed buried. The
        keyboard's own height is measured instead and the sheet is lifted by exactly that much.
        
        maxHeight shrinks alongside it, so a long capture scrolls inside what is left rather than
        pushing the Add button off the top.
      */}
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="gap-3 rounded-t-3xl bg-canvas p-5"
          style={{
            paddingBottom: keyboard > 0 ? 20 : 36,
            marginBottom: keyboard,
            maxHeight: keyboard > 0 ? '70%' : '88%',
          }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ink">Add to your record</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={C.muted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            <View className="gap-3">
              <View className="flex-row rounded-xl bg-track p-[3px]">
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    className={`h-9 flex-1 items-center justify-center rounded-[10px] ${
                      category === c.key ? 'border border-line bg-surface' : ''
                    }`}>
                    <Text
                      className={`text-[13px] ${category === c.key ? 'font-medium text-ink' : 'text-muted'}`}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* How it goes in. The same three the health worker has. */}
              <View className="flex-row gap-2">
                {MODES.map((m) => {
                  const active = mode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setMode(m.key)}
                      className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                        active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                      }`}>
                      <Feather name={m.icon} size={14} color={active ? C.primary : C.muted} />
                      <Text className={`text-[13px] ${active ? 'font-medium text-primary' : 'text-muted'}`}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mode === 'PHOTO' ? (
                <View className="gap-2.5 rounded-xl border border-line bg-surface p-3.5">
                  <Meta>
                    Photograph a prescription, a printed result or a discharge note. Printed text reads well;
                    handwriting usually does not, so type those.
                  </Meta>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => void readPhoto('CAMERA')}
                      disabled={working !== null}
                      className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary-soft">
                      <Feather name="camera" size={15} color={C.primary} />
                      <Text className="text-[13px] font-medium text-primary">Take a photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void readPhoto('LIBRARY')}
                      disabled={working !== null}
                      className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-fill">
                      <Feather name="image" size={15} color={C.muted} />
                      <Text className="text-[13px] font-medium text-ink">From photos</Text>
                    </Pressable>
                  </View>

                  {photo ? (
                    <View className="flex-row items-center gap-3 rounded-xl bg-fill p-2.5">
                      <Image source={{ uri: photo.uri }} className="h-12 w-12 rounded-lg" resizeMode="cover" />
                      <View className="flex-1 gap-0.5">
                        <Text className="text-[13px] font-medium text-ink">Document attached</Text>
                        <Meta>
                          {photo.imageHash
                            ? 'Stays on this phone. Only a fingerprint of it is sent.'
                            : 'Stays on this phone.'}
                        </Meta>
                      </View>
                      <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                        <Feather name="trash-2" size={16} color={C.muted} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {mode === 'VOICE' ? (
                <View className="gap-2.5 rounded-xl border border-line bg-surface p-3.5">
                  {!canRecord ? (
                    <View className="gap-1">
                      <Text className="text-[13px] font-medium text-ink">Speaking is not available on this build</Text>
                      <Text className="text-[13px] leading-5 text-muted">
                        This install does not include the microphone module. Use Type or Photo — a newer build will
                        add it.
                      </Text>
                    </View>
                  ) : voiceReady ? (
                    <>
                      <Meta>Say it in your own words. The audio never leaves this phone.</Meta>
                      <Pressable
                        onPress={() => void speak()}
                        disabled={working !== null}
                        className={`h-10 flex-row items-center justify-center gap-2 rounded-xl ${
                          recording ? 'bg-danger-soft' : 'bg-primary-soft'
                        }`}>
                        <Feather
                          name={recording ? 'square' : 'mic'}
                          size={15}
                          color={recording ? C.danger : C.primary}
                        />
                        <Text
                          className={`text-[13px] font-medium ${recording ? 'text-danger' : 'text-primary'}`}>
                          {recording ? 'Stop and read it back' : 'Start speaking'}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={() => router.push('/worker-model')} className="gap-1">
                      <Text className="text-[13px] font-medium text-ink">Speaking needs the speech model</Text>
                      <Text className="text-[13px] text-primary">Install it (about 32 MB)</Text>
                    </Pressable>
                  )}
                  {voice.error ? <Text className="text-sm text-danger">{voice.error}</Text> : null}
                </View>
              ) : null}

              {working ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text className="text-[13px] text-muted">{working}</Text>
                </View>
              ) : null}

              {/*
                Always multiline, and it grows. It used to be a single line for typing, which is
                the shape of a field that expects one word — so a pasted discharge summary scrolled
                sideways through a 52px slot with its beginning and end both out of sight.
              */}
              <TextInput
                className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base leading-[22px] text-ink"
                style={{ minHeight: mode === 'TYPE' ? 52 : 132, maxHeight: 260 }}
                placeholder={
                  mode === 'TYPE'
                    ? 'e.g. Penicillin — or paste a whole report'
                    : 'What was read goes here. Correct anything the scan got wrong.'
                }
                placeholderTextColor={C.hint}
                value={value}
                onChangeText={(t) => setValue(t.slice(0, MAX))}
                multiline
                textAlignVertical="top"
                scrollEnabled
                autoFocus={mode === 'TYPE'}
              />

              {/*
                Only once the end is actually in sight. A counter sitting under an empty field is
                a limit announcing itself before anyone has come near it.
              */}
              {value.length > MAX - 500 ? (
                <Text className="text-right text-[11px] text-muted">
                  {MAX - value.length} characters left
                </Text>
              ) : null}

              {/*
                Said before the save, not after, because it changes what someone types. A long
                capture is kept whole and read for what is in it; a short one is taken at its word.
              */}
              {value.trim().length > LOOKS_LIKE_A_DOCUMENT || mode !== 'TYPE' ? (
                <View className="flex-row items-start gap-2 rounded-xl bg-primary-soft px-3 py-2.5">
                  <Feather name="file-text" size={14} color={C.primary} style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-[12px] leading-[17px] text-ink">
                    This is kept as a document you can open and read in full. Allergies and medicines
                    found in it are listed underneath.
                  </Text>
                </View>
              ) : null}

              {error ? <Text className="text-sm text-danger">{error}</Text> : null}

              <Pressable
                onPress={() => void submit()}
                disabled={!canSave}
                className={`h-[52px] items-center justify-center rounded-xl ${canSave ? 'bg-primary' : 'bg-track'}`}>
                <Text className={`text-base font-medium ${canSave ? 'text-white' : 'text-muted'}`}>
                  {busy ? 'Saving…' : 'Add'}
                </Text>
              </Pressable>

              <Meta>
                {photo
                  ? 'Saved as self-reported with your document attached. A health worker can confirm it from the document.'
                  : 'This is saved as self-reported until a health worker confirms it.'}
              </Meta>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
