/**
 * The palette as plain values, for the places a className cannot reach: Feather's `color`,
 * `placeholderTextColor`, ActivityIndicator, RefreshControl tint, StatusBar.
 *
 * These are the same values tailwind.config.js defines. Before this file there were 130
 * hardcoded hex literals across 24 files, drawn from three different grey families plus a
 * stray blue, which is most of why the app read as inconsistent. Import from here instead of
 * typing a hex.
 */
export const C = {
  ink: '#142D2A',
  primary: '#0F6E56',
  primaryDeep: '#0C5A47',
  primarySoft: '#D9F0E7',
  surface: '#FFFFFF',
  canvas: '#F7F9F7',
  line: '#E2E8E4',
  /** Secondary text. Meets AA on surface, canvas and fill. */
  muted: '#5D6C82',
  /** Placeholders and other non-essential text. Clears 3:1, deliberately lighter than muted. */
  hint: '#7C8A9C',
  fill: '#F1F5F3',
  track: '#E9EEEB',
  warn: '#B45309',
  warnSoft: '#FEF3E2',
  danger: '#CE2B2B',
  dangerSoft: '#FBEAEA',
  neutralSoft: '#EEF1F4',
  /** Borders and switch tracks only — never behind text. White on dim is 1.48:1. */
  dim: '#CBD5E1',

  /* The night surface. See tailwind.config.js for why the accent is lifted here. */
  night: '#0B1A17',
  nightPanel: '#122621',
  mist: '#F2F7F4',
  mistDim: '#9FB3AB',
  mistFaint: '#7C9289',
  glow: '#2FBE8F',
  glowInk: '#06120F',
} as const;

export type ColorToken = keyof typeof C;
