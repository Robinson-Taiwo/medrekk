import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { C } from './tokens';
import { BottomTabInset } from '@/constants/theme';

/**
 * The Split layout: dark chrome, bright content.
 *
 * The brand lives in the frame — the bar at the top, the bar at the bottom — and the record
 * itself sits on near-white. That split is not decoration. The app is used in daylight, often
 * on a cheap screen with the brightness down, and a dark surface is the worst possible place
 * to read a list of medicines; but a wholly light app had nothing of MedRekk in it and looked
 * like a form. This keeps the identity where it costs nothing and the legibility where it
 * matters.
 *
 * Every screen is built from these pieces so there is one answer to what a header, a row and
 * a primary action look like.
 */

/* ---------------------------------------------------------------- *
 * Standing
 * ---------------------------------------------------------------- */

export type Standing = 'CLINICALLY_VERIFIED' | 'EVIDENCE_BACKED' | 'SELF_REPORTED' | 'UNVERIFIED' | 'ALERT';

/**
 * How an entry got here, as a word and a colour — never a colour alone. Colour is the thing
 * that is read at a glance and the thing a colour-blind reader cannot use, so the word always
 * travels with it.
 */
export const STANDING: Record<Standing, { label: string; line: string; text: string; soft: string }> = {
  CLINICALLY_VERIFIED: { label: 'Confirmed by a clinician', line: C.primary, text: 'text-primary', soft: 'bg-primary-soft' },
  EVIDENCE_BACKED: { label: 'Backed by a document', line: C.evidence, text: 'text-evidence', soft: 'bg-evidence-soft' },
  SELF_REPORTED: { label: 'You added this', line: C.muted, text: 'text-muted', soft: 'bg-neutral-soft' },
  UNVERIFIED: { label: 'Not yet reviewed', line: C.warn, text: 'text-warn', soft: 'bg-warn-soft' },
  ALERT: { label: 'Allergy', line: C.danger, text: 'text-danger', soft: 'bg-danger-soft' },
};

/* ---------------------------------------------------------------- *
 * Frame
 * ---------------------------------------------------------------- */

/** The dark base every Split screen sits on. The sheet covers most of it. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-night" edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

/**
 * The dark band at the top: who this is and where you are. `back` turns the title into a
 * return, `right` takes a status or an action.
 */
export function Chrome({
  title,
  subtitle,
  right,
  onBack,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  compact?: boolean;
}) {
  return (
    <View className={`px-5 ${compact ? 'pb-3 pt-2' : 'pb-4 pt-3'}`}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} className="mb-2 flex-row items-center gap-1.5 self-start">
          <Feather name="chevron-left" size={16} color={C.mistDim} />
          <Text className="text-[13px] font-medium text-mist-dim">Back</Text>
        </Pressable>
      ) : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[21px] font-semibold leading-[26px] tracking-tight text-mist">{title}</Text>
          {subtitle ? <Text className="mt-1 text-[12px] text-mist-dim">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** A small status marker for the chrome: synced, offline, pending. */
export function ChromeTag({
  label,
  tone = 'ok',
}: {
  label: string;
  tone?: 'ok' | 'warn' | 'quiet';
}) {
  const colour = tone === 'ok' ? C.glow : tone === 'warn' ? C.glowWarn : C.mistDim;
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colour }} />
      <Text className="text-[11px] font-semibold" style={{ color: colour }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The bright reading surface. Scrolls by default; pass `scroll={false}` for a screen that
 * manages its own list.
 */
export function Sheet({
  children,
  scroll = true,
  pad = true,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ paddingBottom: BottomTabInset + 24, ...(pad ? { padding: 20, gap: 14 } : {}) }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );
  return <View className="flex-1 overflow-hidden rounded-t-[26px] bg-canvas">{body}</View>;
}

