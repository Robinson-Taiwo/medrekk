import { useEffect, useRef } from 'react';

import { useTour } from './TourProvider';
import { hasSeenTour, markTourSeen } from './tourStore';
import { PATIENT_TOUR, WORKER_TOUR } from './tours';

/** Long enough for the tab bar to lay out and register its spots before anything is highlighted. */
const SETTLE_MS = 700;

/**
 * Shows the walk round once, the first time somebody reaches the home screen.
 *
 * Marked as seen when it STARTS, not when it finishes. Somebody who skips it has decided they do
 * not want it, and somebody whose app is killed halfway through has already had the parts that
 * matter — in both cases, showing it again on the next launch would read as the app not
 * listening. "Show me around again" belongs on the profile screen, not in a loop.
 */
export function useFirstRunTour(userId: string | undefined, role: string | undefined): void {
  const { start } = useTour();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || attempted.current === userId) return;
    attempted.current = userId;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const tour = role === 'HEALTH_WORKER' ? 'worker-v1' : 'patient-v1';
        if (await hasSeenTour(userId, tour)) return;
        if (cancelled) return;
        await markTourSeen(userId, tour);
        start(tour, role === 'HEALTH_WORKER' ? WORKER_TOUR : PATIENT_TOUR);
      })();
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, role, start]);
}
