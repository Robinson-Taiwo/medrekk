import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatSaved(savedAt: string): string {
  const d = new Date(savedAt);
  return Number.isNaN(d.getTime()) ? "an earlier visit" : d.toLocaleString();
}

export default function OfflineBanner({ savedAt }: { savedAt: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-amber-100 px-4 pb-2 dark:bg-amber-900" style={{ paddingTop: insets.top + 8 }}>
      <Text className="text-sm font-semibold text-amber-900 dark:text-amber-100">Offline</Text>
      <Text className="text-xs text-amber-900 dark:text-amber-100">
        Showing information saved on {formatSaved(savedAt)}. Changes need a connection.
      </Text>
    </View>
  );
}
