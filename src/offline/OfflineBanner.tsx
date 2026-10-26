import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatSaved(savedAt: string): string {
  const d = new Date(savedAt);
  return Number.isNaN(d.getTime()) ? "an earlier visit" : d.toLocaleString();
}

export default function OfflineBanner({ savedAt }: { savedAt: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-warn-soft px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
      <Text className="text-sm font-semibold text-warn">Offline</Text>
      <Text className="text-xs text-warn">
        Showing information saved on {formatSaved(savedAt)}. Changes need a connection.
      </Text>
    </View>
  );
}
