/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const COLORS = {
  bg: '#191A1F',          // main background (near-black, slightly warm)
  surface: '#22242A',     // panels / inputs
  border: '#2F3238',      // dividers & input borders

  textPrimary: '#E6E7E8', // off-white, not pure white
  textSecondary: '#A0A4AA',

  accent: '#8FAEA3',      // muted green-gray (comms / active state)
  accentStrong: '#AFC9BF',

  myMsg: '#2E3F3C',       // dark, grounded, low-signal
  theirMsg: '#2A2D33',    // neutral slate

  danger: '#B55A5A',
};

/**
 * Font families
 * These should map to installed fonts (IBM Plex, etc.)
 */
export const FONT_FAMILY = Platform.select({
  ios: {
    sans: 'IBMPlexSans-Regular',
    sansMedium: 'IBMPlexSans-Regular',
    mono: 'IBMPlexMono-Medium',
  },
  android: {
    sans: 'IBMPlexSans-Regular',
    sansMedium: 'IBMPlexSans-Regular',
    mono: 'IBMPlexMono-Medium',
  },
  web: {
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    sansMedium: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  default: {
    sans: 'sans-serif',
    sansMedium: 'sans-serif',
    mono: 'monospace',
  },
});

/**
 * Typography roles
 * These are semantic, not aesthetic.
 */
export const TYPE = {
  body: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },

  bodyStrong: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },

  title: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 32,
    lineHeight: 36,
    color: COLORS.textPrimary,
  },

  subtitle: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 20,
    lineHeight: 26,
    color: COLORS.textSecondary,
  },

  mono: {
    fontFamily: FONT_FAMILY?.mono,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
};


export const BUTTON = {
  height: 44,
  radius: 3,

  primary: {
    bg: COLORS.accent,
    bgPressed: COLORS.accentStrong,
    text: '#101412',
  },

  secondary: {
    bg: COLORS.surface,
    bgPressed: '#2A2D33',
    text: COLORS.textPrimary,
    border: COLORS.border,
  },

  danger: {
    bg: COLORS.danger,
    bgPressed: '#9E4A4A',
    text: '#1A0F0F',
  },
};

export const BUTTON_TEXT = {
  fontFamily: FONT_FAMILY?.sansMedium,
  fontSize: 15,
  letterSpacing: 0.3,
};

export const INPUT = {
  height: 42,
  radius: 2,

  bg: COLORS.surface,
  border: COLORS.border,
  borderFocus: COLORS.accent,

  text: COLORS.textPrimary,
  placeholder: COLORS.textSecondary,
};


export const INPUT_TEXT = {
  fontFamily: FONT_FAMILY?.sans,
  fontSize: 16,
};

export const CHAT = {
  radius: 3,

  mineBg: COLORS.myMsg,
  theirsBg: COLORS.theirMsg,

  text: COLORS.textPrimary,
  meta: COLORS.textSecondary,
};
