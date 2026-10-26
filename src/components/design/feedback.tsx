import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';

import { C } from './tokens';

/**
 * Telling somebody something, and asking them something.
 *
 * Both used to be Alert.alert, which is the operating system's dialog: a grey slab in the middle
 * of the screen, in the system font, that looks the same in every app on the phone and nothing
 * like this one. It also blocks — the app stops until it is dismissed — which is far too much
 * ceremony for "that did not save".
 *
 * So the two cases are separated here, because they were never the same thing:
 *
 *   toast   — something happened and there is nothing to decide. Arrives at the top, leaves on
 *             its own, never takes the screen. Failure to save a form belongs here.
 *   confirm — something is about to be destroyed and the answer must come from a person. Still
 *             interrupts, deliberately, because that is the whole point of asking.
 */

type Tone = 'ok' | 'error' | 'info';

interface ToastSpec {
  tone: Tone;
  title: string;
  body?: string;
}

interface ConfirmSpec {
  title: string;
  body?: string;
  /** The word on the button that does the thing. Never "OK": say what will happen. */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface Feedback {
  toast: (spec: ToastSpec) => void;
  /** Resolves true when the person chose to go ahead. Never rejects. */
  confirm: (spec: ConfirmSpec) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

const TONE: Record<Tone, { icon: keyof typeof Feather.glyphMap; fg: string; bg: string; border: string }> = {
  ok: { icon: 'check-circle', fg: C.primary, bg: C.primarySoft, border: 'rgba(15,110,86,0.18)' },
  error: { icon: 'alert-circle', fg: C.danger, bg: C.dangerSoft, border: 'rgba(206,43,43,0.18)' },
  info: { icon: 'info', fg: C.muted, bg: C.neutralSoft, border: C.line },
};

/** Long enough to read a sentence; an error gets longer, because it is usually unexpected. */
const DWELL: Record<Tone, number> = { ok: 2600, error: 4200, info: 3200 };

function Toast({ spec, onDone }: { spec: ToastSpec; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const tone = TONE[spec.tone];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      timer = setTimeout(dismiss, DWELL[spec.tone]);
    });
    return () => clearTimeout(timer);
    // The spec identity is the toast's identity: a new one mounts a new component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(onDone);
  }, [onDone, slide]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`${spec.title}. ${spec.body ?? ''} Tap to dismiss.`}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tone.border,
          backgroundColor: C.surface,
          paddingHorizontal: 14,
          paddingVertical: 12,
          // A toast floats over whatever it interrupts, so it needs to look lifted or it reads
          // as part of the screen underneath it.
          shadowColor: '#0B1A17',
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}>
        <View
          style={{
            height: 26,
            width: 26,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            backgroundColor: tone.bg,
          }}>
          <Feather name={tone.icon} size={14} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{spec.title}</Text>
          {spec.body ? (
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: C.muted }}>{spec.body}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ConfirmSheet({
  spec,
  onAnswer,
}: {
  spec: ConfirmSpec;
  onAnswer: (ok: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const danger = spec.destructive === true;

  return (
    <Modal transparent animationType="slide" onRequestClose={() => onAnswer(false)}>
      <Pressable
        onPress={() => onAnswer(false)}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,26,23,0.45)' }}>
        {/* Swallows the tap so pressing the sheet itself is not a dismissal. */}
        <Pressable
          onPress={() => undefined}
          style={{
            gap: 14,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: C.canvas,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 10,
          }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View
              style={{
                height: 44,
                width: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 15,
                backgroundColor: danger ? C.dangerSoft : C.primarySoft,
              }}>
              <Feather
                name={danger ? 'alert-triangle' : 'help-circle'}
                size={20}
                color={danger ? C.danger : C.primary}
              />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: C.ink, textAlign: 'center' }}>
              {spec.title}
            </Text>
            {spec.body ? (
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: C.muted, textAlign: 'center' }}>
                {spec.body}
              </Text>
            ) : null}
          </View>

          {/* Cancel first and widest-looking on purpose: the destructive button should take a
              deliberate reach, not sit where the thumb already is. */}
          <View style={{ gap: 9 }}>
            <Pressable
              onPress={() => onAnswer(true)}
              accessibilityRole="button"
              style={{
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 15,
                backgroundColor: danger ? C.danger : C.primary,
              }}>
              <Text style={{ fontSize: 15.5, fontWeight: '600', color: '#FFFFFF' }}>{spec.confirmLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => onAnswer(false)}
              accessibilityRole="button"
              style={{
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 15,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.surface,
              }}>
              <Text style={{ fontSize: 15.5, fontWeight: '500', color: C.ink }}>
                {spec.cancelLabel ?? 'Cancel'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; spec: ToastSpec }[]>([]);
  const [ask, setAsk] = useState<{ spec: ConfirmSpec; resolve: (ok: boolean) => void } | null>(null);
  const nextId = useRef(0);

  const value = useMemo<Feedback>(
    () => ({
      toast: (spec) => {
        const id = nextId.current++;
        // Only ever one on screen. Two stacked toasts is a log, and nobody reads a log.
        setToasts([{ id, spec }]);
      },
      confirm: (spec) =>
        new Promise<boolean>((resolve) => {
          setAsk({ spec, resolve });
        }),
    }),
    [],
  );

  const answer = useCallback(
    (ok: boolean) => {
      setAsk((current) => {
        current?.resolve(ok);
        return null;
      });
    },
    [],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {/* box-none so the rest of the screen stays usable while a toast is up. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        {toasts.map((t) => (
          <Toast key={t.id} spec={t.spec} onDone={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </View>
      {ask ? <ConfirmSheet spec={ask.spec} onAnswer={answer} /> : null}
    </FeedbackContext.Provider>
  );
}

/**
 * Outside the provider this returns working no-ops rather than throwing. A missing provider must
 * never be the reason a save fails: the worst case is a message nobody sees, and a confirm that
 * declines, which is the safe answer to "shall I delete this".
 */
export function useFeedback(): Feedback {
  const found = useContext(FeedbackContext);
  return (
    found ?? {
      toast: () => undefined,
      confirm: async () => false,
    }
  );
}

/** The message under an unknown failure, in one place so it reads the same everywhere. */
export function reasonFor(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof Error && e.message.trim().length > 0) return e.message;
  return fallback;
}
