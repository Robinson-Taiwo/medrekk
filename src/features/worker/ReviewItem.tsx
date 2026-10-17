import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { CATEGORY_LABELS, CLAIM_CATEGORIES, type ClaimCategory, type DraftItem } from './workerApi';

export interface ReviewEntry extends DraftItem {
  confirmed?: boolean;
}

interface Props {
  item: ReviewEntry;
  index: number;
  fromAi: boolean;
  onChange: (index: number, patch: Partial<ReviewEntry>) => void;
  onRemove: (index: number) => void;
}

function nextCategory(category: ClaimCategory): ClaimCategory {
  const at = CLAIM_CATEGORIES.indexOf(category) + 1;
  return CLAIM_CATEGORIES[at % CLAIM_CATEGORIES.length] ?? category;
}

export default function ReviewItem({ item, index, fromAi, onChange, onRemove }: Props) {
  const confirmed = item.confirmed === true;

  return (
    <View
      className={`gap-2 rounded-xl bg-surface px-3.5 py-3 ${
        confirmed ? 'border border-line' : 'border border-dashed border-dim'
      }`}>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => onChange(index, { category: nextCategory(item.category) })} hitSlop={6}>
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {CATEGORY_LABELS[item.category]}
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-1.5">
          {confirmed ? (
            <View className="h-6 flex-row items-center gap-1.5 rounded-full bg-primary-soft px-2.5">
              <Feather name="check" size={11} color="#0F6E56" />
              <Text className="text-xs font-medium text-primary">Confirmed by you</Text>
            </View>
          ) : (
            <>
              {fromAi ? (
                <View className="h-6 flex-row items-center gap-1.5 rounded-full bg-neutral-soft px-2.5">
                  <Feather name="zap" size={11} color="#5D6C82" />
                  <Text className="text-xs font-medium text-muted">AI draft</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => onChange(index, { confirmed: true })}
                className="h-6 flex-row items-center gap-1 rounded-lg border border-line px-2.5">
                <Feather name="check" size={11} color="#142D2A" />
                <Text className="text-xs font-medium text-ink">Confirm</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={() => onRemove(index)} hitSlop={8} className="pl-1">
            <Feather name="x" size={16} color="#7C8A9C" />
          </Pressable>
        </View>
      </View>

      <TextInput
        value={item.value}
        onChangeText={(value) => onChange(index, { value, confirmed: false })}
        multiline
        placeholder="What was recorded"
        placeholderTextColor="#7C8A9C"
        className="text-[15px] font-medium leading-[21px] text-ink"
      />
    </View>
  );
}
