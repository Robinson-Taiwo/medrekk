import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dimensions, Modal, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { C } from '@/components/design/tokens';

/**
 * The short walk round the app somebody gets the first time they open it.
 *
 * Built here rather than pulled in, for two reasons. The libraries that do this want to wrap
 * every target in their own component and were written against older React Native; on 0.86 with
 * the new architecture that is a gamble to discover three days before a demo. And the whole
 * thing is a dimmed overlay, a hole, and a card — about as much code as configuring someone
 * else's version of it.
 *
 * The hole is four opaque rectangles arranged around the target rather than a mask, because
 * masking on Android means a library and a native view, and four Views are exact, cheap and
 * behave identically on both platforms.
 */

export interface TourStep {
  /** Matches the id given to useTourSpot. A step whose target is not on screen is skipped. */
  spot: string;
  title: string;
  body: string;
  /** Pushes the ring out from the target, so a tight icon is not strangled by its own highlight. */
  pad?: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourApi {
  /** Starts a tour, unless one is already running. */
  start: (id: string, steps: TourStep[], onDone?: () => void) => void;
  register: (spot: string, rect: Rect | null) => void;
  running: boolean;
}

const TourContext = createContext<TourApi | null>(null);

/**
 * Marks a thing the tour can point at.
 *
 * Spread onto the View that wraps it. Measuring happens on layout and again whenever the tour
 * advances, because a scroll or a rotation between registering and showing would otherwise
 * highlight the place the target used to be.
 */
export function useTourSpot(spot: string): {
  ref: (node: View | null) => void;
  onLayout: (e: LayoutChangeEvent) => void;
} {
  const api = useContext(TourContext);
  const node = useRef<View | null>(null);

  const measure = useCallback(() => {
    const target = node.current;
    if (!target || !api) return;
    // measureInWindow, not measure: the overlay is a full-screen Modal, so it needs the
    // position on the window rather than inside whatever parent happens to contain the target.
    target.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) api.register(spot, { x, y, width, height });
    });
  }, [api, spot]);

  useEffect(() => {
    return () => api?.register(spot, null);
  }, [api, spot]);

  return {
    ref: (n: View | null) => {
      node.current = n;
      if (n) requestAnimationFrame(measure);
    },
    onLayout: measure,
  };
}

export function useTour(): TourApi {
  return (
    useContext(TourContext) ?? {
      start: () => undefined,
      register: () => undefined,
      running: false,
    }
  );
}

const SCREEN = Dimensions.get('window');
const CARD_MARGIN = 16;

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [, setTick] = useState(0);
  const spots = useRef(new Map<string, Rect>());
  const finish = useRef<(() => void) | undefined>(undefined);

  const register = useCallback((spot: string, rect: Rect | null) => {
    if (rect) spots.current.set(spot, rect);
    else spots.current.delete(spot);
    // Nudges a render so a step waiting on a target that has just appeared can draw.
    setTick((t) => t + 1);
  }, []);

  const start = useCallback((_id: string, next: TourStep[], onDone?: () => void) => {
    setSteps((current) => {
      if (current) return current; // one at a time; a second request is ignored, not queued
      finish.current = onDone;
      setIndex(0);
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setSteps(null);
    setIndex(0);
    finish.current?.();
    finish.current = undefined;
  }, []);

  const api = useMemo<TourApi>(
    () => ({ start, register, running: steps !== null }),
    [start, register, steps],
  );

  // Steps whose target is actually on screen. A tab that this role does not have, or a card that
  // only exists once there is data, simply drops out rather than pointing at nothing.
  const live = useMemo(
    () => (steps ?? []).filter((s) => spots.current.has(s.spot)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, spots.current.size],
  );

  const step = live[index];
  const rect = step ? spots.current.get(step.spot) : undefined;

  useEffect(() => {
    if (steps !== null && live.length === 0) close();
  }, [steps, live.length, close]);

  if (!step || !rect) {
    return <TourContext.Provider value={api}>{children}</TourContext.Provider>;
  }

  const pad = step.pad ?? 8;
  const hole = {
    x: Math.max(0, rect.x - pad),
    y: Math.max(0, rect.y - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  // Below the target when there is room for the card, above it otherwise. A card that runs off
  // the bottom of the screen is the usual way these go wrong on a short phone.
  const below = hole.y + hole.height + 190 < SCREEN.height;
  const last = index === live.length - 1;

  return (
    <TourContext.Provider value={api}>
      {children}
      <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        {/* The four panes around the hole. Tapping any of them advances, which is what people
            try first, and the buttons below are for those who do not. */}
        <Pressable
          onPress={() => (last ? close() : setIndex((i) => i + 1))}
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={`${step.title}. ${step.body}. Tap to ${last ? 'finish' : 'continue'}.`}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hole.y, backgroundColor: 'rgba(11,26,23,0.82)' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.height, bottom: 0, backgroundColor: 'rgba(11,26,23,0.82)' }} />
          <View style={{ position: 'absolute', left: 0, top: hole.y, width: hole.x, height: hole.height, backgroundColor: 'rgba(11,26,23,0.82)' }} />
          <View style={{ position: 'absolute', left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height, backgroundColor: 'rgba(11,26,23,0.82)' }} />

          {/* The ring. Not a fill — the point is to see the real control, lit. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.x,
              top: hole.y,
              width: hole.width,
              height: hole.height,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: C.glow,
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: CARD_MARGIN,
              right: CARD_MARGIN,
              ...(below ? { top: hole.y + hole.height + 14 } : { bottom: SCREEN.height - hole.y + 14 }),
              borderRadius: 20,
              backgroundColor: C.surface,
              padding: 18,
              gap: 10,
            }}>
            <View className="flex-row items-center justify-between">
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.muted, letterSpacing: 0.6 }}>
                {index + 1} OF {live.length}
              </Text>
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip the tour">
                <Text style={{ fontSize: 13, color: C.muted }}>Skip</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '600', color: C.ink }}>{step.title}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: C.muted }}>{step.body}</Text>

            <View className="mt-1 flex-row items-center gap-2">
              {/* Progress as dots, so the end is visible from the first step. Nobody commits to
                  a tour of unknown length. */}
              <View className="flex-1 flex-row gap-1.5">
                {live.map((s, i) => (
                  <View
                    key={s.spot}
                    style={{
                      height: 5,
                      flex: 1,
                      borderRadius: 3,
                      backgroundColor: i <= index ? C.primary : C.track,
                    }}
                  />
                ))}
              </View>
              <Pressable
                onPress={() => (last ? close() : setIndex((i) => i + 1))}
                accessibilityRole="button"
                style={{
                  height: 42,
                  minWidth: 96,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 13,
                  backgroundColor: C.primary,
                  paddingHorizontal: 18,
                }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: '#FFFFFF' }}>
                  {last ? 'Got it' : 'Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </TourContext.Provider>
  );
}
