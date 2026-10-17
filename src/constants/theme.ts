import { Platform } from 'react-native';

/**
 * What survives of the Expo starter's theme file.
 *
 * It used to export a light/dark `Colors` map — black backgrounds, white text, a blue link —
 * which was a second theme system living beside the NativeWind tokens in tailwind.config.js.
 * Nothing rendered it: it reached only four template components (themed-text, themed-view,
 * collapsible, hint-row) that no screen imported, and those are gone. The colours are in
 * tailwind.config.js, and tokens.ts has them as values for props that cannot take a class.
 *
 * `import '@/global.css'` lived here too, which made a stylesheet depend on a constants file
 * being imported. app/_layout.tsx imports it directly, so it is no longer needed here.
 */

/** Clears the tab bar so the last item in a scroll view is not sitting underneath it. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
