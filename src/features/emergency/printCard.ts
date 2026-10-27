import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * The emergency card, as something you can hold.
 *
 * A QR on a locked phone screen answers the easy half of the problem. The hard half is the
 * person found unconscious with a flat battery, or face down, or whose phone is in the bag that
 * went in the other ambulance — and for that the card has to exist off the phone: in a wallet,
 * taped inside a helmet, on the back of a child's school ID, stuck to the fridge where a
 * paramedic will look.
 *
 * So this produces a sheet with two things on it: a wallet-sized card to cut out, and a page of
 * instructions for whoever finds it, written for somebody who has never heard of MedRekk and is
 * in a hurry.
 *
 * Both native modules are loaded lazily and checked first, the same way notifications are: a
 * build made before they were added must lose this button, not crash on the screen that holds it.
 */

const REQUIRED = ['ExpoPrint', 'ExpoSharing'] as const;

function nativeSideExists(): boolean {
  try {
    return REQUIRED.every((name) => requireOptionalNativeModule(name) != null);
  } catch {
    return false;
  }
}

type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');

let loaded: { print: PrintModule; sharing: SharingModule } | null | undefined;

/**
 * Both halves, or null.
 *
 * Checking the native side is not enough on its own, which an earlier version of this file got
 * wrong. Expo Go ships expo-print and expo-sharing, so requireOptionalNativeModule answered yes
 * while the JS failed to resolve — the packages had been installed with Metro already running,
 * so its module map was stale and `import ExponentPrint from './ExponentPrint'` blew up inside
 * the library. The buttons were offered, the press failed, and the person got "undefined is not
 * a function" for something that was never their doing.
 *
 * So the check is the real one: load it, and confirm the functions this file calls are actually
 * functions. Anything short of that is a guess about somebody else's packaging.
 */
