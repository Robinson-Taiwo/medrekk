import type { TourStep } from './TourProvider';

/**
 * What a first-time patient is shown, in the order the app is actually used.
 *
 * Four steps, not ten. A tour is a toll on the way to the thing somebody came for, and the test
 * is not how much it explains but how much is still remembered a minute later. Everything here
 * is either non-obvious or load-bearing; anything that could be worked out by looking has been
 * left out on purpose.
 *
 * Each body says what the thing is for, not what it is called. "Record — your records" teaches
 * nobody anything.
 */
export const PATIENT_TOUR: TourStep[] = [
  {
    spot: 'tab-record',
    title: 'Everything you have is here',
    body: 'Prescriptions, test results, visits. You can add things yourself — type them, photograph the paper, or just say them out loud.',
  },
  {
    spot: 'tab-emergency',
    title: 'For when you cannot speak for yourself',
    body: 'Your blood group and critical allergies, readable by a responder without unlocking your phone. Only what you put there is visible.',
  },
  {
    spot: 'tab-explore',
    title: 'Nobody reads your record until you say yes',
    body: 'When a health worker asks, the request lands here. You see who is asking and why, you can approve less than they wanted, and access ends by itself.',
    pad: 10,
  },
  {
    spot: 'tab-index',
    title: 'It all works with no network',
    body: 'Your record is on this phone, not in the cloud. A clinic with no signal can still read it, and anything you add catches up when you are next online.',
  },
];

/**
 * The health worker's version. Shorter, because a worker is usually being shown the app by
 * somebody standing next to them, and because the consent flow is the only part that is not
 * self-evident from the screen.
 */
export const WORKER_TOUR: TourStep[] = [
  {
    spot: 'tab-worker-patient',
    title: 'Start by asking',
    body: 'Find a patient by their MedRekk code and request what you need to see. They approve it on their own phone, and you only get what they agreed to.',
  },
  {
    spot: 'tab-worker-encounter',
    title: 'Record the visit here',
    body: 'Type it, dictate it, or photograph your notes. It works with no signal and syncs when you have one.',
  },
  {
    spot: 'tab-worker-model',
    title: 'The reading happens on this phone',
    body: 'The model that reads notes runs on the handset, so nothing is sent away to be understood.',
  },
];
