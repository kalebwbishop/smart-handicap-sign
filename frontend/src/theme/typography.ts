/**
 * Smart Handicap Sign – Typography Scale
 *
 * Large, readable fonts. Accessibility-forward sizing.
 */

import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  web: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
  default: undefined, // system default on native
});

export const typography: Record<string, TextStyle> = {
  h1: {
    fontFamily,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  h4: {
    fontFamily,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  body: {
    fontFamily,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400',
  },
  bodyLarge: {
    fontFamily,
    fontSize: 19,
    lineHeight: 30,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  label: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
};
