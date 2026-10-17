import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkerSession } from '@/features/worker/workerSession';
import { useModelStatus } from '@/features/ai/modelStore';
import { Card, Meta } from '@/components/design/primitives';
import { BottomTabInset } from '@/constants/theme';

export default function WorkerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const session = useWorkerSession();
  const model = useModelStatus();

  const approved = session?.status === 'APPROVED';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: BottomTabInset + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-0.5">
          <Meta>Health worker</Meta>
          <Text className="text-2xl font-semibold tracking-tight text-ink">
            {(user?.fullName ?? '').trim().split(/\s+/)[0] ?? ''}
          </Text>
        </View>

        {approved && session ? (
          <View className="gap-3.5 rounded-2xl bg-ink p-4">
            <Text className="text-xs font-medium text-white/70">Current patient</Text>
            <View className="gap-1">
              <Text className="text-xl font-semibold text-white">{session.patientName}</Text>
              <Text className="text-sm tracking-widest text-white/60">{session.medrekkCode}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/worker-encounter')}
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-surface">
              <Feather name="edit-3" size={16} color="#142D2A" />
              <Text className="text-[15px] font-medium text-ink">Record an encounter</Text>
            </Pressable>
          </View>
        ) : (
          <Card className="items-center gap-3 px-5 py-7">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-fill">
              <Feather name="search" size={22} color="#5D6C82" />
            </View>
            <Text className="text-[17px] font-semibold text-ink">No patient yet</Text>
            <Text className="max-w-[280px] text-center text-sm leading-5 text-muted">
              Find a patient by their MedRekk code and name. They approve on their own phone before you can record
              anything.
            </Text>
            <Pressable
              onPress={() => router.push('/worker-patient')}
              className="mt-1 h-11 justify-center rounded-xl bg-primary px-5">
              <Text className="text-[15px] font-medium text-white">Find a patient</Text>
            </Pressable>
          </Card>
        )}

        <View className="gap-2">
          <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">On-device AI</Text>
          <Pressable onPress={() => router.push('/worker-model')}>
            <Card className="flex-row items-center gap-3 p-3.5">
              <View
                className={`h-[38px] w-[38px] items-center justify-center rounded-[10px] ${
                  model.state === 'READY' ? 'bg-primary-soft' : 'bg-fill'
                }`}>
                <Feather name="cpu" size={18} color={model.state === 'READY' ? '#0F6E56' : '#5D6C82'} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-ink">
                  {model.state === 'READY' ? 'Model installed' : 'Model not installed'}
                </Text>
                <Meta>
                  {model.state === 'READY'
                    ? 'Notes are structured on this phone, with no internet'
                    : 'Without it, notes are structured by simple rules'}
                </Meta>
              </View>
              <Feather name="chevron-right" size={18} color="#5D6C82" />
            </Card>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
