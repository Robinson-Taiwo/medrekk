import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { api } from '@/services/api';
import { Meta } from '@/components/design/primitives';
import { captureFromCamera, captureFromLibrary, type PhotoText } from '@/features/ai/photo';
import { useVoiceCapture } from '@/features/ai/useVoiceCapture';
import { useWhisperStatus } from '@/features/ai/whisperStore';

export type AddCategory = 'ALLERGIES' | 'CURRENT_MEDICATIONS' | 'PAST_MEDICAL_HISTORY';

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

/** The server caps both at 300. Trimming here keeps a long scan from being refused outright. */
const MAX = 300;

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
  onAdded: (claim: AddedClaim) => void;
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
  const voiceReady = whisper.state === 'READY';

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

  const submit = async () => {
    const entry = value.trim();
    if (busy || entry.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<AddedClaim>('/patients/me/claims', {
        method: 'POST',
        body: { category, value: entry.slice(0, MAX) },
      });

      // Attached second and deliberately not fatal: the entry is the thing the patient asked
      // for, and losing the attachment must not lose the entry.
      if (photo) {
        try {
          await api(`/patients/me/claims/${created.id}/evidence`, {
            method: 'POST',
            body: {
              kind: kindFor(category),
              description:
                photo.text.trim().length >= 3
                  ? photo.text.trim().slice(0, MAX)
                  : `Photograph taken by the patient (${photo.source === 'CAMERA' ? 'camera' : 'from photos'})`,
              captureMethod: 'OCR',
              ...(photo.imageHash ? { imageHash: photo.imageHash } : {}),
            },
          });
        } catch {
          // Shown on the next screen as an entry with no document rather than an error here.
        }
      }

      onAdded(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  const recording = voice.stage === 'RECORDING';
  const canSave = !busy && value.trim().length > 0;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[88%] gap-3 rounded-t-3xl bg-canvas p-5 pb-9">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ink">Add to your record</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color="#5D6C82" />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                      <Feather name={m.icon} size={14} color={active ? '#0F6E56' : '#5D6C82'} />
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
                      <Feather name="camera" size={15} color="#0F6E56" />
                      <Text className="text-[13px] font-medium text-primary">Take a photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void readPhoto('LIBRARY')}
                      disabled={working !== null}
                      className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-fill">
                      <Feather name="image" size={15} color="#5D6C82" />
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
                        <Feather name="trash-2" size={16} color="#5D6C82" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {mode === 'VOICE' ? (
                <View className="gap-2.5 rounded-xl border border-line bg-surface p-3.5">
                  {voiceReady ? (
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
                          color={recording ? '#CE2B2B' : '#0F6E56'}
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
                  <ActivityIndicator size="small" color="#0F6E56" />
                  <Text className="text-[13px] text-muted">{working}</Text>
                </View>
              ) : null}

              <TextInput
                className="min-h-[52px] rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink"
                placeholder={mode === 'TYPE' ? 'e.g. Penicillin' : 'What was read goes here — edit it down'}
                placeholderTextColor="#7C8A9C"
                value={value}
                onChangeText={(t) => setValue(t.slice(0, MAX))}
                multiline={mode !== 'TYPE'}
                autoFocus={mode === 'TYPE'}
              />

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
