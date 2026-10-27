import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTour, type TourStep } from './TourProvider';
import { hasSeenTour, markTourSeen } from './tourStore';

/** Long enough for the screen to lay out and register its targets before anything is drawn. */
const SETTLE_MS = 650;

/**
 * The short introduction for one screen, shown the first time that screen is reached.
 *
 * Per screen rather than one tour at the start, because a walk round the whole app on first
 * launch teaches somebody five things about screens they have not seen and will not remember.
 * Arriving at the record screen and being shown, there and then, where to share it is the moment
 * the explanation is actually wanted.
 *
 * Each screen's tour is remembered separately, so finishing one does not silence the others, and
 * "Show me around again" clears them all.
 */
export function useScreenTour(tour: string, steps: TourStep[]): void {
  const { user } = useAuth();
  const { start } = useTour();
  const attempted = useRef<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    const key = userId ? `${userId}:${tour}` : null;
    if (!userId || !key || attempted.current === key) return;
    attempted.current = key;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (await hasSeenTour(userId, tour)) return;
        if (cancelled) return;
        // Marked on start, not on finish: somebody who skips has decided, and somebody whose app
        // dies halfway has already had the part that matters.
        await markTourSeen(userId, tour);
        start(tour, steps);
      })();
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, tour, steps, start]);
}
