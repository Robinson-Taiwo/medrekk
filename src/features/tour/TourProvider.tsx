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
import { Modal, Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
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

/**
 * Deliberately holds nothing that changes while a tour runs.
 *
 * This used to carry `running: steps !== null`, which meant the context value got a new identity
 * the instant a tour started. Every useTourSpot has a cleanup keyed on that value, so starting
 * the tour ran all of them at once and unregistered every target it was about to point at — the
 * tour appeared, found nothing on screen, and closed itself. About one second, which is exactly
 * what it looked like.
 *
 * Keep this stable. Anything that changes per step belongs in state inside the provider.
 */
interface TourApi {
  /** Starts a tour, unless one is already running. */
  start: (id: string, steps: TourStep[], onDone?: () => void) => void;
  register: (spot: string, rect: Rect | null) => void;
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

  // Stable, so React does not detach and reattach the ref on every render — which, with the
  // measure that follows it, meant every render scheduled another measurement.
  const ref = useCallback(
    (n: View | null) => {
      node.current = n;
      if (n) requestAnimationFrame(measure);
    },
    [measure],
  );

  return { ref, onLayout: measure };
}

/** Stable no-op outside a provider, so it does not become a new object on every render either. */
const NO_TOUR: TourApi = { start: () => undefined, register: () => undefined };

export function useTour(): TourApi {
  return useContext(TourContext) ?? NO_TOUR;
}

const CARD_MARGIN = 16;
/** Clear air between the card and the thing it is pointing at. The connector crosses it. */
const GAP = 22;

export function TourProvider({ children }: { children: ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  // Bumped whenever a target registers or moves. Used as the memo dependency below, because a
  // ref's contents are invisible to React and `spots.current.size` is read during render — it
  // cannot be depended on to recompute anything.
  const [version, setVersion] = useState(0);
  const spots = useRef(new Map<string, Rect>());
  const finish = useRef<(() => void) | undefined>(undefined);
  // Read per render rather than once at module load, so a rotation or a resized window does not
  // leave the overlay drawing against a screen size that no longer exists.
  const { width: screenW, height: screenH } = useWindowDimensions();

  const register = useCallback((spot: string, rect: Rect | null) => {
    const current = spots.current.get(spot);
    if (rect) {
      if (
        current &&
        current.x === rect.x &&
        current.y === rect.y &&
        current.width === rect.width &&
        current.height === rect.height
      ) {
        return; // identical measurement, nothing to redraw
      }
      spots.current.set(spot, rect);
    } else {
      if (!current) return;
      spots.current.delete(spot);
    }
    setVersion((v) => v + 1);
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

  // start and register are both useCallback with no changing deps, so this value is created
  // once and never again. That is the whole point — see the note on TourApi.
  const api = useMemo<TourApi>(() => ({ start, register }), [start, register]);

  // Steps whose target is actually on screen. A tab that this role does not have, or a card that
  // only exists once there is data, simply drops out rather than pointing at nothing.
  const live = useMemo(
    () => (steps ?? []).filter((s) => spots.current.has(s.spot)),
    // version, not spots.current.size: see the note where version is declared.
    [steps, version],
  );

  const step = live[index];
  const rect = step ? spots.current.get(step.spot) : undefined;

  /**
   * A tour that can find none of its targets gives up — but only after giving them a moment to
   * arrive. Closing on the first render would end every tour started before the tab bar has
   * laid itself out, which is most of them.
   */
  useEffect(() => {
    if (steps === null || live.length > 0) return;
    const grace = setTimeout(() => {
      if (spots.current.size === 0) close();
    }, 1200);
    return () => clearTimeout(grace);
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

  /*
   * Which side of the target the card goes, and how tall it may be.
   *
   * Measured rather than guessed: whichever side has more clear space wins, and the card is
   * capped at what that side actually offers. The card is then anchored GAP away from the hole
   * edge, so it cannot overlap the thing it is describing no matter how long the text is — which
   * was the whole complaint, and fair: a tutorial sitting on top of the button it is naming
   * explains nothing.
   */
  const spaceAbove = hole.y - GAP - CARD_MARGIN;
  const spaceBelow = screenH - (hole.y + hole.height) - GAP - CARD_MARGIN;
  const below = spaceBelow >= spaceAbove;
  // Floor high enough that the title, body and the Next button all survive. A card clipped
  // short enough to hide its own button is worse than one that overlaps slightly.
  const room = Math.max(below ? spaceBelow : spaceAbove, 230);
  const last = index === live.length - 1;

  // The connector: a hairline from the card's edge to the ring, aligned with the target's centre
  // so it reads as pointing AT something rather than merely sitting near it.
  const pointerX = Math.min(Math.max(hole.x + hole.width / 2, CARD_MARGIN + 14), screenW - CARD_MARGIN - 14);

  return (
    <TourContext.Provider value={api}>
      {children}
      {/*
        No statusBarTranslucent, deliberately.
        
        With it, the Modal's origin is the physical top of the screen while measureInWindow
        returns coordinates relative to the window, which on Android starts below the status bar.
        Everything was therefore drawn one status-bar-height too low: the ring sat under its
        target and the card slid down onto the tab bar it was supposed to be pointing at. Losing
        the dimmed status bar is a small price for coordinates that mean what they say.
      */}
      <Modal transparent animationType="fade" onRequestClose={close}>
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

          {/*
            The connector. A hairline from the card to the ring, with a dot where it lands, so
            the card reads as pointing at the control rather than merely appearing beside it.
          */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pointerX - 1,
              width: 2,
              backgroundColor: C.glow,
              opacity: 0.7,
              ...(below
                ? { top: hole.y + hole.height, height: GAP }
                : { top: hole.y - GAP, height: GAP }),
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pointerX - 4,
              top: (below ? hole.y + hole.height : hole.y) - 4,
              height: 8,
              width: 8,
              borderRadius: 4,
              backgroundColor: C.glow,
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: CARD_MARGIN,
              right: CARD_MARGIN,
              maxHeight: room,
              ...(below
                ? { top: hole.y + hole.height + GAP }
                : { bottom: screenH - hole.y + GAP }),
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