/** The dark footer. A single clear action, with a line of context under it when needed. */
export function BottomBar({
  label,
  onPress,
  note,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  note?: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const off = disabled || busy;
  return (
    <View className="bg-night px-5 pb-4 pt-3">
      <Pressable
        onPress={onPress}
        disabled={off}
        className="h-[52px] items-center justify-center rounded-2xl"
        style={{ backgroundColor: off ? C.nightTrack : C.glow }}>
        {/* Ink on glow is 7.56:1; white on it is 2.36:1, so the label is dark. */}
        <Text className="text-[16px] font-semibold" style={{ color: off ? C.mistFaint : C.glowInk }}>
          {busy ? 'Working…' : label}
        </Text>
      </Pressable>
      {note ? <Text className="mt-2 text-center text-[11px] text-mist-dim">{note}</Text> : null}
    </View>
  );
}

/* ---------------------------------------------------------------- *
 * Sheet contents
 * ---------------------------------------------------------------- */

/** A section title on the sheet, with an optional count or action on the right. */
export function Heading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-[17px] font-semibold tracking-tight text-ink">{children}</Text>
      {right}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text className="text-[12px] leading-[18px] text-muted">{children}</Text>;
}

/**
 * One entry in the record. The coloured edge is the fast read and the word underneath is the
 * accurate one; neither is on its own enough.
 */
export function EntryRow({
  title,
  standing,
  meta,
  right,
  onPress,
}: {
  title: string;
  standing: Standing;
  meta?: string;
  right?: string;
  onPress?: () => void;
}) {
  const tone = STANDING[standing];
  const body = (
    <View className="flex-row gap-3 border-b border-line px-5 py-3">
      <View className="mt-[3px] w-[3px] rounded-full" style={{ backgroundColor: tone.line }} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold leading-[20px] tracking-tight text-ink">{title}</Text>
        <Text className={`mt-1 text-[12px] font-medium ${tone.text}`}>{tone.label}</Text>
        {meta ? <Text className="mt-0.5 text-[12px] text-muted">{meta}</Text> : null}
      </View>
      {right ? <Text className="pt-0.5 text-[12px] text-muted">{right}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={C.dim} style={{ marginTop: 2 }} /> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** Filters and other one-of-many choices. Solid ink when chosen, not an outline. */
export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`h-9 justify-center rounded-xl px-3.5 ${active ? 'bg-ink' : 'bg-fill'}`}>
            <Text className={`text-[13px] font-medium ${active ? 'text-white' : 'text-muted'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A block that needs attention but is not an error: a waiting request, a pending licence. */
export function Callout({
  tone = 'warn',
  kicker,
  title,
  children,
  action,
  onAction,
}: {
  tone?: 'warn' | 'danger' | 'quiet';
  kicker?: string;
  title: string;
  children?: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  const skin =
    tone === 'danger'
      ? { bg: 'bg-danger-soft', fg: 'text-danger' }
      : tone === 'quiet'
        ? { bg: 'bg-fill', fg: 'text-muted' }
        : { bg: 'bg-warn-soft', fg: 'text-warn' };
  return (
    <View className={`gap-2 rounded-2xl p-4 ${skin.bg}`}>
      {kicker ? (
        <Text className={`text-[11px] font-bold uppercase tracking-[1.2px] ${skin.fg}`}>{kicker}</Text>
      ) : null}
      <Text className="text-[16px] font-semibold leading-[21px] tracking-tight text-ink">{title}</Text>
      {children}
      {action && onAction ? (
        <Pressable onPress={onAction} className="mt-1 h-10 items-center justify-center rounded-xl bg-ink px-4">
          <Text className="text-[14px] font-semibold text-white">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Nothing here yet, said in a way that explains rather than apologises. */
export function Empty({
  icon = 'inbox',
  title,
  body,
  action,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-2.5 rounded-2xl border border-line bg-surface px-6 py-9">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-fill">
        <Feather name={icon} size={20} color={C.muted} />
      </View>
      <Text className="text-[16px] font-semibold tracking-tight text-ink">{title}</Text>
      <Text className="text-center text-[13px] leading-[19px] text-muted">{body}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} className="mt-1 h-10 justify-center rounded-xl bg-primary px-4">
          <Text className="text-[14px] font-medium text-white">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The legend. A colour system nobody can decode is decoration. */
export function StandingLegend() {
  const shown: Standing[] = ['CLINICALLY_VERIFIED', 'EVIDENCE_BACKED', 'SELF_REPORTED', 'ALERT'];
  return (
    <View className="gap-2 px-5 py-4">
      <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-muted">What the colours mean</Text>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((s) => (
          <View key={s} className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-[3px] rounded-full" style={{ backgroundColor: STANDING[s].line }} />
            <Text className="text-[11px] text-muted">{STANDING[s].label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
