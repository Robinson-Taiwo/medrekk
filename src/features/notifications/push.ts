import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { api } from '@/services/api';
import { C } from '@/components/design/tokens';

/**
 * Being told your record was asked for, while the app is closed.
 *
 * An access request is open for a few minutes. Without this the only way a patient learned of
 * one was by opening the app and looking, so the clinician had to say "check your phone" —
 * fine in a demo, useless in a clinic.
 *
 * Nothing here is imported at module scope. expo-notifications reaches for native modules the
 * moment it loads, and on a build made before it was added that throws during import — which
 * does not fail politely, it takes the router down with it and the app shows a red screen
 * about ErrorBoundary instead of anything to do with notifications. Loading it lazily, inside
 * a try, means an older build simply has no notifications and works in every other respect.
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;
let registered: string | null = null;
let handlerSet = false;

/**
 * Native modules expo-notifications resolves while its own index is being evaluated — before
 * any function of ours runs. Its index re-exports `topicSubscription`, which does
 * `requireNativeModule('ExpoTopicSubscriptionModule')` at module scope and throws outright
 * when the native side is absent.
 *
 * Catching the import is not enough on its own, because a bundler is free to evaluate a
 * module earlier than the await that asked for it. Asking first, through the one API that
 * returns null instead of throwing, means a build without notifications never loads the
 * package at all.
 */
const REQUIRED = ['ExpoTopicSubscriptionModule', 'ExpoPushTokenManager', 'ExpoNotificationsEmitter'] as const;

function nativeSideExists(): boolean {
  try {
    return REQUIRED.every((name) => requireOptionalNativeModule(name) != null);
  } catch {
    return false;
  }
}

/** The module, or null on a build whose native side does not have it. */
async function notifications(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached;
  if (!nativeSideExists()) {
    cached = null;
    return cached;
  }
  try {
    cached = await import('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

/** Heads-up banners while the app is open, so a request is not missed mid-conversation. */
function ensureHandler(N: NotificationsModule): void {
  if (handlerSet) return;
  handlerSet = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Android shows nothing at all without a channel, and silently — no error, no notification.
 * Created before any token is requested.
 */
async function ensureAndroidChannel(N: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync('access', {
    name: 'Access requests',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: C.primary,
  });
}

/**
 * The Expo project this build belongs to. getExpoPushTokenAsync cannot mint a token without
 * it, and the failure reads as a generic error rather than a missing id.
 */
async function projectId(): Promise<string | undefined> {
  try {
    const Constants = (await import('expo-constants')).default;
    const extra = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
    return extra?.projectId ?? (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  } catch {
    return undefined;
  }
}

/** Whether this build can receive notifications at all. */
export async function pushAvailable(): Promise<boolean> {
  return (await notifications()) !== null;
}

/**
 * Asks once, then tells the server about this handset.
 *
 * Permission is requested here rather than at sign-up because the reason is only legible once
 * somebody has a record: a prompt on the first screen of an app you have not used yet is the
 * kind people decline out of hand.
 */
export async function registerForPush(): Promise<void> {
  try {
    const N = await notifications();
    if (!N) return;

    const Device = await import('expo-device');
    if (!Device.isDevice) return; // simulators cannot receive push at all

    ensureHandler(N);
    await ensureAndroidChannel(N);

    const existing = await N.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const id = await projectId();
    const { data: token } = await N.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    if (!token || token === registered) return;

    await api('/auth/me/push-token', { method: 'POST', body: { token } });
    registered = token;
  } catch {
    // No notifications on this handset. The app is unchanged otherwise.
  }
}

/**
 * Hands the token back on sign-out. Without this the next notification for that account would
 * land on a phone somebody else is now holding — the same mistake as leaving an access grant
 * on a shared handset.
 */
export async function unregisterForPush(): Promise<void> {
  const token = registered;
  registered = null;
  if (!token) return;
  try {
    await api('/auth/me/push-token', { method: 'DELETE', body: { token } });
  } catch {
    // Offline. The server drops tokens Expo reports as dead anyway.
  }
}

/** Typed to the literal routes, because expo-router's typed routes reject a bare string. */
export function routeFor(kind: string | undefined): '/patient/access' | '/worker-patient' | null {
  switch (kind) {
    case 'ACCESS_REQUEST':
      return '/patient/access';
    case 'ACCESS_APPROVED':
    case 'ACCESS_DENIED':
    case 'ACCESS_REVOKED':
      return '/worker-patient';
    default:
      return null;
  }
}

/**
 * A tapped notification should land on the thing it was about, not on whatever screen the app
 * happened to be showing. Covers both paths: a tap that opened the app from cold, and one
 * that arrived while it was already running.
 *
 * Returns a teardown. Kept here rather than in the layout so the layout never imports
 * expo-notifications itself, which is what made a missing native module fatal.
 */
export function attachNotificationTaps(go: (to: '/patient/access' | '/worker-patient') => void): () => void {
  let cancelled = false;
  let detach: (() => void) | undefined;

  void (async () => {
    const N = await notifications();
    if (!N || cancelled) return;

    const routeOf = (data: unknown): '/patient/access' | '/worker-patient' | null => {
      const kind = (data as { kind?: unknown } | undefined)?.kind;
      return routeFor(typeof kind === 'string' ? kind : undefined);
    };

    try {
      const opened = await N.getLastNotificationResponseAsync();
      const to = routeOf(opened?.notification.request.content.data);
      if (to && !cancelled) go(to);
    } catch {
      // Nothing opened the app. Normal.
    }

    const sub = N.addNotificationResponseReceivedListener((response) => {
      const to = routeOf(response.notification.request.content.data);
      if (to) go(to);
    });
    detach = () => sub.remove();
  })();

  return () => {
    cancelled = true;
    detach?.();
  };
}
