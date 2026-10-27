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
/**
 * `soft` is a class, for a className. `wash` is the same colour as a value, for the places a
 * class cannot reach — a backgroundColor computed at runtime, which is what the card tile needs.
 */
export const STANDING: Record<Standing, { label: string; line: string; text: string; soft: string; wash: string }> = {
  CLINICALLY_VERIFIED: { label: 'Confirmed by a clinician', line: C.primary, text: 'text-primary', soft: 'bg-primary-soft', wash: C.primarySoft },
  EVIDENCE_BACKED: { label: 'Backed by a document', line: C.evidence, text: 'text-evidence', soft: 'bg-evidence-soft', wash: C.evidenceSoft },
  SELF_REPORTED: { label: 'You added this', line: C.muted, text: 'text-muted', soft: 'bg-neutral-soft', wash: C.neutralSoft },
  UNVERIFIED: { label: 'Not yet reviewed', line: C.warn, text: 'text-warn', soft: 'bg-warn-soft', wash: C.warnSoft },
  ALERT: { label: 'Allergy', line: C.danger, text: 'text-danger', soft: 'bg-danger-soft', wash: C.dangerSoft },
};

/* ---------------------------------------------------------------- *
 * Frame
 * ---------------------------------------------------------------- */

/**
 * The dark base every Split screen sits on. The sheet covers most of it.
 *
 * `topInset={false}` when something above has already claimed the status-bar space — the
 * offline banner does, and without this the two of them each add it and the screen starts a
 * notch too low.
 */
export function Screen({ children, topInset = true }: { children: ReactNode; topInset?: boolean }) {
  return (
    <SafeAreaView className="flex-1 bg-night" edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}>
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

  /*
   * A card, not a row in a table.
   *
   * These were hairline-divided rows with a 3px keyline — correct, dense, and completely
   * uniform, so a list of six read as one grey block and nothing in it invited a tap. Cards
   * separated by space on a tinted page do the same job while giving each entry an edge, and
   * the standing moves from a thin line into a colour-washed tile that is actually visible at
   * arm's length.
   *
   * Separation by shadow rather than border: a border drawn around every card in a list adds
   * five more lines to the screen, and lines are what made the old version feel like a form.
   */
  const body = (
    <View
      className="mx-4 mb-2.5 flex-row items-center gap-3 overflow-hidden rounded-2xl bg-surface p-3"
      style={{
        shadowColor: '#0B1A17',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}>
      {/* The leading tile. Carries the standing's colour as a wash, so the state is legible
          before a single word is read. */}
      <View
        className="h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: tone.wash }}>
        <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: tone.line }} />
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="text-[15px] font-semibold leading-[20px] tracking-tight text-ink">
          {title}
        </Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Text className={`text-[12px] font-medium ${tone.text}`}>{tone.label}</Text>
          {meta ? <Text className="text-[12px] text-dim">·</Text> : null}
          {meta ? (
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] text-muted">
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      {right ? <Text className="shrink-0 text-[12px] text-muted">{right}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={C.dim} /> : null}
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

/**
 * Nothing here yet — which is a state worth designing, not an absence to apologise for.
 *
 * An empty screen is the first thing most people see, and the version that says only "no
 * items" teaches them nothing and leaves them nowhere to go. Each of these says what the
 * screen is for, what will fill it, and offers the one thing worth doing now. `hints` carry
 * the detail that would otherwise bloat the sentence.
 */
export function Empty({
  icon = 'inbox',
  title,
  body,
  hints,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  /** Concrete things that will appear here, or ways to fill it. Three at most. */
  hints?: { icon: keyof typeof Feather.glyphMap; label: string }[];
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-surface">
      <View className="items-center gap-2.5 px-6 pb-6 pt-8">
        {/* A tinted disc rather than a grey one: an empty record is a normal state, not a fault. */}
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
          <Feather name={icon} size={22} color={C.primary} />
        </View>
        <Text className="text-[17px] font-semibold tracking-tight text-ink">{title}</Text>
        <Text className="max-w-[300px] text-center text-[13px] leading-[19px] text-muted">{body}</Text>

        {action && onAction ? (
          <Pressable onPress={onAction} className="mt-2 h-11 justify-center rounded-xl bg-primary px-5">
            <Text className="text-[15px] font-medium text-white">{action}</Text>
          </Pressable>
        ) : null}
        {secondary && onSecondary ? (
          <Pressable onPress={onSecondary} hitSlop={8} className="pt-1">
            <Text className="text-[13px] font-medium text-primary">{secondary}</Text>
          </Pressable>
        ) : null}
      </View>

      {hints && hints.length > 0 ? (
        <View className="gap-2.5 border-t border-line bg-fill px-5 py-4">
          {hints.map((h) => (
            <View key={h.label} className="flex-row items-center gap-2.5">
              <Feather name={h.icon} size={14} color={C.muted} />
              <Text className="flex-1 text-[12.5px] leading-[18px] text-muted">{h.label}</Text>
            </View>
          ))}
        </View>
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
