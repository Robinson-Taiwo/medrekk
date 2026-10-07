import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmergencyCard from "@/features/emergency/EmergencyCard";
import EmergencyEditor from "@/features/emergency/EmergencyEditor";
import { PROFILE_PATH, type EmergencyProfileData } from "@/features/emergency/types";
import { writeCache } from "@/offline/cache";
import { fetchWithCache } from "@/offline/cachedFetch";
import OfflineBanner from "@/offline/OfflineBanner";

const CACHE_KEY = "emergency-profile";

export default function EmergencyProfileScreen() {
  const [profile, setProfile] = useState<EmergencyProfileData | null>(null);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchWithCache<EmergencyProfileData>(CACHE_KEY, PROFILE_PATH);
      setProfile(result.data);
      setOfflineSavedAt(result.fromCache ? result.savedAt : null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!editing) void load();
    }, [load, editing]),
  );

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-white p-6 dark:bg-black">
        {error ? (
          <View className="items-center gap-3">
            <Text className="text-center text-sm text-red-700">{error}</Text>
            <Pressable onPress={() => void load()} className="rounded-xl bg-[#0F6E56] px-5 py-3">
              <Text className="font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <EmergencyEditor
        profile={profile}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setProfile(updated);
          setOfflineSavedAt(null);
          setEditing(false);
          void writeCache(CACHE_KEY, updated).catch(() => undefined);
        }}
      />
    );
  }

  if (!offlineSavedAt) {
    return <EmergencyCard profile={profile} onEdit={() => setEditing(true)} />;
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <OfflineBanner savedAt={offlineSavedAt} />
      <EmergencyCard profile={profile} onEdit={() => setEditing(true)} />
    </View>
  );
}
