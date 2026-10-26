import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { MODEL_APPROX_MB, MODEL_LABEL, WHISPER_APPROX_MB, WHISPER_LABEL, formatMb } from '@/features/ai/modelConfig';
import { deleteModel, downloadModel, refreshModelStatus, useModelStatus } from '@/features/ai/modelStore';
import { deleteWhisper, downloadWhisper, refreshWhisperStatus, useWhisperStatus, type WhisperStatus } from '@/features/ai/whisperStore';
import { Card, Meta } from '@/components/design/primitives';
import { BottomTabInset } from '@/constants/theme';
import { Chrome, Note, Screen, Sheet } from '@/components/design/split';
import { C } from '@/components/design/tokens';
import { useFeedback } from '@/components/design/feedback';

interface ModelCardProps {
  label: string;
  approxMb: number;
  purpose: string;
  withoutIt: string;
  status: WhisperStatus;
  onDownload: () => void;
  onDelete: () => void;
}

function ModelCard({ label, approxMb, purpose, withoutIt, status, onDownload, onDelete }: ModelCardProps) {
  const { confirm } = useFeedback();
  const percent = status.totalBytes > 0 ? Math.min(100, Math.round((status.bytesWritten / status.totalBytes) * 100)) : 0;

  const confirmDelete = () =>
    void confirm({
      title: 'Remove this model?',
      body: withoutIt,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
      destructive: true,
    }).then((ok) => {
      if (ok) onDelete();
    });

  return (
    <Card className="gap-3 p-4">
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[15px] font-medium text-ink">{label}</Text>
          {status.state === 'READY' ? (
            <View className="h-6 flex-row items-center gap-1.5 rounded-full bg-primary-soft px-2.5">
              <Feather name="check" size={11} color={C.primary} />
              <Text className="text-xs font-medium text-primary">Installed</Text>
            </View>
          ) : (
            <Text className="text-xs text-muted">About {approxMb} MB</Text>
          )}
        </View>
        <Meta>{purpose}</Meta>
      </View>

      {status.state === 'DOWNLOADING' ? (
        <View className="gap-2">
          <View className="h-1.5 overflow-hidden rounded-full bg-track">
            <View className="h-1.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </View>
          <Meta>
            {formatMb(status.bytesWritten)} of {status.totalBytes > 0 ? formatMb(status.totalBytes) : 'unknown'}. Keep this screen open.
          </Meta>
        </View>
      ) : null}

      {status.state === 'READY' ? (
        <View className="gap-2">
          <Meta>{formatMb(status.sizeOnDisk)} on this device.</Meta>
          <Pressable onPress={confirmDelete} className="h-11 items-center justify-center rounded-xl border border-line bg-surface">
            <Text className="text-[13px] font-medium text-danger">Remove</Text>
          </Pressable>
        </View>
      ) : null}

      {status.state === 'MISSING' || status.state === 'FAILED' ? (
        <View className="gap-2">
          <Meta>{withoutIt}</Meta>
          {status.error ? <Text className="text-[13px] text-danger">{status.error}</Text> : null}
          <Pressable onPress={onDownload} className="h-11 items-center justify-center rounded-xl bg-primary">
            <Text className="text-[13px] font-medium text-white">{status.state === 'FAILED' ? 'Try again' : 'Download'}</Text>
          </Pressable>
        </View>
      ) : null}

      {status.state === 'UNKNOWN' ? <ActivityIndicator /> : null}
    </Card>
  );
}

export default function WorkerModelScreen() {
  const model = useModelStatus();
  const whisper = useWhisperStatus();

  useFocusEffect(
    useCallback(() => {
      void refreshModelStatus();
      void refreshWhisperStatus();
    }, []),
  );

  return (
    <Screen>
      <Chrome
        title="On this phone"
        subtitle="Both models run on the handset itself"
      />
      <Sheet>
        <Note>
          Nothing you record is sent anywhere while they work. Download them over Wi-Fi if you can.
        </Note>

        <ModelCard
          label={MODEL_LABEL}
          approxMb={MODEL_APPROX_MB}
          purpose="Turns a note into items for the record."
          withoutIt="Without it, notes are structured by simple rules instead, which still works."
          status={model}
          onDownload={() => void downloadModel()}
          onDelete={() => void deleteModel()}
        />

        <ModelCard
          label={WHISPER_LABEL}
          approxMb={WHISPER_APPROX_MB}
          purpose="Turns speech into text, so a note can be recorded by talking."
          withoutIt="Without it, Voice capture is unavailable and notes are typed."
          status={whisper}
          onDownload={() => void downloadWhisper()}
          onDelete={() => void deleteWhisper()}
        />

        <Meta>Together they take about {MODEL_APPROX_MB + WHISPER_APPROX_MB} MB. Either can be removed at any time.</Meta>
      </Sheet>
    </Screen>
  );
}
