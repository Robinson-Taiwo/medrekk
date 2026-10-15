import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export type Tone = 'verified' | 'pending' | 'unverified' | 'danger' | 'neutral';

const TONE: Record<Tone, string> = {
  verified: 'bg-primary-soft',
  pending: 'bg-warn-soft',
  unverified: 'bg-neutral-soft',
  danger: 'bg-danger-soft',
  neutral: 'bg-fill',
};

const TONE_TEXT: Record<Tone, string> = {
  verified: 'text-primary',
  pending: 'text-warn',
  unverified: 'text-muted',
  danger: 'text-danger',
  neutral: 'text-ink',
};

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <View className={`h-6 flex-row items-center gap-1.5 self-start rounded-full px-2.5 ${TONE[tone]}`}>
      <Text className={`text-xs font-medium ${TONE_TEXT[tone]}`}>{children}</Text>
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-xl border border-line bg-surface ${className}`}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-[13px] font-medium text-primary">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text className="text-[11px] font-medium uppercase tracking-wider text-muted">{children}</Text>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <Text className="text-xs text-muted">{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-[52px] flex-row items-center justify-center rounded-xl ${disabled ? 'bg-dim' : 'bg-primary'}`}>
      <Text className="text-base font-medium text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-[52px] flex-row items-center justify-center rounded-xl border border-line bg-surface">
      <Text className="text-base font-medium text-ink">{label}</Text>
    </Pressable>
  );
}

/** The design's pill-shaped segmented control, used for scopes, durations and capture modes. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row rounded-xl bg-track p-[3px]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`h-9 flex-1 items-center justify-center rounded-[10px] ${
              active ? 'border border-line bg-surface' : ''
            }`}>
            <Text className={`text-[13px] ${active ? 'font-medium text-ink' : 'text-muted'}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