async function modules(): Promise<{ print: PrintModule; sharing: SharingModule } | null> {
  if (loaded !== undefined) return loaded;
  if (!nativeSideExists()) {
    loaded = null;
    return loaded;
  }
  try {
    const [print, sharing] = await Promise.all([import('expo-print'), import('expo-sharing')]);
    loaded =
      typeof print.printAsync === 'function' &&
      typeof print.printToFileAsync === 'function' &&
      typeof sharing.shareAsync === 'function'
        ? { print, sharing }
        : null;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Resolves once, before any button is drawn. Null-safe on every build. */
export async function printingAvailable(): Promise<boolean> {
  return (await modules()) !== null;
}

export interface CardData {
  fullName: string;
  medrekkCode: string;
  bloodGroup?: string;
  /** Severe allergies only. Conditions deliberately do not appear here — see html() below. */
  allergies: string[];
  /** Base64 PNG of the QR, from react-native-qrcode-svg's toDataURL. */
  qrBase64?: string;
  /** Where the QR points, printed as text so the card works without a scanner. */
  url: string;
  /** The day it was printed, so a stale card can be recognised as one. */
  printedOn: string;
}

/** Nothing from a record is interpolated into HTML without this. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function list(items: string[], empty: string): string {
  if (items.length === 0) return `<span class="none">${esc(empty)}</span>`;
  return items.map((i) => `<span class="chip">${esc(i)}</span>`).join(' ');
}

/**
 * What goes on paper, and what stays behind the code.
 *
 * Printing the whole card defeats the QR. Nobody scans a square when the answer is already
 * written beside it, and the two things the scan exists for are both lost: the record stays
 * CURRENT, and every look is WRITTEN DOWN. A card printed in January that lists no allergies is
 * worse than no card at all once one is added in March — it is a confident, wrong answer that a
 * responder has no reason to doubt.
 *
 * A QR-only card fails the other way: the responder with no signal, which is the whole scenario
 * this exists for.
 *
 * So paper carries only what changes treatment in the first minute — blood group, and the
 * allergies that cause anaphylaxis. That is exactly what a medical alert bracelet has carried
 * for fifty years, and bracelets settled on it for the same reason: it must work with no
 * technology at all. Conditions, medicines and the contact number go behind the code, where they
 * stay current and where reading them leaves a trace.
 *
 * Privacy pushes the same way. A wallet is lost more often than it is used in an emergency, and
 * a list of conditions in a stranger's hands is the most sensitive and least urgent part of a
 * record.
 */
function html(card: CardData): string {
  const qr = card.qrBase64
    ? `<img class="qr" src="data:image/png;base64,${card.qrBase64}" alt="" />`
    : `<div class="qr noqr">QR unavailable<br/>use the code</div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif; color: #142D2A; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 2mm; letter-spacing: -0.01em; }
  .card { border: 1.5pt solid #142D2A; border-radius: 4mm; padding: 5mm; display: flex; gap: 5mm; align-items: flex-start; }
  .cut { font-size: 7.5pt; color: #5D6C82; margin: 0 0 2mm; letter-spacing: 0.08em; text-transform: uppercase; }
  .band { background: #CE2B2B; color: #fff; font-size: 9pt; font-weight: 700; letter-spacing: 0.12em; padding: 1.5mm 3mm; border-radius: 2mm; display: inline-block; margin-bottom: 3mm; }
  .qr { width: 32mm; height: 32mm; }
  .noqr { border: 1pt dashed #9aa; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 7pt; color: #5D6C82; }
  .name { font-size: 13pt; font-weight: 700; }
  .code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11pt; letter-spacing: 0.1em; margin-top: 1mm; }
  .row { margin-top: 2.5mm; font-size: 8.5pt; }
  .row b { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: #5D6C82; margin-bottom: 0.8mm; }
  .chip { display: inline-block; background: #F1F5F3; border-radius: 1.5mm; padding: 0.8mm 2mm; margin: 0 1mm 1mm 0; font-size: 8.5pt; }
  .none { color: #5D6C82; font-size: 8.5pt; }
  .blood { font-size: 15pt; font-weight: 700; }
  .sheet { margin-top: 9mm; border-top: 0.5pt solid #E2E8E4; padding-top: 5mm; }
  ol { margin: 0; padding-left: 5mm; font-size: 9.5pt; line-height: 1.55; }
  li { margin-bottom: 2mm; }
  .url { font-family: ui-monospace, Menlo, monospace; font-size: 8pt; word-break: break-all; color: #0F6E56; }
  .foot { margin-top: 5mm; font-size: 7.5pt; color: #5D6C82; line-height: 1.5; }
  .scan { margin-top: 2.5mm; font-size: 7.5pt; color: #0F6E56; font-weight: 600; line-height: 1.4; }
  .asof { margin-top: 1.5mm; font-size: 6.5pt; color: #5D6C82; }
</style></head>
<body>
  <p class="cut">Cut along the border · fits a wallet</p>
  <div class="card">
    ${qr}
    <div style="flex:1">
      <span class="band">MEDICAL — IN AN EMERGENCY</span>
      <div class="name">${esc(card.fullName)}</div>
      <div class="code">${esc(card.medrekkCode)}</div>
      <div class="row"><b>Blood group</b><span class="blood">${esc(card.bloodGroup ?? 'Not recorded')}</span></div>
      <div class="row"><b>Severe allergies</b>${list(card.allergies, 'None recorded')}</div>
      <div class="scan">Scan for conditions, medicines and who to call &mdash; kept up to date</div>
      <div class="asof">Printed ${esc(card.printedOn)} &middot; the two facts above are as of that date</div>
    </div>
  </div>

  <div class="sheet">
    <h1>If you found this card on someone</h1>
    <ol>
      <li><b>Call for help first.</b> This card does not replace emergency services.</li>
      <li><b>Scan the square</b> with any phone camera, or open the address below and type the code. It needs no app and no account.</li>
      <li><b>The card above carries only the two facts that change treatment immediately.</b> Scanning shows the rest — conditions, current medicines, and who to contact — and that version is always current, while paper is not.</li>
      <li><b>You will see only this person's emergency information.</b> The rest of their medical record stays private.</li>
      <li><b>Tell the clinician the code.</b> At a hospital, staff can ask the patient for fuller access once they are able to give it.</li>
    </ol>
    <p class="row"><b>Address</b><span class="url">${esc(card.url)}</span></p>
    <p class="foot">
      Every scan is recorded in the patient's own log, including the time — which is one reason to
      scan rather than rely on the print. Reprint this after your blood group or severe allergies
      change. Keep it where it will be found: a wallet, a phone case, a school bag, the fridge.
    </p>
  </div>
</body></html>`;
}

/** Opens the system print dialogue: a printer, or Save to PDF. */
export async function printCard(card: CardData): Promise<void> {
  const m = await modules();
  if (!m) throw new Error('Printing is not available in this build of the app.');
  await m.print.printAsync({ html: html(card) });
}

/**
 * Makes the PDF and hands it to the share sheet — Save to Files, send on WhatsApp, email it to
 * a relative. Realistically this is the one people use: few have a printer, and nearly everyone
 * has somebody who can print it for them.
 */
export async function shareCard(card: CardData): Promise<void> {
  const m = await modules();
  if (!m) throw new Error('Sharing is not available in this build of the app.');
  if (!(await m.sharing.isAvailableAsync())) {
    throw new Error('This phone has nowhere to send the file.');
  }

  const { uri } = await m.print.printToFileAsync({ html: html(card) });

  /*
   * Copied out of the Print directory before it is shared.
   *
   * printToFileAsync writes into a private folder the share sheet is not permitted to read —
   * "Not allowed to read file under given URL" — and the random filename it generates would
   * arrive in somebody's WhatsApp as a meaningless string of hex. Copying to the cache under a
   * name a person would recognise fixes both at once.
   */
  const FileSystem = await import('expo-file-system/legacy');
  const to = `${FileSystem.cacheDirectory}medrekk-emergency-card.pdf`;
  try {
    await FileSystem.deleteAsync(to, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to });
  } catch {
    // Could not relocate it; the original is still a valid PDF, so try sharing that.
    await m.sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    return;
  }

  await m.sharing.shareAsync(to, {
    mimeType: 'application/pdf',
    // iOS identifies the type by UTI rather than MIME, and without it the share sheet offers
    // far fewer places to send the file.
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Your emergency card',
  });
}
