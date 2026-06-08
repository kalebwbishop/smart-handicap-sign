/**
 * Hazard Hero – Typography Scale
 *
 * Uses Montserrat across all platforms (loaded via @expo-google-fonts/montserrat).
 * SemiBold (600) for headings/emphasis, Regular (400) for body, Light (300) for contrast.
 * See DESIGN.md §3 for full hierarchy.
 */

import { Platform, TextStyle } from 'react-native';

const displayFamily = Platform.select({
  web: '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
  default: 'Montserrat_600SemiBold',
});

const textFamily = Platform.select({
  web: '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
  default: 'Montserrat_400Regular',
});

const textFamilyBold = Platform.select({
  web: '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
  default: 'Montserrat_600SemiBold',
});

export const typography: Record<string, TextStyle> = {
  /** Section Display – 48px */
  h1: {
    fontFamily: displayFamily,
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52,
    letterSpacing: -0.5,
  },
  /** Product Heading – 28px */
  h2: {
    fontFamily: displayFamily,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: 0.196,
  },
  /** Utility Heading – 24px */
  h3: {
    fontFamily: displayFamily,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  /** Subhead – 19px */
  h4: {
    fontFamily: displayFamily,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: 0.228,
  },
  /** Body Primary – 17px */
  body: {
    fontFamily: textFamily,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.374,
  },
  /** Body Large – 21px link/action heading scale */
  bodyLarge: {
    fontFamily: textFamily,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '400',
  },
  /** Body Small – 14px control label */
  bodySmall: {
    fontFamily: textFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.224,
  },
  /** Label – 12px micro UI */
  label: {
    fontFamily: textFamilyBold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: -0.12,
  },
  /** Button – 17px emphasis */
  button: {
    fontFamily: textFamilyBold,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.374,
  },
  /** Caption – 14px */
  caption: {
    fontFamily: textFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.224,
  },
  /** Caption Bold */
  captionBold: {
    fontFamily: textFamilyBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.224,
  },
  /** Small / Legal – 12px */
  small: {
    fontFamily: textFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: -0.12,
  },
};
